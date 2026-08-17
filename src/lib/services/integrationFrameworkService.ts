/**
 * Innovion Integration Framework Service
 *
 * Provider-neutral core service for managing integrations.
 * Handles: OAuth lifecycle, token management, audit logging,
 * health monitoring, sync job tracking, webhook event processing.
 *
 * Security:
 *  - Tokens are encrypted before storage via pgcrypto RPC
 *  - Tokens are never logged or returned to browser clients
 *  - All operations are tenant-isolated via company_id
 *  - Server-side only — uses Supabase service role for credential writes
 *  - Browser clients query integration_connection_status view (no token columns)
 *
 * External URLs: all OAuth callbacks use innovion.app domain
 *
 * Platform Event Bus:
 *  - publishToEventBus() writes to integration_event_bus_outbox (transactional outbox)
 *  - A background worker drains the outbox once Team D provides the Event Bus contract
 *  - Schema version is tracked for contract compatibility
 */

import { createClient } from '@/lib/supabase/client';
import type { ProviderAdapter } from '@/lib/integrations/providerAdapter';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConnectionStatus {
  providerSlug: string;
  isConnected: boolean;
  isHealthy: boolean;
  reauthRequired: boolean;
  externalOrgName?: string;
  externalOrgId?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  errorCount?: number;
}

export interface AuditLogEntry {
  id: string;
  providerSlug: string;
  action: string;
  performedBy?: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface SyncJobRecord {
  id: string;
  companyId: string;
  providerSlug: string;
  syncType: string;
  status: string;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  retryCount: number;
  lastError?: string;
  createdAt: string;
}

// ── Safe connection status (no token columns) ─────────────────────────────────

export interface OAuthConnectionStatus {
  id: string;
  providerSlug: string;
  connectionState: 'active' | 'expiring_soon' | 'expired' | 'invalid' | 'revoked';
  reauthRequired: boolean;
  externalUserId?: string;
  externalUserEmail?: string;
  externalTenantId?: string;
  scopeString?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Platform Event Bus types ──────────────────────────────────────────────────

export interface IntegrationEvent {
  eventType: string;
  providerSlug?: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
  schemaVersion?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const integrationFrameworkService = {
  // ── Connection status ───────────────────────────────────────────────────────

  /**
   * Get connection status for all providers for a company.
   * Uses provider_integrations + integration_health + integration_external_orgs.
   * Does NOT query integration_oauth_credentials — use getOAuthConnectionStatus() for that.
   */
  async getConnectionStatuses(companyId: string): Promise<ConnectionStatus[]> {
    const supabase = createClient();

    const [integrationsResult, healthResult, externalOrgsResult] = await Promise.all([
      supabase
        .from('provider_integrations')
        .select(
          'provider_slug, status, is_enabled, reauth_required, connected_at, last_sync_at, last_sync_status'
        )
        .eq('company_id', companyId),
      supabase
        .from('integration_health')
        .select('provider_slug, is_healthy, error_count, last_error')
        .eq('company_id', companyId),
      supabase
        .from('integration_external_orgs')
        .select('provider_slug, external_org_name, external_org_id')
        .eq('company_id', companyId)
        .eq('is_primary', true),
    ]);

    const integrations = integrationsResult.data ?? [];
    const health = healthResult.data ?? [];
    const orgs = externalOrgsResult.data ?? [];

    return integrations.map((i) => {
      const h = health.find((x) => x.provider_slug === i.provider_slug);
      const o = orgs.find((x) => x.provider_slug === i.provider_slug);
      return {
        providerSlug: i.provider_slug,
        isConnected: i.status === 'active' || i.status === 'configured',
        isHealthy: h?.is_healthy ?? true,
        reauthRequired: i.reauth_required ?? false,
        externalOrgName: o?.external_org_name,
        externalOrgId: o?.external_org_id,
        connectedAt: i.connected_at,
        lastSyncAt: i.last_sync_at,
        lastSyncStatus: i.last_sync_status,
        errorCount: h?.error_count ?? 0,
      };
    });
  },

  /**
   * Get OAuth connection status for a company+provider from the safe view.
   * Returns non-secret metadata only — no token columns.
   * This is the ONLY method browser clients should use to check OAuth state.
   */
  async getOAuthConnectionStatus(
    companyId: string,
    providerSlug: string
  ): Promise<OAuthConnectionStatus | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('integration_connection_status')
      .select(
        'id, provider_slug, connection_state, reauth_required, external_user_id, external_user_email, external_tenant_id, scope_string, expires_at, created_at, updated_at'
      )
      .eq('company_id', companyId)
      .eq('provider_slug', providerSlug)
      .is('revoked_at', null)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      providerSlug: data.provider_slug,
      connectionState: data.connection_state as OAuthConnectionStatus['connectionState'],
      reauthRequired: data.reauth_required ?? false,
      externalUserId: data.external_user_id ?? undefined,
      externalUserEmail: data.external_user_email ?? undefined,
      externalTenantId: data.external_tenant_id ?? undefined,
      scopeString: data.scope_string ?? undefined,
      expiresAt: data.expires_at ?? undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  // ── Audit log ───────────────────────────────────────────────────────────────

  /**
   * Read audit log entries for a company+provider.
   * Audit log is immutable — written server-side only.
   */
  async getAuditLog(companyId: string, providerSlug: string, limit = 50): Promise<AuditLogEntry[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('integration_audit_log')
      .select('id, provider_slug, action, performed_by, details, created_at')
      .eq('company_id', companyId)
      .eq('provider_slug', providerSlug)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      providerSlug: r.provider_slug,
      action: r.action,
      performedBy: r.performed_by,
      details: (r.details as Record<string, unknown>) ?? {},
      createdAt: r.created_at,
    }));
  },

  // ── Sync jobs ───────────────────────────────────────────────────────────────

  /**
   * Get recent sync jobs for a company+provider.
   */
  async getSyncJobs(companyId: string, providerSlug: string, limit = 20): Promise<SyncJobRecord[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('integration_sync_jobs')
      .select('*')
      .eq('company_id', companyId)
      .eq('provider_slug', providerSlug)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      companyId: r.company_id,
      providerSlug: r.provider_slug,
      syncType: r.sync_type,
      status: r.status,
      recordsFetched: r.records_fetched ?? 0,
      recordsCreated: r.records_created ?? 0,
      recordsUpdated: r.records_updated ?? 0,
      recordsSkipped: r.records_skipped ?? 0,
      recordsFailed: r.records_failed ?? 0,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      durationMs: r.duration_ms,
      retryCount: r.retry_count ?? 0,
      lastError: r.last_error,
      createdAt: r.created_at,
    }));
  },

  // ── External orgs ───────────────────────────────────────────────────────────

  /**
   * Get mapped external organisations for a company.
   */
  async getExternalOrgs(companyId: string, providerSlug?: string) {
    const supabase = createClient();
    let query = supabase
      .from('integration_external_orgs')
      .select(
        'id, provider_slug, external_org_id, external_org_name, external_tenant_id, org_metadata, is_primary, connected_at'
      )
      .eq('company_id', companyId);

    if (providerSlug) {
      query = query.eq('provider_slug', providerSlug);
    }

    const { data, error } = await query.order('connected_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // ── Granted scopes ──────────────────────────────────────────────────────────

  /**
   * Get granted OAuth scopes for a company+provider.
   */
  async getGrantedScopes(companyId: string, providerSlug: string): Promise<string[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('integration_scopes')
      .select('scope_name')
      .eq('company_id', companyId)
      .eq('provider_slug', providerSlug)
      .is('revoked_at', null);

    if (error) throw error;
    return (data ?? []).map((r) => r.scope_name);
  },

  // ── Health ──────────────────────────────────────────────────────────────────

  /**
   * Get connection health for a company+provider.
   */
  async getHealth(companyId: string, providerSlug: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from('integration_health')
      .select('*')
      .eq('company_id', companyId)
      .eq('provider_slug', providerSlug)
      .single();
    return data;
  },

  // ── Webhook events ──────────────────────────────────────────────────────────

  /**
   * Get recent webhook events for a company+provider.
   */
  async getWebhookEvents(companyId: string, providerSlug: string, limit = 50) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('integration_webhook_events')
      .select(
        'id, provider_slug, external_event_id, event_type, status, received_at, processed_at, retry_count, last_error, signature_valid'
      )
      .eq('company_id', companyId)
      .eq('provider_slug', providerSlug)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  },

  // ── Platform Event Bus ──────────────────────────────────────────────────────

  /**
   * Publish an integration event to the Platform Event Bus outbox.
   *
   * Uses the transactional outbox pattern — events are written atomically
   * to integration_event_bus_outbox. A background worker drains the outbox
   * to the Platform Event Bus once Team D provides the approved contract.
   *
   * IMPORTANT: This method uses the Supabase client (authenticated user context).
   * For server-side publishing from API routes, use publishToEventBusServerSide()
   * with the service role client instead.
   *
   * No credentials or token values must ever be included in the event payload.
   */
  async publishToEventBus(
    companyId: string,
    event: IntegrationEvent
  ): Promise<{ id: string } | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('integration_event_bus_outbox')
      .insert({
        company_id: companyId,
        event_type: event.eventType,
        event_source: 'integration_framework',
        provider_slug: event.providerSlug ?? null,
        payload: event.payload,
        correlation_id: event.correlationId ?? undefined,
        causation_id: event.causationId ?? undefined,
        schema_version: event.schemaVersion ?? 'v1',
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[IntegrationFramework] Failed to write event to outbox:', error.message);
      return null;
    }
    return data;
  },

  /**
   * Get pending outbox events for a company (for monitoring/debugging).
   * Returns event metadata only — no credentials in payload.
   */
  async getEventBusOutbox(companyId: string, limit = 50) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('integration_event_bus_outbox')
      .select(
        'id, event_type, provider_slug, status, attempt_count, schema_version, created_at, published_at, last_error'
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  },
};

// ── Provider registry ─────────────────────────────────────────────────────────

/**
 * Registry of available provider adapters.
 * Adapters are registered here and resolved by slug in API routes.
 */
const adapterRegistry = new Map<string, ProviderAdapter>();

export function registerAdapter(adapter: ProviderAdapter): void {
  adapterRegistry.set(adapter.providerSlug, adapter);
}

export function getAdapter(providerSlug: string): ProviderAdapter | undefined {
  return adapterRegistry.get(providerSlug);
}

export function getRegisteredProviders(): string[] {
  return Array.from(adapterRegistry.keys());
}
