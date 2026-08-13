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
import { authenticateApiKey, hasScope, unauthorizedResponse, forbiddenResponse } from '@/lib/platformApiAuth';
import { createClient } from '@/lib/supabase/server';
import { getCountryConfig, COUNTRY_CONFIGS } from '@/lib/countryConfig';
import { DEFAULT_LOCALISATION } from '@/lib/localisation';

export async function GET(req: NextRequest) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return unauthorizedResponse();
  if (!hasScope(ctx, 'country-config:read')) return forbiddenResponse();

  const { searchParams } = new URL(req.url);
  let countryCode = (searchParams.get('country') ?? '').toUpperCase();

  // If no country specified, derive from company localisation
  if (!countryCode) {
    const supabase = await createClient();
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
    businessIdentifiers: config.businessIdentifiers.map(({ validationPattern: _vp, ...rest }) => rest),
  };

  return NextResponse.json({ data: safeConfig });
}

/**
 * GET /api/platform/country-config?list=true
 * Returns the list of all supported country codes and names.
 */
export async function HEAD(req: NextRequest) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return unauthorizedResponse();
  if (!hasScope(ctx, 'country-config:read')) return forbiddenResponse();

  const list = Object.values(COUNTRY_CONFIGS).map((c) => ({
    countryCode: c.countryCode,
    countryName: c.countryName,
    defaultLanguage: c.defaultLanguage,
  }));

  return NextResponse.json({ data: list });
}
