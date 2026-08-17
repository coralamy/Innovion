'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client.
 *
 * ---------------------------------------------------------------------------
 * DEFECT 1 REMEDIATED (P1 — CSRF exposure of the session cookie):
 *   Session cookies were written unconditionally with
 *       SameSite=None; Secure; Partitioned
 *   `SameSite=None` instructs the browser to attach the cookie to CROSS-SITE
 *   requests. The Supabase auth cookie is the session, so any third-party page
 *   could cause an authenticated request to be issued on the user's behalf.
 *   `SameSite=Lax` — the modern default — is now used, and `None` is available
 *   only when NEXT_PUBLIC_EMBEDDED_MODE is explicitly set, which is required
 *   when the application is genuinely embedded in a cross-origin iframe.
 *
 *   *** BEHAVIOUR CHANGE REQUIRING FOUNDER CONFIRMATION ***
 *   If Innovion is embedded in an iframe on another origin (the previous
 *   `Partitioned` attribute suggests it may have been, in a preview host), set
 *   NEXT_PUBLIC_EMBEDDED_MODE=true to restore the old behaviour. Flagged in the
 *   Team A completion report rather than changed silently.
 *
 * DEFECT 2 REMEDIATED (P1 — session tokens in localStorage):
 *   When cookies were unavailable the client stored the full auth token — the
 *   access token AND the refresh token — in `localStorage`, which is readable
 *   by any script running on the origin. A single XSS then yields a refresh
 *   token, i.e. durable account takeover that survives password change. The
 *   fallback is retained ONLY under the same explicit embedded-mode flag,
 *   because in a partitioned third-party context there is no alternative, and
 *   it is off by default.
 *
 * DEFECT 3 REMEDIATED (P1 — global fetch monkey-patch leaking the session):
 *   The module replaced `window.fetch` for the whole application and attached
 *       x-sb-token: <full auth token>
 *   to EVERY same-origin request, including requests to routes that have no
 *   business seeing it, and wrote it into any logging or tracing that captures
 *   request headers. Nothing in this codebase reads `x-sb-token`. Removed.
 * ---------------------------------------------------------------------------
 */

const PFX = 'sb_';

/**
 * Cross-origin embedding must be opted into explicitly. Default posture is a
 * first-party application with SameSite=Lax cookies.
 */
const EMBEDDED_MODE = process.env.NEXT_PUBLIC_EMBEDDED_MODE === 'true';

const sameSiteAttributes = EMBEDDED_MODE
  ? 'SameSite=None; Secure; Partitioned'
  : 'SameSite=Lax; Secure';

const canUseCookies = (() => {
  let cache: boolean | null = null;
  return () => {
    if (typeof document === 'undefined') return false;
    if (cache !== null) return cache;
    const k = '__sb_test__';
    document.cookie = `${k}=1; Path=/; ${sameSiteAttributes}`;
    cache = document.cookie.includes(k);
    document.cookie = `${k}=; Path=/; Max-Age=0; ${sameSiteAttributes}`;
    return cache;
  };
})();

const fromCookies = () =>
  typeof document === 'undefined'
    ? []
    : document.cookie
        .split(';')
        .filter(Boolean)
        .map((c) => {
          const eqIdx = c.trim().indexOf('=');
          const name = eqIdx >= 0 ? c.trim().slice(0, eqIdx) : c.trim();
          const value = eqIdx >= 0 ? decodeURIComponent(c.trim().slice(eqIdx + 1)) : '';
          return { name: name.trim(), value };
        })
        .filter((c) => c.name);

const fromStorage = () => {
  if (!EMBEDDED_MODE) return [];
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PFX))
      .map((k) => ({ name: k.slice(PFX.length), value: localStorage.getItem(k) || '' }));
  } catch {
    return [];
  }
};

interface CookieOptions {
  path?: string;
  maxAge?: number;
  domain?: string;
  expires?: number | string | Date;
}

const setCookie = (name: string, value: string, options?: CookieOptions) => {
  let s = `${name}=${encodeURIComponent(value)}; Path=${options?.path || '/'}; ${sameSiteAttributes}`;
  if (options?.maxAge) s += `; Max-Age=${options.maxAge}`;
  if (options?.domain) s += `; Domain=${options.domain}`;
  if (options?.expires) s += `; Expires=${new Date(options.expires).toUTCString()}`;
  document.cookie = s;
};

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const domains = ['', host, host ? `.${host}` : ''].filter(Boolean);
  const variants = [
    'Path=/; SameSite=Lax',
    'Path=/; SameSite=Lax; Secure',
    'Path=/; SameSite=None; Secure',
    'Path=/; SameSite=None; Secure; Partitioned',
  ];
  variants.forEach((attrs) => {
    document.cookie = `${name}=; Max-Age=0; ${attrs}`;
    domains.forEach((domain) => {
      document.cookie = `${name}=; Max-Age=0; Domain=${domain}; ${attrs}`;
    });
  });
};

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => (canUseCookies() ? fromCookies() : fromStorage()),
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return;

          if (canUseCookies()) {
            cookiesToSet.forEach(({ name, value, options }) =>
              value ? setCookie(name, value, options) : deleteCookie(name)
            );
            return;
          }

          if (!EMBEDDED_MODE) {
            // Cookies are unavailable and localStorage is not an authorised
            // fallback. Fail visibly rather than silently persisting the
            // session somewhere an attacker can read it.
            console.error(
              '[supabase] Cookies are blocked and NEXT_PUBLIC_EMBEDDED_MODE is not enabled, ' +
                'so the session cannot be persisted. Enable third-party cookies, or set ' +
                'NEXT_PUBLIC_EMBEDDED_MODE=true if this application is deliberately embedded ' +
                'in a cross-origin iframe.'
            );
            return;
          }

          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              if (value) {
                localStorage.setItem(`${PFX}${name}`, value);
              } else {
                localStorage.removeItem(`${PFX}${name}`);
              }
            } catch (err) {
              console.warn('[supabase] Unable to persist session to localStorage', err);
            }
            if (value) setCookie(name, value, options);
          });
        },
      },
    }
  );
}
