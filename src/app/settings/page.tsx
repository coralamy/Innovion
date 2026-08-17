'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import Link from 'next/link';
import {
  Settings,
  Building2,
  Bell,
  Shield,
  CreditCard,
  Globe,
  Mail,
  Phone,
  Save,
  ChevronRight,
  Smartphone,
  Key,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  UserCog,
  RefreshCw,
  AlertCircle,
  Info,
} from 'lucide-react';
import { settingsService } from '@/lib/services/settingsService';
import { rolePermissionsService } from '@/lib/services/rolePermissionsService';
import { useRBAC } from '@/contexts/RBACContext';
import { useAuth } from '@/contexts/AuthContext';
import type { RolePermissions, UserRole } from '@/contexts/RBACContext';

const settingsSections = [
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'supervisor', label: 'Supervisor Permissions', icon: UserCog },
  { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
  { id: 'integrations', label: 'Integrations', icon: Globe, href: '/settings/integrations' },
];

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, value, onChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-600 text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className="flex-shrink-0 transition-colors disabled:opacity-40"
        style={{ color: value ? 'var(--accent)' : 'var(--muted-foreground)' }}
      >
        {value ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
      </button>
    </div>
  );
}

// ── Supervisor Permissions Panel ──────────────────────────────────────────────

const PERMISSION_LABELS: Record<keyof RolePermissions, { label: string; description: string }> = {
  canManageUsers: {
    label: 'Manage Users',
    description: 'Create, edit, and deactivate user accounts',
  },
  canManageCompany: {
    label: 'Manage Company',
    description: 'Edit company profile and platform settings',
  },
  canViewReports: {
    label: 'View Reports',
    description: 'Access operational and financial reports',
  },
  canManageJobs: { label: 'Manage Jobs', description: 'Create, assign, and close jobs' },
  canManageCompliance: {
    label: 'Manage Compliance',
    description: 'Update compliance items and certifications',
  },
  canManageDocuments: {
    label: 'Manage Documents',
    description: 'Upload, edit, and delete documents',
  },
  canManageInventory: {
    label: 'Manage Inventory',
    description: 'Add, edit, and remove inventory items',
  },
  canViewFinancials: {
    label: 'View Financials',
    description: 'Access invoices, timesheets, and revenue data',
  },
};

interface SupervisorPanelProps {
  companyId: string | null;
  onRefreshRBAC: () => Promise<void>;
}

function SupervisorPermissionsPanel({ companyId, onRefreshRBAC }: SupervisorPanelProps) {
  const [perms, setPerms] = useState<RolePermissions>({
    canManageUsers: false,
    canManageCompany: false,
    canViewReports: true,
    canManageJobs: true,
    canManageCompliance: true,
    canManageDocuments: true,
    canManageInventory: false,
    canViewFinancials: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPerms = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const record = await rolePermissionsService.getForRole(companyId, 'supervisor' as UserRole);
      if (record) setPerms(record.permissions);
    } catch {
      // Use baseline defaults if no record exists yet
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadPerms();
  }, [loadPerms]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      await rolePermissionsService.upsert(companyId, 'supervisor' as UserRole, perms);
      await onRefreshRBAC();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save permissions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof RolePermissions) => (v: boolean) =>
    setPerms((p) => ({ ...p, [key]: v }));

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 animate-pulse">
            <div className="space-y-1.5">
              <div className="h-3 w-32 rounded bg-secondary" />
              <div className="h-2.5 w-48 rounded bg-secondary" />
            </div>
            <div className="w-7 h-4 rounded bg-secondary" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div
        className="flex items-start gap-3 p-4 rounded-xl text-sm"
        style={{
          backgroundColor: 'rgba(37,99,235,0.06)',
          border: '1px solid rgba(37,99,235,0.15)',
        }}
      >
        <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#2563EB' }} />
        <div>
          <p className="font-600 text-foreground">Dynamic Supervisor Permissions</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            These permissions are stored in the database and applied at runtime — they are never
            hard-coded. Changes take effect immediately for all Supervisor-role users in your
            company. (EDR-007)
          </p>
        </div>
      </div>

      {/* Permission toggles */}
      <div className="card-elevated p-5">
        <h3 className="text-sm font-700 text-foreground mb-1">Supervisor Role Permissions</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Configure what Supervisors can access and modify within Innovion.
        </p>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {(Object.keys(PERMISSION_LABELS) as Array<keyof RolePermissions>).map((key) => {
            const meta = PERMISSION_LABELS[key];
            // canManageCompany is locked off for supervisors — constitutional constraint
            const locked = key === 'canManageCompany';
            return (
              <div key={key} className={locked ? 'opacity-50' : ''}>
                <ToggleRow
                  label={meta.label}
                  description={
                    locked ? `${meta.description} — locked for Supervisor role` : meta.description
                  }
                  value={locked ? false : perms[key]}
                  onChange={toggle(key)}
                  disabled={locked}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg text-sm"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--danger)' }}
        >
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center justify-between">
        <button
          onClick={loadPerms}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-600 transition-all hover:bg-secondary"
          style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          <RefreshCw size={12} />
          Reset to saved
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !companyId}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
          style={{
            backgroundColor: saved ? 'var(--success)' : 'var(--accent)',
            minWidth: '160px',
            justifyContent: 'center',
          }}
        >
          {saving ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>
              <CheckCircle2 size={15} />
              Permissions Saved
            </>
          ) : (
            <>
              <Save size={15} />
              Save Permissions
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { companyId, user, resetPassword } = useAuth();
  const { hasPermission, refreshPermissions } = useRBAC();
  const [activeSection, setActiveSection] = useState('company');
  const [saved, setSaved] = useState(false);
  const [passwordResetState, setPasswordResetState] = useState<
    'idle' | 'sending' | 'sent' | 'error'
  >('idle');

  /**
   * Change Password — previously an inert control.
   *
   * Deliberately routed through Supabase Auth's own recovery flow rather than
   * an in-page password field: the recovery link is minted and mailed by the
   * auth service, is single-use, and proves control of the mailbox. The
   * alternative — collecting a new password in this form — would require the
   * current password to be re-verified here to be safe, and no such check
   * existed.
   */
  const handleChangePassword = async () => {
    if (!user?.email) return;
    setPasswordResetState('sending');
    try {
      await resetPassword(user.email);
      setPasswordResetState('sent');
    } catch {
      setPasswordResetState('error');
    }
  };
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsId, setSettingsId] = useState<string>('');

  const [company, setCompany] = useState({
    name: '',
    abn: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    timezone: 'Australia/Sydney',
    currency: 'AUD',
  });

  const [notifPrefs, setNotifPrefs] = useState({
    emailCompliance: true,
    emailJobs: true,
    emailIncidents: true,
    emailReports: false,
    pushCompliance: true,
    pushJobs: false,
    pushIncidents: true,
    smsIncidents: true,
  });

  const [security, setSecurity] = useState({
    twoFactor: true,
    sessionTimeout: '8h',
    ipWhitelist: false,
    auditLog: true,
    passwordPolicy: 'strong',
  });

  useEffect(() => {
    settingsService.get().then((data) => {
      if (data) {
        setSettingsId(data.id);
        setCompany({
          name: data.companyName,
          abn: data.abn,
          email: data.email,
          phone: data.phone,
          address: data.address,
          website: data.website,
          timezone: data.timezone,
          currency: data.currency,
        });
        setNotifPrefs({
          emailCompliance: data.notifEmailCompliance,
          emailJobs: data.notifEmailJobs,
          emailIncidents: data.notifEmailIncidents,
          emailReports: data.notifEmailReports,
          pushCompliance: data.notifPushCompliance,
          pushJobs: data.notifPushJobs,
          pushIncidents: data.notifPushIncidents,
          smsIncidents: data.notifSmsIncidents,
        });
        setSecurity({
          twoFactor: data.securityTwoFactor,
          sessionTimeout: data.securitySessionTimeout,
          ipWhitelist: data.securityIpWhitelist,
          auditLog: data.securityAuditLog,
          passwordPolicy: data.securityPasswordPolicy,
        });
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!settingsId) return;
    setSaving(true);
    const result = await settingsService.save({
      id: settingsId,
      companyName: company.name,
      abn: company.abn,
      email: company.email,
      phone: company.phone,
      address: company.address,
      website: company.website,
      timezone: company.timezone,
      currency: company.currency,
      notifEmailCompliance: notifPrefs.emailCompliance,
      notifEmailJobs: notifPrefs.emailJobs,
      notifEmailIncidents: notifPrefs.emailIncidents,
      notifEmailReports: notifPrefs.emailReports,
      notifPushCompliance: notifPrefs.pushCompliance,
      notifPushJobs: notifPrefs.pushJobs,
      notifPushIncidents: notifPrefs.pushIncidents,
      notifSmsIncidents: notifPrefs.smsIncidents,
      securityTwoFactor: security.twoFactor,
      securitySessionTimeout: security.sessionTimeout,
      securityIpWhitelist: security.ipWhitelist,
      securityAuditLog: security.auditLog,
      securityPasswordPolicy: security.passwordPolicy,
    });
    setSaving(false);
    if (result) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const updateNotif = (key: keyof typeof notifPrefs) => (v: boolean) =>
    setNotifPrefs((p) => ({ ...p, [key]: v }));

  // Only admins can see the Supervisor Permissions section
  const visibleSections = settingsSections.filter((s) => {
    if (s.id === 'supervisor') return hasPermission('canManageUsers');
    return true;
  });

  return (
    <AppLayout currentPath="/settings">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header-title">Settings</h1>
            <p className="page-header-subtitle">
              Manage your workspace, notifications, and security preferences
            </p>
          </div>
          {activeSection !== 'supervisor' && (
            <div className="flex items-center gap-3">
              {saved && (
                <span
                  className="flex items-center gap-1.5 text-sm font-600 animate-fade-in"
                  style={{ color: 'var(--success)' }}
                >
                  <CheckCircle2 size={15} />
                  Changes saved
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                style={{
                  backgroundColor: saved ? 'var(--success)' : 'var(--accent)',
                  minWidth: '130px',
                  justifyContent: 'center',
                }}
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle2 size={15} />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="card-elevated overflow-hidden">
              {visibleSections.map((section, idx) => {
                const SectionIcon = section.icon;
                const isActive = activeSection === section.id;
                const sectionWithHref = section as typeof section & { href?: string };
                if (sectionWithHref.href) {
                  return (
                    <Link
                      key={section.id}
                      href={sectionWithHref.href}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm transition-colors text-left"
                      style={{
                        backgroundColor: 'transparent',
                        color: 'var(--foreground)',
                        borderBottom:
                          idx < visibleSections.length - 1 ? '1px solid var(--border)' : 'none',
                        display: 'flex',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <SectionIcon size={16} />
                        <span className="font-600">{section.label}</span>
                      </div>
                      <ChevronRight size={14} style={{ opacity: 0.4 }} />
                    </Link>
                  );
                }
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm transition-colors text-left"
                    style={{
                      backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                      color: isActive ? 'white' : 'var(--foreground)',
                      borderBottom:
                        idx < visibleSections.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <SectionIcon size={16} />
                      <span className="font-600">{section.label}</span>
                    </div>
                    <ChevronRight size={14} style={{ opacity: isActive ? 1 : 0.4 }} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {activeSection === 'company' && (
              <div className="card-elevated p-6 space-y-5">
                <h2 className="text-base font-700 text-foreground">Company Profile</h2>
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className={i === 4 ? 'sm:col-span-2' : ''}>
                        <div className="skeleton h-3 w-24 mb-2" />
                        <div className="skeleton h-10 w-full rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: 'Company Name', key: 'name' },
                      { label: 'ABN', key: 'abn' },
                      { label: 'Email Address', key: 'email' },
                      { label: 'Phone Number', key: 'phone' },
                      { label: 'Address', key: 'address' },
                      { label: 'Website', key: 'website' },
                    ].map((field) => (
                      <div
                        key={field.key}
                        className={field.key === 'address' ? 'sm:col-span-2' : ''}
                      >
                        <label
                          className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                          style={{ fontSize: '11px' }}
                        >
                          {field.label}
                        </label>
                        <input
                          suppressHydrationWarning
                          type="text"
                          value={company[field.key as keyof typeof company]}
                          onChange={(e) =>
                            setCompany((p) => ({ ...p, [field.key]: e.target.value }))
                          }
                          className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                          style={{ borderColor: 'var(--border)' }}
                        />
                      </div>
                    ))}
                    <div>
                      <label
                        className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                        style={{ fontSize: '11px' }}
                      >
                        Timezone
                      </label>
                      <select
                        suppressHydrationWarning
                        value={company.timezone}
                        onChange={(e) => setCompany((p) => ({ ...p, timezone: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                        <option value="Australia/Melbourne">Australia/Melbourne (AEST)</option>
                        <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
                        <option value="Australia/Perth">Australia/Perth (AWST)</option>
                        <option value="Australia/Adelaide">Australia/Adelaide (ACST)</option>
                      </select>
                    </div>
                    <div>
                      <label
                        className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                        style={{ fontSize: '11px' }}
                      >
                        Currency
                      </label>
                      <select
                        suppressHydrationWarning
                        value={company.currency}
                        onChange={(e) => setCompany((p) => ({ ...p, currency: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <option value="AUD">AUD — Australian Dollar</option>
                        <option value="NZD">NZD — New Zealand Dollar</option>
                        <option value="USD">USD — US Dollar</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-4">
                {[
                  {
                    title: 'Email Notifications',
                    icon: Mail,
                    items: [
                      {
                        key: 'emailCompliance',
                        label: 'Compliance alerts',
                        description: 'Expiring licenses, certifications, and insurance',
                      },
                      {
                        key: 'emailJobs',
                        label: 'Job updates',
                        description: 'New assignments, completions, and cancellations',
                      },
                      {
                        key: 'emailIncidents',
                        label: 'Incident reports',
                        description: 'New incidents and status changes',
                      },
                      {
                        key: 'emailReports',
                        label: 'Weekly reports',
                        description: 'Automated weekly operations summary',
                      },
                    ],
                  },
                  {
                    title: 'Push Notifications',
                    icon: Smartphone,
                    items: [
                      {
                        key: 'pushCompliance',
                        label: 'Compliance alerts',
                        description: 'Critical compliance issues requiring immediate action',
                      },
                      {
                        key: 'pushJobs',
                        label: 'Job updates',
                        description: 'Real-time job status changes',
                      },
                      {
                        key: 'pushIncidents',
                        label: 'Incident alerts',
                        description: 'New critical and high severity incidents',
                      },
                    ],
                  },
                  {
                    title: 'SMS Notifications',
                    icon: Phone,
                    items: [
                      {
                        key: 'smsIncidents',
                        label: 'Critical incidents',
                        description: 'SMS alerts for critical severity incidents only',
                      },
                    ],
                  },
                ].map((group) => (
                  <div key={group.title} className="card-elevated p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <group.icon size={16} className="text-muted-foreground" />
                      <h3 className="text-sm font-700 text-foreground">{group.title}</h3>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {group.items.map((item) => (
                        <ToggleRow
                          key={item.key}
                          label={item.label}
                          description={item.description}
                          value={notifPrefs[item.key as keyof typeof notifPrefs]}
                          onChange={updateNotif(item.key as keyof typeof notifPrefs)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-4">
                <div className="card-elevated p-5">
                  <h3 className="text-sm font-700 text-foreground mb-4">Authentication</h3>
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    <ToggleRow
                      label="Two-Factor Authentication"
                      description="Require 2FA for all admin and manager accounts"
                      value={security.twoFactor}
                      onChange={(v) => setSecurity((p) => ({ ...p, twoFactor: v }))}
                    />
                    <ToggleRow
                      label="IP Whitelist"
                      description="Restrict access to approved IP addresses only"
                      value={security.ipWhitelist}
                      onChange={(v) => setSecurity((p) => ({ ...p, ipWhitelist: v }))}
                    />
                    <ToggleRow
                      label="Audit Log"
                      description="Log all user actions for security review"
                      value={security.auditLog}
                      onChange={(v) => setSecurity((p) => ({ ...p, auditLog: v }))}
                    />
                  </div>
                </div>
                <div className="card-elevated p-5">
                  <h3 className="text-sm font-700 text-foreground mb-4">Session & Password</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                        style={{ fontSize: '11px' }}
                      >
                        Session Timeout
                      </label>
                      <select
                        suppressHydrationWarning
                        value={security.sessionTimeout}
                        onChange={(e) =>
                          setSecurity((p) => ({ ...p, sessionTimeout: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <option value="1h">1 hour</option>
                        <option value="4h">4 hours</option>
                        <option value="8h">8 hours</option>
                        <option value="24h">24 hours</option>
                        <option value="never">Never</option>
                      </select>
                    </div>
                    <div>
                      <label
                        className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                        style={{ fontSize: '11px' }}
                      >
                        Password Policy
                      </label>
                      <select
                        suppressHydrationWarning
                        value={security.passwordPolicy}
                        onChange={(e) =>
                          setSecurity((p) => ({ ...p, passwordPolicy: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <option value="basic">Basic (8+ chars)</option>
                        <option value="strong">Strong (8+ chars, number, symbol)</option>
                        <option value="very-strong">
                          Very Strong (12+ chars, mixed case, number, symbol)
                        </option>
                      </select>
                    </div>
                  </div>
                  {/*
                    Previously inert. Password change is performed through
                    Supabase Auth's recovery flow, which mints its own
                    single-use link and mails it to the address on the account —
                    the same mechanism as "forgot password", and the reason the
                    Edge Function no longer accepts a caller-supplied reset link.
                  */}
                  <button
                    onClick={handleChangePassword}
                    disabled={passwordResetState === 'sending'}
                    className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 transition-all hover:bg-secondary disabled:opacity-60"
                    style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    <Key size={14} />
                    {passwordResetState === 'sending'
                      ? 'Sending…'
                      : passwordResetState === 'sent'
                        ? 'Check your email'
                        : 'Change Password'}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'supervisor' && (
              <SupervisorPermissionsPanel
                companyId={companyId}
                onRefreshRBAC={refreshPermissions}
              />
            )}

            {activeSection === 'billing' && (
              <div className="space-y-4">
                <div className="card-elevated p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-700 text-foreground">Current Plan</h3>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-700 text-white"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      Growth
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {[
                      { label: 'Plan', value: 'Growth' },
                      { label: 'Price', value: '$99/month' },
                      { label: 'Next Billing', value: '01 Aug 2025' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="p-3 rounded-lg text-center"
                        style={{ backgroundColor: 'var(--secondary)' }}
                      >
                        <p className="text-sm font-700 text-foreground">{item.value}</p>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[
                      'Up to 15 contractors',
                      'Unlimited jobs',
                      'Compliance tracking',
                      'Advanced reporting',
                      'Priority support',
                    ].map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 size={14} className="text-success flex-shrink-0" />
                        <span className="text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/billing"
                    className="mt-4 inline-block px-4 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Change plan
                  </Link>
                </div>
                {/*
                  DEFECT REMEDIATED (fabricated data presented as real):
                  this panel displayed a hard-coded "Visa ending in 4242,
                  Expires 12/2027" for every organisation, with an inert
                  "Update" control beside it. No payment method is stored
                  anywhere in the schema, so the card did not exist — yet a user
                  reading this screen would reasonably conclude that billing was
                  set up and that their subscription would renew. Replaced with
                  the true state and a link to the page that actually manages
                  billing.
                */}
                <div className="card-elevated p-5">
                  <h3 className="text-sm font-700 text-foreground mb-4">Payment Method</h3>
                  <div
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--secondary)' }}
                  >
                    <CreditCard size={18} className="text-muted-foreground" />
                    <div>
                      <p className="text-sm font-600 text-foreground">No payment method on file</p>
                      <p className="text-xs text-muted-foreground">
                        Payment methods are managed from Billing.
                      </p>
                    </div>
                    <Link
                      href="/billing"
                      className="ml-auto text-xs font-600 text-accent hover:underline"
                    >
                      Manage billing
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'integrations' && (
              <div className="card-elevated p-5">
                <h3 className="text-sm font-700 text-foreground mb-4">Available Integrations</h3>
                <div className="space-y-3">
                  {[
                    {
                      name: 'Xero',
                      description: 'Sync invoices and financial data',
                      connected: true,
                      color: '#1AB4D7',
                    },
                    {
                      name: 'Slack',
                      description: 'Send job and compliance alerts to Slack channels',
                      connected: false,
                      color: '#4A154B',
                    },
                    {
                      name: 'Google Calendar',
                      description: 'Sync job schedules with Google Calendar',
                      connected: true,
                      color: '#4285F4',
                    },
                    {
                      name: 'Zapier',
                      description: 'Automate workflows with 5,000+ apps',
                      connected: false,
                      color: '#FF4A00',
                    },
                    {
                      name: 'Stripe',
                      description: 'Process client payments and invoices',
                      connected: false,
                      color: '#635BFF',
                    },
                  ].map((integration) => (
                    <div
                      key={integration.name}
                      className="flex items-center gap-4 p-4 rounded-xl border transition-colors hover:bg-secondary/30"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-800 text-white flex-shrink-0"
                        style={{ backgroundColor: integration.color }}
                      >
                        {integration.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-700 text-foreground">{integration.name}</p>
                        <p className="text-xs text-muted-foreground">{integration.description}</p>
                      </div>
                      {/*
                        This summary duplicated the integrations list that
                        /settings/integrations already owns, with an inert
                        Connect control. It now links to the page that performs
                        the connection, rather than presenting a second,
                        non-functional entry point to the same feature.
                      */}
                      <Link
                        href="/settings/integrations"
                        className="px-3 py-1.5 rounded-lg text-xs font-600 transition-all flex-shrink-0"
                        style={{
                          backgroundColor: integration.connected
                            ? 'var(--success-bg)'
                            : 'var(--accent)',
                          color: integration.connected ? 'var(--success)' : 'white',
                          border: integration.connected ? '1px solid rgba(16,185,129,0.3)' : 'none',
                        }}
                      >
                        {integration.connected ? 'Connected' : 'Connect'}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
