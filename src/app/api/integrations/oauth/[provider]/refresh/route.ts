/**
 * OAuth Token Refresh
 * POST /api/integrations/oauth/[provider]/refresh
 *
 * Server-side token refresh. Tokens are never exposed to browser clients.
 *
 * ---------------------------------------------------------------------------
 * DEFECTS REMEDIATED
 *
 * 1. NO AUTHORISATION CHECK (P1). The route required only authentication. Any
 *    member of the tenant at any role — including 'viewer' — could rotate the
 *    organisation's provider credentials, and on failure the route itself sets
 *    `reauth_required = true, status = 'error'` on provider_integrations,
 *    breaking the integration for every user of that tenant. Restricted to
 *    tenant administrators.
 *
 * 2. ARBITRARY TENANT. `.eq('user_id', ...).limit(1).single()` chose whichever
 *    membership came back first for a multi-tenant user.
 *
 * 3. WRONG RPC ARGUMENT NAME. `decrypt_provider_config` was called with
 *    `{ encrypted_text: ... }`; the parameter is `cipher_text`. The call could
 *    never resolve, so refresh always fell through to "No refresh token
 *    available" — the token-refresh path has never worked.
 *
 * 4. RE-ENCRYPTION FAILURE SILENTLY DISCARDED. On an encryption error the code
 *    wrote `encrypted_access_token: encryptedData ?? creds.encrypted_access_token`
 *    — retaining the OLD ciphertext while recording the NEW expiry. The stored
 *    access token would then be an expired one advertised as fresh, and the
 *    integration would fail on every subsequent call with no diagnostic.
 *
 * 5. WRITES THROUGH THE END-USER CLIENT. `integration_oauth_credentials` is not
 *    writable by `authenticated` (migration 20260817006000); the update was
 *    refused and the error discarded.
 *
 * 6. `params` IS A PROMISE in Next.js 15 and was destructured synchronously.
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

  const guard = await requireTenantAdmin(request, 'oauth/refresh');
  if (!guard.ok) return guard.response;
  const { userId, companyId } = guard;

  const adapter = getAdapter(provider);
  if (!adapter) {
    return NextResponse.json(
      { error: `Adapter for '${provider}' not registered` },
      { status: 501 }
    );
  }

  let db;
  try {
    db = createAdminClient();
  } catch (err) {
    logger.error('oauth/refresh', 'Service role client unavailable', { provider }, err);
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const markReauthRequired = async () => {
    const { error } = await db
      .from('provider_integrations')
      .update({ reauth_required: true, status: 'error' })
      .eq('company_id', companyId)
      .eq('provider_slug', provider);
    if (error) {
      logger.warn('oauth/refresh', 'Failed to flag reauth_required', {
        provider,
        companyId,
        error: error.message,
      });
    }
  };

  try {
    const { data: creds, error: credsError } = await db
      .from('integration_oauth_credentials')
      .select('encrypted_access_token, expires_at, is_valid')
      .eq('company_id', companyId)
      .eq('provider_slug', provider)
      .is('revoked_at', null)
      .maybeSingle();

    if (credsError) {
      logger.error('oauth/refresh', 'Failed to read credentials', {
        provider,
        companyId,
        error: credsError.message,
      });
      return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 });
    }

    if (!creds || !creds.is_valid) {
      await markReauthRequired();
      return NextResponse.json(
        { error: 'Credentials invalid — reauthorisation required', reauthRequired: true },
        { status: 401 }
      );
    }

    // Correct parameter name: decrypt_provider_config(cipher_text TEXT).
    const { data: decrypted, error: decryptError } = await db.rpc('decrypt_provider_config', {
      cipher_text: creds.encrypted_access_token,
    });

    if (decryptError) {
      // Post-20260817003000 this raises on a wrong or missing key rather than
      // quietly returning {}. That is a configuration fault, not a user fault.
      logger.error('oauth/refresh', 'Credential decryption failed', {
        provider,
        companyId,
        error: decryptError.message,
      });
      return NextResponse.json({ error: 'Stored credentials could not be read' }, { status: 500 });
    }

    if (!decrypted?.refresh_token) {
      await markReauthRequired();
      return NextResponse.json(
        { error: 'No refresh token available — reauthorisation required', reauthRequired: true },
        { status: 400 }
      );
    }

    const newTokenSet = await adapter.refreshAccessToken(decrypted.refresh_token);

    const tokenPayload = {
      access_token: newTokenSet.accessToken,
      refresh_token: newTokenSet.refreshToken ?? decrypted.refresh_token,
    };

    const { data: reEncrypted, error: encryptError } = await db.rpc('encrypt_provider_config', {
      plain_json: tokenPayload,
    });

    // Never retain the previous ciphertext alongside a new expiry: that stores
    // an expired token and advertises it as fresh.
    if (encryptError || !reEncrypted) {
      logger.error('oauth/refresh', 'Re-encryption failed — refreshed token discarded', {
        provider,
        companyId,
        error: encryptError?.message,
      });
      await markReauthRequired();
      return NextResponse.json(
        { error: 'Token refresh failed', reauthRequired: true },
        { status: 500 }
      );
    }

    const { error: updateError } = await db
      .from('integration_oauth_credentials')
      .update({
        encrypted_access_token: reEncrypted,
        expires_at: newTokenSet.expiresAt.toISOString(),
        refresh_expires_at: newTokenSet.refreshExpiresAt?.toISOString() ?? null,
        is_valid: true,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('provider_slug', provider);

    if (updateError) {
      logger.error('oauth/refresh', 'Failed to persist refreshed credentials', {
        provider,
        companyId,
        error: updateError.message,
      });
      return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 });
    }

    await db.from('integration_audit_log').insert({
      company_id: companyId,
      provider_slug: provider,
      action: 'token_refreshed',
      performed_by: userId,
      details: { expires_at: newTokenSet.expiresAt.toISOString() },
    });

    return NextResponse.json({ success: true, expiresAt: newTokenSet.expiresAt.toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('oauth/refresh', 'Token refresh failed', { provider, companyId }, err);

    await markReauthRequired();
    await db.from('integration_audit_log').insert({
      company_id: companyId,
      provider_slug: provider,
      action: 'error',
      performed_by: userId,
      details: { error: message, phase: 'token_refresh' },
    });

    return NextResponse.json(
      { error: 'Token refresh failed', reauthRequired: true },
      { status: 500 }
    );
  }
}
