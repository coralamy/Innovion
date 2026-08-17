import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Integrity-protected OAuth state.
 *
 * ---------------------------------------------------------------------------
 * DEFECT REMEDIATED (P0 — cross-tenant write / account grafting via a forged
 * state cookie):
 *
 *   The authorize route serialised the OAuth state as PLAIN JSON into a cookie:
 *
 *     response.cookies.set(`oauth_state_${provider}`, JSON.stringify({
 *       state, codeVerifier, companyId, userId, provider, returnTo,
 *       acquisitionSource, createdAt,
 *     }), { httpOnly: true, ... })
 *
 *   and the callback route trusted its entire contents:
 *
 *     storedState = JSON.parse(storedStateCookie);
 *     if (storedState.state !== stateParam) ...   // both attacker-chosen
 *     ... upsert({ company_id: storedState.companyId, ... })
 *
 *   `httpOnly` prevents *page JavaScript* from reading the cookie. It does not
 *   prevent an attacker from SENDING one: a `Cookie:` header is just a request
 *   header, set freely by curl, by any HTTP client, or by any code able to
 *   write a cookie on the site's domain (including a sibling subdomain). The
 *   attacker therefore chose `state` AND the value it was compared against, so
 *   the CSRF check compared two values they controlled and always passed —
 *   and, critically, chose `companyId`, binding their own provider account to
 *   any tenant they named, or overwriting that tenant's stored credentials.
 *
 *   The state is now signed with HMAC-SHA256 over the exact serialised payload.
 *   A cookie that was not minted by this server is rejected before it is
 *   parsed, and the comparison is constant-time.
 *
 * DEFECT 2 REMEDIATED (unbounded state lifetime):
 *   `createdAt` was written into the payload and never checked. The cookie's
 *   own `maxAge` was the only expiry, and a cookie's expiry is enforced by the
 *   *client*. The signed payload now carries an issue time that the server
 *   verifies.
 * ---------------------------------------------------------------------------
 */

export interface OAuthStatePayload {
  state: string;
  codeVerifier?: string;
  companyId: string;
  userId: string;
  provider: string;
  returnTo: string;
  acquisitionSource: string;
  createdAt: number;
}

/** OAuth flows are short; anything older than this is refused. */
export const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

function stateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'OAUTH_STATE_SECRET is not configured, or is shorter than 32 characters. ' +
        'It signs the OAuth state cookie; without it the provider callback cannot ' +
        'distinguish a state this server issued from one an attacker supplied. ' +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
    );
  }
  return secret;
}

export function newStateToken(): string {
  return randomBytes(32).toString('hex');
}

export function signState(payload: OAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const mac = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export type StateVerification =
  | { ok: true; payload: OAuthStatePayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function verifyState(cookieValue: string | undefined, now: number): StateVerification {
  if (!cookieValue) return { ok: false, reason: 'malformed' };

  const dot = cookieValue.lastIndexOf('.');
  if (dot <= 0) return { ok: false, reason: 'malformed' };

  const body = cookieValue.slice(0, dot);
  const presented = cookieValue.slice(dot + 1);

  const expected = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    typeof payload?.state !== 'string' ||
    typeof payload?.companyId !== 'string' ||
    typeof payload?.userId !== 'string' ||
    typeof payload?.provider !== 'string' ||
    typeof payload?.createdAt !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  if (now - payload.createdAt > OAUTH_STATE_MAX_AGE_MS) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, payload };
}

/**
 * Reduce a caller-supplied `return_to` to a safe same-origin path.
 *
 * DEFECT REMEDIATED (open redirect):
 *   `return_to` was taken verbatim from the query string, stored in the state
 *   cookie, and then used as
 *       NextResponse.redirect(new URL(`${storedState.returnTo}?oauth_success=…`,
 *                                     request.url))
 *   `new URL()` with an absolute first argument DISCARDS the base, so
 *       /api/integrations/oauth/xero/authorize?return_to=https://evil.example
 *   produced a redirect to `https://evil.example` — carried out by the
 *   application's own domain at the end of a trusted OAuth flow, which is
 *   precisely the context in which a user will not question it. A
 *   protocol-relative value (`//evil.example`) had the same effect.
 *
 *   Anything that is not a single-slash-prefixed local path is discarded.
 */
export function safeReturnTo(
  candidate: string | null | undefined,
  fallback = '/settings/integrations'
): string {
  if (!candidate) return fallback;
  // Must start with exactly one '/', and must not begin a scheme or an
  // authority. Backslashes are rejected: some clients normalise them to '/'.
  if (!candidate.startsWith('/')) return fallback;
  if (candidate.startsWith('//')) return fallback;
  if (candidate.includes('\\')) return fallback;
  if (candidate.includes('://')) return fallback;
  return candidate;
}
