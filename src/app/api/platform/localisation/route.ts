/**
 * GET /api/platform/localisation
 *
 * Returns the localisation settings for the authenticated company.
 * Scope required: localisation:read
 *
 * Response shape:
 * {
 *   country, language, currencyCode, currencySymbol,
 *   currencyDecimalPrecision, thousandsSeparator, decimalSeparator,
 *   currencySymbolPosition, timezone, dateFormat, timeFormat,
 *   firstDayOfWeek, measurementSystem
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, hasScope, unauthorizedResponse, forbiddenResponse } from '@/lib/platformApiAuth';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_LOCALISATION } from '@/lib/localisation';
import { logger } from '@/lib/logger';
import {
  checkRateLimit,
  getRequestIdentifier,
  RATE_LIMIT_CONFIGS,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  const identifier = getRequestIdentifier(req);
  const rlResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.platformApi);
  if (!rlResult.success) return rateLimitExceededResponse(rlResult);

  const ctx = await authenticateApiKey(req);
  if (!ctx) return unauthorizedResponse();
  if (!hasScope(ctx, 'localisation:read')) return forbiddenResponse();

  try {
    const supabase = await createClient();

    const { data: locData, error } = await supabase
      .from('company_localisation')
      .select('*')
      .eq('company_id', ctx.companyId)
      .maybeSingle();

    if (error) {
      logger.warn('api/platform/localisation', 'DB query failed, returning defaults', { companyId: ctx.companyId, error: error.message });
    }

    const settings = locData
      ? {
          country: locData.country ?? DEFAULT_LOCALISATION.country,
          language: locData.language ?? DEFAULT_LOCALISATION.language,
          currencyCode: locData.currency_code ?? DEFAULT_LOCALISATION.currencyCode,
          currencySymbol: locData.currency_symbol ?? DEFAULT_LOCALISATION.currencySymbol,
          currencyDecimalPrecision: locData.currency_decimal_precision ?? DEFAULT_LOCALISATION.currencyDecimalPrecision,
          thousandsSeparator: locData.thousands_separator ?? DEFAULT_LOCALISATION.thousandsSeparator,
          decimalSeparator: locData.decimal_separator ?? DEFAULT_LOCALISATION.decimalSeparator,
          currencySymbolPosition: locData.currency_symbol_position ?? DEFAULT_LOCALISATION.currencySymbolPosition,
          timezone: locData.timezone ?? DEFAULT_LOCALISATION.timezone,
          dateFormat: locData.date_format ?? DEFAULT_LOCALISATION.dateFormat,
          timeFormat: locData.time_format ?? DEFAULT_LOCALISATION.timeFormat,
          firstDayOfWeek: locData.first_day_of_week ?? DEFAULT_LOCALISATION.firstDayOfWeek,
          measurementSystem: locData.measurement_system ?? DEFAULT_LOCALISATION.measurementSystem,
        }
      : DEFAULT_LOCALISATION;

    return addRateLimitHeaders(NextResponse.json({ data: settings }), rlResult);
  } catch (err) {
    logger.error('api/platform/localisation', 'Unexpected error', { companyId: ctx.companyId }, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
