'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /**
   * The active tenant, resolved from the authoritative `user_roles` table.
   * `null` until resolved, and `null` for a user with no tenant membership.
   */
  companyId: string | null;
  /** Every tenant this user authoritatively belongs to. */
  companyIds: string[];
  /** True once the tenant lookup has completed (success or failure). */
  companyResolved: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, string>) => Promise<unknown>;
  signIn: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  getCurrentUser: () => Promise<User | null>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<unknown>;
  refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyResolved, setCompanyResolved] = useState(false);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    // getUser() validates the token against the auth server; getSession() only
    // decodes whatever is in storage. The user object must come from getUser().
    supabase.auth.getUser().then(({ data: { user: verifiedUser } }) => {
      setUser(verifiedUser ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  /**
   * Resolve the active tenant.
   *
   * DEFECT REMEDIATED (P0 — application-layer counterpart of the database
   * tenant-authority remediation):
   *
   *   companyId was previously derived as
   *       (user?.user_metadata?.company_id as string | undefined) ?? null
   *
   *   `user_metadata` is written by the end user through
   *   `supabase.auth.updateUser({ data: { company_id: '<any uuid>' } })`. Every
   *   query in the application that filters `.eq('company_id', companyId)`, and
   *   every write that stamps `company_id: companyId`, therefore took its
   *   tenant from a value the user controls.
   *
   *   Row Level Security now blocks the resulting cross-tenant reads and writes
   *   at the database (migrations 20260817000000–20260817002000), but the
   *   application must not be *asking* for another tenant's data in the first
   *   place: doing so leaves the product silently showing empty screens instead
   *   of the user's own data, and leaves a single missing policy as the only
   *   thing between a user and someone else's records.
   *
   *   Tenant identity is now read from `public.user_roles`, which only a tenant
   *   admin can write and which RLS restricts to the caller's own memberships.
   */
  const resolveTenant = useCallback(
    async (currentUser: User | null) => {
      if (!currentUser) {
        setCompanyIds([]);
        setCompanyId(null);
        setCompanyResolved(true);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('company_id, created_at')
        .eq('user_id', currentUser.id)
        .not('company_id', 'is', null)
        .order('created_at', { ascending: true });

      if (error) {
        // Fail closed: no tenant rather than a guessed one.
        setCompanyIds([]);
        setCompanyId(null);
        setCompanyResolved(true);
        return;
      }

      const ids = (data ?? []).map((r) => r.company_id as string).filter(Boolean);
      setCompanyIds(ids);

      // user_metadata may SELECT among tenants the user genuinely belongs to,
      // but can never introduce one. This mirrors get_my_company_id() in the
      // database exactly.
      const requested = currentUser.user_metadata?.company_id as string | undefined;
      setCompanyId(requested && ids.includes(requested) ? requested : (ids[0] ?? null));
      setCompanyResolved(true);
    },
    [supabase]
  );

  useEffect(() => {
    setCompanyResolved(false);
    void resolveTenant(user);
  }, [user, resolveTenant]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  const signUp = async (email: string, password: string, metadata: Record<string, string> = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Display data only. Nothing here is ever treated as authority.
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
        },
        emailRedirectTo: `${siteUrl}/auth/callback?type=signup&next=/verify-email`,
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setCompanyIds([]);
    setCompanyId(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?type=recovery`,
    });
    if (error) throw error;
  };

  const getCurrentUser = async () => {
    const {
      data: { user: u },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return u;
  };

  /**
   * DEFECT REMEDIATED: this previously read
   *     return user?.email_confirmed_at !== null;
   *
   * `email_confirmed_at` is ABSENT (undefined) on an unconfirmed user, not
   * null, and `user` itself is null when signed out. `undefined !== null` and
   * `undefined !== null` are both true, so the function returned `true`
   * unconditionally — for unverified users and for signed-out visitors alike.
   * Any gate built on it was inert.
   */
  const isEmailVerified = () => Boolean(user?.email_confirmed_at);

  /**
   * DEFECT REMEDIATED (dead code on a non-existent table):
   *   This queried `public.user_profiles`, which no migration has ever created.
   *   Any caller would have thrown. It had no callers anywhere in the codebase,
   *   so the failure was latent rather than observed.
   *
   *   The profile information the application actually holds is the
   *   authoritative role membership in `user_roles` plus the user's own display
   *   metadata, so that is what this returns.
   */
  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_roles')
      .select('company_id, role, created_at')
      .eq('user_id', user.id);
    if (error) throw error;
    return {
      id: user.id,
      email: user.email ?? null,
      fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
      avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      emailVerified: Boolean(user.email_confirmed_at),
      memberships: data ?? [],
    };
  };

  const refreshTenant = async () => {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    setUser(u ?? null);
    await resolveTenant(u ?? null);
  };

  const value: AuthContextValue = {
    user,
    session,
    loading,
    companyId,
    companyIds,
    companyResolved,
    signUp,
    signIn,
    signOut,
    resetPassword,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
    refreshTenant,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
