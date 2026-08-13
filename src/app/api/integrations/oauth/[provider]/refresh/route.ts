/**
 * OAuth Token Refresh
 * POST /api/integrations/oauth/[provider]/refresh
 *
 * Server-side token refresh — never exposes tokens to browser clients.
 * Called by server-side processes when access token is near expiry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAdapter } from '@/lib/services/integrationFrameworkService';
// Register all provider adapters (Xero, etc.) before any adapter lookup
import '@/lib/integrations/adapters';

export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { provider } = params;

  const cookieStore = await cookies();
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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_roles')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'No company associated with this user' }, { status: 400 });
  }

  const adapter = getAdapter(provider);
  if (!adapter) {
    return NextResponse.json({ error: `Adapter for '${provider}' not registered` }, { status: 501 });
  }

  try {
    // Retrieve encrypted refresh token
    const { data: creds } = await supabase
      .from('integration_oauth_credentials')
      .select('encrypted_access_token, expires_at, is_valid')
      .eq('company_id', profile.company_id)
      .eq('provider_slug', provider)
      .is('revoked_at', null)
      .single();

    if (!creds?.is_valid) {
      // Mark reauth required
      await supabase
        .from('provider_integrations')
        .update({ reauth_required: true, status: 'error' })
        .eq('company_id', profile.company_id)
        .eq('provider_slug', provider);

      return NextResponse.json({ error: 'Credentials invalid — reauthorisation required', reauthRequired: true }, { status: 401 });
    }

    // Decrypt to get refresh token
    const { data: decryptedData } = await supabase.rpc('decrypt_provider_config', {
      encrypted_text: creds.encrypted_access_token,
    });

    if (!decryptedData?.refresh_token) {
      return NextResponse.json({ error: 'No refresh token available' }, { status: 400 });
    }

    // Perform token refresh via provider adapter
    const newTokenSet = await adapter.refreshAccessToken(decryptedData.refresh_token);

    // Re-encrypt new tokens
    const tokenPayload = {
      access_token: newTokenSet.accessToken,
      ...(newTokenSet.refreshToken ? { refresh_token: newTokenSet.refreshToken } : { refresh_token: decryptedData.refresh_token }),
    };

    const { data: encryptedData } = await supabase.rpc('encrypt_provider_config', {
      plain_json: tokenPayload,
    });

    // Update stored credentials
    await supabase
      .from('integration_oauth_credentials')
      .update({
        encrypted_access_token: encryptedData ?? creds.encrypted_access_token,
        expires_at: newTokenSet.expiresAt.toISOString(),
        refresh_expires_at: newTokenSet.refreshExpiresAt?.toISOString() ?? null,
        is_valid: true,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', profile.company_id)
      .eq('provider_slug', provider);

    // Audit log — no token values
    await supabase.from('integration_audit_log').insert({
      company_id: profile.company_id,
      provider_slug: provider,
      action: 'token_refreshed',
      performed_by: user.id,
      details: { expires_at: newTokenSet.expiresAt.toISOString() },
    });

    return NextResponse.json({ success: true, expiresAt: newTokenSet.expiresAt.toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[OAuth Refresh] ${provider} refresh failed:`, message);

    // Mark reauth required on refresh failure
    await supabase
      .from('provider_integrations')
      .update({ reauth_required: true, status: 'error' })
      .eq('company_id', profile.company_id)
      .eq('provider_slug', provider);

    await supabase.from('integration_audit_log').insert({
      company_id: profile.company_id,
      provider_slug: provider,
      action: 'error',
      performed_by: user.id,
      details: { error: message, phase: 'token_refresh' },
    });

    return NextResponse.json({ error: 'Token refresh failed', reauthRequired: true }, { status: 500 });
  }
}
