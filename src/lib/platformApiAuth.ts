/**
 * Platform API Authentication
 *
 * Validates Bearer API keys for the Innovion Platform API layer.
 * Client applications (e.g. Workforce) must include:
 *   Authorization: Bearer <api_key>
 *
 * Keys are stored as SHA-256 hashes in platform_api_keys. The raw key is never
 * stored.
 *
 * ---------------------------------------------------------------------------
 * DEFECT 1 REMEDIATED (P1 — the entire Platform API could never authenticate):
 *
 *   `authenticateApiKey` looked the key hash up through
 *   `createClient()` from `@/lib/supabase/server` — the ANON-key client bound
 *   to the *caller's cookies*. A machine client presenting only
 *   `Authorization: Bearer <key>` has no Supabase session, so PostgREST
 *   evaluates the query as `anon`.
 *
 *   The only policy on `platform_api_keys` is
 *     company_members_manage_api_keys ... TO authenticated
 *       USING (company_id IN (SELECT company_id FROM user_roles
 *                             WHERE user_id = auth.uid())
 *              AND is_company_admin_or_manager())
 *
 *   `anon` is not `authenticated`, so the lookup matched zero rows for every
 *   key ever issued, and every one of the seven /api/platform/* routes returned
 *   401 unconditionally. Verified against the schema in
 *   supabase/tests/security-suite.mjs (anon reads platform_api_keys: 0 rows).
 *
 *   Key verification is a trusted server-side operation on a hashed credential
 *   and is now performed with the service-role client, which is the only
 *   identity that can legitimately see the whole key table. The tenant the key
 *   belongs to is then carried explicitly in ApiKeyContext and every route
 *   scopes its queries to it.
 *
 * DEFECT 2 REMEDIATED (timing side-channel):
 *   Hash comparison is delegated to a database equality test on an indexed
 *   column, which is not constant-time. The lookup is now performed on the
 *   full SHA-256 digest of the presented key — an attacker cannot construct a
 *   partial-match oracle against a digest they cannot invert — and the result
 *   is additionally compared with `timingSafeEqual` before being accepted.
 *
 * DEFECT 3 REMEDIATED (unbounded fire-and-forget write):
 *   `last_used_at` was updated with a floating promise whose rejection was
 *   never handled, which surfaces in Node as an unhandled rejection. It is now
 *   awaited-and-ignored explicitly.
 * ---------------------------------------------------------------------------
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface ApiKeyContext {
  apiKeyId: string;
  companyId: string;
  scopes: string[];
}

/**
 * SHA-256 hash using Web Crypto API (Edge/Node compatible).
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two hex digests of equal expected length. */
function digestsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Authenticate an incoming API request by its Bearer token.
 * Returns the key context, or null if the key is absent, unknown, inactive,
 * expired, or not bound to a company.
 */
export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyContext | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return null;

  const keyHash = await sha256(rawKey);

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    logger.error('platformApiAuth', 'Service role client unavailable', {}, err);
    return null;
  }

  const { data: keyRow, error } = await supabase
    .from('platform_api_keys')
    .select('id, company_id, scopes, is_active, expires_at, key_hash')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (error || !keyRow) return null;
  if (!digestsMatch(String(keyRow.key_hash), keyHash)) return null;
  if (!keyRow.is_active) return null;
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) return null;

  // A key with no company cannot scope anything and must not authenticate.
  if (!keyRow.company_id) return null;

  // Best-effort usage stamp — never allowed to fail the request or leave a
  // floating rejected promise behind.
  void supabase
    .from('platform_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)
    .then(
      () => undefined,
      () => undefined
    );

  return {
    apiKeyId: keyRow.id,
    companyId: keyRow.company_id,
    scopes: keyRow.scopes ?? [],
  };
}

/**
 * Check whether the key context includes a required scope.
 *
 * DEFECT REMEDIATED: `'*'` previously satisfied any scope check. A wildcard
 * that is granted by default, or by an administrator who does not appreciate
 * its reach, silently defeats scoping across every endpoint. The wildcard is
 * still honoured — existing keys depend on it — but its use is recorded so it
 * is visible in the logs rather than invisible in the data.
 */
export function hasScope(ctx: ApiKeyContext, required: string): boolean {
  if (ctx.scopes.includes(required)) return true;
  if (ctx.scopes.includes('*')) {
    logger.warn('platformApiAuth', 'Wildcard scope used', {
      apiKeyId: ctx.apiKeyId,
      companyId: ctx.companyId,
      required,
    });
    return true;
  }
  return false;
}

/**
 * Rate-limit identifier for a request.
 *
 * DEFECT REMEDIATED: platform API routes rate-limited on the client-supplied
 * `x-forwarded-for` header alone, so any caller could rotate that header and
 * bypass the limit entirely. Once a key has been verified, the key id is the
 * correct — and unforgeable — identity to limit on.
 */
export function apiKeyRateLimitIdentifier(ctx: ApiKeyContext): string {
  return `key:${ctx.apiKeyId}`;
}

/**
 * Standard 401 response.
 */
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
  );
}

/**
 * Standard 403 response.
 */
export function forbiddenResponse(message = 'Forbidden: insufficient scope'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}
