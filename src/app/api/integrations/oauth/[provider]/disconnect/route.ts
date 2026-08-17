/**
 * OAuth Disconnect
 * POST /api/integrations/oauth/[provider]/disconnect
 *
 * Revokes provider tokens, deactivates webhook subscriptions, marks the
 * integration disconnected and writes an audit entry. Administrator only.
 *
 * ---------------------------------------------------------------------------
 * DEFECTS REMEDIATED
 *
 * 1. BROKEN PERMISSION CHECK — see `requireTenantAdmin` for the full analysis
 *    of the `role_permissions` query that was filtered by company but not by
 *    the caller's role.
 *
 * 2. WRONG RPC ARGUMENT NAME. Revocation called
 *      supabase.rpc('decrypt_provider_config', { encrypted_text: ... })
 *    but the function's parameter is `cipher_text`. PostgREST could not resolve
 *    the overload, so the call always failed; the failure was caught by a
 *    `catch` that logged a warning and continued, so provider-side tokens were
 *    NEVER revoked on disconnect. The integration appeared disconnected in
 *    Innovion while the access token remained live at the provider.
 *
 * 3. EVERY WRITE UNCHECKED, AND NOW IMPOSSIBLE FOR AN END USER.
 *    `integration_oauth_credentials` is deliberately not writable by
 *    `authenticated` (migration 20260817006000), so the anon/session client
 *    could not mark credentials revoked. Writes now use the service role, with
 *    the tenant pinned to the verified administrator's company, and errors are
 *    checked. Revocation failing is now reported to the caller rather than
 *    reported as success.
 *
 * 4. `params` IS A PROMISE in Next.js 15 and was destructured synchronously.
 *
 * 5. NO RATE LIMITING on a destructive, unauthenticated-until-checked endpoint.
 * ---------------------------------------------------------------------------
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '@/lib/services/integrationFrameworkService';
import { requireTenantAdmin } from '@/lib/integrations/tenantAdminGuard';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
// Register all provider adapters (Xero, etc.) before any adapter lookup
import '@/lib/integrations/adapters';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  const guard = await requireTenantAdmin(request, 'oauth/disconnect');
  if (!guard.ok) return guard.response;
  const { userId, userEmail, companyId } = guard;

  let db;
  try {
    db = createAdminClient();
  } catch (err) {
    logger.error('oauth/disconnect', 'Service role client unavailable', { provider }, err);
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    const { data: creds } = await db
      .from('integration_oauth_credentials')
      .select('encrypted_access_token, is_valid')
      .eq('company_id', companyId)
      .eq('provider_slug', provider)
      .is('revoked_at', null)
      .maybeSingle();

    const adapter = getAdapter(provider);

    let providerRevoked = false;
    let revocationError: string | null = null;

    if (adapter && creds?.encrypted_access_token) {
      try {
        // Correct parameter name: the function signature is
        // decrypt_provider_config(cipher_text TEXT).
        const { data: decrypted, error: decryptError } = await db.rpc('decrypt_provider_config', {
          cipher_text: creds.encrypted_access_token,
        });

        if (decryptError) throw new Error(decryptError.message);

        if (decrypted?.access_token) {
          await adapter.revokeTokens(decrypted.access_token, decrypted.refresh_token);
          providerRevoked = true;
        }
      } catch (revokeErr) {
        revocationError = revokeErr instanceof Error ? revokeErr.message : 'Unknown error';
        // Local cleanup still proceeds — but the caller is told, rather than
        // being shown an unqualified success while the provider token lives on.
        logger.error('oauth/disconnect', 'Provider-side token revocation failed', {
          provider,
          companyId,
          error: revocationError,
        });
      }
    }

    const now = new Date().toISOString();

    const { error: credError } = await db
      .from('integration_oauth_credentials')
      .update({ is_valid: false, revoked_at: now })
      .eq('company_id', companyId)
      .eq('provider_slug', provider);

    if (credError) {
      logger.error('oauth/disconnect', 'Failed to mark credentials revoked', {
        provider,
        companyId,
        error: credError.message,
      });
      return NextResponse.json({ error: 'Disconnect failed' }, { status: 500 });
    }

    const cleanups = await Promise.all([
      db
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
        .eq('company_id', companyId)
        .eq('provider_slug', provider),
      db
        .from('integration_external_orgs')
        .update({ disconnected_at: now })
        .eq('company_id', companyId)
        .eq('provider_slug', provider)
        .is('disconnected_at', null),
      db
        .from('integration_scopes')
        .update({ revoked_at: now })
        .eq('company_id', companyId)
        .eq('provider_slug', provider)
        .is('revoked_at', null),
      db
        .from('integration_webhooks')
        .update({ is_active: false })
        .eq('company_id', companyId)
        .eq('provider_slug', provider),
    ]);

    for (const result of cleanups) {
      if (result.error) {
        logger.warn('oauth/disconnect', 'Cleanup step failed', {
          provider,
          companyId,
          error: result.error.message,
        });
      }
    }

    await db.from('integration_audit_log').insert({
      company_id: companyId,
      provider_slug: provider,
      action: 'disconnected',
      performed_by: userId,
      details: {
        disconnected_by: userEmail ?? userId,
        provider_token_revoked: providerRevoked,
        revocation_error: revocationError,
      },
    });

    return NextResponse.json({
      success: true,
      providerTokenRevoked: providerRevoked,
      // Surfaced deliberately: a disconnect that could not revoke at the
      // provider leaves a live token and requires manual revocation there.
      warning: revocationError
        ? 'The integration was disconnected locally, but the provider did not confirm token revocation. Revoke access at the provider directly.'
        : undefined,
    });
  } catch (err) {
    logger.error('oauth/disconnect', 'Disconnect failed', { provider, companyId }, err);
    return NextResponse.json({ error: 'Disconnect failed' }, { status: 500 });
  }
}
