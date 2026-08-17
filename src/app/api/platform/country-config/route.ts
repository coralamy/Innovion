/**
 * GET /api/platform/country-config
 *
 * Returns the country configuration for a given country code.
 * Scope required: country-config:read
 *
 * Query params:
 *   ?country=AU   (defaults to the company's configured country)
 *
 * Response shape: CountryConfig (see src/lib/countryConfig.ts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardPlatformRequest } from '@/lib/platformApiRoute';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCountryConfig, COUNTRY_CONFIGS } from '@/lib/countryConfig';
import { DEFAULT_LOCALISATION } from '@/lib/localisation';
import { addRateLimitHeaders } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  // This route previously had NO rate limiting at all, unlike its siblings.
  const guard = await guardPlatformRequest(req, 'country-config:read');
  if (!guard.ok) return guard.response;
  const { ctx, rate: rlResult } = guard;

  const { searchParams } = new URL(req.url);
  let countryCode = (searchParams.get('country') ?? '').toUpperCase();

  // If no country specified, derive from company localisation
  if (!countryCode) {
    const supabase = createAdminClient();
    const { data: locData } = await supabase
      .from('company_localisation')
      .select('country')
      .eq('company_id', ctx.companyId)
      .maybeSingle();
    countryCode = locData?.country ?? DEFAULT_LOCALISATION.country;
  }

  const config = getCountryConfig(countryCode);

  // Strip RegExp objects (not JSON-serialisable) from businessIdentifiers
  const safeConfig = {
    ...config,
    businessIdentifiers: config.businessIdentifiers.map(
      ({ validationPattern: _vp, ...rest }) => rest
    ),
  };

  return addRateLimitHeaders(NextResponse.json({ data: safeConfig }), rlResult);
}

/**
 * HEAD /api/platform/country-config
 * Returns the list of all supported country codes and names.
 */
export async function HEAD(req: NextRequest) {
  const guard = await guardPlatformRequest(req, 'country-config:read');
  if (!guard.ok) return guard.response;

  const list = Object.values(COUNTRY_CONFIGS).map((c) => ({
    countryCode: c.countryCode,
    countryName: c.countryName,
    defaultLanguage: c.defaultLanguage,
  }));

  return NextResponse.json({ data: list });
}
