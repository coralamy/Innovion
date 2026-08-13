/**
 * Provider Integration Service
 *
 * Manages third-party provider integrations per company (tenant-isolated).
 * Customer-facing catalogue: Xero, MYOB, Microsoft, Google, Stripe, RHIXO, Twilio.
 *
 * Security (EDR-006 Phase 2 resolution):
 *  - Sensitive credentials are stored in `encrypted_config` (pgcrypto AES via Supabase).
 *  - `config_json` (plain JSONB) is retained for backward compatibility.
 *  - `display_config` (non-sensitive metadata) is returned to the UI.
 *  - Mutations require admin role (enforced by RLS policy).
 *  - Encryption/decryption is performed server-side via Supabase RPC functions.
 */

import { createClient } from '@/lib/supabase/client';

// ── Provider catalogue ────────────────────────────────────────────────────────

export type ProviderCategory =
  | 'accounting' |'microsoft' |'google' |'payments' |'web_digital' |'communications' |'identity' |'other';

export type IntegrationStatus =
  | 'not_configured' | 'configured' | 'active' | 'error' | 'disabled';

export interface ProviderDefinition {
  slug: string;
  name: string;
  category: ProviderCategory;
  description: string;
  docsUrl: string;
  /** Fields required in display_config (non-sensitive) */
  displayFields: Array<{ key: string; label: string; placeholder: string }>;
  /** Fields required in config_json (sensitive — stored encrypted server-side) */
  secretFields: Array<{ key: string; label: string; placeholder: string }>;
  /** Whether this provider uses OAuth 2.0 flow */
  usesOAuth?: boolean;
  /** Coming soon — not yet available for connection */
  comingSoon?: boolean;
}

export const PROVIDER_CATALOGUE: ProviderDefinition[] = [
  // ── Accounting & Finance ──────────────────────────────────────────────────
  {
    slug: 'xero',
    name: 'Xero',
    category: 'accounting',
    description: 'Connect Xero to sync contacts, customers and organisation metadata. Designed for Xero App Store certification.',
    docsUrl: 'https://developer.xero.com/documentation/',
    displayFields: [
      { key: 'organisationName', label: 'Connected Organisation', placeholder: 'Xero organisation name' },
    ],
    secretFields: [],
    usesOAuth: true,
  },
  {
    slug: 'myob',
    name: 'MYOB',
    category: 'accounting',
    description: 'Connect MYOB AccountRight or Essentials to sync contacts and accounting data.',
    docsUrl: 'https://developer.myob.com/',
    displayFields: [
      { key: 'companyFile', label: 'Company File', placeholder: 'MYOB company file name' },
    ],
    secretFields: [],
    usesOAuth: true,
    comingSoon: true,
  },

  // ── Microsoft ─────────────────────────────────────────────────────────────
  {
    slug: 'microsoft',
    name: 'Microsoft / Microsoft 365',
    category: 'microsoft',
    description: 'Microsoft Entra ID authentication, multi-tenant SSO, and Microsoft 365 ecosystem foundation.',
    docsUrl: 'https://learn.microsoft.com/en-us/azure/active-directory/',
    displayFields: [
      { key: 'tenantName', label: 'Microsoft Tenant', placeholder: 'contoso.onmicrosoft.com' },
    ],
    secretFields: [],
    usesOAuth: true,
  },

  // ── Google ────────────────────────────────────────────────────────────────
  {
    slug: 'google',
    name: 'Google / Google Workspace',
    category: 'google',
    description: 'Google Workspace SSO, Google Calendar, Google Drive, and Maps Platform integration.',
    docsUrl: 'https://developers.google.com/',
    displayFields: [
      { key: 'workspaceDomain', label: 'Workspace Domain', placeholder: 'yourcompany.com' },
    ],
    secretFields: [],
    usesOAuth: true,
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  {
    slug: 'stripe',
    name: 'Stripe',
    category: 'payments',
    description: 'Payment processing, subscriptions, and Connect for marketplace payments.',
    docsUrl: 'https://stripe.com/docs',
    displayFields: [
      { key: 'publishableKey', label: 'Publishable Key', placeholder: 'pk_live_...' },
      { key: 'webhookEndpoint', label: 'Webhook Endpoint', placeholder: 'https://innovion.app/api/integrations/webhooks/stripe' },
    ],
    secretFields: [
      { key: 'secretKey', label: 'Secret Key', placeholder: 'sk_live_...' },
      { key: 'webhookSecret', label: 'Webhook Signing Secret', placeholder: 'whsec_...' },
    ],
  },

  // ── Web & Digital Services ────────────────────────────────────────────────
  {
    slug: 'rhixo',
    name: 'RHIXO',
    category: 'web_digital',
    description: 'RHIXO web and digital services integration for domain, hosting and digital presence management.',
    docsUrl: 'https://rhixo.com/',
    displayFields: [
      { key: 'accountId', label: 'Account ID', placeholder: 'RHIXO account identifier' },
      { key: 'primaryDomain', label: 'Primary Domain', placeholder: 'yourcompany.com' },
    ],
    secretFields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'RHIXO API Key' },
    ],
  },

  // ── Communications ────────────────────────────────────────────────────────
  {
    slug: 'twilio',
    name: 'Twilio',
    category: 'communications',
    description: 'SMS, voice, and WhatsApp messaging for notifications and alerts.',
    docsUrl: 'https://www.twilio.com/docs',
    displayFields: [
      { key: 'accountSid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'fromNumber', label: 'From Number', placeholder: '+61400000000' },
    ],
    secretFields: [
      { key: 'authToken', label: 'Auth Token', placeholder: 'Twilio Auth Token' },
    ],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProviderIntegration {
  id: string;
  companyId: string;
  providerSlug: string;
  providerName: string;
  category: ProviderCategory;
  status: IntegrationStatus;
  displayConfig: Record<string, string>;
  isEnabled: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertIntegrationPayload {
  providerSlug: string;
  providerName: string;
  category: ProviderCategory;
  displayConfig: Record<string, string>;
  /** Sensitive fields — encrypted at rest via pgcrypto (EDR-006 Phase 2) */
  secretConfig: Record<string, string>;
  isEnabled: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): ProviderIntegration {
  return {
    id:            row.id as string,
    companyId:     row.company_id as string,
    providerSlug:  row.provider_slug as string,
    providerName:  row.provider_name as string,
    category:      row.category as ProviderCategory,
    status:        row.status as IntegrationStatus,
    displayConfig: (row.display_config as Record<string, string>) ?? {},
    isEnabled:     row.is_enabled as boolean,
    lastTestedAt:  row.last_tested_at as string | null,
    lastError:     row.last_error as string | null,
    createdAt:     row.created_at as string,
    updatedAt:     row.updated_at as string,
  };
}

export const providerIntegrationService = {
  /** List all integrations for the authenticated company */
  async list(companyId: string): Promise<ProviderIntegration[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('provider_integrations')
      .select('id, company_id, provider_slug, provider_name, category, status, display_config, is_enabled, last_tested_at, last_error, created_at, updated_at')
      .eq('company_id', companyId)
      .order('provider_name');
    if (error) throw error;
    return (data ?? []).map(mapRow);
  },

  /**
   * Upsert (create or update) an integration for the authenticated company.
   *
   * EDR-006 Phase 2: secretConfig is encrypted via the Supabase
   * `encrypt_provider_config` RPC function before storage.
   */
  async upsert(companyId: string, payload: UpsertIntegrationPayload): Promise<ProviderIntegration> {
    const supabase = createClient();

    // Encrypt secrets server-side via pgcrypto RPC
    let encryptedConfig: string | null = null;
    const hasSecrets = Object.values(payload.secretConfig).some((v) => v && v.trim() !== '');
    if (hasSecrets) {
      const { data: encData, error: encError } = await supabase
        .rpc('encrypt_provider_config', { plain_json: payload.secretConfig });
      if (!encError && encData) {
        encryptedConfig = encData as string;
      }
    }

    const upsertPayload: Record<string, unknown> = {
      company_id:    companyId,
      provider_slug: payload.providerSlug,
      provider_name: payload.providerName,
      category:      payload.category,
      display_config: payload.displayConfig,
      is_enabled:    payload.isEnabled,
      status:        payload.isEnabled ? 'configured' : 'not_configured',
    };

    if (encryptedConfig) {
      upsertPayload.encrypted_config = encryptedConfig;
    }
    if (hasSecrets) {
      upsertPayload.config_json = payload.secretConfig;
    }

    const { data, error } = await supabase
      .from('provider_integrations')
      .upsert(upsertPayload, { onConflict: 'company_id,provider_slug' })
      .select('id, company_id, provider_slug, provider_name, category, status, display_config, is_enabled, last_tested_at, last_error, created_at, updated_at')
      .single();
    if (error) throw error;
    return mapRow(data as Record<string, unknown>);
  },

  /** Disable an integration */
  async disable(companyId: string, integrationId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('provider_integrations')
      .update({ is_enabled: false, status: 'disabled' })
      .eq('id', integrationId)
      .eq('company_id', companyId);
    if (error) throw error;
  },

  /** Delete an integration record */
  async delete(companyId: string, integrationId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('provider_integrations')
      .delete()
      .eq('id', integrationId)
      .eq('company_id', companyId);
    if (error) throw error;
  },
};
