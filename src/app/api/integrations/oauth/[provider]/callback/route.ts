/**
 * OAuth Callback Handler
 * GET /api/integrations/oauth/[provider]/callback
 *
 * Validates the signed state cookie (CSRF + integrity), re-establishes the
 * caller's identity and tenant authority, exchanges the authorization code for
 * tokens, encrypts and stores them, maps the external organisation, and records
 * an audit entry. Tokens are never exposed to browser clients.
 *
 * ---------------------------------------------------------------------------
 * DEFECTS REMEDIATED
 *
 * 1. FORGEABLE STATE (P0). The state cookie was plain JSON and the route
 *    trusted `companyId` and `userId` from it. See
 *    src/lib/integrations/oauthState.ts for the full analysis. The state is now
 *    HMAC-signed and its age is verified.
 *
 * 2. NO RE-AUTHENTICATION (P0). Even with a genuine state cookie, the route
 *    never checked who was making the callback request or whether they still
 *    held authority over the tenant named in it. Authority is now re-verified
 *    against `user_roles` at the moment of use.
 *
 * 3. OPEN REDIRECT (P1). `returnTo` came from the cookie and was passed
 *    straight to `NextResponse.redirect(new URL(returnTo, request.url))`; an
 *    absolute URL replaces the base entirely. Now constrained to a local path.
 *
 * 4. EVERY WRITE SILENTLY FAILED (P1). All six writes went through the ANON
 *    client, and `integration_oauth_credentials`, `integration_external_orgs`,
 *    `integration_scopes` and `integration_acquisition_source` have SELECT-only
 *    RLS policies — so every one was refused. No error was checked (`await
 *    supabase.from(...).upsert(...)` with the result discarded), and the route
 *    redirected with `?oauth_success=<provider>` regardless. A user completed
 *    the OAuth dance, was told the integration had connected, and nothing had
 *    been stored. Writes now use the service-role client, and every error is
 *    checked and surfaced.
 *
 * 5. ENCRYPTION FAILURE TREATED AS SUCCESS (P0 for confidentiality).
 *    `const { data: encryptedData } = await supabase.rpc('encrypt_provider_
 *    config', ...)` discarded the error and then stored
 *    `encrypted_access_token: encryptedData ?? null`. After migration
 *    20260817003000 the encryption function raises when no key is configured —
 *    which this code would have turned into a stored NULL and a success
 *    message. Encryption failure now aborts the connection.
 *
 * 6. `params` IS A PROMISE in Next.js 15 and was destructured synchronously.
 *
 * 7. STATE COOKIE NOT CLEARED ON FAILURE. The single-use cookie was deleted
 *    only on the success path, so a failed exchange left a valid state cookie
 *    in place to be replayed. It is now cleared on every exit.
 * ---------------------------------------------------------------------------
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAdapter } from '@/lib/services/integrationFrameworkService';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyState, safeReturnTo } from '@/lib/integrations/oauthState';
import { logger } from '@/lib/logger';
// Register all provider adapters (Xero, etc.) before any adapter lookup
import '@/lib/integrations/adapters';

/** Build a redirect that always clears the single-use state cookie. */
function finish(
  request: NextRequest,
  provider: string,
  path: string,
  params: Record<string, string>
) {
  const url = new URL(safeReturnTo(path), request.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = NextResponse.redirect(url);
  response.cookies.set(`oauth_state_${provider}`, '', { path: '/', maxAge: 0 });
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const FAIL = '/settings/integrations';

  if (errorParam) {
    logger.warn('oauth/callback', 'Provider returned an error', { provider, error: errorParam });
    return finish(request, provider, FAIL, { oauth_error: errorParam, provider });
  }

  if (!code || !stateParam) {
    return finish(request, provider, FAIL, { oauth_error: 'missing_params', provider });
  }

  // ── 1. Verify the state cookie's integrity, origin and age ────────────────
  const cookieStore = await cookies();
  const verification = verifyState(cookieStore.get(`oauth_state_${provider}`)?.value, Date.now());

  if (!verification.ok) {
    logger.warn('oauth/callback', 'State cookie rejected', {
      provider,
      reason: verification.reason,
    });
    return finish(request, provider, FAIL, {
      oauth_error: verification.reason === 'expired' ? 'state_expired' : 'invalid_state',
      provider,
    });
  }

  const storedState = verification.payload;

  // ── 2. CSRF: the returned state must match the one we minted ──────────────
  // Both sides now originate from a signed cookie this server issued, so this
  // comparison is meaningful rather than self-referential.
  if (storedState.state !== stateParam || storedState.provider !== provider) {
    logger.warn('oauth/callback', 'State mismatch', { provider });
    return finish(request, provider, FAIL, { oauth_error: 'state_mismatch', provider });
  }

  // ── 3. Re-establish the caller and re-verify tenant authority ─────────────
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* read-only in this handler */
        },
      },
    }
  );

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user || user.id !== storedState.userId) {
    logger.warn('oauth/callback', 'Callback identity does not match the state it presented', {
      provider,
    });
    return finish(request, provider, FAIL, { oauth_error: 'session_mismatch', provider });
  }

  const { data: role } = await userClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', storedState.companyId)
    .maybeSingle();

  if (role?.role !== 'admin') {
    logger.warn('oauth/callback', 'Caller is not an administrator of the target tenant', {
      provider,
      companyId: storedState.companyId,
    });
    return finish(request, provider, FAIL, { oauth_error: 'not_authorised', provider });
  }

  const adapter = getAdapter(provider);
  if (!adapter) {
    return finish(request, provider, FAIL, { oauth_error: 'adapter_not_ready', provider });
  }

  // ── 4. Persist. Service role, because credential tables are deliberately
  //      not writable by end users; the tenant is pinned to the verified state.
  let db;
  try {
    db = createAdminClient();
  } catch (err) {
    logger.error('oauth/callback', 'Service role client unavailable', { provider }, err);
    return finish(request, provider, FAIL, { oauth_error: 'server_misconfigured', provider });
  }

  const companyId = storedState.companyId;

  try {
    const tokenSet = await adapter.exchangeCodeForTokens(
      { code, state: stateParam },
      storedState.codeVerifier
    );

    const tokenPayload = {
      access_token: tokenSet.accessToken,
      ...(tokenSet.refreshToken ? { refresh_token: tokenSet.refreshToken } : {}),
    };

    const { data: encrypted, error: encryptError } = await db.rpc('encrypt_provider_config', {
      plain_json: tokenPayload,
    });

    // Encryption is not optional. A failure here previously stored NULL and
    // reported success.
    if (encryptError || !encrypted) {
      logger.error('oauth/callback', 'Credential encryption failed — connection aborted', {
        provider,
        companyId,
        error: encryptError?.message,
      });
      return finish(request, provider, FAIL, { oauth_error: 'encryption_unavailable', provider });
    }

    const { error: credError } = await db.from('integration_oauth_credentials').upsert(
      {
        company_id: companyId,
        provider_slug: provider,
        encrypted_access_token: encrypted,
        encrypted_refresh_token: null, // stored inside the encrypted_access_token blob
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

    if (credError) {
      logger.error('oauth/callback', 'Failed to persist credentials', {
        provider,
        companyId,
        error: credError.message,
      });
      return finish(request, provider, FAIL, { oauth_error: 'storage_failed', provider });
    }

    // External organisation mapping — non-fatal, but errors are recorded.
    try {
      const orgs = await adapter.listExternalOrgs(tokenSet.accessToken);
      if (orgs.length > 0) {
        const primaryOrg = orgs[0];

        const { error: orgError } = await db.from('integration_external_orgs').upsert(
          {
            company_id: companyId,
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
        if (orgError) {
          logger.warn('oauth/callback', 'Failed to record external organisation', {
            provider,
            companyId,
            error: orgError.message,
          });
        }

        const { error: piError } = await db.from('provider_integrations').upsert(
          {
            company_id: companyId,
            provider_slug: provider,
            provider_name: adapter.providerName,
            category:
              provider === 'xero' || provider === 'myob'
                ? 'accounting'
                : provider === 'microsoft'
                  ? 'microsoft'
                  : provider === 'google'
                    ? 'google'
                    : provider === 'stripe'
                      ? 'payments'
                      : 'other',
            status: 'active',
            is_enabled: true,
            connected_by: user.id,
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
        if (piError) {
          logger.warn('oauth/callback', 'Failed to update provider_integrations', {
            provider,
            companyId,
            error: piError.message,
          });
        }
      }
    } catch (orgErr) {
      logger.warn(
        'oauth/callback',
        'Failed to fetch external organisations',
        { provider, companyId },
        orgErr
      );
    }

    if (tokenSet.scope) {
      const scopes = tokenSet.scope.split(/[\s,]+/).filter(Boolean);
      // One statement rather than a round trip per scope.
      const { error: scopeError } = await db.from('integration_scopes').upsert(
        scopes.map((scopeName) => ({
          company_id: companyId,
          provider_slug: provider,
          scope_name: scopeName,
          granted_at: new Date().toISOString(),
          revoked_at: null,
        })),
        { onConflict: 'company_id,provider_slug,scope_name' }
      );
      if (scopeError) {
        logger.warn('oauth/callback', 'Failed to record granted scopes', {
          provider,
          companyId,
          error: scopeError.message,
        });
      }
    }

    if (storedState.acquisitionSource && storedState.acquisitionSource !== 'direct') {
      const { error: acqError } = await db.from('integration_acquisition_source').upsert(
        {
          company_id: companyId,
          source: storedState.acquisitionSource,
          provider_slug: provider,
          activated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' }
      );
      if (acqError) {
        logger.warn('oauth/callback', 'Failed to record acquisition source', {
          provider,
          companyId,
          error: acqError.message,
        });
      }
    }

    // Audit — no token values are recorded.
    const { error: auditError } = await db.from('integration_audit_log').insert({
      company_id: companyId,
      provider_slug: provider,
      action: 'connected',
      performed_by: user.id,
      details: {
        external_user_email: tokenSet.externalUserEmail ?? null,
        external_tenant_id: tokenSet.externalTenantId ?? null,
        acquisition_source: storedState.acquisitionSource,
        scopes_granted: tokenSet.scope ?? null,
      },
    });
    if (auditError) {
      logger.warn('oauth/callback', 'Failed to write audit entry', {
        provider,
        companyId,
        error: auditError.message,
      });
    }

    return finish(request, provider, storedState.returnTo, { oauth_success: provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('oauth/callback', 'Token exchange failed', { provider, companyId }, err);

    await db.from('integration_audit_log').insert({
      company_id: companyId,
      provider_slug: provider,
      action: 'error',
      performed_by: user.id,
      details: { error: message, phase: 'token_exchange' },
    });

    return finish(request, provider, FAIL, { oauth_error: 'token_exchange_failed', provider });
  }
}
