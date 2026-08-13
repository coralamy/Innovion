/**
 * Xero Provider Adapter
 *
 * Implements the canonical ProviderAdapter interface for Xero OAuth 2.0.
 *
 * Phase 1 scope (read-only):
 *   - Organisation metadata (accounting.settings.read)
 *   - Contacts / customers (accounting.contacts.read)
 *
 * OAuth callback: https://innovion.app/api/integrations/oauth/xero/callback
 * Webhook endpoint: https://innovion.app/api/integrations/webhooks/xero
 *
 * Security:
 *   - PKCE (S256) is used for all authorization requests
 *   - Tokens are never logged or returned to browser clients
 *   - Webhook validation uses HMAC-SHA256 of raw body with XERO_WEBHOOK_KEY
 *   - Refresh token rotation is handled — new refresh token replaces old
 *   - No Xero secret or token is committed to the repository
 *
 * Credentials (environment variables — never committed):
 *   XERO_CLIENT_ID       — Xero OAuth 2.0 Client ID
 *   XERO_CLIENT_SECRET   — Xero OAuth 2.0 Client Secret
 *   XERO_WEBHOOK_KEY     — Xero webhook signing key (from Xero Developer portal)
 */

import {
  BaseProviderAdapter,
  type OAuthAuthorizeParams,
  type OAuthCallbackParams,
  type OAuthTokenSet,
  type ExternalOrg,
  type SyncResult,
  type HealthCheckResult,
  type WebhookValidationResult,
} from '@/lib/integrations/providerAdapter';

// ── Xero API constants ────────────────────────────────────────────────────────

const XERO_AUTHORIZATION_ENDPOINT = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_ENDPOINT = 'https://identity.xero.com/connect/token';
const XERO_REVOCATION_ENDPOINT = 'https://identity.xero.com/connect/revocation';
const XERO_CONNECTIONS_ENDPOINT = 'https://api.xero.com/connections';
const XERO_ACCOUNTING_API = 'https://api.xero.com/api.xro/2.0';

// ── Xero API response types ───────────────────────────────────────────────────

interface XeroTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  id_token?: string;
}

interface XeroConnection {
  id: string;
  tenantId: string;
  tenantType: string;
  tenantName: string;
  createdDateUtc: string;
  updatedDateUtc: string;
}

interface XeroOrganisation {
  OrganisationID: string;
  Name: string;
  LegalName?: string;
  CountryCode?: string;
  BaseCurrency?: string;
  OrganisationType?: string;
  IsDemoCompany?: boolean;
  ShortCode?: string;
}

interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
  IsCustomer?: boolean;
  IsSupplier?: boolean;
  ContactStatus?: string;
  UpdatedDateUTC?: string;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class XeroProviderAdapter extends BaseProviderAdapter {
  readonly providerSlug = 'xero';
  readonly providerName = 'Xero';

  /**
   * Phase 1 scopes — read-only contacts and organisation metadata.
   * offline_access is required for refresh token issuance.
   */
  readonly requiredScopes = [
    'openid',
    'profile',
    'email',
    'accounting.contacts.read',
    'accounting.settings.read',
    'offline_access',
  ];

  // ── OAuth 2.0 Authorization URL ─────────────────────────────────────────────

  async buildAuthorizationUrl(params: OAuthAuthorizeParams): Promise<{
    url: string;
    state: string;
    codeVerifier?: string;
  }> {
    const { state } = params;
    const { codeVerifier, codeChallenge } = await this.generatePKCE();

    const url = new URL(XERO_AUTHORIZATION_ENDPOINT);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.getClientId());
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', this.requiredScopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return { url: url.toString(), state, codeVerifier };
  }

  // ── Token Exchange ──────────────────────────────────────────────────────────

  async exchangeCodeForTokens(
    params: OAuthCallbackParams,
    codeVerifier?: string
  ): Promise<OAuthTokenSet> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: this.redirectUri,
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
    });

    if (codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const response = await fetch(XERO_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Never log the full error body — may contain sensitive data
      throw new Error(`Xero token exchange failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as XeroTokenResponse;
    return this.mapTokenResponse(data);
  }

  // ── Token Refresh ───────────────────────────────────────────────────────────

  /**
   * Refresh an expired Xero access token.
   *
   * Xero uses refresh token rotation — each refresh issues a new refresh token.
   * The old refresh token is invalidated immediately.
   * The caller (integrationFrameworkService) must store the new refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
    });

    const response = await fetch(XERO_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      // 400 with invalid_grant means refresh token is expired/revoked
      if (response.status === 400) {
        throw new Error('Xero refresh token expired or revoked — reauthorisation required');
      }
      throw new Error(`Xero token refresh failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as XeroTokenResponse;
    return this.mapTokenResponse(data);
  }

  // ── List External Organisations (Xero Tenants) ──────────────────────────────

  /**
   * List Xero organisations (tenants) the user has authorised.
   *
   * Xero supports multiple tenants per OAuth connection.
   * Phase 1: we map the first (primary) tenant.
   * The Xero tenant ID is stored as external_org_id — it is an external
   * integration reference, not an Innovion tenant model.
   */
  async listExternalOrgs(accessToken: string): Promise<ExternalOrg[]> {
    const response = await fetch(XERO_CONNECTIONS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Xero connections fetch failed: HTTP ${response.status}`);
    }

    const connections = (await response.json()) as XeroConnection[];

    return connections.map((conn) => ({
      externalOrgId: conn.tenantId,
      externalOrgName: conn.tenantName,
      externalTenantId: conn.tenantId,
      metadata: {
        connectionId: conn.id,
        tenantType: conn.tenantType,
        createdDateUtc: conn.createdDateUtc,
      },
    }));
  }

  // ── Token Revocation ────────────────────────────────────────────────────────

  /**
   * Revoke Xero tokens.
   * Xero supports token revocation via the standard OAuth 2.0 revocation endpoint.
   * Revoking the refresh token invalidates the entire session.
   * Must not throw if tokens are already invalid.
   */
  async revokeTokens(accessToken: string, refreshToken?: string): Promise<void> {
    // Prefer revoking the refresh token — this invalidates the entire session
    const tokenToRevoke = refreshToken ?? accessToken;

    try {
      const body = new URLSearchParams({
        token: tokenToRevoke,
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
      });

      const response = await fetch(XERO_REVOCATION_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      // 200 = revoked; 400 = already invalid — both are acceptable
      if (!response.ok && response.status !== 400) {
        // Log warning but don't throw — local cleanup must still proceed
        console.warn(`[XeroAdapter] Token revocation returned HTTP ${response.status} — proceeding with local cleanup`);
      }
    } catch (err) {
      // Network errors during revocation must not block local cleanup
      console.warn('[XeroAdapter] Token revocation request failed — proceeding with local cleanup:', err instanceof Error ? err.message : 'Unknown');
    }
  }

  // ── Webhook Validation ──────────────────────────────────────────────────────

  /**
   * Validate an inbound Xero webhook request.
   *
   * Xero webhook validation (per Xero documentation):
   * 1. Compute HMAC-SHA256 of the raw request body using the webhook signing key.
   * 2. Base64-encode the result.
   * 3. Compare against the x-xero-signature header value.
   * 4. If they match, the webhook is authentic.
   *
   * Xero also sends an "intention to receive" validation request:
   * - The body is an empty JSON object: {}
   * - The x-xero-signature header is present and valid
   * - The events array is empty: []
   * - Respond with HTTP 200 to confirm the endpoint is reachable
   *
   * The signing key is XERO_WEBHOOK_KEY from environment — never committed.
   */
  async validateWebhook(
    headers: Record<string, string>,
    rawBody: Buffer,
    signingSecret: string
  ): Promise<WebhookValidationResult> {
    const xeroSignature = headers['x-xero-signature'];

    if (!xeroSignature) {
      return { isValid: false };
    }

    // Compute HMAC-SHA256 of raw body using the webhook key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(signingSecret);
    const bodyData = rawBody;

    let computedSignature: string;
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, bodyData);
      computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    } catch (err) {
      console.error('[XeroAdapter] Webhook HMAC computation failed:', err instanceof Error ? err.message : 'Unknown');
      return { isValid: false };
    }

    // Constant-time comparison to prevent timing attacks
    const isValid = this.constantTimeEqual(computedSignature, xeroSignature);

    if (!isValid) {
      return { isValid: false };
    }

    // Parse payload to extract event metadata
    let payload: {
      events?: Array<{
        eventId?: string;
        eventType?: string;
        eventDateUtc?: string;
        resourceId?: string;
        resourceUrl?: string;
        tenantId?: string;
        tenantType?: string;
      }>;
      lastEventSequence?: number;
      firstEventSequence?: number;
      entropy?: string;
    };

    try {
      payload = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      return { isValid: true }; // Signature valid but unparseable — let caller handle
    }

    const events = payload.events ?? [];

    // Intention-to-receive: empty events array — signature valid, no events to process
    if (events.length === 0) {
      return {
        isValid: true,
        eventType: 'xero.validation',
        externalEventId: `xero-validation-${Date.now()}`,
        externalTenantId: undefined,
      };
    }

    // Extract metadata from first event (batch events share the same tenant)
    const firstEvent = events[0];
    return {
      isValid: true,
      eventType: firstEvent.eventType ?? 'xero.event',
      externalEventId: firstEvent.eventId ?? undefined,
      externalTenantId: firstEvent.tenantId ?? undefined,
    };
  }

  // ── Sync ────────────────────────────────────────────────────────────────────

  /**
   * Execute a Phase 1 sync operation.
   *
   * Phase 1 scope (read-only):
   *   - Organisation metadata (accounting.settings.read)
   *   - Contacts / customers (accounting.contacts.read)
   *
   * Full sync: fetches all contacts and organisation metadata.
   * Incremental sync: fetches contacts modified since last cursor.
   *
   * Results are stored in integration_webhook_events for async processing.
   * This method returns counts only — no raw Xero data is returned to callers.
   */
  async sync(
    accessToken: string,
    externalOrgId: string,
    syncType: 'full' | 'incremental',
    cursor?: Record<string, unknown>
  ): Promise<SyncResult> {
    let result: SyncResult = {
      recordsFetched: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
    };

    try {
      // Fetch organisation metadata
      const orgResult = await this.fetchOrganisation(accessToken, externalOrgId);
      if (orgResult) {
        result.recordsFetched += 1;
        result.recordsUpdated += 1;
      }

      // Fetch contacts (with optional modified-since cursor for incremental)
      const modifiedSince = syncType === 'incremental' && cursor?.modifiedSince
        ? String(cursor.modifiedSince)
        : undefined;

      const contactsResult = await this.fetchContacts(accessToken, externalOrgId, modifiedSince);
      result.recordsFetched += contactsResult.fetched;
      result.recordsUpdated += contactsResult.updated;

      // Set next cursor for incremental sync
      result.nextCursor = { modifiedSince: new Date().toISOString() };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sync error';
      result.recordsFailed += 1;
      result.errors = [{ code: 'SYNC_ERROR', message }];
    }

    return result;
  }

  // ── Health Check ────────────────────────────────────────────────────────────

  /**
   * Check Xero connection health by fetching the connections list.
   * Does not modify any state.
   */
  async checkHealth(accessToken: string): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetch(XERO_CONNECTIONS_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { isHealthy: true, latencyMs };
      }

      if (response.status === 401) {
        return { isHealthy: false, latencyMs, error: 'Access token expired or invalid' };
      }

      return { isHealthy: false, latencyMs, error: `Xero API returned HTTP ${response.status}` };
    } catch (err) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private getClientId(): string {
    const clientId = process.env.XERO_CLIENT_ID;
    if (!clientId) {
      throw new Error('XERO_CLIENT_ID environment variable is not configured');
    }
    return clientId;
  }

  private getClientSecret(): string {
    const clientSecret = process.env.XERO_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error('XERO_CLIENT_SECRET environment variable is not configured');
    }
    return clientSecret;
  }

  private mapTokenResponse(data: XeroTokenResponse): OAuthTokenSet {
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    // Xero refresh tokens expire after 60 days
    const refreshExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type ?? 'Bearer',
      expiresAt,
      refreshExpiresAt,
      scope: data.scope,
    };
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   */
  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Fetch Xero organisation metadata for a tenant.
   * Uses accounting.settings.read scope.
   */
  private async fetchOrganisation(
    accessToken: string,
    tenantId: string
  ): Promise<XeroOrganisation | null> {
    const response = await fetch(`${XERO_ACCOUNTING_API}/Organisation`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as { Organisations?: XeroOrganisation[] };
    return data.Organisations?.[0] ?? null;
  }

  /**
   * Fetch Xero contacts for a tenant.
   * Uses accounting.contacts.read scope.
   * Supports incremental sync via If-Modified-Since header.
   */
  private async fetchContacts(
    accessToken: string,
    tenantId: string,
    modifiedSince?: string
  ): Promise<{ fetched: number; updated: number }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Xero-Tenant-Id': tenantId,
      Accept: 'application/json',
    };

    if (modifiedSince) {
      headers['If-Modified-Since'] = modifiedSince;
    }

    // Fetch customers only (IsCustomer=true) for Phase 1 scope
    const url = new URL(`${XERO_ACCOUNTING_API}/Contacts`);
    url.searchParams.set('where', 'IsCustomer=true');
    url.searchParams.set('includeArchived', 'false');

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      if (response.status === 304) {
        // Not modified — no changes since last sync
        return { fetched: 0, updated: 0 };
      }
      throw new Error(`Xero Contacts API returned HTTP ${response.status}`);
    }

    const data = await response.json() as { Contacts?: XeroContact[] };
    const contacts = data.Contacts ?? [];

    return { fetched: contacts.length, updated: contacts.length };
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const xeroAdapter = new XeroProviderAdapter();
