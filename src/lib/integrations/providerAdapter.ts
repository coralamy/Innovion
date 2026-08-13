/**
 * Innovion Integration Framework — Provider Adapter Interface
 *
 * Defines the contract that every provider adapter must implement.
 * Provider-specific code (Xero, Microsoft, etc.) sits behind this interface.
 *
 * All external-facing URLs use the innovion.app domain.
 * OAuth callbacks: https://innovion.app/api/integrations/oauth/{provider}/callback
 */

// ── OAuth types ───────────────────────────────────────────────────────────────

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt: Date;
  refreshExpiresAt?: Date;
  scope?: string;
  externalUserId?: string;
  externalUserEmail?: string;
  externalTenantId?: string;
}

export interface OAuthAuthorizeParams {
  companyId: string;
  userId: string;
  /** Opaque state value for CSRF protection — must be validated on callback */
  state: string;
  /** PKCE code verifier (stored server-side, never sent to client) */
  codeVerifier?: string;
  /** Acquisition source for marketplace attribution */
  acquisitionSource?: string;
  /** Return path after successful connection */
  returnTo?: string;
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
  /** Provider-specific extra params (e.g. Xero session_state) */
  extra?: Record<string, string>;
}

// ── External organisation ─────────────────────────────────────────────────────

export interface ExternalOrg {
  externalOrgId: string;
  externalOrgName: string;
  externalTenantId?: string;
  metadata?: Record<string, unknown>;
}

// ── Sync types ────────────────────────────────────────────────────────────────

export interface SyncResult {
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  nextCursor?: Record<string, unknown>;
  errors?: Array<{ code: string; message: string; context?: Record<string, unknown> }>;
}

// ── Webhook types ─────────────────────────────────────────────────────────────

export interface WebhookValidationResult {
  isValid: boolean;
  /** Normalised event type string */
  eventType?: string;
  /** Provider-assigned event ID for idempotency */
  externalEventId?: string;
  /** Resolved company/tenant identifier from payload */
  externalTenantId?: string;
}

// ── Health check ──────────────────────────────────────────────────────────────

export interface HealthCheckResult {
  isHealthy: boolean;
  latencyMs?: number;
  error?: string;
}

// ── Provider adapter interface ────────────────────────────────────────────────

/**
 * Every provider adapter must implement this interface.
 * The integration framework calls these methods — provider-specific
 * implementation details are encapsulated within each adapter.
 */
export interface ProviderAdapter {
  /** Unique provider slug matching PROVIDER_CATALOGUE */
  readonly providerSlug: string;

  /** Human-readable provider name */
  readonly providerName: string;

  /**
   * Generate the OAuth 2.0 authorization URL.
   * Must include PKCE challenge and state parameter.
   * Redirect URI must use innovion.app domain.
   */
  buildAuthorizationUrl(params: OAuthAuthorizeParams): Promise<{
    url: string;
    state: string;
    codeVerifier?: string;
  }>;

  /**
   * Exchange authorization code for tokens.
   * Returns decrypted token set — caller is responsible for encrypting before storage.
   */
  exchangeCodeForTokens(
    params: OAuthCallbackParams,
    codeVerifier?: string
  ): Promise<OAuthTokenSet>;

  /**
   * Refresh an expired access token.
   * Returns new token set — caller encrypts before storage.
   * Must handle provider-specific refresh token rotation.
   */
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet>;

  /**
   * List external organisations available after authentication.
   * (e.g. Xero returns multiple tenants; Microsoft returns tenant info)
   */
  listExternalOrgs(accessToken: string): Promise<ExternalOrg[]>;

  /**
   * Revoke tokens and clean up provider-side subscriptions.
   * Must not throw if tokens are already invalid.
   */
  revokeTokens(accessToken: string, refreshToken?: string): Promise<void>;

  /**
   * Validate an inbound webhook request.
   * Implementation is provider-specific — do NOT assume generic HMAC.
   * Xero: HMAC-SHA256 of payload with webhook key.
   * Microsoft: uses subscription validation + bearer token validation.
   * Stripe: HMAC-SHA256 with timestamp replay protection.
   */
  validateWebhook(
    headers: Record<string, string>,
    rawBody: Buffer,
    signingSecret: string
  ): Promise<WebhookValidationResult>;

  /**
   * Execute a sync operation for the given type.
   * Must be idempotent — safe to retry with same cursor.
   */
  sync(
    accessToken: string,
    externalOrgId: string,
    syncType: 'full' | 'incremental',
    cursor?: Record<string, unknown>
  ): Promise<SyncResult>;

  /**
   * Check connection health without modifying any state.
   */
  checkHealth(accessToken: string): Promise<HealthCheckResult>;

  /**
   * OAuth scopes required for Phase 1 operation.
   */
  readonly requiredScopes: string[];

  /**
   * OAuth redirect URI — must use innovion.app domain.
   * Format: https://innovion.app/api/integrations/oauth/{providerSlug}/callback
   */
  readonly redirectUri: string;
}

// ── Base adapter helper ───────────────────────────────────────────────────────

/**
 * Base class providing shared utilities for provider adapters.
 * Adapters extend this and implement the ProviderAdapter interface.
 */
export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly providerSlug: string;
  abstract readonly providerName: string;
  abstract readonly requiredScopes: string[];

  /** All OAuth callbacks use innovion.app — never builtwithrocket.new */
  get redirectUri(): string {
    return `https://innovion.app/api/integrations/oauth/${this.providerSlug}/callback`;
  }

  abstract buildAuthorizationUrl(params: OAuthAuthorizeParams): Promise<{ url: string; state: string; codeVerifier?: string }>;

  abstract exchangeCodeForTokens(params: OAuthCallbackParams, codeVerifier?: string): Promise<OAuthTokenSet>;

  abstract refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet>;

  abstract listExternalOrgs(accessToken: string): Promise<ExternalOrg[]>;

  abstract revokeTokens(accessToken: string, refreshToken?: string): Promise<void>;

  abstract validateWebhook(headers: Record<string, string>, rawBody: Buffer, signingSecret: string): Promise<WebhookValidationResult>;

  abstract sync(
    accessToken: string,
    externalOrgId: string,
    syncType: 'full' | 'incremental',
    cursor?: Record<string, unknown>
  ): Promise<SyncResult>;

  abstract checkHealth(accessToken: string): Promise<HealthCheckResult>;

  /**
   * Generate a cryptographically random state parameter for CSRF protection.
   */
  protected generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate PKCE code verifier and challenge.
   */
  protected async generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return { codeVerifier, codeChallenge };
  }
}
