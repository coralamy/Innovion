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
import { guardPlatformRequest } from '@/lib/platformApiRoute';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { addRateLimitHeaders } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  const guard = await guardPlatformRequest(req, 'tenancy:read');
  if (!guard.ok) return guard.response;
  const { ctx, rate: rlResult } = guard;

  try {
    // Service role: a machine caller has no Supabase session, so the anon
    // cookie client used previously resolved to `anon` and every tenant-scoped
    // RLS policy matched nothing — this endpoint returned 404 for every valid
    // key. Tenant scoping is enforced explicitly below via ctx.companyId.
    const supabase = createAdminClient();

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(
        `
        id,
        name,
        country_code,
        business_identifier_type,
        business_identifier_value,
        partner_id,
        territory_id,
        customer_ownership,
        created_at
      `
      )
      .eq('id', ctx.companyId)
      .maybeSingle();

    if (companyError) {
      logger.error('api/platform/tenancy', 'Failed to fetch company', {
        companyId: ctx.companyId,
        error: companyError.message,
      });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Column names corrected: `partners` exposes partner_name / partner_type /
    // partner_status (there is no name, partner_type_id or is_active column),
    // `territories` exposes territory_name / exclusivity, and `subscriptions`
    // exposes sub_status. Every one of these queries previously failed and had
    // its error discarded, so partner, territory and subscription were reported
    // as null for every organisation.
    let partner = null;
    if (company.partner_id) {
      const { data: partnerData } = await supabase
        .from('partners')
        .select('id, partner_name, partner_type, country_code, partner_status')
        .eq('id', company.partner_id)
        .maybeSingle();
      partner = partnerData
        ? {
            id: partnerData.id,
            name: partnerData.partner_name,
            partnerType: partnerData.partner_type,
            countryCode: partnerData.country_code,
            isActive: partnerData.partner_status === 'active',
          }
        : null;
    }

    let territory = null;
    if (company.territory_id) {
      const { data: territoryData } = await supabase
        .from('territories')
        .select('id, territory_name, country_code, territory_type, exclusivity')
        .eq('id', company.territory_id)
        .maybeSingle();
      territory = territoryData
        ? {
            id: territoryData.id,
            name: territoryData.territory_name,
            countryCode: territoryData.country_code,
            territoryType: territoryData.territory_type,
            isExclusive: territoryData.exclusivity === 'exclusive',
          }
        : null;
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_name, sub_status, trial_ends_at, current_period_end')
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
              status: subscription.sub_status,
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
