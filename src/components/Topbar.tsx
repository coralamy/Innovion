'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Search, Bell, ChevronDown, Settings, LogOut, User, HelpCircle, Sun, Moon, X } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { BRAND_IDENTITY, PLATFORM_IDENTITY } from '@/lib/brand';

interface TopbarProps {
  onMobileMenuToggle: () => void;
  currentPath: string;
}

const breadcrumbMap: Record<string, { label: string; parent?: string }> = {
  '/': { label: 'Dashboard' },
  '/dashboard': { label: 'Dashboard' },
  '/scheduling': { label: 'Schedule', parent: 'Operations' },
  '/jobs': { label: 'Jobs', parent: 'Operations' },
  '/recurring-jobs': { label: 'Recurring Jobs', parent: 'Operations' },
  '/sites': { label: 'Sites', parent: 'Operations' },
  '/clients': { label: 'Clients', parent: 'Operations' },
  '/checklists': { label: 'Checklists', parent: 'Operations' },
  '/checklist-templates': { label: 'CL Templates', parent: 'Operations' },
  '/contractors': { label: 'Contractors', parent: 'Workforce' },
  '/workforce-roster': { label: 'Roster', parent: 'Workforce' },
  '/workforce-capacity': { label: 'Capacity View', parent: 'Workforce' },
  '/time-tracking': { label: 'Time Tracking', parent: 'Workforce' },
  '/timesheet-approval': { label: 'Timesheet Approval', parent: 'Workforce' },
  '/contractor-invoices': { label: 'Contractor Invoices', parent: 'Workforce' },
  '/employees': { label: 'Employees', parent: 'Workforce' },
  '/users': { label: 'Users', parent: 'Workforce' },
  '/compliance': { label: 'Compliance', parent: 'Compliance' },
  '/documents': { label: 'Documents', parent: 'Compliance' },
  '/incidents': { label: 'Incidents', parent: 'Compliance' },
  '/inventory': { label: 'Inventory', parent: 'Management' },
  '/vehicles': { label: 'Vehicles', parent: 'Management' },
  '/reports': { label: 'Reports', parent: 'Management' },
  '/profile': { label: 'My Profile', parent: 'System' },
  '/notifications': { label: 'Notifications', parent: 'System' },
  '/billing': { label: 'Billing', parent: 'System' },
  '/settings': { label: 'Settings', parent: 'System' },
  '/companies': { label: 'Companies', parent: 'System' },
  '/platform-api': { label: 'Platform API', parent: 'System' },
  '/platform-config-inspector': { label: 'Configuration Inspector', parent: 'System' },
  '/settings/integrations': { label: 'Integrations', parent: 'System' },
};

export default function Topbar({ onMobileMenuToggle, currentPath }: TopbarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { user, signOut, companyId } = useAuth();
  const router = useRouter();

  const crumb = breadcrumbMap[currentPath] || {
    label: currentPath.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Page',
  };

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const loadCount = async () => {
      let query = supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
      if (companyId) query = query.eq('company_id', companyId);
      const { count } = await query;
      setUnreadCount(count || 0);
    };
    loadCount();
    const channel = supabase
      .channel('topbar-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}) }, () => setUnreadCount((p) => p + 1))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
        if ((payload.new as any).is_read) setUnreadCount((p) => Math.max(0, p - 1));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, () => loadCount())
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, companyId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSignOut = async () => {
    try { await signOut(); } catch {}
    router.push('/sign-up-login');
  };

  const fullName: string = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const email: string = user?.email || '';
  const initials: string = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const shortName: string = fullName.split(' ').slice(0, 2).map((n: string, i: number) => i === 1 ? n[0] + '.' : n).join(' ');

  return (
    <header
      suppressHydrationWarning
      className="flex-shrink-0 h-[56px] flex items-center gap-3 px-4 lg:px-5 z-30"
      style={{
        backgroundColor: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
      }}
    >
      {/* Mobile menu toggle */}
      <button
        suppressHydrationWarning
        onClick={onMobileMenuToggle}
        className="lg:hidden p-1.5 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95"
        style={{ color: 'var(--muted-foreground)' }}
        aria-label="Open menu"
      >
        <Menu size={19} />
      </button>

      {/* Breadcrumb */}
      <div className="hidden sm:flex items-center gap-1.5 text-[13px] min-w-0 flex-shrink-0">
        <span className="font-600" style={{ color: 'var(--primary)', letterSpacing: '-0.01em' }}>{PLATFORM_IDENTITY.platformName}</span>
        <span className="opacity-30" style={{ color: 'var(--foreground)' }}>/</span>
        <span style={{ color: 'var(--muted-foreground)' }}>{BRAND_IDENTITY.name}</span>
        {crumb.parent && (
          <>
            <span className="opacity-30" style={{ color: 'var(--foreground)' }}>/</span>
            <span style={{ color: 'var(--muted-foreground)' }}>{crumb.parent}</span>
          </>
        )}
        <span className="opacity-30" style={{ color: 'var(--foreground)' }}>/</span>
        <span className="font-600 truncate" style={{ color: 'var(--foreground)' }}>{crumb.label}</span>
      </div>

      {/* Search */}
      <div className={`flex-1 max-w-xs mx-auto relative transition-all duration-300 ${searchFocused ? 'max-w-md' : ''}`}>
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200 z-10"
          style={{ color: searchFocused ? 'var(--accent)' : 'var(--muted-foreground)' }}
        />
        <input
          ref={searchRef}
          suppressHydrationWarning
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search… (⌘K)"
          className="w-full pl-9 pr-8 py-1.5 text-[13px] rounded-lg border transition-all duration-200 focus:outline-none"
          style={{
            backgroundColor: searchFocused ? 'var(--card)' : 'var(--muted)',
            borderColor: searchFocused ? 'var(--accent)' : 'var(--border)',
            color: 'var(--foreground)',
            boxShadow: searchFocused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
          }}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {searchValue && (
          <button
            onClick={() => setSearchValue('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-opacity"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5 ml-auto">
        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative p-1.5 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95"
          style={{ color: 'var(--muted-foreground)' }}
          aria-label="Notifications"
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] rounded-full flex items-center justify-center font-700 text-white animate-scale-in"
              style={{ backgroundColor: 'var(--danger)', fontSize: '9px', padding: '0 3px' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Theme toggle */}
        <button
          suppressHydrationWarning
          onClick={toggleTheme}
          className="p-1.5 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 hidden sm:flex"
          style={{ color: 'var(--muted-foreground)' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Help */}
        <button
          className="p-1.5 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 hidden md:flex"
          style={{ color: 'var(--muted-foreground)' }}
          aria-label="Help"
        >
          <HelpCircle size={17} />
        </button>

        {/* Divider */}
        <div className="w-px h-5 mx-1 hidden sm:block" style={{ backgroundColor: 'var(--border)' }} />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            suppressHydrationWarning
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-lg transition-all duration-150 hover:bg-secondary active:scale-95"
            style={{ color: 'var(--foreground)' }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white font-700 flex-shrink-0 ring-2 ring-offset-1"
              style={{
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                fontSize: '10px',
                ringColor: 'rgba(37,99,235,0.3)',
              }}
            >
              {initials}
            </div>
            <span className="hidden sm:block text-[13px] font-600">{shortName}</span>
            <ChevronDown
              size={13}
              className={`hidden sm:block transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
              style={{ color: 'var(--muted-foreground)' }}
            />
          </button>

          {userMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border py-1 z-50 animate-scale-in"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              {/* User info */}
              <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-700 flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', fontSize: '11px' }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-600 truncate" style={{ color: 'var(--foreground)' }}>{fullName}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--muted-foreground)' }}>{email}</p>
                  </div>
                </div>
              </div>

              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-secondary rounded-lg mx-1"
                  style={{ color: 'var(--foreground)' }}
                >
                  <User size={14} style={{ color: 'var(--muted-foreground)' }} />
                  My Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-secondary rounded-lg mx-1"
                  style={{ color: 'var(--foreground)' }}
                >
                  <Settings size={14} style={{ color: 'var(--muted-foreground)' }} />
                  Settings
                </Link>
              </div>

              <div className="border-t pt-1" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-danger/5 rounded-lg mx-1"
                  style={{ color: 'var(--danger)', width: 'calc(100% - 8px)' }}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}