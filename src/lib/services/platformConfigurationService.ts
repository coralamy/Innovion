/**
 * Platform Configuration Service
 *
 * This service is the authoritative operational configuration layer for every
 * Innovion client — Web Platform, Workforce, APIs, Partner Portal, Customer
 * Portal, and future Digital Professionals.
 *
 * It is NOT an application settings service. It is the single, extensible,
 * governed source of truth that describes an organisation's complete operational
 * configuration across the entire Coralamy platform.
 *
 * All future configuration domains must be incorporated here to ensure a single
 * authoritative source of truth. No client application should duplicate or
 * independently maintain configuration that belongs in this service.
 *
 * Design principles:
 *  1. Authoritative — every Innovion client (Web, Workforce, APIs, Partner
 *     Portal, Customer Portal, Digital Professionals) consumes this service.
 *  2. Extensibility — new configuration domains are added as optional top-level
 *     keys; existing clients that do not read the new key are unaffected.
 *  3. Configuration-driven — no country/region/plan logic is hard-coded in
 *     application code; all behaviour is derived from this configuration.
 *  4. Governed — all configuration changes are traceable and version-controlled.
 *  5. Versioned — every response carries a `configVersion` so clients can
 *     detect schema changes and handle them gracefully.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { CountryConfig } from '@/lib/countryConfig';
import { COUNTRY_CONFIGS } from '@/lib/countryConfig';
import type { LocalisationSettings } from '@/lib/localisation';

// ─── Schema version ───────────────────────────────────────────────────────────

/**
 * Increment this whenever a breaking change is made to the config shape.
 * Clients must check this version before parsing the configuration payload.
 *
 * v2.0.0 — Expanded from application settings service to full operational
 *           configuration layer for all Innovion clients. Added domains:
 *           workforceConfig, customerPortalConfig, partnerPortalConfig,
 *           apiClientsConfig, dataGovernanceConfig, auditComplianceConfig.
 * v3.0.0 — Added ConfigurationManifest to every payload. Clients must use
 *           the manifest to determine whether configuration has changed before
 *           downloading updates. Configuration should only be refreshed when
 *           the configHash or configVersion has changed.
 */
export const PLATFORM_CONFIG_VERSION = '3.0.0';

/**
 * The Supabase client a configuration read should be performed with.
 *
 * DEFECT REMEDIATED (P1 — the Platform API returned no configuration):
 *   Every method in this service called `createClient()` from
 *   `@/lib/supabase/client` — the BROWSER client. In the browser that client
 *   carries the signed-in user's session. Inside a Next.js route handler there
 *   is no `document` and no `localStorage`, so its cookie adapter returns an
 *   empty array and PostgREST evaluates the request as `anon`. Under the
 *   tenant-scoped RLS policies `anon` matches nothing, so every
 *   /api/platform/* route that reached this service resolved a null
 *   configuration and answered 404 ORG_NOT_FOUND — for a valid API key, for a
 *   real organisation.
 *
 *   The client is now injectable. Browser callers keep the existing behaviour
 *   (session-scoped, RLS-enforced). Server routes pass the service-role client
 *   AFTER they have authenticated the Bearer API key and resolved the tenant it
 *   is bound to, and every query is scoped to that companyId.
 */
export type PlatformDataClient = SupabaseClient;

// ─── Branding ─────────────────────────────────────────────────────────────────

export interface BrandingConfig {
  /** Organisation display name */
  organisationName: string;
  /** Primary brand colour (hex) */
  primaryColour: string;
  /** Secondary / accent colour (hex) */
  secondaryColour: string;
  /** URL to the organisation's logo asset */
  logoUrl: string | null;
  /** URL to a square / icon version of the logo */
  faviconUrl: string | null;
  /** Custom domain if white-labelled */
  customDomain: string | null;
  /** Whether the Coralamy / Innovion "Powered by" badge is shown */
  showPoweredBy: boolean;
}

// ─── Localisation ─────────────────────────────────────────────────────────────

export interface LocalisationConfig extends LocalisationSettings {
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** IANA timezone identifier */
  timezone: string;
  /** BCP-47 language tag */
  language: string;
  /** ISO 4217 currency code */
  currencyCode: string;
  /** Currency symbol */
  currencySymbol: string;
  /** Number of decimal places for currency display */
  currencyDecimalPrecision: number;
  /** Thousands separator character */
  thousandsSeparator: string;
  /** Decimal separator character */
  decimalSeparator: string;
  /** Whether the currency symbol appears before or after the amount */
  currencySymbolPosition: 'before' | 'after';
  /** Date display format string (e.g. 'DD/MM/YYYY') */
  dateFormat: string;
  /** 12-hour or 24-hour clock */
  timeFormat: '12h' | '24h';
  /** 0 = Sunday, 1 = Monday, 6 = Saturday */
  firstDayOfWeek: 0 | 1 | 6;
  /** Metric or imperial measurement system */
  measurementSystem: 'metric' | 'imperial';
  /** Country-level configuration (tax, address format, business identifiers) */
  countryConfig: CountryConfig;
}

// ─── Licensing ────────────────────────────────────────────────────────────────

export type LicenceModel =
  | 'direct'
  | 'exclusive_country'
  | 'exclusive_territory'
  | 'master_licence'
  | 'regional_licence'
  | 'white_label'
  | 'strategic_partnership';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'suspended'
  | 'read_only';

export interface LicensingConfig {
  /** Commercial licence model under which this organisation operates */
  licenceModel: LicenceModel;
  /** Current subscription plan name */
  planName: string | null;
  /** Current subscription status */
  status: SubscriptionStatus | null;
  /** Maximum number of user seats permitted */
  maxUsers: number | null;
  /** Maximum number of active jobs permitted */
  maxJobs: number | null;
  /** List of feature flags included in this plan */
  planFeatures: string[];
  /** Whether the account is currently in read-only mode */
  isReadOnly: boolean;
  /** Whether the subscription is in an active/billable state */
  isActive: boolean;
  /** ISO 8601 timestamp when the trial period ends (null if not trialing) */
  trialEndsAt: string | null;
  /** ISO 8601 timestamp for the end of the current billing period */
  currentPeriodEnd: string | null;
  /** Coralamy product identifier (e.g. 'innovion', 'ezbillable') */
  productId: string;
  /** Human-readable product name */
  productName: string;
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export type ModuleStatus = 'enabled' | 'disabled' | 'beta' | 'coming_soon';

export interface ModuleConfig {
  /** Unique module identifier (slug) */
  id: string;
  /** Human-readable module name */
  name: string;
  /** Brief description of what the module provides */
  description: string;
  /** Whether the module is available to this organisation */
  status: ModuleStatus;
  /** Whether the module requires an additional licence or add-on */
  requiresAddOn: boolean;
  /** Ordered list of navigation paths this module exposes */
  routes: string[];
}

export interface ModulesConfig {
  /** All modules known to the platform */
  available: ModuleConfig[];
  /** Shortcut: IDs of modules currently enabled for this organisation */
  enabledIds: string[];
}

// ─── Security Policies ────────────────────────────────────────────────────────

export type PasswordPolicy = 'standard' | 'strong' | 'enterprise';
export type SessionTimeout = '15min' | '30min' | '1h' | '4h' | '8h' | 'never';

export interface SecurityPoliciesConfig {
  /** Whether multi-factor authentication is enforced */
  mfaRequired: boolean;
  /** Whether MFA is available (but not necessarily enforced) */
  mfaEnabled: boolean;
  /** Session inactivity timeout */
  sessionTimeout: SessionTimeout;
  /** Whether IP allowlisting is active */
  ipWhitelistEnabled: boolean;
  /** Allowed IP CIDR ranges (empty = all IPs allowed) */
  ipWhitelist: string[];
  /** Whether the security audit log is enabled */
  auditLogEnabled: boolean;
  /** Password complexity policy */
  passwordPolicy: PasswordPolicy;
  /** Whether single sign-on (SSO) is configured */
  ssoEnabled: boolean;
  /** SSO provider identifier (e.g. 'okta', 'azure_ad') */
  ssoProvider: string | null;
  /** Paths that remain accessible even in read-only mode */
  readOnlyAllowedPaths: string[];
  /** Subscription statuses that trigger read-only mode */
  readOnlyTriggerStatuses: SubscriptionStatus[];
}

// ─── Digital Professional (AI Workforce) ─────────────────────────────────────

export type DigitalProfessionalStatus = 'not_provisioned' | 'provisioned' | 'active' | 'suspended';

export interface DigitalProfessionalCapability {
  /** Unique capability identifier */
  id: string;
  /** Human-readable capability name */
  name: string;
  /** Whether this capability is enabled for the organisation */
  enabled: boolean;
  /** Supported language codes for this capability */
  supportedLanguages: string[];
  /** AI model or provider powering this capability */
  provider: string | null;
  /** Additional capability-specific configuration */
  config: Record<string, unknown>;
}

export interface DigitalProfessionalConfig {
  /** Provisioning status of the Digital Professional for this organisation */
  status: DigitalProfessionalStatus;
  /** Display name of the Digital Professional persona */
  personaName: string | null;
  /** Avatar URL for the Digital Professional */
  avatarUrl: string | null;
  /** Primary language for AI responses */
  primaryLanguage: string;
  /** All capabilities available to this organisation */
  capabilities: DigitalProfessionalCapability[];
  /** Whether the Digital Professional can access company data */
  dataAccessEnabled: boolean;
  /** Maximum tokens per request (0 = platform default) */
  maxTokensPerRequest: number;
}

// ─── Partner Configuration ────────────────────────────────────────────────────

export type PartnerType =
  | 'country_licensee'
  | 'regional_partner'
  | 'territory_partner'
  | 'certified_implementation_partner'
  | 'strategic_partner'
  | 'direct';

export interface TerritoryConfig {
  /** Unique territory identifier */
  id: string;
  /** Territory display name */
  name: string;
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** Sub-national region (state, province, etc.) — null for country-level */
  region: string | null;
  /** Whether this is an exclusive territory */
  isExclusive: boolean;
}

export interface PartnerConfig {
  /** Whether this organisation is managed by a partner */
  hasPartner: boolean;
  /** Partner record identifier */
  partnerId: string | null;
  /** Partner organisation name */
  partnerName: string | null;
  /** Partner type */
  partnerType: PartnerType | null;
  /** Territory this organisation belongs to */
  territory: TerritoryConfig | null;
  /** Customer ownership classification */
  customerOwnership: 'direct' | 'licensed_territory' | 'regional_distributor' | string;
  /** Revenue attribution: MRR in the organisation's currency */
  mrr: number | null;
  /** Revenue attribution: ARR in the organisation's currency */
  arr: number | null;
  /** Products the partner is authorised to represent */
  partnerProducts: string[];
}

// ─── Feature Registry ─────────────────────────────────────────────────────────

export type FeatureStatus = 'enabled' | 'disabled' | 'beta' | 'deprecated' | 'coming_soon';

export interface FeatureFlag {
  /** Unique feature key (e.g. 'recurring_jobs', 'ai_scheduling') */
  key: string;
  /** Human-readable feature name */
  name: string;
  /** Current status for this organisation */
  status: FeatureStatus;
  /** Whether this feature is gated behind a specific plan or add-on */
  planGated: boolean;
  /** Minimum plan required to access this feature (null = all plans) */
  minimumPlan: string | null;
  /** Rollout percentage (0–100); 100 = fully released */
  rolloutPercentage: number;
}

export interface FeatureRegistryConfig {
  /** All feature flags known to the platform */
  flags: FeatureFlag[];
  /** Shortcut: keys of features currently enabled for this organisation */
  enabledKeys: string[];
}

// ─── Organisational Hierarchy ─────────────────────────────────────────────────

export type OrganisationTier = 'standalone' | 'parent' | 'subsidiary' | 'franchise';

export interface OrganisationalUnit {
  /** Unique identifier for this unit */
  id: string;
  /** Display name */
  name: string;
  /** Type of unit (department, division, branch, etc.) */
  type: string;
  /** Parent unit ID (null for root) */
  parentId: string | null;
  /** Whether this unit is currently active */
  isActive: boolean;
}

export interface OrganisationalHierarchyConfig {
  /** How this organisation sits within a corporate structure */
  tier: OrganisationTier;
  /** Parent organisation ID (null for standalone/parent) */
  parentOrganisationId: string | null;
  /** Child organisation IDs (empty for leaf organisations) */
  childOrganisationIds: string[];
  /** Internal organisational units (departments, branches, etc.) */
  units: OrganisationalUnit[];
  /** Whether multi-site management is enabled */
  multiSiteEnabled: boolean;
  /** Total number of sites/locations */
  siteCount: number;
}

// ─── Notification Preferences ─────────────────────────────────────────────────

export interface NotificationChannelConfig {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

export interface NotificationPreferencesConfig {
  compliance: NotificationChannelConfig;
  jobs: NotificationChannelConfig;
  incidents: NotificationChannelConfig;
  reports: NotificationChannelConfig;
  /** Extensible: additional event types can be added without breaking clients */
  [eventType: string]: NotificationChannelConfig;
}

// ─── Workforce Configuration ──────────────────────────────────────────────────

/**
 * Operational configuration consumed by the Workforce application.
 * The Workforce app must not maintain any independent configuration —
 * all behaviour must be derived from this domain.
 */
export interface WorkforceConfig {
  /**
   * Whether the Workforce application is enabled for this organisation.
   * When false, the Workforce app must refuse to operate.
   */
  enabled: boolean;
  /**
   * Workforce application version compatibility.
   * The Workforce app should reject configurations from incompatible versions.
   */
  minimumAppVersion: string | null;
  /**
   * Whether field workers can clock in/out via the Workforce app.
   */
  timesheetEnabled: boolean;
  /**
   * Whether GPS location tracking is enabled during active jobs.
   */
  locationTrackingEnabled: boolean;
  /**
   * Whether field workers can capture photos and attach them to jobs.
   */
  photoCapturEnabled: boolean;
  /**
   * Whether field workers can complete checklists via the Workforce app.
   */
  checklistsEnabled: boolean;
  /**
   * Whether field workers can raise incidents via the Workforce app.
   */
  incidentReportingEnabled: boolean;
  /**
   * Whether field workers can view and manage their own schedules.
   */
  scheduleViewEnabled: boolean;
  /**
   * Whether push notifications are delivered to Workforce app users.
   */
  pushNotificationsEnabled: boolean;
  /**
   * Offline mode: whether the Workforce app can operate without connectivity.
   */
  offlineModeEnabled: boolean;
  /**
   * Maximum number of days of schedule data to sync to the device.
   */
  scheduleDataSyncDays: number;
  /**
   * Custom branding applied within the Workforce app (may differ from web).
   * Null means inherit from the top-level branding domain.
   */
  workforceBranding: Pick<BrandingConfig, 'primaryColour' | 'secondaryColour' | 'logoUrl'> | null;
}

// ─── Customer Portal Configuration ───────────────────────────────────────────

/**
 * Operational configuration for the Customer Portal.
 * Defines what customers can see and do within their self-service portal.
 */
export interface CustomerPortalConfig {
  /**
   * Whether the Customer Portal is enabled for this organisation.
   */
  enabled: boolean;
  /**
   * Whether customers can log in to the portal using a magic link.
   */
  magicLinkLoginEnabled: boolean;
  /**
   * Whether customers can view their job history.
   */
  jobHistoryVisible: boolean;
  /**
   * Whether customers can request new jobs through the portal.
   */
  jobRequestEnabled: boolean;
  /**
   * Whether customers can view and download their invoices.
   */
  invoicesVisible: boolean;
  /**
   * Whether customers can make payments through the portal.
   */
  onlinePaymentsEnabled: boolean;
  /**
   * Whether customers can view compliance documents relevant to their sites.
   */
  complianceDocumentsVisible: boolean;
  /**
   * Whether customers can submit feedback or satisfaction ratings.
   */
  feedbackEnabled: boolean;
  /**
   * Whether customers can view real-time job status updates.
   */
  liveJobStatusEnabled: boolean;
  /**
   * Custom portal subdomain (e.g. 'portal.acme.com').
   * Null means the default platform portal URL is used.
   */
  portalDomain: string | null;
  /**
   * Custom welcome message displayed on the portal home screen.
   */
  welcomeMessage: string | null;
  /**
   * Portal-specific branding overrides.
   * Null means inherit from the top-level branding domain.
   */
  portalBranding: Pick<BrandingConfig, 'primaryColour' | 'secondaryColour' | 'logoUrl'> | null;
}

// ─── Partner Portal Configuration ────────────────────────────────────────────

/**
 * Operational configuration for the Partner Portal.
 * Defines what partners can access and manage within their portal.
 */
export interface PartnerPortalConfig {
  /**
   * Whether the Partner Portal is enabled for this organisation.
   * For customer organisations, this reflects whether their managing partner
   * has portal access. For partner organisations, this is their own portal.
   */
  enabled: boolean;
  /**
   * Whether partners can view and manage their customer accounts.
   */
  customerManagementEnabled: boolean;
  /**
   * Whether partners can view revenue and commission reports.
   */
  revenueReportingEnabled: boolean;
  /**
   * Whether partners can onboard new customers directly.
   */
  customerOnboardingEnabled: boolean;
  /**
   * Whether partners can access support ticket management.
   */
  supportManagementEnabled: boolean;
  /**
   * Whether partners can view territory performance dashboards.
   */
  territoryDashboardEnabled: boolean;
  /**
   * Whether partners can manage sub-partners within their territory.
   */
  subPartnerManagementEnabled: boolean;
  /**
   * Whether partners can access training and certification resources.
   */
  trainingResourcesEnabled: boolean;
  /**
   * Whether partners can generate co-branded marketing materials.
   */
  marketingMaterialsEnabled: boolean;
  /**
   * Partner portal domain (e.g. 'partners.innovion.com').
   */
  portalDomain: string | null;
  /**
   * Partner-specific branding overrides.
   * Null means inherit from the top-level branding domain.
   */
  partnerBranding: Pick<BrandingConfig, 'primaryColour' | 'secondaryColour' | 'logoUrl'> | null;
}

// ─── API Clients Registry ─────────────────────────────────────────────────────

/**
 * Describes an authorised API client that consumes the Platform Configuration
 * Service. This registry is the governed record of every system that depends
 * on this service as its configuration source.
 */
export interface ApiClientDescriptor {
  /** Unique client identifier (e.g. 'workforce', 'partner-portal') */
  clientId: string;
  /** Human-readable client name */
  name: string;
  /** Client type classification */
  type:
    | 'web_platform'
    | 'workforce'
    | 'partner_portal'
    | 'customer_portal'
    | 'digital_professional'
    | 'external_api'
    | 'internal_service';
  /** Whether this client is currently active */
  isActive: boolean;
  /** Configuration domains this client is authorised to read */
  authorisedDomains: string[];
  /** API key prefix used by this client (for audit correlation) */
  keyPrefix: string | null;
  /** ISO 8601 timestamp of last successful configuration fetch */
  lastSeenAt: string | null;
}

export interface ApiClientsConfig {
  /** All registered API clients for this organisation */
  clients: ApiClientDescriptor[];
  /** Total number of active clients */
  activeClientCount: number;
}

// ─── Data Governance ──────────────────────────────────────────────────────────

/**
 * Data governance and residency configuration.
 * Controls where data is stored, how long it is retained, and what
 * compliance frameworks apply to this organisation.
 */
export interface DataGovernanceConfig {
  /**
   * Primary data residency region (e.g. 'ap-southeast-2' for Australia).
   * All data at rest must be stored within this region.
   */
  dataResidencyRegion: string;
  /**
   * Whether data residency is contractually enforced for this organisation.
   */
  dataResidencyEnforced: boolean;
  /**
   * Data retention period in days for operational records.
   * 0 = platform default (typically 7 years for compliance).
   */
  retentionPeriodDays: number;
  /**
   * Whether GDPR compliance mode is active.
   * Enables right-to-erasure workflows and consent management.
   */
  gdprEnabled: boolean;
  /**
   * Whether the organisation has signed a Data Processing Agreement.
   */
  dpaExecuted: boolean;
  /**
   * ISO 8601 date when the DPA was executed.
   */
  dpaExecutedAt: string | null;
  /**
   * Active compliance frameworks applicable to this organisation.
   * Examples: 'ISO27001', 'SOC2', 'PCI-DSS', 'HIPAA', 'ASD-Essential8'
   */
  complianceFrameworks: string[];
  /**
   * Whether data export (portability) is enabled for this organisation.
   */
  dataExportEnabled: boolean;
  /**
   * Whether anonymisation of personal data is required on account closure.
   */
  anonymisationOnClosureRequired: boolean;
}

// ─── Audit & Compliance Policy ────────────────────────────────────────────────

/**
 * Platform-level audit and compliance policy configuration.
 * Governs what is logged, how long logs are retained, and what
 * compliance obligations apply to this organisation.
 */
export interface AuditComplianceConfig {
  /**
   * Whether the platform audit log is enabled for this organisation.
   */
  auditLogEnabled: boolean;
  /**
   * Audit log retention period in days.
   * 0 = platform default.
   */
  auditLogRetentionDays: number;
  /**
   * Whether configuration changes are included in the audit log.
   * Recommended: always true for governed organisations.
   */
  configChangeAuditEnabled: boolean;
  /**
   * Whether API access events are included in the audit log.
   */
  apiAccessAuditEnabled: boolean;
  /**
   * Whether user authentication events are included in the audit log.
   */
  authEventAuditEnabled: boolean;
  /**
   * Whether data export events are included in the audit log.
   */
  dataExportAuditEnabled: boolean;
  /**
   * Whether the organisation has nominated a Data Protection Officer.
   */
  dpoNominated: boolean;
  /**
   * DPO contact email address.
   */
  dpoEmail: string | null;
  /**
   * Whether compliance alert notifications are active.
   */
  complianceAlertsEnabled: boolean;
  /**
   * Compliance alert notification recipients.
   */
  complianceAlertRecipients: string[];
  /**
   * Whether automated compliance reports are generated.
   */
  automatedReportingEnabled: boolean;
  /**
   * Automated report frequency: 'daily' | 'weekly' | 'monthly' | 'never'
   */
  reportingFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
}

// ─── Platform Extensions (future-proof) ──────────────────────────────────────

/**
 * An open-ended map for future configuration domains.
 * Clients must treat unknown keys as optional and handle them gracefully.
 * Example future keys: 'aiGovernance', 'marketplaceConfig', 'webhooksConfig'
 */
export type PlatformExtensions = Record<string, unknown>;

// ─── Configuration Manifest ───────────────────────────────────────────────────

/**
 * ConfigurationManifest accompanies every Platform Configuration payload.
 *
 * Clients must use this manifest to determine whether configuration has changed
 * before downloading a full update. Configuration should only be refreshed when
 * the configHash or configVersion differs from the client's cached value.
 *
 * Architectural Principle:
 *   The Platform Configuration Service is the Single Source of Truth.
 *   All clients — Web Platform, Workforce, Partner Portal, Customer Portal,
 *   Public APIs, Digital Professionals, and future Coralamy applications —
 *   must consume this manifest before deciding whether to refresh configuration.
 */
export interface ConfigurationManifest {
  /**
   * Schema version of the PlatformOrganisationConfig object.
   * Clients must check this before parsing. Major bumps may be breaking.
   * Example: '3.0.0'
   */
  schemaVersion: string;

  /**
   * Monotonically increasing configuration version for this organisation.
   * Incremented whenever any configuration domain changes.
   * Clients should cache this and only refresh when it changes.
   * Example: 42
   */
  configVersion: number;

  /**
   * SHA-256 hash of the serialised configuration payload (ETag equivalent).
   * Clients may use this for conditional GET semantics — only refresh if
   * the hash differs from the cached value.
   * Example: 'a3f2c1d4e5b6...'
   */
  configHash: string;

  /**
   * ISO 8601 UTC timestamp when this manifest was generated.
   * Example: '2026-07-29T00:48:18.805Z'
   */
  generatedAt: string;

  /**
   * Platform API version that generated this manifest.
   * Example: 'v3'
   */
  apiVersion: string;

  /**
   * Minimum client version required to consume this configuration.
   * Clients below this version must prompt for an upgrade before proceeding.
   * Example: '2.0.0'
   */
  minimumClientVersion: string;

  /**
   * Client types that are compatible with this configuration payload.
   * Clients not in this list must not attempt to consume the configuration.
   */
  compatibleClientTypes: Array<
    | 'web_platform'
    | 'workforce'
    | 'partner_portal'
    | 'customer_portal'
    | 'digital_professional'
    | 'external_api'
    | 'internal_service'
    | 'desktop_application'
    | 'public_api'
    | 'future_coralamy'
  >;

  /**
   * Unique identifier of the organisation this configuration belongs to.
   */
  organisationId: string;

  /**
   * Tenant identifier for multi-tenant deployments.
   * Equals organisationId for single-tenant organisations.
   */
  tenantId: string;

  /**
   * ISO 8601 UTC timestamp of the last configuration change.
   * Null if no changes have been recorded.
   */
  lastModifiedAt: string | null;

  /**
   * Number of configuration domains included in this payload.
   */
  domainCount: number;

  /**
   * Whether this is a partial payload (domain-filtered) or the full configuration.
   */
  isPartial: boolean;
}

// ─── Root Configuration Object ────────────────────────────────────────────────

/**
 * PlatformOrganisationConfig is the complete, authoritative operational
 * configuration for an organisation across the entire Coralamy platform.
 *
 * This is not an application settings object. It is the governed configuration
 * layer that every Innovion client — Web Platform, Workforce, APIs, Partner
 * Portal, Customer Portal, and Digital Professionals — must consume as its
 * single source of truth.
 *
 * All fields except `configVersion`, `organisationId`, and `retrievedAt` are
 * optional at the type level so that partial configurations can be returned
 * when specific domains are unavailable, without breaking clients.
 *
 * Adding a new configuration domain:
 *  1. Define the interface above.
 *  2. Add the field here as optional.
 *  3. Implement the assembly logic in `getOrganisationConfig()`.
 *  4. Add the domain key to `getConfigDomains()`.
 *  5. Bump PLATFORM_CONFIG_VERSION (minor for additions, major for breaking changes).
 *  6. No existing clients are broken — they simply ignore the new key.
 */
export interface PlatformOrganisationConfig {
  /** Schema version — clients should check this before parsing */
  configVersion: string;
  /** Unique organisation (company) identifier */
  organisationId: string;
  /** ISO 8601 UTC timestamp when this configuration was retrieved */
  retrievedAt: string;

  /**
   * Configuration Manifest — clients must check this before deciding whether
   * to refresh configuration. Only download the full payload when the
   * configHash or manifest.configVersion has changed.
   */
  manifest: ConfigurationManifest;

  // ── Core domains ──────────────────────────────────────────────────────────
  branding: BrandingConfig;
  localisation: LocalisationConfig;
  licensing: LicensingConfig;
  modules: ModulesConfig;
  security: SecurityPoliciesConfig;
  digitalProfessional: DigitalProfessionalConfig;
  partner: PartnerConfig;
  featureRegistry: FeatureRegistryConfig;
  organisationalHierarchy: OrganisationalHierarchyConfig;
  notifications: NotificationPreferencesConfig;

  // ── Client-specific operational domains ───────────────────────────────────
  /** Operational configuration for the Workforce application */
  workforceConfig: WorkforceConfig;
  /** Operational configuration for the Customer Portal */
  customerPortalConfig: CustomerPortalConfig;
  /** Operational configuration for the Partner Portal */
  partnerPortalConfig: PartnerPortalConfig;

  // ── Platform governance domains ───────────────────────────────────────────
  /** Registry of all authorised API clients consuming this service */
  apiClientsConfig: ApiClientsConfig;
  /** Data governance, residency, and retention policy */
  dataGovernanceConfig: DataGovernanceConfig;
  /** Audit logging and compliance policy */
  auditComplianceConfig: AuditComplianceConfig;

  /**
   * Extension point for future configuration domains.
   * Clients must not fail if they encounter unknown keys here.
   */
  extensions: PlatformExtensions;
}

// ─── Default / Fallback Values ────────────────────────────────────────────────

const DEFAULT_BRANDING: BrandingConfig = {
  organisationName: '',
  primaryColour: '#2563eb',
  secondaryColour: '#64748b',
  logoUrl: null,
  faviconUrl: null,
  customDomain: null,
  showPoweredBy: true,
};

const DEFAULT_SECURITY: SecurityPoliciesConfig = {
  mfaRequired: false,
  mfaEnabled: false,
  sessionTimeout: '8h',
  ipWhitelistEnabled: false,
  ipWhitelist: [],
  auditLogEnabled: true,
  passwordPolicy: 'standard',
  ssoEnabled: false,
  ssoProvider: null,
  readOnlyAllowedPaths: [
    '/dashboard',
    '/reports',
    '/time-tracking',
    '/documents',
    '/profile',
    '/settings',
    '/billing',
  ],
  readOnlyTriggerStatuses: ['read_only', 'suspended', 'cancelled', 'past_due'],
};

const DEFAULT_DIGITAL_PROFESSIONAL: DigitalProfessionalConfig = {
  status: 'not_provisioned',
  personaName: null,
  avatarUrl: null,
  primaryLanguage: 'en-AU',
  capabilities: [],
  dataAccessEnabled: false,
  maxTokensPerRequest: 0,
};

const DEFAULT_WORKFORCE: WorkforceConfig = {
  enabled: true,
  minimumAppVersion: null,
  timesheetEnabled: true,
  locationTrackingEnabled: false,
  photoCapturEnabled: true,
  checklistsEnabled: true,
  incidentReportingEnabled: true,
  scheduleViewEnabled: true,
  pushNotificationsEnabled: true,
  offlineModeEnabled: false,
  scheduleDataSyncDays: 14,
  workforceBranding: null,
};

const DEFAULT_CUSTOMER_PORTAL: CustomerPortalConfig = {
  enabled: false,
  magicLinkLoginEnabled: true,
  jobHistoryVisible: true,
  jobRequestEnabled: false,
  invoicesVisible: true,
  onlinePaymentsEnabled: false,
  complianceDocumentsVisible: false,
  feedbackEnabled: true,
  liveJobStatusEnabled: false,
  portalDomain: null,
  welcomeMessage: null,
  portalBranding: null,
};

const DEFAULT_PARTNER_PORTAL: PartnerPortalConfig = {
  enabled: false,
  customerManagementEnabled: false,
  revenueReportingEnabled: false,
  customerOnboardingEnabled: false,
  supportManagementEnabled: false,
  territoryDashboardEnabled: false,
  subPartnerManagementEnabled: false,
  trainingResourcesEnabled: false,
  marketingMaterialsEnabled: false,
  portalDomain: null,
  partnerBranding: null,
};

const DEFAULT_DATA_GOVERNANCE: DataGovernanceConfig = {
  dataResidencyRegion: 'ap-southeast-2',
  dataResidencyEnforced: false,
  retentionPeriodDays: 0,
  gdprEnabled: false,
  dpaExecuted: false,
  dpaExecutedAt: null,
  complianceFrameworks: [],
  dataExportEnabled: true,
  anonymisationOnClosureRequired: false,
};

const DEFAULT_AUDIT_COMPLIANCE: AuditComplianceConfig = {
  auditLogEnabled: true,
  auditLogRetentionDays: 0,
  configChangeAuditEnabled: true,
  apiAccessAuditEnabled: true,
  authEventAuditEnabled: true,
  dataExportAuditEnabled: true,
  dpoNominated: false,
  dpoEmail: null,
  complianceAlertsEnabled: true,
  complianceAlertRecipients: [],
  automatedReportingEnabled: false,
  reportingFrequency: 'never',
};

const CORE_MODULES: ModuleConfig[] = [
  {
    id: 'jobs',
    name: 'Jobs',
    description: 'Job scheduling and management',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/jobs', '/recurring-jobs', '/scheduling'],
  },
  {
    id: 'clients',
    name: 'Clients',
    description: 'Client relationship management',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/clients'],
  },
  {
    id: 'employees',
    name: 'Employees',
    description: 'Employee records and management',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/employees'],
  },
  {
    id: 'contractors',
    name: 'Contractors',
    description: 'Contractor management',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/contractors'],
  },
  {
    id: 'sites',
    name: 'Sites',
    description: 'Site and location management',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/sites'],
  },
  {
    id: 'compliance',
    name: 'Compliance',
    description: 'Compliance tracking and alerts',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/compliance'],
  },
  {
    id: 'documents',
    name: 'Documents',
    description: 'Document storage and management',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/documents'],
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Inventory and asset tracking',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/inventory'],
  },
  {
    id: 'vehicles',
    name: 'Vehicles',
    description: 'Fleet and vehicle management',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/vehicles'],
  },
  {
    id: 'incidents',
    name: 'Incidents',
    description: 'Incident reporting and management',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/incidents'],
  },
  {
    id: 'checklists',
    name: 'Checklists',
    description: 'Operational checklists and templates',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/checklists', '/checklist-templates'],
  },
  {
    id: 'time_tracking',
    name: 'Time Tracking',
    description: 'Time entry and timesheet approval',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/time-tracking', '/timesheet-approval'],
  },
  {
    id: 'reports',
    name: 'Reports',
    description: 'Operational and financial reporting',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/reports'],
  },
  {
    id: 'billing',
    name: 'Billing',
    description: 'Subscription and billing management',
    status: 'enabled',
    requiresAddOn: false,
    routes: ['/billing'],
  },
  {
    id: 'digital_workforce',
    name: 'Digital Workforce',
    description: 'AI-powered Digital Professional agents',
    status: 'coming_soon',
    requiresAddOn: true,
    routes: [],
  },
];

const CORE_FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: 'recurring_jobs',
    name: 'Recurring Jobs',
    status: 'enabled',
    planGated: false,
    minimumPlan: null,
    rolloutPercentage: 100,
  },
  {
    key: 'scheduling_calendar',
    name: 'Scheduling Calendar',
    status: 'enabled',
    planGated: false,
    minimumPlan: null,
    rolloutPercentage: 100,
  },
  {
    key: 'contractor_invoices',
    name: 'Contractor Invoices',
    status: 'enabled',
    planGated: false,
    minimumPlan: null,
    rolloutPercentage: 100,
  },
  {
    key: 'document_storage',
    name: 'Document Storage',
    status: 'enabled',
    planGated: false,
    minimumPlan: null,
    rolloutPercentage: 100,
  },
  {
    key: 'compliance_alerts',
    name: 'Compliance Alerts',
    status: 'enabled',
    planGated: false,
    minimumPlan: null,
    rolloutPercentage: 100,
  },
  {
    key: 'rbac',
    name: 'Role-Based Access Control',
    status: 'enabled',
    planGated: false,
    minimumPlan: null,
    rolloutPercentage: 100,
  },
  {
    key: 'multi_language',
    name: 'Multi-Language Support',
    status: 'enabled',
    planGated: false,
    minimumPlan: null,
    rolloutPercentage: 100,
  },
  {
    key: 'workforce_app',
    name: 'Workforce Application',
    status: 'enabled',
    planGated: false,
    minimumPlan: null,
    rolloutPercentage: 100,
  },
  {
    key: 'customer_portal',
    name: 'Customer Portal',
    status: 'coming_soon',
    planGated: true,
    minimumPlan: 'professional',
    rolloutPercentage: 0,
  },
  {
    key: 'partner_portal',
    name: 'Partner Portal',
    status: 'coming_soon',
    planGated: true,
    minimumPlan: 'enterprise',
    rolloutPercentage: 0,
  },
  {
    key: 'ai_scheduling',
    name: 'AI Scheduling Assistant',
    status: 'coming_soon',
    planGated: true,
    minimumPlan: 'enterprise',
    rolloutPercentage: 0,
  },
  {
    key: 'white_label',
    name: 'White Label Branding',
    status: 'coming_soon',
    planGated: true,
    minimumPlan: 'enterprise',
    rolloutPercentage: 0,
  },
  {
    key: 'sso',
    name: 'Single Sign-On (SSO)',
    status: 'coming_soon',
    planGated: true,
    minimumPlan: 'enterprise',
    rolloutPercentage: 0,
  },
  {
    key: 'data_residency',
    name: 'Data Residency Controls',
    status: 'coming_soon',
    planGated: true,
    minimumPlan: 'enterprise',
    rolloutPercentage: 0,
  },
];

// ─── Service ──────────────────────────────────────────────────────────────────

export const platformConfigurationService = {
  /**
   * Retrieve the complete platform configuration for an organisation.
   *
   * This is the primary entry point for all Innovion clients. It assembles
   * every configuration domain from the database and returns a single,
   * authoritative, versioned configuration object.
   *
   * Clients (Web Platform, Workforce, APIs, Partner Portal, Customer Portal,
   * Digital Professionals) must consume this method rather than maintaining
   * independent configuration.
   *
   * @param companyId - The organisation's unique identifier
   * @returns Full PlatformOrganisationConfig, or null if the company is not found
   */
  async getOrganisationConfig(
    companyId: string,
    client?: PlatformDataClient
  ): Promise<PlatformOrganisationConfig | null> {
    const supabase = client ?? createClient();

    // ── Fetch all required data in parallel ──────────────────────────────────
    const [companyResult, settingsResult, localisationResult, subscriptionResult, partnerResult] =
      await Promise.all([
        supabase.from('companies').select('*').eq('id', companyId).maybeSingle(),
        supabase.from('settings').select('*').eq('company_id', companyId).maybeSingle(),
        supabase.from('company_localisation').select('*').eq('company_id', companyId).maybeSingle(),
        supabase.from('subscriptions').select('*').eq('company_id', companyId).maybeSingle(),
        supabase
          .from('companies')
          .select('partner_id, territory_id, country_code, customer_ownership')
          .eq('id', companyId)
          .maybeSingle(),
      ]);

    const company = companyResult.data;
    if (!company) return null;

    const settings = settingsResult.data;
    const localisation = localisationResult.data;
    const subscription = subscriptionResult.data;
    const partnerMeta = partnerResult.data;

    // ── Resolve country configuration ────────────────────────────────────────
    const countryCode = (localisation?.country ?? partnerMeta?.country_code ?? 'AU') as string;
    const countryConfig: CountryConfig = COUNTRY_CONFIGS[countryCode] ?? COUNTRY_CONFIGS['AU'];

    // ── Branding ─────────────────────────────────────────────────────────────
    const branding: BrandingConfig = {
      organisationName: company.name ?? settings?.company_name ?? '',
      primaryColour: company.primary_colour ?? DEFAULT_BRANDING.primaryColour,
      secondaryColour: company.secondary_colour ?? DEFAULT_BRANDING.secondaryColour,
      // `companies.logo` is the real column; `logo_url` never existed.
      logoUrl: company.logo ?? null,
      faviconUrl: company.favicon_url ?? null,
      customDomain: company.custom_domain ?? null,
      showPoweredBy: company.show_powered_by ?? true,
    };

    // ── Localisation ─────────────────────────────────────────────────────────
    const localisationConfig: LocalisationConfig = {
      countryCode,
      timezone: localisation?.timezone ?? countryConfig.defaultTimezone,
      language: localisation?.language ?? countryConfig.defaultLanguage,
      currencyCode: localisation?.currency_code ?? countryConfig.defaultCurrency.code,
      currencySymbol: localisation?.currency_symbol ?? countryConfig.defaultCurrency.symbol,
      currencyDecimalPrecision:
        localisation?.currency_decimal_precision ?? countryConfig.defaultCurrency.decimalPrecision,
      thousandsSeparator:
        localisation?.thousands_separator ?? countryConfig.defaultCurrency.thousandsSeparator,
      decimalSeparator:
        localisation?.decimal_separator ?? countryConfig.defaultCurrency.decimalSeparator,
      currencySymbolPosition: (localisation?.currency_symbol_position ??
        countryConfig.defaultCurrency.symbolPosition) as 'before' | 'after',
      dateFormat: localisation?.date_format ?? countryConfig.defaultDateFormat,
      timeFormat: (localisation?.time_format ?? countryConfig.defaultTimeFormat) as '12h' | '24h',
      firstDayOfWeek: (localisation?.first_day_of_week ?? countryConfig.defaultFirstDayOfWeek) as
        | 0
        | 1
        | 6,
      measurementSystem: (localisation?.measurement_system ?? countryConfig.measurementSystem) as
        | 'metric'
        | 'imperial',
      country: countryCode,
      countryConfig,
    };

    // ── Licensing ─────────────────────────────────────────────────────────────
    const readOnlyStatuses: SubscriptionStatus[] = [
      'read_only',
      'suspended',
      'cancelled',
      'past_due',
    ];
    const activeStatuses: SubscriptionStatus[] = ['active', 'trialing'];
    // The column is `sub_status`; `subscription.status` is always undefined, so
    // every organisation previously resolved to status null → isActive false.
    const subStatus = (subscription?.sub_status ?? null) as SubscriptionStatus | null;

    // The licence model lives on the company's PARTNER, not on the company.
    let licenceModel: LicenceModel = 'direct';
    if (partnerMeta?.partner_id) {
      const { data: partnerLicence } = await supabase
        .from('partners')
        .select('licence_model')
        .eq('id', partnerMeta.partner_id)
        .maybeSingle();
      if (partnerLicence?.licence_model)
        licenceModel = partnerLicence.licence_model as LicenceModel;
    }

    const licensing: LicensingConfig = {
      licenceModel,
      planName: subscription?.plan_name ?? null,
      status: subStatus,
      maxUsers: subscription?.max_users ?? null,
      maxJobs: subscription?.max_jobs ?? null,
      planFeatures: subscription?.features ?? [],
      isReadOnly: readOnlyStatuses.includes(subStatus as SubscriptionStatus),
      isActive: activeStatuses.includes(subStatus as SubscriptionStatus),
      trialEndsAt: subscription?.trial_ends_at ?? null,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      // Product identity is platform-wide; `companies` carries no product columns.
      productId: 'innovion',
      productName: 'Innovion',
    };

    // ── Modules ───────────────────────────────────────────────────────────────
    const planFeatureSet = new Set<string>(licensing.planFeatures);
    const modulesAvailable: ModuleConfig[] = CORE_MODULES.map((mod) => ({
      ...mod,
      status:
        mod.requiresAddOn && !planFeatureSet.has(mod.id)
          ? ('disabled' as ModuleStatus)
          : mod.status,
    }));

    const modules: ModulesConfig = {
      available: modulesAvailable,
      enabledIds: modulesAvailable.filter((m) => m.status === 'enabled').map((m) => m.id),
    };

    // ── Security ──────────────────────────────────────────────────────────────
    const security: SecurityPoliciesConfig = {
      mfaRequired: settings?.security_two_factor ?? DEFAULT_SECURITY.mfaRequired,
      mfaEnabled: settings?.security_two_factor ?? DEFAULT_SECURITY.mfaEnabled,
      sessionTimeout: (settings?.security_session_timeout ??
        DEFAULT_SECURITY.sessionTimeout) as SessionTimeout,
      ipWhitelistEnabled: settings?.security_ip_whitelist ?? DEFAULT_SECURITY.ipWhitelistEnabled,
      ipWhitelist: [],
      auditLogEnabled: settings?.security_audit_log ?? DEFAULT_SECURITY.auditLogEnabled,
      passwordPolicy: (settings?.security_password_policy ??
        DEFAULT_SECURITY.passwordPolicy) as PasswordPolicy,
      ssoEnabled: false,
      ssoProvider: null,
      readOnlyAllowedPaths: DEFAULT_SECURITY.readOnlyAllowedPaths,
      readOnlyTriggerStatuses: DEFAULT_SECURITY.readOnlyTriggerStatuses,
    };

    // ── Digital Professional ──────────────────────────────────────────────────
    const digitalProfessional: DigitalProfessionalConfig = {
      ...DEFAULT_DIGITAL_PROFESSIONAL,
      primaryLanguage: localisationConfig.language,
    };

    // ── Partner ───────────────────────────────────────────────────────────────
    let partnerConfig: PartnerConfig = {
      hasPartner: false,
      partnerId: null,
      partnerName: null,
      partnerType: null,
      territory: null,
      customerOwnership: partnerMeta?.customer_ownership ?? 'direct',
      mrr: null,
      arr: null,
      partnerProducts: [],
    };

    if (partnerMeta?.partner_id) {
      const [partnerRow, territoryRow] = await Promise.all([
        // `partners` has partner_name, not name.
        supabase
          .from('partners')
          .select('id, partner_name, partner_type')
          .eq('id', partnerMeta.partner_id)
          .maybeSingle(),
        partnerMeta.territory_id
          ? supabase
              .from('territories')
              .select('*')
              .eq('id', partnerMeta.territory_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const [partnerProductsRow, revenueRow] = await Promise.all([
        supabase
          .from('partner_products')
          .select('product_id')
          .eq('partner_id', partnerMeta.partner_id),
        // The columns are mrr_amount / arr_amount.
        supabase
          .from('partner_revenue')
          .select('mrr_amount, arr_amount')
          .eq('company_id', companyId)
          .order('period_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      partnerConfig = {
        hasPartner: true,
        partnerId: partnerRow.data?.id ?? partnerMeta.partner_id,
        partnerName: partnerRow.data?.partner_name ?? null,
        partnerType: (partnerRow.data?.partner_type ?? null) as PartnerType | null,
        territory: territoryRow.data
          ? {
              // territories exposes territory_name / region_code / exclusivity.
              id: territoryRow.data.id,
              name: territoryRow.data.territory_name,
              countryCode: territoryRow.data.country_code,
              region: territoryRow.data.region_code ?? null,
              isExclusive: territoryRow.data.exclusivity === 'exclusive',
            }
          : null,
        customerOwnership: partnerMeta.customer_ownership ?? 'direct',
        mrr: revenueRow.data?.mrr_amount ?? null,
        arr: revenueRow.data?.arr_amount ?? null,
        partnerProducts: (partnerProductsRow.data ?? []).map((r: any) => r.product_id),
      };
    }

    // ── Feature Registry ──────────────────────────────────────────────────────
    const featureFlags: FeatureFlag[] = CORE_FEATURE_FLAGS.map((flag) => ({
      ...flag,
      status:
        flag.planGated && !planFeatureSet.has(flag.key)
          ? ('disabled' as FeatureStatus)
          : flag.status,
    }));

    const featureRegistry: FeatureRegistryConfig = {
      flags: featureFlags,
      enabledKeys: featureFlags.filter((f) => f.status === 'enabled').map((f) => f.key),
    };

    // ── Organisational Hierarchy ──────────────────────────────────────────────
    const { count: siteCount } = await supabase
      .from('sites')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);

    const organisationalHierarchy: OrganisationalHierarchyConfig = {
      tier: (company.organisation_tier ?? 'standalone') as OrganisationTier,
      parentOrganisationId: company.parent_organisation_id ?? null,
      childOrganisationIds: [],
      units: [],
      multiSiteEnabled: (siteCount ?? 0) > 1,
      siteCount: siteCount ?? 0,
    };

    // ── Notifications ─────────────────────────────────────────────────────────
    const notifications: NotificationPreferencesConfig = {
      compliance: {
        email: settings?.notif_email_compliance ?? true,
        push: settings?.notif_push_compliance ?? true,
        sms: false,
        inApp: true,
      },
      jobs: {
        email: settings?.notif_email_jobs ?? true,
        push: settings?.notif_push_jobs ?? true,
        sms: false,
        inApp: true,
      },
      incidents: {
        email: settings?.notif_email_incidents ?? true,
        push: settings?.notif_push_incidents ?? false,
        sms: settings?.notif_sms_incidents ?? false,
        inApp: true,
      },
      reports: {
        email: settings?.notif_email_reports ?? false,
        push: false,
        sms: false,
        inApp: false,
      },
    };

    // ── Workforce Configuration ───────────────────────────────────────────────
    const workforceConfig: WorkforceConfig = {
      ...DEFAULT_WORKFORCE,
      // Inherit branding from top-level branding domain
      workforceBranding: {
        primaryColour: branding.primaryColour,
        secondaryColour: branding.secondaryColour,
        logoUrl: branding.logoUrl,
      },
      // Disable workforce if subscription is not active
      enabled: !licensing.isReadOnly,
      // Sync schedule data based on plan
      scheduleDataSyncDays: licensing.planName === 'enterprise' ? 30 : 14,
    };

    // ── Customer Portal Configuration ─────────────────────────────────────────
    const customerPortalEnabled =
      featureFlags.find((f) => f.key === 'customer_portal')?.status === 'enabled';
    const customerPortalConfig: CustomerPortalConfig = {
      ...DEFAULT_CUSTOMER_PORTAL,
      enabled: customerPortalEnabled,
      portalBranding: customerPortalEnabled
        ? {
            primaryColour: branding.primaryColour,
            secondaryColour: branding.secondaryColour,
            logoUrl: branding.logoUrl,
          }
        : null,
    };

    // ── Partner Portal Configuration ──────────────────────────────────────────
    const partnerPortalEnabled =
      featureFlags.find((f) => f.key === 'partner_portal')?.status === 'enabled';
    const partnerPortalConfig: PartnerPortalConfig = {
      ...DEFAULT_PARTNER_PORTAL,
      enabled: partnerPortalEnabled && partnerConfig.hasPartner,
      partnerBranding:
        partnerPortalEnabled && partnerConfig.hasPartner
          ? {
              primaryColour: branding.primaryColour,
              secondaryColour: branding.secondaryColour,
              logoUrl: branding.logoUrl,
            }
          : null,
    };

    // ── API Clients Registry ──────────────────────────────────────────────────
    // Fetch active API keys to build the client registry
    const { data: apiKeys } = await supabase
      .from('platform_api_keys')
      .select('id, key_prefix, label, scopes, is_active, last_used_at')
      .eq('company_id', companyId)
      .eq('is_active', true);

    const registeredClients: ApiClientDescriptor[] = [
      // The Web Platform is always an implicit client
      {
        clientId: 'web-platform',
        name: 'Innovion Web Platform',
        type: 'web_platform',
        isActive: true,
        authorisedDomains: this.getConfigDomains(),
        keyPrefix: null,
        lastSeenAt: null,
      },
      // Map active API keys to client descriptors
      ...(apiKeys ?? []).map(
        (key: any): ApiClientDescriptor => ({
          clientId: key.id,
          name: key.label,
          type: inferClientType(key.label, key.scopes),
          isActive: key.is_active,
          authorisedDomains: inferAuthorisedDomains(key.scopes),
          keyPrefix: key.key_prefix,
          lastSeenAt: key.last_used_at ?? null,
        })
      ),
    ];

    const apiClientsConfig: ApiClientsConfig = {
      clients: registeredClients,
      activeClientCount: registeredClients.filter((c) => c.isActive).length,
    };

    // ── Data Governance ───────────────────────────────────────────────────────
    const dataGovernanceConfig: DataGovernanceConfig = {
      ...DEFAULT_DATA_GOVERNANCE,
      // Derive region from localisation
      dataResidencyRegion: resolveDataResidencyRegion(countryCode),
      // GDPR applies to EU/UK organisations
      gdprEnabled: [
        'GB',
        'DE',
        'FR',
        'NL',
        'IE',
        'SE',
        'DK',
        'FI',
        'NO',
        'AT',
        'BE',
        'CH',
      ].includes(countryCode),
    };

    // ── Audit & Compliance Policy ─────────────────────────────────────────────
    const auditComplianceConfig: AuditComplianceConfig = {
      ...DEFAULT_AUDIT_COMPLIANCE,
      auditLogEnabled: security.auditLogEnabled,
    };

    // ── Assemble and return ───────────────────────────────────────────────────
    const configPayload = {
      configVersion: PLATFORM_CONFIG_VERSION,
      organisationId: companyId,
      retrievedAt: new Date().toISOString(),
      // Core domains
      branding,
      localisation: localisationConfig,
      licensing,
      modules,
      security,
      digitalProfessional,
      partner: partnerConfig,
      featureRegistry,
      organisationalHierarchy,
      notifications,
      // Client-specific operational domains
      workforceConfig,
      customerPortalConfig,
      partnerPortalConfig,
      // Platform governance domains
      apiClientsConfig,
      dataGovernanceConfig,
      auditComplianceConfig,
      extensions: {},
    };

    // Generate the manifest after assembling the payload
    const configHash = await generateConfigHash(configPayload);
    const manifest: ConfigurationManifest = {
      schemaVersion: PLATFORM_CONFIG_VERSION,
      configVersion: Date.now(), // monotonic proxy; replace with DB-tracked version when available
      configHash,
      generatedAt: configPayload.retrievedAt,
      apiVersion: 'v3',
      minimumClientVersion: '2.0.0',
      compatibleClientTypes: [
        'web_platform',
        'workforce',
        'partner_portal',
        'customer_portal',
        'digital_professional',
        'external_api',
        'internal_service',
        'desktop_application',
        'public_api',
        'future_coralamy',
      ],
      organisationId: companyId,
      tenantId: companyId,
      lastModifiedAt: company.updated_at ?? null,
      domainCount: this.getConfigDomains().length,
      isPartial: false,
    };

    return { ...configPayload, manifest };
  },

  /**
   * Retrieve only the branding configuration for an organisation.
   * Lightweight alternative when only branding data is needed.
   */
  async getBranding(
    companyId: string,
    client?: PlatformDataClient
  ): Promise<BrandingConfig | null> {
    const supabase = client ?? createClient();
    // `logo` is the existing column; `logo_url` never existed. The remaining
    // branding columns were added by migration 20260817010000.
    const { data, error } = await supabase
      .from('companies')
      .select(
        'name, logo, primary_colour, secondary_colour, favicon_url, custom_domain, show_powered_by'
      )
      .eq('id', companyId)
      .maybeSingle();
    if (error) {
      logger.error('platformConfigurationService', 'getBranding failed', {
        companyId,
        error: error.message,
      });
      return null;
    }
    if (!data) return null;
    return {
      organisationName: data.name ?? '',
      primaryColour: data.primary_colour ?? DEFAULT_BRANDING.primaryColour,
      secondaryColour: data.secondary_colour ?? DEFAULT_BRANDING.secondaryColour,
      logoUrl: data.logo ?? null,
      faviconUrl: data.favicon_url ?? null,
      customDomain: data.custom_domain ?? null,
      showPoweredBy: data.show_powered_by ?? true,
    };
  },

  /**
   * Retrieve only the licensing configuration for an organisation.
   * Lightweight alternative when only subscription/plan data is needed.
   */
  async getLicensing(
    companyId: string,
    client?: PlatformDataClient
  ): Promise<LicensingConfig | null> {
    const supabase = client ?? createClient();
    // `companies` has no licence_model / product_id / product_name column —
    // those queries silently returned null for every organisation. The licence
    // model belongs to the company's PARTNER (public.partners.licence_model);
    // a company with no partner is 'direct'. Product identity is platform-wide.
    const [companyResult, subscriptionResult] = await Promise.all([
      supabase.from('companies').select('id, partner_id').eq('id', companyId).maybeSingle(),
      supabase.from('subscriptions').select('*').eq('company_id', companyId).maybeSingle(),
    ]);
    const company = companyResult.data;
    const subscription = subscriptionResult.data;
    if (!company) return null;

    let licenceModel: LicenceModel = 'direct';
    if (company.partner_id) {
      const { data: partner } = await supabase
        .from('partners')
        .select('licence_model')
        .eq('id', company.partner_id)
        .maybeSingle();
      if (partner?.licence_model) licenceModel = partner.licence_model as LicenceModel;
    }

    const readOnlyStatuses: SubscriptionStatus[] = [
      'read_only',
      'suspended',
      'cancelled',
      'past_due',
    ];
    const activeStatuses: SubscriptionStatus[] = ['active', 'trialing'];
    // The column is `sub_status`, not `status`.
    const subStatus = (subscription?.sub_status ?? null) as SubscriptionStatus | null;

    return {
      licenceModel,
      planName: subscription?.plan_name ?? null,
      status: subStatus,
      maxUsers: subscription?.max_users ?? null,
      maxJobs: subscription?.max_jobs ?? null,
      planFeatures: subscription?.features ?? [],
      isReadOnly: readOnlyStatuses.includes(subStatus as SubscriptionStatus),
      isActive: activeStatuses.includes(subStatus as SubscriptionStatus),
      trialEndsAt: subscription?.trial_ends_at ?? null,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      // Product identity is platform-wide; `companies` carries no product columns.
      productId: 'innovion',
      productName: 'Innovion',
    };
  },

  /**
   * Retrieve only the security policies for an organisation.
   */
  async getSecurityPolicies(
    companyId: string,
    client?: PlatformDataClient
  ): Promise<SecurityPoliciesConfig | null> {
    const supabase = client ?? createClient();
    const { data: settings } = await supabase
      .from('settings')
      .select(
        'security_two_factor, security_session_timeout, security_ip_whitelist, security_audit_log, security_password_policy'
      )
      .eq('company_id', companyId)
      .maybeSingle();
    if (!settings) return DEFAULT_SECURITY;
    return {
      mfaRequired: settings.security_two_factor ?? false,
      mfaEnabled: settings.security_two_factor ?? false,
      sessionTimeout: (settings.security_session_timeout ?? '8h') as SessionTimeout,
      ipWhitelistEnabled: settings.security_ip_whitelist ?? false,
      ipWhitelist: [],
      auditLogEnabled: settings.security_audit_log ?? true,
      passwordPolicy: (settings.security_password_policy ?? 'standard') as PasswordPolicy,
      ssoEnabled: false,
      ssoProvider: null,
      readOnlyAllowedPaths: DEFAULT_SECURITY.readOnlyAllowedPaths,
      readOnlyTriggerStatuses: DEFAULT_SECURITY.readOnlyTriggerStatuses,
    };
  },

  /**
   * Retrieve the feature registry for an organisation.
   * Merges platform-wide flags with organisation-specific overrides.
   */
  async getFeatureRegistry(
    companyId: string,
    client?: PlatformDataClient
  ): Promise<FeatureRegistryConfig> {
    const supabase = client ?? createClient();
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('features')
      .eq('company_id', companyId)
      .maybeSingle();

    const planFeatureSet = new Set<string>(subscription?.features ?? []);
    const flags: FeatureFlag[] = CORE_FEATURE_FLAGS.map((flag) => ({
      ...flag,
      status:
        flag.planGated && !planFeatureSet.has(flag.key)
          ? ('disabled' as FeatureStatus)
          : flag.status,
    }));

    return {
      flags,
      enabledKeys: flags.filter((f) => f.status === 'enabled').map((f) => f.key),
    };
  },

  /**
   * Retrieve the Workforce operational configuration for an organisation.
   * The Workforce application must call this rather than maintaining its own config.
   */
  async getWorkforceConfig(
    companyId: string,
    client?: PlatformDataClient
  ): Promise<WorkforceConfig> {
    const supabase = client ?? createClient();
    const [companyResult, subscriptionResult] = await Promise.all([
      supabase
        .from('companies')
        .select('primary_colour, secondary_colour, logo')
        .eq('id', companyId)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('sub_status, plan_name')
        .eq('company_id', companyId)
        .maybeSingle(),
    ]);

    const company = companyResult.data;
    const subscription = subscriptionResult.data;
    const readOnlyStatuses = ['read_only', 'suspended', 'cancelled', 'past_due'];
    const isReadOnly = readOnlyStatuses.includes(subscription?.sub_status ?? '');

    return {
      ...DEFAULT_WORKFORCE,
      enabled: !isReadOnly,
      scheduleDataSyncDays: subscription?.plan_name === 'enterprise' ? 30 : 14,
      workforceBranding: company
        ? {
            primaryColour: company.primary_colour ?? DEFAULT_BRANDING.primaryColour,
            secondaryColour: company.secondary_colour ?? DEFAULT_BRANDING.secondaryColour,
            logoUrl: company.logo ?? null,
          }
        : null,
    };
  },

  /**
   * Check whether a specific feature flag is enabled for an organisation.
   * Convenience method — avoids loading the full config for a single check.
   */
  async isFeatureEnabled(
    companyId: string,
    featureKey: string,
    client?: PlatformDataClient
  ): Promise<boolean> {
    const registry = await this.getFeatureRegistry(companyId, client);
    return registry.enabledKeys.includes(featureKey);
  },

  /**
   * Retrieve only the Configuration Manifest for an organisation.
   *
   * Clients should call this lightweight endpoint first to determine whether
   * their cached configuration is still valid. Only fetch the full configuration
   * when the configHash or schemaVersion has changed.
   *
   * This is the recommended pattern for all Innovion clients:
   *   1. Fetch manifest → compare configHash with cached value
   *   2. If unchanged → use cached configuration
   *   3. If changed → fetch full configuration and update cache
   */
  async getManifest(
    companyId: string,
    client?: PlatformDataClient
  ): Promise<ConfigurationManifest | null> {
    const supabase = client ?? createClient();
    const { data: company } = await supabase
      .from('companies')
      .select('id, updated_at')
      .eq('id', companyId)
      .maybeSingle();
    if (!company) return null;

    // Lightweight hash based on company update timestamp
    const hashInput = `${companyId}:${PLATFORM_CONFIG_VERSION}:${company.updated_at ?? ''}`;
    const configHash = await generateConfigHash({ _hashInput: hashInput });

    return {
      schemaVersion: PLATFORM_CONFIG_VERSION,
      configVersion: new Date(company.updated_at ?? Date.now()).getTime(),
      configHash,
      generatedAt: new Date().toISOString(),
      apiVersion: 'v3',
      minimumClientVersion: '2.0.0',
      compatibleClientTypes: [
        'web_platform',
        'workforce',
        'partner_portal',
        'customer_portal',
        'digital_professional',
        'external_api',
        'internal_service',
        'desktop_application',
        'public_api',
        'future_coralamy',
      ],
      organisationId: companyId,
      tenantId: companyId,
      lastModifiedAt: company.updated_at ?? null,
      domainCount: this.getConfigDomains().length,
      isPartial: false,
    };
  },

  /**
   * Return the list of all known configuration domain keys.
   * Useful for clients that want to enumerate available domains.
   */
  getConfigDomains(): string[] {
    return [
      // Core domains
      'branding',
      'localisation',
      'licensing',
      'modules',
      'security',
      'digitalProfessional',
      'partner',
      'featureRegistry',
      'organisationalHierarchy',
      'notifications',
      // Client-specific operational domains
      'workforceConfig',
      'customerPortalConfig',
      'partnerPortalConfig',
      // Platform governance domains
      'apiClientsConfig',
      'dataGovernanceConfig',
      'auditComplianceConfig',
      // Extension point
      'extensions',
    ];
  },
};

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Generate a deterministic SHA-256 hash of a configuration payload.
 * Used to populate ConfigurationManifest.configHash (ETag equivalent).
 * Clients compare this hash against their cached value to determine
 * whether a full configuration refresh is necessary.
 */
async function generateConfigHash(payload: Record<string, unknown>): Promise<string> {
  try {
    const serialised = JSON.stringify(payload, Object.keys(payload).sort());
    const encoder = new TextEncoder();
    const data = encoder.encode(serialised);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback: use a timestamp-based pseudo-hash if crypto is unavailable
    return `fallback-${Date.now().toString(16)}`;
  }
}

/**
 * Infer the client type from the API key label and scopes.
 * This is a best-effort classification for the API clients registry.
 */
function inferClientType(label: string, scopes: string[]): ApiClientDescriptor['type'] {
  const lower = label.toLowerCase();
  if (lower.includes('workforce')) return 'workforce';
  if (lower.includes('partner')) return 'partner_portal';
  if (lower.includes('customer') || lower.includes('portal')) return 'customer_portal';
  if (lower.includes('digital') || lower.includes('ai')) return 'digital_professional';
  if (lower.includes('internal') || lower.includes('service')) return 'internal_service';
  if (scopes.includes('*')) return 'internal_service';
  return 'external_api';
}

/**
 * Map API key scopes to the configuration domains they authorise.
 */
function inferAuthorisedDomains(scopes: string[]): string[] {
  if (scopes.includes('*') || scopes.includes('platform-config:read')) {
    return platformConfigurationService.getConfigDomains();
  }
  const domainMap: Record<string, string[]> = {
    'localisation:read': ['localisation'],
    'country-config:read': ['localisation'],
    'business-rules:read': ['licensing', 'modules', 'featureRegistry'],
    'tenancy:read': ['organisationalHierarchy', 'security'],
    'partner-config:read': ['partner', 'partnerPortalConfig'],
    'translations:read': ['localisation'],
  };
  const domains = new Set<string>();
  for (const scope of scopes) {
    for (const d of domainMap[scope] ?? []) {
      domains.add(d);
    }
  }
  return Array.from(domains);
}

/**
 * Resolve the primary data residency region from a country code.
 * Maps ISO 3166-1 alpha-2 country codes to AWS/GCP region identifiers.
 */
function resolveDataResidencyRegion(countryCode: string): string {
  const regionMap: Record<string, string> = {
    AU: 'ap-southeast-2',
    NZ: 'ap-southeast-2',
    SG: 'ap-southeast-1',
    US: 'us-east-1',
    CA: 'ca-central-1',
    GB: 'eu-west-2',
    DE: 'eu-central-1',
    FR: 'eu-west-3',
    NL: 'eu-west-1',
    IE: 'eu-west-1',
  };
  return regionMap[countryCode] ?? 'ap-southeast-2';
}
