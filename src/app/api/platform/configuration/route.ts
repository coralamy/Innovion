/**
 * GET /api/platform/configuration
 *
 * Returns the complete platform configuration for the authenticated organisation.
 *
 * This endpoint is the authoritative configuration source for every Innovion
 * client — Web Platform, Workforce, APIs, Partner Portal, Customer Portal, and
 * future Digital Professionals. It is not an application settings endpoint; it
 * is the operational configuration layer of the entire platform.
 *
 * Scope required: platform-config:read  (or wildcard *)
 *
 * Optional query parameters:
 *   ?domains=branding,localisation,licensing   — return only the specified domains
 *   ?domain=workforceConfig                    — shorthand for a single domain
 *   ?manifestOnly=true                         — return only the ConfigurationManifest
 *                                                (lightweight check before full refresh)
 *
 * Available domains (v3.0.0):
 *   Core:        branding, localisation, licensing, modules, security,
 *                digitalProfessional, partner, featureRegistry,
 *                organisationalHierarchy, notifications
 *   Clients:     workforceConfig, customerPortalConfig, partnerPortalConfig
 *   Governance:  apiClientsConfig, dataGovernanceConfig, auditComplianceConfig
 *   Extension:   extensions
 *
 * The response always includes configVersion, organisationId, retrievedAt, and
 * manifest regardless of the domains filter, so clients can detect schema changes
 * and determine whether a full refresh is necessary.
 *
 * Recommended client refresh pattern:
 *   1. GET ?manifestOnly=true → compare configHash with cached value
 *   2. If unchanged → use cached configuration (no further request needed)
 *   3. If changed → GET (full) → update cache
 *
 * Schema versioning:
 *   Clients should check configVersion before parsing. Minor version bumps
 *   (e.g. 3.0.0 → 3.1.0) add optional fields only. Major bumps may be breaking.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiKey,
  hasScope,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/platformApiAuth';
import { platformConfigurationService, PLATFORM_CONFIG_VERSION, type PlatformOrganisationConfig } from '@/lib/services/platformConfigurationService';
import { logger } from '@/lib/logger';
import {
  checkRateLimit,
  getRequestIdentifier,
  RATE_LIMIT_CONFIGS,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from '@/lib/rateLimit';

const REQUIRED_SCOPE = 'platform-config:read';

export async function GET(req: NextRequest) {
  // ── Rate limiting ───────────────────────────────────────────────────────────
  const identifier = getRequestIdentifier(req);
  const rlResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.platformApi);
  if (!rlResult.success) return rateLimitExceededResponse(rlResult);

  // ── Authentication & authorisation ─────────────────────────────────────────
  const ctx = await authenticateApiKey(req);
  if (!ctx) return unauthorizedResponse();
  if (!hasScope(ctx, REQUIRED_SCOPE)) return forbiddenResponse();

  const { searchParams } = new URL(req.url);

  // ── Manifest-only mode (lightweight change detection) ──────────────────────
  const manifestOnly = searchParams.get('manifestOnly') === 'true';
  if (manifestOnly) {
    try {
      const manifest = await platformConfigurationService.getManifest(ctx.companyId);
      if (!manifest) {
        return NextResponse.json(
          { error: 'Organisation not found', code: 'ORG_NOT_FOUND' },
          { status: 404 }
        );
      }
      return addRateLimitHeaders(NextResponse.json({ manifest }), rlResult);
    } catch (err) {
      logger.error('api/platform/configuration', 'Unexpected error retrieving configuration', { companyId: ctx.companyId }, err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // ── Optional domain filtering ──────────────────────────────────────────────
  const domainsParam = searchParams.get('domains') ?? searchParams.get('domain');
  const requestedDomains = domainsParam
    ? domainsParam.split(',').map((d) => d.trim()).filter(Boolean)
    : null;

  // ── Retrieve full configuration ────────────────────────────────────────────
  try {
    const config = await platformConfigurationService.getOrganisationConfig(ctx.companyId);

    if (!config) {
      return NextResponse.json(
        { error: 'Organisation not found', code: 'ORG_NOT_FOUND' },
        { status: 404 }
      );
    }

    // ── Apply domain filter if requested ──────────────────────────────────────
    if (requestedDomains && requestedDomains.length > 0) {
      const filtered: Record<string, unknown> = {
        configVersion: config.configVersion,
        organisationId: config.organisationId,
        retrievedAt: config.retrievedAt,
        // Manifest is always included — clients need it for change detection
        manifest: {
          ...config.manifest,
          domainCount: requestedDomains.length,
          isPartial: true,
        },
      };

      const validDomains = platformConfigurationService.getConfigDomains();

      for (const domain of requestedDomains) {
        if (validDomains.includes(domain)) {
          (filtered as any)[domain] = (config as any)[domain];
        }
      }

      return addRateLimitHeaders(NextResponse.json({ data: filtered }), rlResult);
    }

    // ── Return full configuration ──────────────────────────────────────────────
    return addRateLimitHeaders(NextResponse.json({ data: config }), rlResult);
  } catch (err) {
    logger.error('api/platform/configuration', 'Unexpected error retrieving configuration', { companyId: ctx.companyId }, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * HEAD /api/platform/configuration
 *
 * Returns the current config schema version, manifest metadata, and available
 * domains. No authentication required — this is a discovery endpoint.
 *
 * Clients may use the ETag header (set to the configHash) for conditional GET
 * semantics without needing to parse the full response body.
 */
export async function HEAD(_req: NextRequest) {
  return NextResponse.json({
    schemaVersion: PLATFORM_CONFIG_VERSION,
    apiVersion: 'v3',
    domains: platformConfigurationService.getConfigDomains(),
    description: 'Platform Configuration Service — authoritative operational configuration for all Innovion clients',
    architecturalPrinciple: 'The Innovion Platform is the Single Source of Truth. All clients consume configuration through this service.',
    compatibleClients: [
      'Innovion Web Platform',
      'Innovion Workforce',
      'Partner Portal',
      'Customer Portal',
      'Public APIs',
      'Digital Professionals',
      'Future Desktop Applications',
      'Future Coralamy Applications',
    ],
  });
}
