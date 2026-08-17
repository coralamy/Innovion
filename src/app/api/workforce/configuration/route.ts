/**
 * GET /api/workforce/configuration
 *
 * The Innovion Workforce configuration endpoint. **Resolution of DEP-1.**
 *
 * ===========================================================================
 * AUTHENTICATION — Supabase user JWT. No embedded secret.
 *
 *     Authorization: Bearer <supabase access token>
 *
 * The token is the session the Workforce app already holds. It is VERIFIED
 * server-side against the auth server on every request; it is never merely
 * decoded, so a forged or tampered token is refused.
 *
 * There is no API key. Nothing secret is compiled into the APK. See
 * `src/lib/workforceAuth.ts` for the full reasoning, including why this was
 * chosen over per-device scoped keys.
 *
 * ===========================================================================
 * TENANT
 *
 * Derived from the verified `sub` against authoritative membership —
 * `user_roles`, then `contractors` linkage (explicit `user_id` or a CONFIRMED
 * e-mail match), then company ownership. Never from `user_metadata`, and never
 * from the credential itself.
 *
 * `?company_id=<uuid>` selects among tenants the caller genuinely belongs to.
 * Naming a tenant they do not belong to is refused with 403 — not silently
 * answered with a different one.
 *
 * ===========================================================================
 * RESPONSE — the Workforce contract (snake_case), resolving DEP-2
 *
 *   GET /api/workforce/configuration                  → { data: {...} }
 *   GET /api/workforce/configuration?manifestOnly=true → { manifest: {...} }
 *
 * Both envelopes match what Team B's `PlatformConfigurationService` already
 * unwraps, and the field names come from Team B's own parser. See
 * `workforceConfigurationAdapter.ts`.
 *
 * ===========================================================================
 * CACHING
 *
 * `private, no-store`. The body is specific to one tenant and one principal; a
 * shared cache keyed on the URL would serve one organisation's configuration to
 * the next caller.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateWorkforceRequest } from '@/lib/workforceAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { platformConfigurationService } from '@/lib/services/platformConfigurationService';
import { toWorkforceConfiguration } from '@/lib/services/workforceConfigurationAdapter';
import { addRateLimitHeaders } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

/** Per-principal, per-tenant. Never shared-cacheable. */
function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export async function GET(req: NextRequest) {
  const guard = await authenticateWorkforceRequest(req);
  if (!guard.ok) return noStore(guard.response);

  const { principal, rate } = guard;

  // Service role: the caller is authenticated and their tenant has been
  // established above, and every read below is pinned to it. The end-user
  // client cannot be used here because a contractor has no `user_roles` row and
  // several configuration tables are deliberately staff-only.
  let db;
  try {
    db = createAdminClient();
  } catch (err) {
    logger.error('api/workforce/configuration', 'Service role client unavailable', {}, err);
    return noStore(NextResponse.json({ error: 'Server misconfigured' }, { status: 503 }));
  }

  try {
    if (req.nextUrl.searchParams.get('manifestOnly') === 'true') {
      const manifest = await platformConfigurationService.getManifest(principal.companyId, db);
      if (!manifest) {
        return noStore(
          NextResponse.json(
            { error: 'Organisation not found', code: 'ORG_NOT_FOUND' },
            { status: 404 }
          )
        );
      }
      return noStore(addRateLimitHeaders(NextResponse.json({ manifest }), rate) as NextResponse);
    }

    const config = await platformConfigurationService.getOrganisationConfig(
      principal.companyId,
      db
    );
    if (!config) {
      return noStore(
        NextResponse.json(
          { error: 'Organisation not found', code: 'ORG_NOT_FOUND' },
          { status: 404 }
        )
      );
    }

    const payload = toWorkforceConfiguration(config);

    return noStore(
      addRateLimitHeaders(
        NextResponse.json({
          data: payload,
          // Non-authoritative, for the Configuration Inspector: it lets a
          // support engineer see which principal the payload was built for
          // without having to decode the token.
          principal: {
            type: principal.principalType,
            company_id: principal.companyId,
          },
        }),
        rate
      ) as NextResponse
    );
  } catch (err) {
    logger.error(
      'api/workforce/configuration',
      'Failed to build workforce configuration',
      { companyId: principal.companyId, principalType: principal.principalType },
      err
    );
    return noStore(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

/**
 * HEAD /api/workforce/configuration
 *
 * Contract discovery. Authenticated like GET — an unauthenticated caller learns
 * nothing, not even that a given deployment serves Workforce.
 */
export async function HEAD(req: NextRequest) {
  const guard = await authenticateWorkforceRequest(req);
  if (!guard.ok) return noStore(guard.response);

  return noStore(
    NextResponse.json({
      contract: 'innovion-workforce-configuration',
      contractVersion: '1.0.0',
      authentication: 'supabase-user-jwt',
      envelopes: { full: 'data', manifestOnly: 'manifest' },
      casing: 'snake_case',
      domains: [
        'branding',
        'i18n',
        'currency',
        'regional',
        'measurement',
        'terminology',
        'licensing',
        'modules',
        'security',
        'digital_professional',
        'partner',
        'features',
        'org_hierarchy',
      ],
    })
  );
}
