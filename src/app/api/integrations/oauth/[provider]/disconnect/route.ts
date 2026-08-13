/**
 * OAuth Disconnect
 * POST /api/integrations/oauth/[provider]/disconnect
 *
 * Revokes tokens, cleans up provider-side subscriptions,
 * marks integration as disconnected, writes audit log.
 * Requires admin permission.
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

  // Check admin permission via role_permissions
  const { data: perms } = await supabase
    .from('role_permissions')
    .select('can_manage_company')
    .eq('company_id', profile.company_id)
    .single();

  if (!perms?.can_manage_company) {
    return NextResponse.json({ error: 'Administrator permission required to disconnect integrations' }, { status: 403 });
  }

  try {
    // Retrieve credentials for revocation
    const { data: creds } = await supabase
      .from('integration_oauth_credentials')
      .select('encrypted_access_token, is_valid')
      .eq('company_id', profile.company_id)
      .eq('provider_slug', provider)
      .is('revoked_at', null)
      .single();

    const adapter = getAdapter(provider);

    // Attempt token revocation if adapter available and credentials exist
    if (adapter && creds?.encrypted_access_token) {
      try {
        const { data: decryptedData } = await supabase.rpc('decrypt_provider_config', {
          encrypted_text: creds.encrypted_access_token,
        });

        if (decryptedData?.access_token) {
          await adapter.revokeTokens(
            decryptedData.access_token,
            decryptedData.refresh_token
          );
        }
      } catch (revokeErr) {
        // Non-fatal — continue with local cleanup even if provider revocation fails
        console.warn(`[OAuth Disconnect] Token revocation failed for ${provider}:`, revokeErr instanceof Error ? revokeErr.message : 'Unknown');
      }
    }

    // Mark credentials as revoked
    await supabase
      .from('integration_oauth_credentials')
      .update({ is_valid: false, revoked_at: new Date().toISOString() })
      .eq('company_id', profile.company_id)
      .eq('provider_slug', provider);

    // Update provider_integrations status
    await supabase
      .from('provider_integrations')
      .update({
        status: 'not_configured',
        is_enabled: false,
        reauth_required: false,
        connected_at: null,
        connected_by: null,
        external_org_id: null,
        last_sync_at: null,
        last_sync_status: null,
      })
      .eq('company_id', profile.company_id)
      .eq('provider_slug', provider);

    // Deactivate external org mappings
    await supabase
      .from('integration_external_orgs')
      .update({ disconnected_at: new Date().toISOString() })
      .eq('company_id', profile.company_id)
      .eq('provider_slug', provider)
      .is('disconnected_at', null);

    // Revoke scope records
    await supabase
      .from('integration_scopes')
      .update({ revoked_at: new Date().toISOString() })
      .eq('company_id', profile.company_id)
      .eq('provider_slug', provider)
      .is('revoked_at', null);

    // Deactivate webhook subscriptions
    await supabase
      .from('integration_webhooks')
      .update({ is_active: false })
      .eq('company_id', profile.company_id)
      .eq('provider_slug', provider);

    // Audit log
    await supabase.from('integration_audit_log').insert({
      company_id: profile.company_id,
      provider_slug: provider,
      action: 'disconnected',
      performed_by: user.id,
      details: { disconnected_by: user.email ?? user.id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[OAuth Disconnect] ${provider} disconnect failed:`, message);
    return NextResponse.json({ error: 'Disconnect failed' }, { status: 500 });
  }
}
