/**
 * GET /api/platform/partner-config
 *
 * Returns partner and licensing configuration for the authenticated company.
 * Scope required: partner-config:read
 *
 * Response includes:
 *   - Partner details and type
 *   - Territory assignment
 *   - Licensing model
 *   - Authorised Coralamy products
 *   - Revenue attribution metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey, hasScope, unauthorizedResponse, forbiddenResponse } from '@/lib/platformApiAuth';
import { createClient } from '@/lib/supabase/server';
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
  if (!hasScope(ctx, 'partner-config:read')) return forbiddenResponse();

  const supabase = await createClient();

  // Get company's partner_id
  const { data: company } = await supabase
    .from('companies')
    .select('partner_id, territory_id, customer_ownership')
    .eq('id', ctx.companyId)
    .maybeSingle();

  if (!company?.partner_id) {
    return addRateLimitHeaders(NextResponse.json({
      data: {
        partner: null,
        territory: null,
        products: [],
        licensing: null,
        revenueAttribution: null,
      },
    }), rlResult);
  }

  // Fetch partner with type
  const { data: partner } = await supabase
    .from('partners')
    .select(`
      id,
      name,
      country_code,
      is_active,
      contact_email,
      partner_types ( name, description )
    `)
    .eq('id', company.partner_id)
    .maybeSingle();

  // Fetch authorised products for this partner
  const { data: partnerProducts } = await supabase
    .from('partner_products')
    .select(`
      is_active,
      licensing_model,
      territory_scope,
      coralamy_products ( name, slug, description )
    `)
    .eq('partner_id', company.partner_id)
    .eq('is_active', true);

  // Fetch territory
  let territory = null;
  if (company.territory_id) {
    const { data: territoryData } = await supabase
      .from('territories')
      .select('id, name, country_code, territory_type, is_exclusive')
      .eq('id', company.territory_id)
      .maybeSingle();
    territory = territoryData;
  }

  // Fetch revenue attribution for this company's subscription
  const { data: revenueRow } = await supabase
    .from('partner_revenue')
    .select('mrr_cents, arr_cents, period_start, period_end')
    .eq('partner_id', company.partner_id)
    .eq('company_id', ctx.companyId)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  return addRateLimitHeaders(NextResponse.json({
    data: {
      partner: partner
        ? {
            id: partner.id,
            name: partner.name,
            countryCode: partner.country_code,
            isActive: partner.is_active,
            contactEmail: partner.contact_email,
            type: (partner as any).partner_types?.name ?? null,
          }
        : null,
      territory,
      products: (partnerProducts ?? []).map((pp: any) => ({
        name: pp.coralamy_products?.name,
        slug: pp.coralamy_products?.slug,
        licensingModel: pp.licensing_model,
        territoryScope: pp.territory_scope,
      })),
      licensing: {
        customerOwnership: company.customer_ownership,
      },
      revenueAttribution: revenueRow
        ? {
            mrrCents: revenueRow.mrr_cents,
            arrCents: revenueRow.arr_cents,
            periodStart: revenueRow.period_start,
            periodEnd: revenueRow.period_end,
          }
        : null,
    },
  }), rlResult);
}
