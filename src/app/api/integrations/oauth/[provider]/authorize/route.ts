/**
 * OAuth Authorization Initiation
 * GET /api/integrations/oauth/[provider]/authorize
 *
 * Generates the OAuth authorization URL for the given provider and stores the
 * PKCE code verifier and CSRF state in a signed, httpOnly cookie.
 *
 * ---------------------------------------------------------------------------
 * DEFECTS REMEDIATED
 *
 * 1. NO AUTHORISATION CHECK (P1 — privilege escalation across roles).
 *    The route required only that the caller be *authenticated*. Any member of
 *    a tenant — a 'viewer', the least-privileged role — could start an OAuth
 *    connection on behalf of the whole organisation, and on completion bind
 *    their own external accounting account to it. Connecting a provider is an
 *    administrative act; RLS already restricts provider_integrations writes to
 *    tenant admins, so a viewer's flow would also have failed silently at the
 *    end. Now checked up front, against authoritative `user_roles`.
 *
 * 2. ARBITRARY TENANT SELECTION.
 *    `.eq('user_id', user.id).limit(1).single()` picked whichever membership
 *    the database happened to return first for a user who belongs to more than
 *    one tenant, so the connection could be attached to a tenant the user was
 *    not acting in. The tenant is now resolved deterministically and, where the
 *    user has several, must be named explicitly with `?company_id=`.
 *
 * 3. UNSIGNED STATE. See src/lib/integrations/oauthState.ts.
 *
 * 4. OPEN REDIRECT via `?return_to=`. See `safeReturnTo`.
 *
 * 5. NO RATE LIMITING on a route that performs a database read and a crypto
 *    operation per request.
 *
 * 6. `params` IS A PROMISE in Next.js 15 and was destructured synchronously.
 * ---------------------------------------------------------------------------
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAdapter } from '@/lib/services/integrationFrameworkService';
import {
  newStateToken,
  signState,
  safeReturnTo,
  OAUTH_STATE_MAX_AGE_MS,
} from '@/lib/integrations/oauthState';
import {
  checkRateLimit,
  getRequestIdentifier,
  RATE_LIMIT_CONFIGS,
  rateLimitExceededResponse,
} from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
// Register all provider adapters (Xero, etc.) before any adapter lookup
import '@/lib/integrations/adapters';

const SUPPORTED_PROVIDERS = ['xero', 'microsoft', 'google', 'stripe', 'rhixo'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: `Provider '${provider}' is not supported` }, { status: 400 });
  }

  const rl = checkRateLimit(
    `oauth-authorize:${getRequestIdentifier(request)}`,
    RATE_LIMIT_CONFIGS.auth
  );
  if (!rl.success) return rateLimitExceededResponse(rl);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Read-only cookie context — the session is still valid for this request.
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // ── Authoritative tenant + role ────────────────────────────────────────────
  const requestedCompany = request.nextUrl.searchParams.get('company_id');

  const { data: memberships, error: membershipError } = await supabase
    .from('user_roles')
    .select('company_id, role')
    .eq('user_id', user.id)
    .not('company_id', 'is', null);

  if (membershipError) {
    logger.error('oauth/authorize', 'Failed to resolve tenant membership', {
      userId: user.id,
      error: membershipError.message,
    });
    return NextResponse.json({ error: 'Unable to resolve organisation' }, { status: 500 });
  }

  const admin = (memberships ?? []).filter((m) => m.role === 'admin');
  if (admin.length === 0) {
    return NextResponse.json(
      { error: 'Only an organisation administrator may connect an integration' },
      { status: 403 }
    );
  }

  let companyId: string;
  if (requestedCompany) {
    const match = admin.find((m) => m.company_id === requestedCompany);
    if (!match) {
      return NextResponse.json(
        { error: 'Only an organisation administrator may connect an integration' },
        { status: 403 }
      );
    }
    companyId = match.company_id as string;
  } else if (admin.length === 1) {
    companyId = admin[0].company_id as string;
  } else {
    return NextResponse.json(
      {
        error:
          'You administer more than one organisation. Specify which one with ?company_id=<uuid>.',
        code: 'COMPANY_AMBIGUOUS',
        administeredCompanyIds: admin.map((m) => m.company_id),
      },
      { status: 400 }
    );
  }

  const adapter = getAdapter(provider);
  if (!adapter) {
    return NextResponse.json(
      {
        error: `Provider '${provider}' adapter is not yet registered.`,
        phase: 'pending',
      },
      { status: 501 }
    );
  }

  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('return_to'));
  const acquisitionSource = request.nextUrl.searchParams.get('acquisition_source') ?? 'direct';

  try {
    const state = newStateToken();

    const { url, codeVerifier } = await adapter.buildAuthorizationUrl({
      companyId,
      userId: user.id,
      state,
      codeVerifier: undefined,
      acquisitionSource,
      returnTo,
    });

    const signed = signState({
      state,
      codeVerifier,
      companyId,
      userId: user.id,
      provider,
      returnTo,
      acquisitionSource,
      createdAt: Date.now(),
    });

    const response = NextResponse.redirect(url);
    response.cookies.set(`oauth_state_${provider}`, signed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Math.floor(OAUTH_STATE_MAX_AGE_MS / 1000),
      path: '/',
    });

    return response;
  } catch (err) {
    logger.error('oauth/authorize', 'Failed to initiate OAuth flow', { provider, companyId }, err);
    return NextResponse.json({ error: 'Failed to initiate OAuth flow' }, { status: 500 });
  }
}
