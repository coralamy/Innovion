/**
 * Platform API Keys Service
 *
 * Manages creation, listing, and revocation of platform API keys.
 * Raw keys are only returned once at creation time; only the hash is stored.
 */

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface PlatformApiKey {
  id: string;
  companyId: string;
  keyPrefix: string;
  label: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export const AVAILABLE_SCOPES = [
  { value: 'localisation:read',       label: 'Localisation — Read' },
  { value: 'country-config:read',     label: 'Country Config — Read' },
  { value: 'business-rules:read',     label: 'Business Rules — Read' },
  { value: 'tenancy:read',            label: 'Multi-Tenancy — Read' },
  { value: 'partner-config:read',     label: 'Partner Config — Read' },
  { value: 'translations:read',       label: 'Translations — Read' },
  { value: 'platform-config:read',    label: 'Platform Configuration — Read' },
  { value: 'workforce-config:read',   label: 'Workforce Config — Read' },
  { value: 'customer-portal:read',    label: 'Customer Portal Config — Read' },
  { value: 'partner-portal:read',     label: 'Partner Portal Config — Read' },
  { value: 'data-governance:read',    label: 'Data Governance — Read' },
  { value: 'audit-compliance:read',   label: 'Audit & Compliance — Read' },
  { value: '*',                       label: 'All Scopes (wildcard)' },
];

/**
 * Generate a cryptographically random API key.
 * Format: wf_live_<32 random hex chars>
 */
export function generateRawApiKey(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const hex = Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `wf_live_${hex}`;
}

/**
 * SHA-256 hash (browser-compatible).
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new API key for the given company.
 * Returns the raw key (shown once) and the stored record.
 */
export async function createApiKey(params: {
  companyId: string;
  createdBy: string;
  label: string;
  scopes: string[];
  expiresAt?: string | null;
}): Promise<{ rawKey: string; record: PlatformApiKey }> {
  const supabase = createClient();
  const rawKey = generateRawApiKey();
  const keyHash = await sha256(rawKey);
  const keyPrefix = rawKey.slice(0, 15);

  const { data, error } = await supabase
    .from('platform_api_keys')
    .insert({
      company_id: params.companyId,
      created_by: params.createdBy,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      label: params.label,
      scopes: params.scopes,
      expires_at: params.expiresAt ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error('platformApiKeyService', 'Failed to create API key', { label: params.label, error: error.message });
    throw new Error(error.message);
  }

  logger.info('platformApiKeyService', 'API key created', { label: params.label, keyPrefix });

  return { rawKey, record: mapRow(data) };
}

/**
 * List all API keys for a company.
 */
export async function listApiKeys(companyId: string): Promise<PlatformApiKey[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('platform_api_keys')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('platformApiKeyService', 'Failed to list API keys', { companyId, error: error.message });
    throw new Error(error.message);
  }
  return (data ?? []).map(mapRow);
}

/**
 * Revoke (deactivate) an API key.
 */
export async function revokeApiKey(keyId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('platform_api_keys')
    .update({ is_active: false })
    .eq('id', keyId);
  if (error) {
    logger.error('platformApiKeyService', 'Failed to revoke API key', { keyId, error: error.message });
    throw new Error(error.message);
  }
  logger.info('platformApiKeyService', 'API key revoked', { keyId });
}

function mapRow(row: any): PlatformApiKey {
  return {
    id: row.id,
    companyId: row.company_id,
    keyPrefix: row.key_prefix,
    label: row.label,
    scopes: row.scopes ?? [],
    isActive: row.is_active,
    lastUsedAt: row.last_used_at ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
  };
}
