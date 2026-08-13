/**
 * GET /api/platform/tenancy
 *
 * Returns multi-tenancy context for the authenticated company.
 * Scope required: tenancy:read
 *
 * Response includes:
 *   - Company identity and status
 *   - Partner and territory assignment
 *   - Customer ownership record
 *   - Subscription status summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, hasScope, unauthorizedResponse, forbiddenResponse } from '@/lib/platformApiAuth';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import {
  checkRateLimit,
  getRequestIdentifier,
  RATE_LIMIT_CONFIGS,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  // ── Rate limiting ───────────────────────────────────────────────────────────
  const identifier = getRequestIdentifier(req);
  const rlResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.platformApi);
  if (!rlResult.success) return rateLimitExceededResponse(rlResult);

  const ctx = await authenticateApiKey(req);
  if (!ctx) return unauthorizedResponse();
  if (!hasScope(ctx, 'tenancy:read')) return forbiddenResponse();

  try {
    const supabase = await createClient();

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(`
        id,
        name,
        country_code,
        business_identifier_type,
        business_identifier_value,
        partner_id,
        territory_id,
        customer_ownership,
        created_at
      `)
      .eq('id', ctx.companyId)
      .maybeSingle();

    if (companyError) {
      logger.error('api/platform/tenancy', 'Failed to fetch company', { companyId: ctx.companyId, error: companyError.message });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    let partner = null;
    if (company.partner_id) {
      const { data: partnerData } = await supabase
        .from('partners')
        .select('id, name, partner_type_id, country_code, is_active')
        .eq('id', company.partner_id)
        .maybeSingle();
      partner = partnerData;
    }

    let territory = null;
    if (company.territory_id) {
      const { data: territoryData } = await supabase
        .from('territories')
        .select('id, name, country_code, territory_type, is_exclusive')
        .eq('id', company.territory_id)
        .maybeSingle();
      territory = territoryData;
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_name, status, trial_ends_at, current_period_end')
      .eq('company_id', ctx.companyId)
      .maybeSingle();

    const response = NextResponse.json({
      data: {
        company: {
          id: company.id,
          name: company.name,
          countryCode: company.country_code,
          businessIdentifierType: company.business_identifier_type,
          businessIdentifierValue: company.business_identifier_value,
          customerOwnership: company.customer_ownership,
          createdAt: company.created_at,
        },
        partner,
        territory,
        subscription: subscription
          ? {
              planName: subscription.plan_name,
              status: subscription.status,
              trialEndsAt: subscription.trial_ends_at,
              currentPeriodEnd: subscription.current_period_end,
            }
          : null,
      },
    });
    return addRateLimitHeaders(response, rlResult);
  } catch (err) {
    logger.error('api/platform/tenancy', 'Unexpected error', { companyId: ctx.companyId }, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
