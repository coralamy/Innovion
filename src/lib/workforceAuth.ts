import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import {
  checkRateLimit,
  getRequestIdentifier,
  RATE_LIMIT_CONFIGS,
  rateLimitExceededResponse,
  type RateLimitResult,
} from '@/lib/rateLimit';

/**
 * Workforce (mobile client) authentication — resolution of DEP-1.
 *
 * ===========================================================================
 * THE BLOCKER
 *
 * Team B reported DEP-1: the Innovion Workforce client could not authenticate
 * to the Platform API. The Platform API accepts only a `platform_api_keys`
 * Bearer key — a COMPANY-SCOPED, SERVER-TO-SERVER credential, SHA-256 hashed
 * at rest, carrying `platform-config:read` for an entire organisation.
 *
 * Team B correctly refused to ship one. A key compiled into a mobile binary is
 * extractable from the APK by anyone who holds it — `strings` on the shared
 * object is usually enough — and the extracted key then authorises that
 * company's whole configuration read, from any device, indefinitely, with no
 * per-user attribution and no revocation short of rotating the key for every
 * installed copy of the app simultaneously. Team B left the integration inert
 * rather than embed one, which was the right call.
 *
 * ===========================================================================
 * THE RESOLUTION, AND WHY IT IS BETTER THAN THE ALTERNATIVE
 *
 * Team B's own report offered Team A two options: a user-JWT-authenticated
 * workforce endpoint, or per-device scoped revocable keys. This implements the
 * first, because the evidence favours it decisively:
 *
 *   * NOTHING SECRET IS EMBEDDED. Per-device keys still require the app to
 *     obtain a first credential, which is the same problem one step removed.
 *     A user JWT is issued by Supabase to a user who has already proved who
 *     they are; the binary carries nothing.
 *   * THE CREDENTIAL ALREADY EXISTS AND IS ALREADY GOVERNED. The Workforce app
 *     holds a Supabase session to reach its own data. Rotation, expiry and
 *     refresh are GoTrue's, already implemented, already tested. A second
 *     credential system would be a second thing to get wrong.
 *   * REVOCATION IS REAL. Signing the user out, disabling the account or
 *     revoking the refresh token ends access immediately, per user, per
 *     device. Revoking a shared company key breaks every device at once, so in
 *     practice it never happens.
 *   * BLAST RADIUS IS ONE USER, NOT ONE COMPANY. A stolen session grants
 *     exactly what that user already had. A stolen company key grants the
 *     organisation.
 *   * THE TENANT IS DERIVED, NOT ASSERTED. The company comes from the verified
 *     `sub` resolved against authoritative membership — not from a key that
 *     encodes a company, and never from `user_metadata`.
 *
 * The token is verified SERVER-SIDE against the auth server on every request
 * (`auth.getUser(token)`), so a forged or tampered JWT is rejected. It is never
 * merely decoded.
 *
 * ===========================================================================
 * DEP-4 NOTE
 *
 * Team B observed that sending a Supabase session token to the Platform origin
 * was a disclosure to infrastructure outside the production boundary, because
 * `INNOVION_PLATFORM_URL` is currently a preview host. That objection is about
 * the ORIGIN, not the mechanism, and it stands: this endpoint must only ever be
 * called on the production Innovion origin. Recorded in the integration report
 * as a Founder action.
 * ===========================================================================
 */

export interface WorkforcePrincipal {
  userId: string;
  email: string | null;
  companyId: string;
  /** 'staff' when the caller holds a user_roles row; 'contractor' otherwise. */
  principalType: 'staff' | 'contractor';
  /** The authoritative role for a staff caller; null for a contractor. */
  role: string | null;
}

export type WorkforceGuardResult =
  | { ok: true; principal: WorkforcePrincipal; rate: RateLimitResult }
  | { ok: false; response: NextResponse };

function unauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
  );
}

/**
 * Authenticate a Workforce request by its Supabase user JWT and resolve the
 * caller's tenant authoritatively.
 *
 * Mirrors the database resolver `public.get_my_company_id()` exactly:
 *   1. `user_roles` membership (Platform staff), then
 *   2. `contractors` linkage — explicit `user_id`, or a CONFIRMED e-mail match
 *      (an unconfirmed address must never be a tenant selector), then
 *   3. company ownership.
 * `user_metadata.company_id` may SELECT among tenants the caller genuinely
 * belongs to; it can never introduce one.
 */
export async function authenticateWorkforceRequest(
  req: NextRequest
): Promise<WorkforceGuardResult> {
  // Coarse pre-authentication limit on network identity. Spoofable, and only
  // guards the unauthenticated path; the real limit is keyed on the verified
  // user below.
  const preAuth = checkRateLimit(
    `workforce-unauth:${getRequestIdentifier(req)}`,
    RATE_LIMIT_CONFIGS.platformApiUnauthenticated
  );
  if (!preAuth.success) {
    return { ok: false, response: rateLimitExceededResponse(preAuth) as NextResponse };
  }

  const header = req.headers.get('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) return { ok: false, response: unauthorized() };

  const token = header.slice(7).trim();
  if (!token) return { ok: false, response: unauthorized() };

  let db;
  try {
    db = createAdminClient();
  } catch (err) {
    logger.error('workforceAuth', 'Service role client unavailable', {}, err);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Server misconfigured' }, { status: 503 }),
    };
  }

  // Verified against the auth server. Not decoded, not trusted.
  const { data, error } = await db.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return { ok: false, response: unauthorized() };

  const rate = checkRateLimit(`workforce:${user.id}`, RATE_LIMIT_CONFIGS.platformApi);
  if (!rate.success) {
    return { ok: false, response: rateLimitExceededResponse(rate) as NextResponse };
  }

  // ── Authoritative tenant resolution ──────────────────────────────────────
  const authorised: Array<{
    companyId: string;
    type: 'staff' | 'contractor';
    role: string | null;
  }> = [];

  const { data: roles } = await db
    .from('user_roles')
    .select('company_id, role, created_at')
    .eq('user_id', user.id)
    .not('company_id', 'is', null)
    .order('created_at', { ascending: true });

  for (const r of roles ?? []) {
    authorised.push({ companyId: r.company_id as string, type: 'staff', role: r.role as string });
  }

  const { data: linkedContractors } = await db
    .from('contractors')
    .select('company_id')
    .eq('user_id', user.id)
    .not('company_id', 'is', null);

  for (const c of linkedContractors ?? []) {
    authorised.push({ companyId: c.company_id as string, type: 'contractor', role: null });
  }

  // Confirmed-e-mail linkage, for contractors invited before they had an
  // account. `email_confirmed_at` is checked because the address in the token
  // is present whether or not it was ever verified.
  if (user.email && user.email_confirmed_at) {
    const { data: byEmail } = await db
      .from('contractors')
      .select('company_id')
      .is('user_id', null)
      .ilike('email', user.email)
      .not('company_id', 'is', null);

    for (const c of byEmail ?? []) {
      authorised.push({ companyId: c.company_id as string, type: 'contractor', role: null });
    }
  }

  if (authorised.length === 0) {
    const { data: owned } = await db
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });
    for (const c of owned ?? []) {
      authorised.push({ companyId: c.id as string, type: 'staff', role: 'admin' });
    }
  }

  if (authorised.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No organisation is associated with this account', code: 'NO_TENANT' },
        { status: 403 }
      ),
    };
  }

  // A selector, never an authority.
  const requested = req.nextUrl.searchParams.get('company_id');
  const chosen = requested
    ? (authorised.find((a) => a.companyId === requested) ?? null)
    : authorised[0];

  if (!chosen) {
    // The caller named a tenant they do not belong to. Refuse rather than
    // quietly serving a different one.
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    rate,
    principal: {
      userId: user.id,
      email: user.email ?? null,
      companyId: chosen.companyId,
      principalType: chosen.type,
      role: chosen.role,
    },
  };
}
