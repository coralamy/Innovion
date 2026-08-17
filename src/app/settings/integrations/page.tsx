'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import PermissionDenied from '@/components/PermissionDenied';
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  ChevronRight,
  Settings,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Save,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  Plug,
  Shield,
  Zap,
} from 'lucide-react';
import {
  providerIntegrationService,
  PROVIDER_CATALOGUE,
  type ProviderIntegration,
  type ProviderDefinition,
  type IntegrationStatus,
} from '@/lib/services/providerIntegrationService';
import Icon from '@/components/ui/AppIcon';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<
  IntegrationStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  not_configured: { label: 'Not Configured', color: 'var(--muted-foreground)', icon: XCircle },
  configured: { label: 'Configured', color: 'var(--warning)', icon: Clock },
  active: { label: 'Active', color: 'var(--success)', icon: CheckCircle2 },
  error: { label: 'Error', color: 'var(--danger)', icon: AlertCircle },
  disabled: { label: 'Disabled', color: 'var(--muted-foreground)', icon: XCircle },
};

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className="flex items-center gap-1 text-xs font-600" style={{ color: meta.color }}>
      <Icon size={12} />
      {meta.label}
    </span>
  );
}

// ── Category label ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  accounting: 'Accounting & Finance',
  microsoft: 'Microsoft',
  google: 'Google',
  payments: 'Payments',
  web_digital: 'Web & Digital Services',
  communications: 'Communications',
  identity: 'Identity & SSO',
  other: 'Other',
};

// ── Configure modal ───────────────────────────────────────────────────────────

interface ConfigureModalProps {
  provider: ProviderDefinition;
  existing: ProviderIntegration | null;
  onClose: () => void;
  onSaved: () => void;
  companyId: string;
}

function ConfigureModal({ provider, existing, onClose, onSaved, companyId }: ConfigureModalProps) {
  const [displayValues, setDisplayValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    provider.displayFields.forEach((f) => {
      init[f.key] = existing?.displayConfig?.[f.key] ?? '';
    });
    return init;
  });
  const [secretValues, setSecretValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    provider.secretFields.forEach((f) => {
      init[f.key] = '';
    });
    return init;
  });
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isEnabled, setIsEnabled] = useState(existing?.isEnabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSecret = (key: string) => setShowSecrets((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await providerIntegrationService.upsert(companyId, {
        providerSlug: provider.slug,
        providerName: provider.name,
        category: provider.category,
        displayConfig: displayValues,
        secretConfig: secretValues,
        isEnabled,
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent)', opacity: 0.1 }}
            >
              <Plug size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="text-sm font-700" style={{ color: 'var(--foreground)' }}>
                {provider.name}
              </h2>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {CATEGORY_LABELS[provider.category]}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all hover:bg-secondary"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {provider.description}
          </p>

          {/* OAuth notice */}
          {provider.usesOAuth && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg text-xs"
              style={{
                backgroundColor: 'rgba(37,99,235,0.06)',
                border: '1px solid rgba(37,99,235,0.15)',
              }}
            >
              <Zap size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--muted-foreground)' }}>
                This provider uses OAuth 2.0. Connection is initiated via the secure OAuth flow — no
                credentials are entered manually. All OAuth endpoints use{' '}
                <strong style={{ color: 'var(--foreground)' }}>innovion.app</strong> domain.
              </span>
            </div>
          )}

          {/* Enable toggle */}
          <div
            className="flex items-center justify-between py-2 rounded-lg px-3"
            style={{ backgroundColor: 'var(--secondary)' }}
          >
            <span className="text-sm font-600" style={{ color: 'var(--foreground)' }}>
              Enable Integration
            </span>
            <button
              onClick={() => setIsEnabled(!isEnabled)}
              style={{ color: isEnabled ? 'var(--accent)' : 'var(--muted-foreground)' }}
            >
              {isEnabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
            </button>
          </div>

          {/* Display fields (non-sensitive) */}
          {provider.displayFields.length > 0 && (
            <div className="space-y-3">
              <h3
                className="text-xs font-700 uppercase tracking-wide"
                style={{ color: 'var(--muted-foreground)', fontSize: '11px' }}
              >
                Configuration
              </h3>
              {provider.displayFields.map((field) => (
                <div key={field.key}>
                  <label
                    className="block text-xs font-600 mb-1.5"
                    style={{ color: 'var(--muted-foreground)', fontSize: '11px' }}
                  >
                    {field.label}
                  </label>
                  <input
                    type="text"
                    value={displayValues[field.key] ?? ''}
                    onChange={(e) =>
                      setDisplayValues((p) => ({ ...p, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Secret fields */}
          {provider.secretFields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Shield size={12} style={{ color: 'var(--muted-foreground)' }} />
                <h3
                  className="text-xs font-700 uppercase tracking-wide"
                  style={{ color: 'var(--muted-foreground)', fontSize: '11px' }}
                >
                  Credentials (encrypted at rest)
                </h3>
              </div>
              {provider.secretFields.map((field) => (
                <div key={field.key}>
                  <label
                    className="block text-xs font-600 mb-1.5"
                    style={{ color: 'var(--muted-foreground)', fontSize: '11px' }}
                  >
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets[field.key] ? 'text' : 'password'}
                      value={secretValues[field.key] ?? ''}
                      onChange={(e) =>
                        setSecretValues((p) => ({ ...p, [field.key]: e.target.value }))
                      }
                      placeholder={existing ? '••••••••••••••••' : field.placeholder}
                      className="w-full px-3 py-2.5 pr-10 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret(field.key)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {showSecrets[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {existing && (
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                      Leave blank to keep existing credential.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--danger)' }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 gap-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-600 transition-opacity hover:opacity-70"
            style={{ color: 'var(--accent)' }}
          >
            <ExternalLink size={12} />
            Documentation
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-600 transition-all hover:bg-secondary"
              style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save Integration
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Provider card ─────────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: ProviderDefinition;
  integration: ProviderIntegration | null;
  onConfigure: () => void;
  canManage: boolean;
}

function ProviderCard({ provider, integration, onConfigure, canManage }: ProviderCardProps) {
  const status: IntegrationStatus = integration?.status ?? 'not_configured';
  const isActive = status === 'active' || status === 'configured';

  return (
    <div
      className="card-elevated flex flex-col transition-all duration-200 hover:shadow-md"
      style={{
        borderLeft: isActive ? '3px solid var(--success)' : '3px solid var(--border)',
        minHeight: '160px',
        opacity: provider.comingSoon ? 0.75 : 1,
      }}
    >
      {/* Card body — flex-1 so all cards grow to equal height */}
      <div className="flex-1 p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h3 className="text-sm font-700 truncate" style={{ color: 'var(--foreground)' }}>
                {provider.name}
              </h3>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-600 flex-shrink-0"
                style={{
                  backgroundColor: 'var(--secondary)',
                  color: 'var(--secondary-foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                {CATEGORY_LABELS[provider.category]}
              </span>
              {provider.comingSoon && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-600 flex-shrink-0"
                  style={{
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    color: 'var(--warning)',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}
                >
                  Coming Soon
                </span>
              )}
            </div>
            <p
              className="text-xs leading-relaxed line-clamp-3"
              style={{ color: 'var(--muted-foreground)', opacity: 0.9 }}
            >
              {provider.description}
            </p>
          </div>
        </div>
      </div>

      {/* Card footer — always at bottom, consistent alignment */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <StatusBadge status={status} />
        {provider.comingSoon ? (
          <span className="text-xs font-500" style={{ color: 'var(--muted-foreground)' }}>
            Coming soon
          </span>
        ) : canManage ? (
          <button
            onClick={onConfigure}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: isActive ? 'var(--secondary)' : 'var(--accent)',
              color: isActive ? 'var(--foreground)' : 'white',
              border: isActive ? '1px solid var(--border)' : 'none',
            }}
          >
            {isActive ? (
              <>
                <Settings size={12} />
                Configure
              </>
            ) : (
              <>
                <Plug size={12} />
                Connect
              </>
            )}
          </button>
        ) : (
          <span className="text-xs font-500" style={{ color: 'var(--muted-foreground)' }}>
            Admin only
          </span>
        )}
      </div>

      {integration?.lastError && (
        <div
          className="flex items-start gap-2 px-5 pb-3 text-xs"
          style={{ color: 'var(--danger)' }}
        >
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          <span
            style={{
              backgroundColor: 'rgba(239,68,68,0.08)',
              padding: '0.375rem 0.5rem',
              borderRadius: '0.375rem',
              display: 'block',
              width: '100%',
            }}
          >
            {integration.lastError}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { companyId } = useAuth();
  const { hasPermission } = useRBAC();
  const canManage = hasPermission('canManageCompany');

  const [integrations, setIntegrations] = useState<ProviderIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [configuring, setConfiguring] = useState<ProviderDefinition | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await providerIntegrationService.list(companyId);
      setIntegrations(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!hasPermission('canManageCompany') && !hasPermission('canViewReports')) {
    return (
      <AppLayout currentPath="/settings/integrations">
        <PermissionDenied />
      </AppLayout>
    );
  }

  const categories = ['all', ...Array.from(new Set(PROVIDER_CATALOGUE.map((p) => p.category)))];

  const filteredProviders =
    selectedCategory === 'all'
      ? PROVIDER_CATALOGUE
      : PROVIDER_CATALOGUE.filter((p) => p.category === selectedCategory);

  const getIntegration = (slug: string) =>
    integrations.find((i) => i.providerSlug === slug) ?? null;

  const activeCount = integrations.filter(
    (i) => i.status === 'active' || i.status === 'configured'
  ).length;

  return (
    <AppLayout currentPath="/settings/integrations">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="page-header-title">Integration Settings</h1>
              {activeCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-700 text-white"
                  style={{ backgroundColor: 'var(--success)' }}
                >
                  {activeCount} active
                </span>
              )}
            </div>
            <p className="page-header-subtitle">
              Connect approved provider services to extend Platform capabilities. Credentials are
              encrypted at rest and never exposed in API responses.
            </p>
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-600 transition-all hover:bg-secondary flex-shrink-0"
            style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Security notice */}
        <div
          className="flex items-start gap-3 p-4 rounded-xl text-sm"
          style={{
            backgroundColor: 'rgba(37,99,235,0.06)',
            border: '1px solid rgba(37,99,235,0.15)',
          }}
        >
          <Shield size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
          <div>
            <p className="font-600" style={{ color: 'var(--foreground)' }}>
              Tenant-Isolated Integration Storage
            </p>
            <p style={{ color: 'var(--muted-foreground)' }}>
              All integration credentials are stored per-company with row-level security. Only
              administrators can configure integrations. Secret fields are stored encrypted and are
              never returned in API responses. All OAuth endpoints and external-facing URLs use the{' '}
              <strong style={{ color: 'var(--foreground)' }}>innovion.app</strong> domain.
            </p>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
              style={{
                backgroundColor: selectedCategory === cat ? 'var(--accent)' : 'var(--secondary)',
                color: selectedCategory === cat ? 'white' : 'var(--foreground)',
                border: selectedCategory === cat ? 'none' : '1px solid var(--border)',
              }}
            >
              {cat === 'all' ? 'All Providers' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div
            className="flex items-center gap-2 p-4 rounded-xl text-sm"
            style={{
              backgroundColor: 'rgba(239,68,68,0.08)',
              color: 'var(--danger)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Provider grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card-elevated p-5 space-y-3">
                <div className="skeleton h-4 w-32 rounded" />
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-8 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProviders.map((provider) => (
              <ProviderCard
                key={provider.slug}
                provider={provider}
                integration={getIntegration(provider.slug)}
                onConfigure={() => setConfiguring(provider)}
                canManage={canManage}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredProviders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Globe
              size={40}
              className="mb-4"
              style={{ color: 'var(--muted-foreground)', opacity: 0.4 }}
            />
            <p className="text-sm font-600" style={{ color: 'var(--foreground)' }}>
              No providers in this category
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Select a different category or view all providers.
            </p>
          </div>
        )}

        {/* Breadcrumb trail */}
        <div
          className="flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <span>System</span>
          <ChevronRight size={12} />
          <span className="font-600" style={{ color: 'var(--foreground)' }}>
            Integrations
          </span>
        </div>
      </div>

      {/* Configure modal */}
      {configuring && (
        <ConfigureModal
          provider={configuring}
          existing={getIntegration(configuring.slug)}
          onClose={() => setConfiguring(null)}
          onSaved={() => setRefreshKey((k) => k + 1)}
          companyId={companyId ?? ''}
        />
      )}
    </AppLayout>
  );
}
