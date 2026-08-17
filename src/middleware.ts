/**
 * Server-side route protection.
 *
 * ---------------------------------------------------------------------------
 * DEFECT REMEDIATED (P1 — every authenticated page was reachable without a
 * session):
 *
 *   The application had NO middleware at all. Access control for every
 *   protected page was performed exclusively in the browser, by
 *   `src/components/AppLayout.tsx`:
 *
 *       useEffect(() => { if (!user) router.replace('/sign-up-login'); })
 *
 *   That runs *after* the server has already rendered and shipped the route to
 *   the client. Consequences, all reproducible with curl:
 *     • Every protected route returned HTTP 200 with its full markup to an
 *       unauthenticated request.
 *     • Disabling JavaScript, or simply reading the response body, defeated the
 *       redirect entirely.
 *     • The redirect is cosmetic: it changes the URL, it does not withhold the
 *       response.
 *
 *   Data itself was still protected by RLS at the database, so this was not by
 *   itself a data breach — but the application shell, route inventory, and any
 *   server-rendered content were exposed, and defence in depth requires the
 *   request to be refused before it is served.
 *
 * This middleware also performs the Supabase session refresh that an App Router
 * application requires: without it, an expired access token is never rotated on
 * the server and Server Components observe a signed-out user while the browser
 * still believes it is signed in.
 * ---------------------------------------------------------------------------
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Routes served to anyone, signed in or not. */
const PUBLIC_PREFIXES = [
  '/marketing',
  '/sign-up-login',
  '/accept-invite',
  '/reset-password',
  '/auth/callback',
];

/**
 * API routes that authenticate themselves and must NOT be gated on a browser
 * session:
 *   /api/platform/*              — Bearer platform API key (see platformApiAuth)
 *   /api/integrations/webhooks/* — provider HMAC signature, no user present
 *   /api/workforce/*             — Bearer Supabase user JWT (see workforceAuth)
 *
 * DEFECT INTRODUCED BY THIS MIDDLEWARE AND FIXED HERE:
 *   `/api/workforce/*` was missing from this list. The Innovion Workforce
 *   mobile client authenticates with `Authorization: Bearer <access token>` and
 *   sends NO cookies — it is not a browser and holds no cookie jar for this
 *   origin. The middleware looked for a session cookie, found none, and
 *   returned its own 401 before the route ran, so
 *   `authenticateWorkforceRequest()` never executed and the DEP-1 endpoint
 *   could not have worked for the one client it exists to serve.
 *
 *   Found by probing the running build: the 401 carried neither the
 *   `WWW-Authenticate: Bearer` header nor the `Cache-Control: private,
 *   no-store` that the route sets, which is what revealed the response was not
 *   coming from the route at all.
 *
 *   Listing the prefix here weakens nothing. Every route beneath it verifies
 *   its bearer token against the auth server and resolves the tenant from
 *   authoritative membership; none of them trusts a cookie.
 */
const SELF_AUTHENTICATING_API_PREFIXES = [
  '/api/platform',
  '/api/integrations/webhooks',
  '/api/workforce',
];

/** Signed-in users have no reason to see these; send them to the product. */
const AUTH_ONLY_PREFIXES = ['/sign-up-login'];

const isUnder = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let self-authenticating machine endpoints through untouched. They must not
  // be redirected to an HTML sign-in page — a machine client needs a 401.
  if (isUnder(pathname, SELF_AUTHENTICATING_API_PREFIXES)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser(), NOT getSession(): getSession() decodes whatever JWT is in the
  // cookie without contacting the auth server, so a forged or tampered token
  // would be accepted here. getUser() validates it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = pathname === '/' || isUnder(pathname, PUBLIC_PREFIXES);

  if (!user && !isPublic) {
    /**
     * DEFECT INTRODUCED BY THIS MIDDLEWARE AND FIXED HERE:
     *   the first version redirected EVERY unauthenticated request, including
     *   session-authenticated JSON APIs such as /api/dashboard/summary.
     *   `fetch()` follows a 307 transparently, so the browser client received
     *   200 OK with the sign-in page's HTML and then failed inside
     *   `response.json()` with a SyntaxError — an authentication failure
     *   presenting as a parse error, with no way for the caller to distinguish
     *   "signed out" from "server broken".
     *   Verified against the running build: /api/dashboard/summary returned
     *   `307 → /sign-up-login`. An API must answer 401.
     */
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/sign-up-login';
    url.search = '';
    // Preserve the intended destination so the user lands where they meant to.
    // Only ever a same-origin path — never an absolute URL, which would make
    // this an open redirect.
    if (pathname !== '/sign-up-login') {
      url.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(url);
  }

  if (user && isUnder(pathname, AUTH_ONLY_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /**
     * Everything except Next.js internals and static assets. Listing the
     * exclusions (rather than enumerating protected routes) means a newly added
     * page is protected by default — the safe direction to fail.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)',
  ],
};
