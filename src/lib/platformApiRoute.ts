import 'server-only';

import type { NextRequest } from 'next/server';
import {
  authenticateApiKey,
  hasScope,
  unauthorizedResponse,
  forbiddenResponse,
  apiKeyRateLimitIdentifier,
  type ApiKeyContext,
} from '@/lib/platformApiAuth';
import {
  checkRateLimit,
  getRequestIdentifier,
  RATE_LIMIT_CONFIGS,
  rateLimitExceededResponse,
  type RateLimitResult,
} from '@/lib/rateLimit';

/**
 * The single authentication/authorisation/rate-limit gate for every
 * /api/platform/* route.
 *
 * ---------------------------------------------------------------------------
 * DEFECTS REMEDIATED
 *
 * 1. INCONSISTENT PROTECTION. Of the seven platform routes, only four applied
 *    rate limiting at all: `country-config` and `translations` had none, and
 *    `country-config`'s HEAD handler authenticated but did not rate limit. A
 *    control that is applied to some endpoints is not a control; an attacker
 *    picks the unprotected one.
 *
 * 2. FORGEABLE RATE-LIMIT IDENTITY. Every route limited on
 *    `getRequestIdentifier(req)`, which returns the first entry of the
 *    client-supplied `X-Forwarded-For` header. Any caller could vary that
 *    header per request and never be limited. Rate limiting now happens in two
 *    stages: a coarse pre-authentication limit keyed on network identity (still
 *    spoofable, but it only guards the unauthenticated path), then the real
 *    limit keyed on the verified, unforgeable API key id.
 *
 * 3. UNAUTHENTICATED WORK. Routes performed rate-limit bookkeeping before
 *    deciding whether the caller was even authenticated. Authentication is
 *    cheap here (one hashed lookup) and is now settled first.
 * ---------------------------------------------------------------------------
 */
export interface PlatformGuardSuccess {
  ok: true;
  ctx: ApiKeyContext;
  rate: RateLimitResult;
}
export interface PlatformGuardFailure {
  ok: false;
  response: Response;
}
export type PlatformGuardResult = PlatformGuardSuccess | PlatformGuardFailure;

export async function guardPlatformRequest(
  req: NextRequest,
  requiredScope: string
): Promise<PlatformGuardResult> {
  // Stage 1 — coarse, network-keyed limit protecting the unauthenticated path.
  const preAuth = checkRateLimit(
    `unauth:${getRequestIdentifier(req)}`,
    RATE_LIMIT_CONFIGS.platformApiUnauthenticated
  );
  if (!preAuth.success) {
    return { ok: false, response: rateLimitExceededResponse(preAuth) };
  }

  const ctx = await authenticateApiKey(req);
  if (!ctx) return { ok: false, response: unauthorizedResponse() };
  if (!hasScope(ctx, requiredScope)) return { ok: false, response: forbiddenResponse() };

  // Stage 2 — the real limit, keyed on the verified key.
  const rate = checkRateLimit(apiKeyRateLimitIdentifier(ctx), RATE_LIMIT_CONFIGS.platformApi);
  if (!rate.success) {
    return { ok: false, response: rateLimitExceededResponse(rate) };
  }

  return { ok: true, ctx, rate };
}
