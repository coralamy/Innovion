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
import { guardPlatformRequest } from '@/lib/platformApiRoute';
import { createAdminClient } from '@/lib/supabase/admin';
import { addRateLimitHeaders } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  const guard = await guardPlatformRequest(req, 'partner-config:read');
  if (!guard.ok) return guard.response;
  const { ctx, rate: rlResult } = guard;

  // Service role: a Bearer-key caller has no Supabase session, so the anon
  // cookie client resolved to `anon` and every query returned nothing. All
  // reads below are explicitly scoped to ctx.companyId / its partner.
  const supabase = createAdminClient();

  // Get company's partner_id
  const { data: company } = await supabase
    .from('companies')
    .select('partner_id, territory_id, customer_ownership')
    .eq('id', ctx.companyId)
    .maybeSingle();

  if (!company?.partner_id) {
    return addRateLimitHeaders(
      NextResponse.json({
        data: {
          partner: null,
          territory: null,
          products: [],
          licensing: null,
          revenueAttribution: null,
        },
      }),
      rlResult
    );
  }

  // ── Column names corrected against the real schema ─────────────────────────
  // Previously this route requested partners.name / partners.is_active,
  // partner_products.is_active / licensing_model / territory_scope,
  // territories.name / is_exclusive and partner_revenue.mrr_cents / arr_cents —
  // none of which exist — and embedded `partner_types(...)` although
  // partners.partner_type is an ENUM, not a foreign key to partner_types, so no
  // PostgREST relationship exists to traverse. Every one of those requests
  // failed, and each `const { data } = ...` discarded the error, so this
  // endpoint answered with nulls and an empty product list for every partner.
  const { data: partner } = await supabase
    .from('partners')
    .select(
      'id, partner_name, partner_type, licence_model, country_code, partner_status, contact_email'
    )
    .eq('id', company.partner_id)
    .maybeSingle();

  // partner_products records authorisation via `is_authorised`, and joins to
  // coralamy_products by a real foreign key (partner_products.product_id).
  const { data: partnerProducts } = await supabase
    .from('partner_products')
    .select('is_authorised, coralamy_products ( product_key, product_name, description )')
    .eq('partner_id', company.partner_id)
    .eq('is_authorised', true);

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

  const { data: revenueRow } = await supabase
    .from('partner_revenue')
    .select('mrr_amount, arr_amount, currency_code, period_start, period_end')
    .eq('partner_id', company.partner_id)
    .eq('company_id', ctx.companyId)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  return addRateLimitHeaders(
    NextResponse.json({
      data: {
        partner: partner
          ? {
              id: partner.id,
              name: partner.partner_name,
              countryCode: partner.country_code,
              isActive: partner.partner_status === 'active',
              contactEmail: partner.contact_email,
              type: partner.partner_type ?? null,
            }
          : null,
        territory,
        products: (partnerProducts ?? []).map((pp) => {
          const product = (
            pp as {
              coralamy_products?: {
                product_key?: string;
                product_name?: string;
                description?: string;
              };
            }
          ).coralamy_products;
          return {
            name: product?.product_name ?? null,
            slug: product?.product_key ?? null,
            description: product?.description ?? null,
          };
        }),
        licensing: {
          customerOwnership: company.customer_ownership,
          // The licensing model is a property of the partner agreement.
          licenceModel: partner?.licence_model ?? null,
          territoryScope: territory?.isExclusive ? 'exclusive' : 'non_exclusive',
        },
        revenueAttribution: revenueRow
          ? {
              mrrAmount: revenueRow.mrr_amount,
              arrAmount: revenueRow.arr_amount,
              currencyCode: revenueRow.currency_code,
              periodStart: revenueRow.period_start,
              periodEnd: revenueRow.period_end,
            }
          : null,
      },
    }),
    rlResult
  );
}
