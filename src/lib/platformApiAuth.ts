/**
 * Platform API Authentication
 *
 * Validates Bearer API keys for the Innovion Platform API layer.
 * Client applications (e.g. Workforce) must include:
 *   Authorization: Bearer <api_key>
 *
 * Keys are stored as SHA-256 hashes in platform_api_keys.
 * The raw key is never stored.
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export interface ApiKeyContext {
  apiKeyId: string;
  companyId: string;
  scopes: string[];
}

/**
 * SHA-256 hash using Web Crypto API (Edge/Node compatible).
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Authenticate an incoming API request by its Bearer token.
 * Returns the key context or null if invalid/expired.
 */
export async function authenticateApiKey(
  req: NextRequest
): Promise<ApiKeyContext | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return null;

  const keyHash = await sha256(rawKey);
  const supabase = await createClient();

  const { data: keyRow, error } = await supabase
    .from('platform_api_keys')
    .select('id, company_id, scopes, is_active, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (error || !keyRow) return null;
  if (!keyRow.is_active) return null;
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) return null;

  // Update last_used_at (fire-and-forget)
  supabase
    .from('platform_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)
    .then(() => {});

  return {
    apiKeyId: keyRow.id,
    companyId: keyRow.company_id,
    scopes: keyRow.scopes ?? [],
  };
}

/**
 * Check whether the key context includes a required scope.
 */
export function hasScope(ctx: ApiKeyContext, required: string): boolean {
  return ctx.scopes.includes(required) || ctx.scopes.includes('*');
}

/**
 * Standard 401 response.
 */
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Standard 403 response.
 */
export function forbiddenResponse(message = 'Forbidden: insufficient scope'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}
