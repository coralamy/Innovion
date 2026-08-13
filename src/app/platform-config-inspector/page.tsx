'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { platformConfigurationService } from '@/lib/services/platformConfigurationService';
import type { PlatformOrganisationConfig, ConfigurationManifest } from '@/lib/services/platformConfigurationService';
import { ShieldCheck, RefreshCw, ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, Globe, Building2, Palette, Lock, Package, Users, Cpu, Handshake, ToggleLeft, GitBranch, Server, Database, FileCheck, AlertTriangle, Info, Copy, Check } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  badgeVariant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copyable?: string;
}

interface StatusBadgeProps {
  value: string | boolean | null | undefined;
  trueLabel?: string;
  falseLabel?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ value, trueLabel = 'Enabled', falseLabel = 'Disabled' }: StatusBadgeProps) {
  if (typeof value === 'boolean') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600"
        style={{
          backgroundColor: value ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: value ? '#16a34a' : '#dc2626',
        }}
      >
        {value ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
        {value ? trueLabel : falseLabel}
      </span>
    );
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    enabled:      { bg: 'rgba(34,197,94,0.12)',  text: '#16a34a' },
    active:       { bg: 'rgba(34,197,94,0.12)',  text: '#16a34a' },
    trialing:     { bg: 'rgba(59,130,246,0.12)', text: '#2563eb' },
    provisioned:  { bg: 'rgba(59,130,246,0.12)', text: '#2563eb' },
    disabled:     { bg: 'rgba(239,68,68,0.12)',  text: '#dc2626' },
    suspended:    { bg: 'rgba(239,68,68,0.12)',  text: '#dc2626' },
    cancelled:    { bg: 'rgba(239,68,68,0.12)',  text: '#dc2626' },
    beta:         { bg: 'rgba(245,158,11,0.12)', text: '#d97706' },
    coming_soon:  { bg: 'rgba(156,163,175,0.12)', text: '#6b7280' },
    deprecated:   { bg: 'rgba(156,163,175,0.12)', text: '#6b7280' },
    past_due:     { bg: 'rgba(245,158,11,0.12)', text: '#d97706' },
    not_provisioned: { bg: 'rgba(156,163,175,0.12)', text: '#6b7280' },
  };

  const key = (value ?? 'unknown').toLowerCase().replace(/ /g, '_');
  const colors = statusColors[key] ?? { bg: 'rgba(156,163,175,0.12)', text: '#6b7280' };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 capitalize"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {value ?? '—'}
    </span>
  );
}

function FieldRow({ label, value, mono = false, copyable }: FieldRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!copyable) return;
    navigator.clipboard.writeText(copyable).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [copyable]);

  return (
    <div className="flex items-start justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
      <span className="text-sm flex-shrink-0 mr-4" style={{ color: 'var(--muted-foreground)', minWidth: '10rem', maxWidth: '12rem' }}>{label}</span>
      <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
        <span
          className={`text-sm text-right break-all ${mono ? 'font-mono text-xs' : 'font-500'}`}
          style={{ color: 'var(--foreground)' }}
        >
          {value ?? <span style={{ color: 'var(--muted-foreground)' }}>—</span>}
        </span>
        {copyable && (
          <button
            onClick={handleCopy}
            className="flex-shrink-0 p-1 rounded transition-colors hover:opacity-70"
            style={{ color: 'var(--muted-foreground)' }}
            title="Copy"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = false, badge, badgeVariant = 'neutral' }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const badgeColors: Record<string, { bg: string; text: string }> = {
    success: { bg: 'rgba(34,197,94,0.15)',  text: '#16a34a' },
    warning: { bg: 'rgba(245,158,11,0.15)', text: '#d97706' },
    error:   { bg: 'rgba(239,68,68,0.15)',  text: '#dc2626' },
    info:    { bg: 'rgba(59,130,246,0.15)', text: '#2563eb' },
    neutral: { bg: 'rgba(148,163,184,0.2)', text: 'var(--foreground)' },
  };
  const bc = badgeColors[badgeVariant];

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:opacity-80"
        style={{ backgroundColor: 'var(--card)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(var(--accent-rgb, 37,99,235),0.1)' }}>
            <Icon size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <span className="text-sm font-600" style={{ color: 'var(--foreground)' }}>{title}</span>
          {badge && (
            <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ backgroundColor: bc.bg, color: bc.text }}>
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronDown size={16} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />}
      </button>
      {open && (
        <div className="px-5 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlatformConfigInspectorPage() {
  const { companyId } = useAuth();
  const { hasPermission } = useRBAC();
  const [config, setConfig] = useState<PlatformOrganisationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const isAuthorised = hasPermission('canManageCompany');

  const loadConfig = useCallback(async () => {
    if (!companyId || !isAuthorised) return;
    setLoading(true);
    setError(null);
    try {
      const data = await platformConfigurationService.getOrganisationConfig(companyId);
      if (!data) throw new Error('Organisation configuration not found.');
      setConfig(data);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration.');
    } finally {
      setLoading(false);
    }
  }, [companyId, isAuthorised]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (!isAuthorised) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <ShieldCheck size={48} style={{ color: 'var(--muted-foreground)' }} />
          <h2 className="text-xl font-700" style={{ color: 'var(--foreground)' }}>Access Restricted</h2>
          <p className="text-sm text-center max-w-sm" style={{ color: 'var(--muted-foreground)' }}>
            The Configuration Inspector is available to authorised administrators and support personnel only.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
              <h1 className="text-xl font-700" style={{ color: 'var(--foreground)' }}>Configuration Inspector</h1>
            </div>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Complete visibility of the active Platform Configuration. Authorised administrators and support personnel only.
            </p>
          </div>
          <button
            onClick={loadConfig}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 transition-all disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)', color: 'white' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)', color: '#dc2626' }}>
            <AlertTriangle size={16} />
            <span className="text-sm font-500">{error}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !config && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--card)' }} />
            ))}
          </div>
        )}

        {config && (
          <>
            {/* Manifest Banner */}
            <ManifestBanner manifest={config.manifest} lastRefreshed={lastRefreshed} />

            {/* Sections */}
            <div className="space-y-3">

              {/* Organisation Identity */}
              <Section title="Organisation Identity" icon={Building2} defaultOpen badge={config.branding.organisationName || 'Unknown'} badgeVariant="info">
                <FieldRow label="Organisation ID" value={config.organisationId} mono copyable={config.organisationId} />
                <FieldRow label="Tenant ID" value={config.manifest.tenantId} mono copyable={config.manifest.tenantId} />
                <FieldRow label="Organisation Name" value={config.branding.organisationName} />
                <FieldRow label="Product" value={`${config.licensing.productName} (${config.licensing.productId})`} />
                <FieldRow label="Licence Model" value={<StatusBadge value={config.licensing.licenceModel} />} />
                <FieldRow label="Organisation Tier" value={<StatusBadge value={config.organisationalHierarchy.tier} />} />
                <FieldRow label="Parent Organisation" value={config.organisationalHierarchy.parentOrganisationId} mono />
                <FieldRow label="Child Organisations" value={config.organisationalHierarchy.childOrganisationIds.length > 0 ? config.organisationalHierarchy.childOrganisationIds.join(', ') : 'None'} />
                <FieldRow label="Sites" value={`${config.organisationalHierarchy.siteCount} site${config.organisationalHierarchy.siteCount !== 1 ? 's' : ''}`} />
                <FieldRow label="Multi-Site" value={<StatusBadge value={config.organisationalHierarchy.multiSiteEnabled} />} />
              </Section>

              {/* Branding */}
              <Section title="Branding" icon={Palette} badge={config.branding.customDomain ? 'Custom Domain' : 'Default'} badgeVariant={config.branding.customDomain ? 'success' : 'neutral'}>
                <FieldRow label="Primary Colour" value={
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border inline-block" style={{ backgroundColor: config.branding.primaryColour, borderColor: 'var(--border)' }} />
                    <span className="font-mono text-xs">{config.branding.primaryColour}</span>
                  </span>
                } />
                <FieldRow label="Secondary Colour" value={
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border inline-block" style={{ backgroundColor: config.branding.secondaryColour, borderColor: 'var(--border)' }} />
                    <span className="font-mono text-xs">{config.branding.secondaryColour}</span>
                  </span>
                } />
                <FieldRow label="Logo URL" value={config.branding.logoUrl} mono />
                <FieldRow label="Favicon URL" value={config.branding.faviconUrl} mono />
                <FieldRow label="Custom Domain" value={config.branding.customDomain} mono />
                <FieldRow label="Show Powered By" value={<StatusBadge value={config.branding.showPoweredBy} />} />
              </Section>

              {/* Localisation */}
              <Section title="Localisation & Regional Configuration" icon={Globe} badge={config.localisation.countryCode}>
                <FieldRow label="Country" value={config.localisation.countryCode} />
                <FieldRow label="Language" value={config.localisation.language} />
                <FieldRow label="Timezone" value={config.localisation.timezone} />
                <FieldRow label="Currency" value={`${config.localisation.currencyCode} (${config.localisation.currencySymbol})`} />
                <FieldRow label="Date Format" value={config.localisation.dateFormat} mono />
                <FieldRow label="Time Format" value={config.localisation.timeFormat} />
                <FieldRow label="First Day of Week" value={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][config.localisation.firstDayOfWeek]} />
                <FieldRow label="Measurement System" value={<StatusBadge value={config.localisation.measurementSystem} />} />
                <FieldRow label="Decimal Separator" value={config.localisation.decimalSeparator} mono />
                <FieldRow label="Thousands Separator" value={config.localisation.thousandsSeparator} mono />
                <FieldRow label="Currency Symbol Position" value={config.localisation.currencySymbolPosition} />
                <FieldRow label="Data Residency Region" value={config.dataGovernanceConfig.dataResidencyRegion} mono />
                <FieldRow label="GDPR Applicable" value={<StatusBadge value={config.dataGovernanceConfig.gdprEnabled} />} />
              </Section>

              {/* Licensing */}
              <Section title="Licensing" icon={FileCheck} badge={config.licensing.status ?? 'Unknown'} badgeVariant={config.licensing.isActive ? 'success' : 'warning'}>
                <FieldRow label="Plan" value={config.licensing.planName} />
                <FieldRow label="Status" value={<StatusBadge value={config.licensing.status} />} />
                <FieldRow label="Active" value={<StatusBadge value={config.licensing.isActive} />} />
                <FieldRow label="Read-Only Mode" value={<StatusBadge value={config.licensing.isReadOnly} trueLabel="Read-Only" falseLabel="Full Access" />} />
                <FieldRow label="Max Users" value={config.licensing.maxUsers ?? 'Unlimited'} />
                <FieldRow label="Max Jobs" value={config.licensing.maxJobs ?? 'Unlimited'} />
                <FieldRow label="Trial Ends" value={config.licensing.trialEndsAt ? new Date(config.licensing.trialEndsAt).toLocaleDateString() : '—'} />
                <FieldRow label="Period End" value={config.licensing.currentPeriodEnd ? new Date(config.licensing.currentPeriodEnd).toLocaleDateString() : '—'} />
                <FieldRow label="Plan Features" value={config.licensing.planFeatures.length > 0 ? config.licensing.planFeatures.join(', ') : 'None'} />
              </Section>

              {/* Enabled Modules */}
              <Section title="Enabled Modules" icon={Package} badge={`${config.modules.enabledIds.length} / ${config.modules.available.length}`} badgeVariant="info">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {config.modules.available.map((mod) => (
                    <div key={mod.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--background)' }}>
                      <span className="text-sm font-500" style={{ color: 'var(--foreground)' }}>{mod.name}</span>
                      <StatusBadge value={mod.status} />
                    </div>
                  ))}
                </div>
              </Section>

              {/* Feature Registry */}
              <Section title="Feature Registry" icon={ToggleLeft} badge={`${config.featureRegistry.enabledKeys.length} enabled`} badgeVariant="info">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {config.featureRegistry.flags.map((flag) => (
                    <div key={flag.key} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--background)' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-500 truncate" style={{ color: 'var(--foreground)' }}>{flag.name}</p>
                        {flag.planGated && (
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Plan: {flag.minimumPlan ?? 'any'} · {flag.rolloutPercentage}%</p>
                        )}
                      </div>
                      <StatusBadge value={flag.status} />
                    </div>
                  ))}
                </div>
              </Section>

              {/* Digital Professional */}
              <Section title="Digital Professional Configuration" icon={Cpu} badge={config.digitalProfessional.status} badgeVariant={config.digitalProfessional.status === 'active' ? 'success' : 'neutral'}>
                <FieldRow label="Status" value={<StatusBadge value={config.digitalProfessional.status} />} />
                <FieldRow label="Persona Name" value={config.digitalProfessional.personaName} />
                <FieldRow label="Primary Language" value={config.digitalProfessional.primaryLanguage} />
                <FieldRow label="Data Access" value={<StatusBadge value={config.digitalProfessional.dataAccessEnabled} />} />
                <FieldRow label="Max Tokens / Request" value={config.digitalProfessional.maxTokensPerRequest === 0 ? 'Platform Default' : config.digitalProfessional.maxTokensPerRequest.toString()} />
                <FieldRow label="Capabilities" value={config.digitalProfessional.capabilities.length > 0 ? `${config.digitalProfessional.capabilities.length} configured` : 'None'} />
              </Section>

              {/* Partner Configuration */}
              <Section title="Partner Configuration" icon={Handshake} badge={config.partner.hasPartner ? config.partner.partnerName ?? 'Partner' : 'Direct'} badgeVariant={config.partner.hasPartner ? 'info' : 'info'}>
                <FieldRow label="Has Partner" value={<StatusBadge value={config.partner.hasPartner} />} />
                <FieldRow label="Partner ID" value={config.partner.partnerId} mono />
                <FieldRow label="Partner Name" value={config.partner.partnerName} />
                <FieldRow label="Partner Type" value={config.partner.partnerType} />
                <FieldRow label="Customer Ownership" value={config.partner.customerOwnership} />
                <FieldRow label="Territory" value={config.partner.territory ? `${config.partner.territory.name} (${config.partner.territory.countryCode})` : '—'} />
                <FieldRow label="MRR" value={config.partner.mrr != null ? config.partner.mrr.toString() : '—'} />
                <FieldRow label="ARR" value={config.partner.arr != null ? config.partner.arr.toString() : '—'} />
                <FieldRow label="Partner Products" value={config.partner.partnerProducts.length > 0 ? config.partner.partnerProducts.join(', ') : 'None'} />
              </Section>

              {/* Security Policies */}
              <Section title="Security Policies" icon={Lock} badge={config.security.mfaRequired ? 'MFA Required' : 'Standard'} badgeVariant={config.security.mfaRequired ? 'success' : 'neutral'}>
                <FieldRow label="MFA Required" value={<StatusBadge value={config.security.mfaRequired} />} />
                <FieldRow label="MFA Enabled" value={<StatusBadge value={config.security.mfaEnabled} />} />
                <FieldRow label="Session Timeout" value={config.security.sessionTimeout} />
                <FieldRow label="IP Allowlist" value={<StatusBadge value={config.security.ipWhitelistEnabled} />} />
                <FieldRow label="Allowed IPs" value={config.security.ipWhitelist.length > 0 ? config.security.ipWhitelist.join(', ') : 'All IPs'} mono />
                <FieldRow label="Audit Log" value={<StatusBadge value={config.security.auditLogEnabled} />} />
                <FieldRow label="Password Policy" value={<StatusBadge value={config.security.passwordPolicy} />} />
                <FieldRow label="SSO Enabled" value={<StatusBadge value={config.security.ssoEnabled} />} />
                <FieldRow label="SSO Provider" value={config.security.ssoProvider} />
              </Section>

              {/* Organisation Hierarchy */}
              <Section title="Organisation Hierarchy" icon={GitBranch} badge={config.organisationalHierarchy.tier}>
                <FieldRow label="Tier" value={<StatusBadge value={config.organisationalHierarchy.tier} />} />
                <FieldRow label="Multi-Site" value={<StatusBadge value={config.organisationalHierarchy.multiSiteEnabled} />} />
                <FieldRow label="Site Count" value={config.organisationalHierarchy.siteCount.toString()} />
                <FieldRow label="Organisational Units" value={config.organisationalHierarchy.units.length > 0 ? `${config.organisationalHierarchy.units.length} units` : 'None configured'} />
              </Section>

              {/* API Version & Platform Compatibility */}
              <Section title="API Version & Platform Compatibility" icon={Server} badge={`API ${config.manifest.apiVersion}`} badgeVariant="info">
                <FieldRow label="Schema Version" value={config.manifest.schemaVersion} mono />
                <FieldRow label="API Version" value={config.manifest.apiVersion} mono />
                <FieldRow label="Min Client Version" value={config.manifest.minimumClientVersion} mono />
                <FieldRow label="Config Hash (ETag)" value={config.manifest.configHash.slice(0, 16) + '...'} mono copyable={config.manifest.configHash} />
                <FieldRow label="Generated At" value={new Date(config.manifest.generatedAt).toLocaleString()} />
                <FieldRow label="Last Modified" value={config.manifest.lastModifiedAt ? new Date(config.manifest.lastModifiedAt).toLocaleString() : '—'} />
                <FieldRow label="Domain Count" value={config.manifest.domainCount.toString()} />
                <div className="pt-2">
                  <p className="text-xs font-600 mb-2" style={{ color: 'var(--muted-foreground)' }}>Compatible Client Types</p>
                  <div className="flex flex-wrap gap-1.5">
                    {config.manifest.compatibleClientTypes.map((ct) => (
                      <span key={ct} className="text-xs px-2 py-0.5 rounded-full font-500" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#2563eb' }}>
                        {ct.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Data Governance */}
              <Section title="Data Governance" icon={Database} badge={config.dataGovernanceConfig.dataResidencyRegion}>
                <FieldRow label="Residency Region" value={config.dataGovernanceConfig.dataResidencyRegion} mono />
                <FieldRow label="Residency Enforced" value={<StatusBadge value={config.dataGovernanceConfig.dataResidencyEnforced} />} />
                <FieldRow label="GDPR Mode" value={<StatusBadge value={config.dataGovernanceConfig.gdprEnabled} />} />
                <FieldRow label="DPA Executed" value={<StatusBadge value={config.dataGovernanceConfig.dpaExecuted} />} />
                <FieldRow label="DPA Date" value={config.dataGovernanceConfig.dpaExecutedAt ? new Date(config.dataGovernanceConfig.dpaExecutedAt).toLocaleDateString() : '—'} />
                <FieldRow label="Retention Period" value={config.dataGovernanceConfig.retentionPeriodDays === 0 ? 'Platform Default' : `${config.dataGovernanceConfig.retentionPeriodDays} days`} />
                <FieldRow label="Data Export" value={<StatusBadge value={config.dataGovernanceConfig.dataExportEnabled} />} />
                <FieldRow label="Compliance Frameworks" value={config.dataGovernanceConfig.complianceFrameworks.length > 0 ? config.dataGovernanceConfig.complianceFrameworks.join(', ') : 'None'} />
              </Section>

              {/* Audit & Compliance */}
              <Section title="Audit & Compliance Policy" icon={FileCheck} badge={config.auditComplianceConfig.auditLogEnabled ? 'Audit Active' : 'Audit Off'} badgeVariant={config.auditComplianceConfig.auditLogEnabled ? 'success' : 'warning'}>
                <FieldRow label="Audit Log" value={<StatusBadge value={config.auditComplianceConfig.auditLogEnabled} />} />
                <FieldRow label="Retention" value={config.auditComplianceConfig.auditLogRetentionDays === 0 ? 'Platform Default' : `${config.auditComplianceConfig.auditLogRetentionDays} days`} />
                <FieldRow label="Config Change Audit" value={<StatusBadge value={config.auditComplianceConfig.configChangeAuditEnabled} />} />
                <FieldRow label="API Access Audit" value={<StatusBadge value={config.auditComplianceConfig.apiAccessAuditEnabled} />} />
                <FieldRow label="Auth Event Audit" value={<StatusBadge value={config.auditComplianceConfig.authEventAuditEnabled} />} />
                <FieldRow label="Data Export Audit" value={<StatusBadge value={config.auditComplianceConfig.dataExportAuditEnabled} />} />
                <FieldRow label="DPO Nominated" value={<StatusBadge value={config.auditComplianceConfig.dpoNominated} />} />
                <FieldRow label="DPO Email" value={config.auditComplianceConfig.dpoEmail} />
                <FieldRow label="Compliance Alerts" value={<StatusBadge value={config.auditComplianceConfig.complianceAlertsEnabled} />} />
                <FieldRow label="Automated Reports" value={<StatusBadge value={config.auditComplianceConfig.automatedReportingEnabled} />} />
                <FieldRow label="Report Frequency" value={config.auditComplianceConfig.reportingFrequency} />
              </Section>

            </div>

            {/* Architectural Principle Footer */}
            <div className="rounded-xl border px-5 py-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              <div className="flex items-start gap-3">
                <Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                <div>
                  <p className="text-sm font-600 mb-1" style={{ color: 'var(--foreground)' }}>Architectural Principle</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    The Innovion Platform is the Single Source of Truth. Business rules, security, multi-tenancy, branding, localisation, licensing, partner configuration, and Digital Professional configuration reside within the Platform. All clients — Innovion Web Platform, Workforce, Partner Portal, Customer Portal, Public APIs, Digital Professionals, and future Coralamy applications — consume configuration exclusively through the Platform Configuration Service.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ─── Manifest Banner ──────────────────────────────────────────────────────────

function ManifestBanner({ manifest, lastRefreshed }: { manifest: ConfigurationManifest; lastRefreshed: Date | null }) {
  return (
    <div className="rounded-xl border px-5 py-4" style={{ borderColor: 'rgba(59,130,246,0.2)', backgroundColor: 'rgba(59,130,246,0.04)' }}>
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <CheckCircle2 size={16} style={{ color: '#2563eb' }} />
          <span className="text-sm font-600" style={{ color: 'var(--foreground)' }}>Configuration Active</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.25)' }}>
            Schema {manifest.schemaVersion}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.25)' }}>
            {manifest.apiVersion}
          </span>
        </div>
        <div className="flex items-center gap-5 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Clock size={12} style={{ color: 'var(--muted-foreground)' }} />
            <span className="text-xs font-500" style={{ color: 'var(--foreground)' }}>
              {lastRefreshed ? `Refreshed ${lastRefreshed.toLocaleTimeString()}` : 'Loading…'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-600" style={{ color: 'var(--muted-foreground)' }}>ETag</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--foreground)', backgroundColor: 'var(--secondary)' }}>{manifest.configHash.slice(0, 12)}…</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-600" style={{ color: 'var(--muted-foreground)' }}>Org</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--foreground)', backgroundColor: 'var(--secondary)' }}>{manifest.organisationId.slice(0, 8)}…</span>
          </div>
        </div>
      </div>
    </div>
  );
}
