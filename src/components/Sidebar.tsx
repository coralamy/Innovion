'use client';
// Sidebar v3 — logo links to dashboard, label truncation fixed, Workforce Capacity nav entry confirmed
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from './ui/AppLogo';
import {
  LayoutDashboard,
  Calendar,
  Briefcase,
  MapPin,
  Users,
  UserCheck,
  UserCog,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Package,
  Truck,
  BarChart3,
  Bell,
  Settings,
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Clock,
  ClipboardList,
  User,
  X,
  Menu,
  CreditCard,
  FileCheck,
  Receipt,
  RotateCcw,
  KeyRound,
  ScanSearch,
  Globe,
  Activity,
  BookUser,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  currentPath: string;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  featured?: boolean;
  requiresPermission?: string;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ id: 'nav-dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      {
        id: 'nav-schedule',
        label: 'Schedule',
        href: '/scheduling',
        icon: Calendar,
        featured: true,
      },
      { id: 'nav-recurring', label: 'Recurring Jobs', href: '/recurring-jobs', icon: RotateCcw },
      { id: 'nav-jobs', label: 'Jobs', href: '/jobs', icon: Briefcase },
      { id: 'nav-sites', label: 'Sites', href: '/sites', icon: MapPin },
      { id: 'nav-checklists', label: 'Checklists', href: '/checklists', icon: ClipboardList },
      {
        id: 'nav-checklist-templates',
        label: 'CL Templates',
        href: '/checklist-templates',
        icon: FileCheck,
      },
      { id: 'nav-clients', label: 'Clients', href: '/clients', icon: Building2 },
    ],
  },
  {
    id: 'workforce',
    label: 'Workforce',
    items: [
      { id: 'nav-workforce-roster', label: 'Roster', href: '/workforce-roster', icon: BookUser },
      { id: 'nav-contractors', label: 'Contractors', href: '/contractors', icon: UserCheck },
      {
        id: 'nav-workforce-capacity',
        label: 'Capacity View',
        href: '/workforce-capacity',
        icon: Activity,
      },
      { id: 'nav-time-tracking', label: 'Time Tracking', href: '/time-tracking', icon: Clock },
      {
        id: 'nav-timesheet-approval',
        label: 'Timesheet Approval',
        href: '/timesheet-approval',
        icon: FileCheck,
        requiresPermission: 'canManageJobs',
      },
      {
        id: 'nav-contractor-invoices',
        label: 'Contractor Invoices',
        href: '/contractor-invoices',
        icon: Receipt,
        requiresPermission: 'canViewFinancials',
      },
      { id: 'nav-employees', label: 'Employees', href: '/employees', icon: Users },
      {
        id: 'nav-users',
        label: 'Users',
        href: '/users',
        icon: UserCog,
        requiresPermission: 'canManageUsers',
      },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    items: [
      { id: 'nav-compliance', label: 'Compliance', href: '/compliance', icon: ShieldCheck },
      { id: 'nav-documents', label: 'Documents', href: '/documents', icon: FileText },
      { id: 'nav-incidents', label: 'Incidents', href: '/incidents', icon: AlertTriangle },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      { id: 'nav-inventory', label: 'Inventory', href: '/inventory', icon: Package },
      { id: 'nav-vehicles', label: 'Vehicles', href: '/vehicles', icon: Truck },
      {
        id: 'nav-reports',
        label: 'Reports',
        href: '/reports',
        icon: BarChart3,
        requiresPermission: 'canViewReports',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'nav-profile', label: 'My Profile', href: '/profile', icon: User },
      { id: 'nav-notifications', label: 'Notifications', href: '/notifications', icon: Bell },
      { id: 'nav-billing', label: 'Billing', href: '/billing', icon: CreditCard },
      { id: 'nav-settings', label: 'Settings', href: '/settings', icon: Settings },
      {
        id: 'nav-companies',
        label: 'Companies',
        href: '/companies',
        icon: Building2,
        requiresPermission: 'canManageCompany',
      },
      {
        id: 'nav-platform-api',
        label: 'Platform API',
        href: '/platform-api',
        icon: KeyRound,
        requiresPermission: 'canManageCompany',
      },
      {
        id: 'nav-config-inspector',
        label: 'Configuration Inspector',
        href: '/platform-config-inspector',
        icon: ScanSearch,
        requiresPermission: 'canManageCompany',
      },
      {
        id: 'nav-integrations',
        label: 'Integrations',
        href: '/settings/integrations',
        icon: Globe,
        requiresPermission: 'canManageCompany',
      },
    ],
  },
];

const mobileBottomNav = [
  { id: 'mob-dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { id: 'mob-schedule', label: 'Schedule', href: '/scheduling', icon: Calendar },
  { id: 'mob-jobs', label: 'Jobs', href: '/jobs', icon: Briefcase },
  { id: 'mob-compliance', label: 'Compliance', href: '/compliance', icon: ShieldCheck },
  { id: 'mob-profile', label: 'Profile', href: '/profile', icon: User },
];

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  currentPath,
}: SidebarProps) {
  const isActive = (href: string) => {
    if (href === '/dashboard' && currentPath === '/') return true;
    return currentPath === href || currentPath.startsWith(href + '/');
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 h-screen overflow-hidden transition-all duration-300"
        style={{
          width: collapsed ? '60px' : '248px',
          backgroundColor: 'var(--sidebar-bg)',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggle={onToggle}
          isActive={isActive}
          currentPath={currentPath}
        />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className="fixed inset-y-0 left-0 z-50 flex flex-col w-72 lg:hidden"
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: mobileOpen ? '8px 0 32px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <Link href="/dashboard" aria-label="Go to Dashboard">
            <AppLogo variant="full" size={36} darkBg={true} showWordmark={true} />
          </Link>
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95"
            style={{ color: 'var(--sidebar-text)' }}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>
        <SidebarContent
          collapsed={false}
          onToggle={onMobileClose}
          isActive={isActive}
          currentPath={currentPath}
          isMobile
        />
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden flex items-center justify-around px-1 py-1"
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderTop: '1px solid var(--sidebar-border)',
          paddingBottom: 'env(safe-area-inset-bottom, 6px)',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.2)',
        }}
      >
        {mobileBottomNav.map((item) => {
          const NavIcon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-150 active:scale-90"
              style={{ color: active ? 'var(--sidebar-active)' : 'var(--sidebar-text)' }}
            >
              <div className="relative">
                <NavIcon size={19} />
                {active && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: 'var(--sidebar-active)' }}
                  />
                )}
              </div>
              <span style={{ fontSize: '9.5px', fontWeight: active ? 600 : 500 }}>
                {item.label}
              </span>
            </Link>
          );
        })}
        <MobileMoreButton />
      </nav>
    </>
  );
}

function MobileMoreButton() {
  const handleMore = () => window.dispatchEvent(new CustomEvent('open-mobile-sidebar'));
  return (
    <button
      onClick={handleMore}
      className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-150 active:scale-90"
      style={{ color: 'var(--sidebar-text)' }}
    >
      <Menu size={19} />
      <span style={{ fontSize: '9.5px', fontWeight: 500 }}>More</span>
    </button>
  );
}

function SidebarContent({
  collapsed,
  onToggle,
  isActive,
  isMobile = false,
}: {
  collapsed: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean;
  currentPath: string;
  isMobile?: boolean;
}) {
  const { user, signOut } = useAuth();
  const { hasPermission, role: rbacRole } = useRBAC();
  const router = useRouter();

  const fullName: string = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials: string = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  /**
   * DEFECT REMEDIATED: the sidebar displayed `user.user_metadata.role`, which
   * the end user writes themselves via `supabase.auth.updateUser()`. It is not
   * an authority check, but it did let a user display any role they liked to
   * anyone looking at their screen, and it contradicted the authoritative role
   * that actually governs their permissions. Sourced from RBACContext, which
   * reads public.user_roles.
   */
  const role: string = rbacRole
    ? rbacRole.charAt(0).toUpperCase() + rbacRole.slice(1)
    : 'Team Member';

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/sign-up-login');
    } catch {
      router.push('/sign-up-login');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo header — links to Dashboard */}
      {!isMobile && (
        <div
          className="flex items-center justify-between px-3 h-[56px] flex-shrink-0"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          {!collapsed ? (
            <>
              <Link
                href="/dashboard"
                aria-label="Go to Dashboard"
                className="flex-1 min-w-0 flex items-center"
              >
                <AppLogo
                  variant="full"
                  size={46}
                  darkBg={true}
                  showWordmark={true}
                  className="[&_img]:!bg-transparent"
                />
              </Link>
              <button
                onClick={onToggle}
                className="p-1.5 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 flex-shrink-0 ml-1"
                style={{ color: 'var(--sidebar-text)' }}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={15} />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center w-full gap-2">
              <Link href="/dashboard" aria-label="Go to Dashboard">
                <AppLogo variant="icon" size={40} darkBg={true} />
              </Link>
              <button
                onClick={onToggle}
                className="p-1.5 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95"
                style={{ color: 'var(--sidebar-text)' }}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-thin">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.requiresPermission || hasPermission(item.requiresPermission as any)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.id} className="mb-1">
              {/* Section label */}
              {!collapsed && (
                <p
                  className="px-3 mb-1 text-[10px] font-700 uppercase tracking-widest"
                  style={{ color: 'var(--sidebar-text)', opacity: 0.45, letterSpacing: '0.1em' }}
                >
                  {section.label}
                </p>
              )}
              {collapsed && (
                <div
                  className="mx-3 mb-1 h-px"
                  style={{ backgroundColor: 'var(--sidebar-border)' }}
                />
              )}

              <div className="px-2 space-y-0.5">
                {visibleItems.map((item) => {
                  const ItemIcon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`sidebar-item ${active ? 'active' : ''}`}
                      title={item.label}
                      style={
                        collapsed ? { justifyContent: 'center', padding: '0.5rem' } : undefined
                      }
                    >
                      <ItemIcon
                        size={15}
                        className="sidebar-icon flex-shrink-0"
                        style={{
                          color: active ? 'var(--sidebar-active)' : 'var(--sidebar-text)',
                          transition: 'color 150ms ease',
                        }}
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                            {item.label}
                          </span>
                          {item.featured && !active && (
                            <span
                              className="flex-shrink-0 text-[9px] font-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                              style={{ backgroundColor: 'rgba(37,99,235,0.15)', color: '#60A5FA' }}
                            >
                              New
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* User footer */}
      <div className="flex-shrink-0 p-2" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        {!collapsed ? (
          <div
            className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-all duration-150 cursor-pointer group"
            style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white font-700 flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                fontSize: '10px',
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
              }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[12px] font-600 truncate"
                style={{ color: 'var(--sidebar-text-active)' }}
              >
                {fullName}
              </p>
              <p
                className="text-[10px] truncate"
                style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}
              >
                {role}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 hover:scale-110 active:scale-95"
              style={{ color: 'var(--sidebar-text)' }}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white font-700"
              style={{
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                fontSize: '10px',
              }}
              title={fullName}
            >
              {initials}
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95"
              style={{ color: 'var(--sidebar-text)' }}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
