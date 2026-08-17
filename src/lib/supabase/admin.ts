import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for trusted server-side routes.
 *
 * This client BYPASSES Row Level Security. Every call site is therefore
 * responsible for establishing, itself, which tenant the request is entitled to
 * act on, and for constraining every query to that tenant.
 *
 * `import 'server-only'` makes it a build-time error for this module to be
 * reached from a Client Component, so the service-role key can never be pulled
 * into a browser bundle.
 *
 * The key is read lazily rather than at module scope: a missing key must fail
 * the request that needs it, with an actionable message, rather than crashing
 * the whole server at import time.
 */
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  }
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. Server-side routes that must ' +
        'bypass RLS (Platform API key verification, OAuth credential persistence, ' +
        'webhook ingestion) cannot operate without it.'
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
