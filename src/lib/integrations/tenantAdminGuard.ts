import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import {
  checkRateLimit,
  getRequestIdentifier,
  RATE_LIMIT_CONFIGS,
  rateLimitExceededResponse,
} from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

/**
 * Establish that the caller is signed in and is an ADMINISTRATOR of exactly one
 * identified tenant, before any integration side effect is permitted.
 *
 * ---------------------------------------------------------------------------
 * DEFECTS REMEDIATED across the OAuth integration routes
 *
 * 1. NO AUTHORISATION AT ALL (`refresh`). The token-refresh route checked only
 *    that the caller was authenticated. Any member of a tenant, at any role,
 *    could force a provider token refresh for the whole organisation —
 *    rotating the tenant's credentials and, on failure, driving the integration
 *    into `reauth_required` for everyone. A denial-of-service usable by the
 *    least-privileged account in the product.
 *
 * 2. BROKEN AUTHORISATION (`disconnect`). It resolved permission with
 *
 *      supabase.from('role_permissions')
 *        .select('can_manage_company')
 *        .eq('company_id', profile.company_id)
 *        .single()
 *
 *    — filtered by COMPANY only, never by the caller's own role. It asks
 *    "does ANY role in this company have can_manage_company?", not "does the
 *    CALLER?". Whenever a company has a single role_permissions row (the seeded
 *    admin row), that check returns true for every member of the tenant,
 *    including a viewer, who could then disconnect the organisation's
 *    accounting integration and revoke its tokens. Where several rows exist,
 *    `.single()` errors instead and the route rejects everyone — so the same
 *    code was simultaneously an escalation and an outage depending on data.
 *
 * 3. ARBITRARY TENANT SELECTION. `.eq('user_id', ...).limit(1).single()` picks
 *    whichever row the database returns first for a multi-tenant user.
 *
 * Authority is taken from `public.user_roles` — the authoritative table — and
 * never from client-writable metadata or from a permission matrix that is not
 * keyed on the caller.
 * ---------------------------------------------------------------------------
 */
export type TenantAdminGuardResult =
  | { ok: true; userId: string; userEmail: string | null; companyId: string }
  | { ok: false; response: NextResponse };

export async function requireTenantAdmin(
  request: NextRequest,
  scope: string
): Promise<TenantAdminGuardResult> {
  const rl = checkRateLimit(`${scope}:${getRequestIdentifier(request)}`, RATE_LIMIT_CONFIGS.auth);
  if (!rl.success) {
    return { ok: false, response: rateLimitExceededResponse(rl) as NextResponse };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* route handlers do not rotate the session cookie here */
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  }

  const { data: memberships, error } = await supabase
    .from('user_roles')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .not('company_id', 'is', null);

  if (error) {
    logger.error(scope, 'Failed to resolve tenant membership', {
      userId: user.id,
      error: error.message,
    });
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unable to resolve organisation' }, { status: 500 }),
    };
  }

  if (!memberships || memberships.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Administrator permission required' }, { status: 403 }),
    };
  }

  const requested = request.nextUrl.searchParams.get('company_id');
  if (requested) {
    const match = memberships.find((m) => m.company_id === requested);
    if (!match) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Administrator permission required' },
          { status: 403 }
        ),
      };
    }
    return {
      ok: true,
      userId: user.id,
      userEmail: user.email ?? null,
      companyId: match.company_id as string,
    };
  }

  if (memberships.length > 1) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            'You administer more than one organisation. Specify which with ?company_id=<uuid>.',
          code: 'COMPANY_AMBIGUOUS',
        },
        { status: 400 }
      ),
    };
  }

  return {
    ok: true,
    userId: user.id,
    userEmail: user.email ?? null,
    companyId: memberships[0].company_id as string,
  };
}
