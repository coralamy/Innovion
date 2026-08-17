'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ErrorBoundary from './ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import OfflineBanner from '@/components/OfflineBanner';
import SessionExpiredModal from '@/components/SessionExpiredModal';
import RealtimeNotificationToasts from '@/components/RealtimeNotificationToasts';
import { createClient } from '@/lib/supabase/client';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
}

export default function AppLayout({ children, currentPath = '/dashboard' }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // null = not yet checked, true = provisioned, false = not provisioned
  const [provisioned, setProvisioned] = useState<boolean | null>(null);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;

    const metaComplete = user?.user_metadata?.onboarding_complete === true;

    if (metaComplete) {
      // Metadata already says complete — no DB round-trip needed
      setProvisioned(true);
      return;
    }

    // Metadata is absent/stale — verify against user_roles as the authoritative source.
    // This handles the window between supabase.auth.updateUser() and the JWT refresh
    // propagating back into the AuthContext user object.
    // DEFECT REMEDIATED: this chained `.catch()` onto a PostgrestFilterBuilder,
    // which is a `PromiseLike` and has no `.catch` — so the handler was never
    // attached and a failed provisioning lookup left `provisioned` at null
    // forever, pinning the user on the loading spinner rather than sending them
    // to onboarding. Awaited inside an async function instead.
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1);
        if (cancelled) return;
        setProvisioned(!error && !!data && data.length > 0);
      } catch {
        if (!cancelled) setProvisioned(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/sign-up-login');
      return;
    }

    // Wait until provisioning check resolves
    if (provisioned === null) return;

    if (!provisioned && currentPath !== '/onboarding') {
      router.replace('/onboarding');
      return;
    }

    // Enforce email verification
    const metaComplete = user?.user_metadata?.onboarding_complete === true;
    if (metaComplete && !user?.email_confirmed_at && currentPath !== '/verify-email') {
      router.replace('/verify-email');
      return;
    }
  }, [user, loading, provisioned, router, currentPath]);

  // Listen for mobile sidebar open event from the bottom nav More button
  useEffect(() => {
    const handler = () => setMobileSidebarOpen(true);
    window.addEventListener('open-mobile-sidebar', handler);
    return () => window.removeEventListener('open-mobile-sidebar', handler);
  }, []);

  // Show loading while auth or provisioning check is in-flight
  if (loading || (user && provisioned === null)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div
              className="w-10 h-10 rounded-full border-2 border-border animate-pulse"
              style={{ borderColor: 'var(--border)' }}
            />
            <div
              className="absolute inset-0 w-10 h-10 rounded-full border-2 border-transparent border-t-accent animate-spin"
              style={{ borderTopColor: 'var(--accent)' }}
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-600" style={{ color: 'var(--foreground)' }}>
              Loading workspace
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Please wait…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Derive a human-readable page name from the current path for error messages
  const pageName =
    currentPath
      .replace(/^\//, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Skip to main content — accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Offline banner */}
      <OfflineBanner />

      {/* Session expired modal */}
      <SessionExpiredModal />

      {/* Real-time notification toasts */}
      <RealtimeNotificationToasts />

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden animate-fade-in"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        currentPath={currentPath}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0" suppressHydrationWarning>
        <Topbar onMobileMenuToggle={() => setMobileSidebarOpen(true)} currentPath={currentPath} />
        <main id="main-content" className="flex-1 overflow-y-auto scrollbar-thin" tabIndex={-1}>
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 xl:px-8 2xl:px-10 py-6 pb-24 lg:pb-6">
            <ErrorBoundary pageName={pageName}>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
