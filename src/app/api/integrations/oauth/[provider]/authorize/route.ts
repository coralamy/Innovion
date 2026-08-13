/**
 * OAuth Authorization Initiation
 * GET /api/integrations/oauth/[provider]/authorize
 *
 * Generates the OAuth authorization URL for the given provider.
 * Stores PKCE code verifier and state in a server-side session cookie.
 *
 * All redirect URIs use innovion.app domain.
 * Never exposes client secrets or code verifiers to the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAdapter } from '@/lib/services/integrationFrameworkService';
// Register all provider adapters (Xero, etc.) before any adapter lookup
import '@/lib/integrations/adapters';

// Supported providers for Phase 1A
const SUPPORTED_PROVIDERS = ['xero', 'microsoft', 'google', 'stripe', 'rhixo'];

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { provider } = params;

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `Provider '${provider}' is not supported` },
      { status: 400 }
    );
  }

  // Authenticate the requesting user
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // Resolve company ID from user profile
  const { data: profile } = await supabase
    .from('user_roles')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'No company associated with this user' }, { status: 400 });
  }

  const adapter = getAdapter(provider);
  if (!adapter) {
    // Adapter not yet registered — return a pending state response
    return NextResponse.json(
      {
        error: `Provider '${provider}' adapter is not yet registered. Phase 1B/1C implementation required.`,
        phase: 'pending',
        redirectUri: `https://innovion.app/api/integrations/oauth/${provider}/callback`,
      },
      { status: 501 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const returnTo = searchParams.get('return_to') ?? '/settings/integrations';
  const acquisitionSource = searchParams.get('acquisition_source') ?? 'direct';

  try {
    // Generate PKCE + state
    const stateArray = new Uint8Array(32);
    crypto.getRandomValues(stateArray);
    const state = Array.from(stateArray, (b) => b.toString(16).padStart(2, '0')).join('');

    const { url, codeVerifier } = await adapter.buildAuthorizationUrl({
      companyId: profile.company_id,
      userId: user.id,
      state,
      codeVerifier: undefined,
      acquisitionSource,
      returnTo,
    });

    // Store OAuth state server-side in a secure, httpOnly cookie
    // State is validated on callback to prevent CSRF
    const oauthState = JSON.stringify({
      state,
      codeVerifier,
      companyId: profile.company_id,
      userId: user.id,
      provider,
      returnTo,
      acquisitionSource,
      createdAt: Date.now(),
    });

    const response = NextResponse.redirect(url);
    response.cookies.set(`oauth_state_${provider}`, oauthState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes — OAuth flows should complete quickly
      path: '/',
    });

    return response;
  } catch (err) {
    console.error(`[OAuth Authorize] ${provider} error:`, err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
