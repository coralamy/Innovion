import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client bound to the request's cookies.
 *
 * Runs as the SIGNED-IN USER, so every Row Level Security policy applies. For
 * trusted operations that must bypass RLS — Platform API key verification,
 * OAuth credential persistence, webhook ingestion — use
 * `createAdminClient()` from `@/lib/supabase/admin` instead, and scope every
 * query to a tenant you have independently established.
 *
 * DEFECT REMEDIATED (P1 — CSRF exposure): session cookies were written with
 *   sameSite: 'none', secure: true
 * unconditionally, which tells the browser to send the session on cross-site
 * requests. This now mirrors the browser client: `lax` by default, `none` only
 * when the application is explicitly configured as cross-origin embedded.
 * See src/lib/supabase/client.ts for the full analysis.
 */
const EMBEDDED_MODE = process.env.NEXT_PUBLIC_EMBEDDED_MODE === 'true';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              // NOTE: httpOnly is deliberately NOT forced here. The browser
              // client in src/lib/supabase/client.ts reads the session from
              // `document.cookie`; marking it httpOnly server-side would make
              // the session invisible to the client and produce a sign-in loop.
              // Moving the session to httpOnly cookies is a worthwhile
              // hardening step but requires the browser client to stop reading
              // cookies directly — recorded as follow-up, not silently half-done.
              cookieStore.set(name, value, {
                ...options,
                sameSite: EMBEDDED_MODE ? 'none' : 'lax',
                secure: process.env.NODE_ENV === 'production' || EMBEDDED_MODE,
              })
            );
          } catch {
            // Server Component read-only context — expected
          }
        },
      },
    }
  );
}
