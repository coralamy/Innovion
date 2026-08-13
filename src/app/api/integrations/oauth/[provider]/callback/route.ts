/**
 * OAuth Callback Handler
 * GET /api/integrations/oauth/[provider]/callback
 *
 * Handles the OAuth 2.0 authorization code callback from providers.
 * Validates state (CSRF), exchanges code for tokens, encrypts tokens,
 * stores credentials, maps external org, records audit log.
 *
 * Registered callback URI with all providers: https://innovion.app/api/integrations/oauth/{provider}/callback
 * Never exposes tokens to browser clients.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAdapter } from '@/lib/services/integrationFrameworkService';
// Register all provider adapters (Xero, etc.) before any adapter lookup
import '@/lib/integrations/adapters';

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { provider } = params;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Provider returned an error (user denied, etc.)
  if (errorParam) {
    console.warn(`[OAuth Callback] ${provider} returned error: ${errorParam} — ${errorDescription}`);
    return NextResponse.redirect(
      new URL(`/settings/integrations?oauth_error=${encodeURIComponent(errorParam)}&provider=${provider}`, request.url)
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL('/settings/integrations?oauth_error=missing_params', request.url)
    );
  }

  // Retrieve and validate stored OAuth state cookie
  const cookieStore = await cookies();
  const storedStateCookie = cookieStore.get(`oauth_state_${provider}`)?.value;

  if (!storedStateCookie) {
    return NextResponse.redirect(
      new URL('/settings/integrations?oauth_error=state_expired', request.url)
    );
  }

  let storedState: {
    state: string;
    codeVerifier?: string;
    companyId: string;
    userId: string;
    provider: string;
    returnTo: string;
    acquisitionSource: string;
    createdAt: number;
  };

  try {
    storedState = JSON.parse(storedStateCookie);
  } catch {
    return NextResponse.redirect(
      new URL('/settings/integrations?oauth_error=invalid_state', request.url)
    );
  }

  // CSRF validation — state must match exactly
  if (storedState.state !== stateParam || storedState.provider !== provider) {
    console.error(`[OAuth Callback] State mismatch for provider ${provider}`);
    return NextResponse.redirect(
      new URL('/settings/integrations?oauth_error=state_mismatch', request.url)
    );
  }

  // State cookie is single-use — delete immediately
  const response = NextResponse.redirect(
    new URL(`${storedState.returnTo}?oauth_success=${provider}`, request.url)
  );
  response.cookies.delete(`oauth_state_${provider}`);

  const adapter = getAdapter(provider);
  if (!adapter) {
    // Adapter not yet registered — record the attempt and redirect
    console.warn(`[OAuth Callback] Adapter for '${provider}' not yet registered (Phase 1B/1C pending)`);
    return NextResponse.redirect(
      new URL(`/settings/integrations?oauth_error=adapter_not_ready&provider=${provider}`, request.url)
    );
  }

  // Create Supabase client for server-side operations
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    // Exchange authorization code for tokens
    const tokenSet = await adapter.exchangeCodeForTokens(
      { code, state: stateParam },
      storedState.codeVerifier
    );

    // Encrypt tokens before storage — never store plain text
    // Uses existing pgcrypto encrypt_provider_config RPC
    const tokenPayload = {
      access_token: tokenSet.accessToken,
      ...(tokenSet.refreshToken ? { refresh_token: tokenSet.refreshToken } : {}),
    };

    const { data: encryptedData } = await supabase.rpc('encrypt_provider_config', {
      plain_json: tokenPayload,
    });

    // Store encrypted OAuth credentials
    await supabase.from('integration_oauth_credentials').upsert(
      {
        company_id: storedState.companyId,
        provider_slug: provider,
        encrypted_access_token: encryptedData ?? null,
        encrypted_refresh_token: null, // Stored within encrypted_access_token blob
        token_type: tokenSet.tokenType,
        expires_at: tokenSet.expiresAt.toISOString(),
        refresh_expires_at: tokenSet.refreshExpiresAt?.toISOString() ?? null,
        external_user_id: tokenSet.externalUserId ?? null,
        external_user_email: tokenSet.externalUserEmail ?? null,
        external_tenant_id: tokenSet.externalTenantId ?? null,
        scope_string: tokenSet.scope ?? null,
        is_valid: true,
        revoked_at: null,
      },
      { onConflict: 'company_id,provider_slug' }
    );

    // List and store external organisations
    try {
      const orgs = await adapter.listExternalOrgs(tokenSet.accessToken);
      if (orgs.length > 0) {
        const primaryOrg = orgs[0];
        await supabase.from('integration_external_orgs').upsert(
          {
            company_id: storedState.companyId,
            provider_slug: provider,
            external_org_id: primaryOrg.externalOrgId,
            external_org_name: primaryOrg.externalOrgName,
            external_tenant_id: primaryOrg.externalTenantId ?? null,
            org_metadata: primaryOrg.metadata ?? {},
            is_primary: true,
            connected_at: new Date().toISOString(),
          },
          { onConflict: 'company_id,provider_slug,external_org_id' }
        );

        // Update provider_integrations with connection info
        await supabase.from('provider_integrations').upsert(
          {
            company_id: storedState.companyId,
            provider_slug: provider,
            provider_name: adapter.providerName,
            category: provider === 'xero' || provider === 'myob' ? 'accounting'
              : provider === 'microsoft' ? 'microsoft'
              : provider === 'google' ? 'google'
              : provider === 'stripe'? 'payments' :'other',
            status: 'active',
            is_enabled: true,
            connected_by: storedState.userId,
            connected_at: new Date().toISOString(),
            external_org_id: primaryOrg.externalOrgId,
            display_config: {
              organisationName: primaryOrg.externalOrgName,
              externalOrgId: primaryOrg.externalOrgId,
            },
            reauth_required: false,
          },
          { onConflict: 'company_id,provider_slug' }
        );
      }
    } catch (orgErr) {
      // Non-fatal — log but don't fail the connection
      console.warn(`[OAuth Callback] Failed to fetch external orgs for ${provider}:`, orgErr instanceof Error ? orgErr.message : 'Unknown');
    }

    // Store granted scopes
    if (tokenSet.scope) {
      const scopes = tokenSet.scope.split(/[\s,]+/).filter(Boolean);
      for (const scopeName of scopes) {
        await supabase.from('integration_scopes').upsert(
          {
            company_id: storedState.companyId,
            provider_slug: provider,
            scope_name: scopeName,
            granted_at: new Date().toISOString(),
            revoked_at: null,
          },
          { onConflict: 'company_id,provider_slug,scope_name' }
        );
      }
    }

    // Record acquisition source
    if (storedState.acquisitionSource && storedState.acquisitionSource !== 'direct') {
      await supabase.from('integration_acquisition_source').upsert(
        {
          company_id: storedState.companyId,
          source: storedState.acquisitionSource,
          provider_slug: provider,
          activated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' }
      );
    }

    // Write audit log — no token values logged
    await supabase.from('integration_audit_log').insert({
      company_id: storedState.companyId,
      provider_slug: provider,
      action: 'connected',
      performed_by: storedState.userId,
      details: {
        external_user_email: tokenSet.externalUserEmail ?? null,
        external_tenant_id: tokenSet.externalTenantId ?? null,
        acquisition_source: storedState.acquisitionSource,
        scopes_granted: tokenSet.scope ?? null,
      },
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[OAuth Callback] ${provider} token exchange failed:`, message);

    // Write failure audit log
    await supabase.from('integration_audit_log').insert({
      company_id: storedState.companyId,
      provider_slug: provider,
      action: 'error',
      performed_by: storedState.userId,
      details: { error: message, phase: 'token_exchange' },
    });

    return NextResponse.redirect(
      new URL(`/settings/integrations?oauth_error=token_exchange_failed&provider=${provider}`, request.url)
    );
  }
}
