import 'server-only';

import type {
  PlatformOrganisationConfig,
  ConfigurationManifest,
} from '@/lib/services/platformConfigurationService';

/**
 * Wire-format adapter: Platform configuration → Innovion Workforce contract.
 *
 * ===========================================================================
 * RESOLUTION OF DEP-2 (payload shape)
 *
 * Team B reported four independent mismatches between the Workforce client and
 * the Platform Configuration Service. Three were corrected on their side (path,
 * manifest query, `{ data: … }` envelope). The fourth was left open, and
 * deliberately so:
 *
 *   "Team A emits camelCase and a different domain set … Team B's 53 KB model
 *    parses snake_case with a different set (i18n, currency, regional,
 *    measurement, terminology, features, org_hierarchy). Reconciling the domain
 *    payload field-by-field requires a live authenticated Platform response to
 *    verify against. Guessing 53 KB of mappings without one would produce
 *    plausible code with no evidence behind it. Deliberately not done."
 *
 * That was the correct call for Team B, who could not see a live response. As
 * integration lead I have the other half of the evidence: Team B's parser
 * itself. Every key below was read out of
 * `lib/services/platform_settings_model.dart` — from the `fromJson` factories
 * of BrandingConfig, LocalisationConfig, LicensingConfig, ModulesConfig,
 * SecurityConfig, DigitalProfessionalConfig, PartnerConfig, FeatureRegistry,
 * OrgHierarchyConfig and PlatformConfiguration — not from a guess about what
 * they might be.
 *
 * The mapping is therefore evidence-based in the direction that matters: it is
 * derived from the consumer, so the consumer parses it by construction. The
 * `tests/workforce-contract-suite.ts` suite asserts every key against the same
 * source.
 *
 * ===========================================================================
 * WHY A SEPARATE ENDPOINT RATHER THAN CHANGING /api/platform/configuration
 *
 * The Platform endpoint's camelCase v3.0.0 payload is a published contract with
 * other consumers (Web Platform, Partner Portal, Customer Portal, Team D).
 * Renaming its fields to suit one client would break the others. The Workforce
 * contract is served alongside it, from the same single source of truth, so
 * neither consumer constrains the other and there is still only one place the
 * configuration is computed.
 *
 * The manifest is emitted unchanged: Team B's `ConfigurationManifest.fromJson`
 * already accepts camelCase and snake_case for every field.
 * ===========================================================================
 */

/** The Workforce-facing configuration document. */
export interface WorkforceConfigurationPayload {
  company_id: string;
  manifest: ConfigurationManifest;
  branding: Record<string, unknown>;
  i18n: Record<string, unknown>;
  currency: Record<string, unknown>;
  regional: Record<string, unknown>;
  measurement: Record<string, unknown>;
  terminology: Record<string, string>;
  licensing: Record<string, unknown>;
  modules: Record<string, unknown>;
  security: Record<string, unknown>;
  digital_professional: Record<string, unknown>;
  partner: Record<string, unknown>;
  features: Record<string, boolean>;
  org_hierarchy: Record<string, unknown>;
  api_version: string;
}

/** Team A stores `firstDayOfWeek` as 0|1|6; Team B expects a day name. */
function dayName(index: number): string {
  switch (index) {
    case 0:
      return 'sunday';
    case 6:
      return 'saturday';
    default:
      return 'monday';
  }
}

/**
 * Team A models session timeout as '15min' | '30min' | '1h' | '4h' | '8h' |
 * 'never'; Team B expects `session_policy.timeout_minutes` as a number, or null
 * for no timeout.
 */
function timeoutMinutes(value: string | null | undefined): number | null {
  switch (value) {
    case '15min':
      return 15;
    case '30min':
      return 30;
    case '1h':
      return 60;
    case '4h':
      return 240;
    case '8h':
      return 480;
    case 'never':
    default:
      return null;
  }
}

/**
 * Team A's password policy is a tier name ('standard' | 'strong' |
 * 'enterprise'); Team B expects the individual rules. The tiers are expanded
 * here so the mobile client enforces the same policy the Platform states,
 * rather than its own defaults.
 */
function passwordRules(policy: string | null | undefined) {
  switch (policy) {
    case 'enterprise':
      return {
        min_length: 14,
        requires_uppercase: true,
        requires_lowercase: true,
        requires_digit: true,
        requires_special: true,
        allow_passphrase: true,
      };
    case 'strong':
      return {
        min_length: 12,
        requires_uppercase: true,
        requires_lowercase: true,
        requires_digit: true,
        requires_special: true,
        allow_passphrase: true,
      };
    case 'standard':
    default:
      return {
        min_length: 10,
        requires_uppercase: true,
        requires_lowercase: true,
        requires_digit: true,
        requires_special: false,
        allow_passphrase: true,
      };
  }
}

/** Which Workforce modules a Platform module id enables. */
const MODULE_ID_MAP: Record<string, string> = {
  jobs: 'jobs',
  scheduling: 'schedule',
  schedule: 'schedule',
  time_tracking: 'time_tracking',
  timesheets: 'time_tracking',
  checklists: 'checklists',
  incidents: 'issue_reports',
  issues: 'issue_reports',
  inventory: 'supply_requests',
  supply: 'supply_requests',
  messages: 'messages',
  documents: 'documents',
  notes: 'notes',
  compliance: 'compliance',
};

export function toWorkforceConfiguration(
  config: PlatformOrganisationConfig
): WorkforceConfigurationPayload {
  const loc = config.localisation;
  const sec = config.security;

  /**
   * Module enablement.
   *
   * A Workforce module is switched OFF only when the Platform has a
   * corresponding module and that module is not enabled for this organisation.
   * A Workforce module with no Platform counterpart stays ON.
   *
   * The inverse rule — on only if present in `enabledIds` — looks stricter and
   * is wrong. Team A's module registry contains jobs, clients, employees,
   * contractors, sites, compliance, documents, inventory, vehicles, incidents,
   * checklists, time_tracking, reports, billing and digital_workforce. It has
   * no entry for `messages`, `notes`, `supply_requests` or `schedule`, which
   * are Workforce concepts. Gating on presence would have reported three
   * working features as disabled on every device, and the app would have hidden
   * them — a Platform response that silently removes Workforce functionality.
   */
  const enabledIds = new Set(config.modules?.enabledIds ?? []);
  const platformDisabled = new Set(
    (config.modules?.available ?? [])
      .filter((m) => !enabledIds.has(m.id))
      .map((m) => MODULE_ID_MAP[m.id] ?? m.id)
  );
  const moduleFlag = (key: string) => !platformDisabled.has(key);

  const dp = config.digitalProfessional;
  // Team A identifies a capability by `id`; Team B names the same six
  // capabilities as booleans under `capabilities`.
  const dpCapabilities = new Set(
    (dp?.capabilities ?? []).filter((c) => c.enabled).map((c) => c.id)
  );

  return {
    company_id: config.organisationId,
    manifest: config.manifest,

    branding: {
      company_name: config.branding.organisationName,
      logo_url: config.branding.logoUrl,
      primary_colour: config.branding.primaryColour,
      accent_colour: config.branding.secondaryColour,
      show_logo_on_splash: true,
      app_display_name: config.branding.organisationName,
    },

    i18n: {
      language_code: loc.language,
      timezone: loc.timezone,
      date_format: loc.dateFormat,
      time_format: loc.timeFormat,
      date_time_format: `${loc.dateFormat} ${loc.timeFormat === '24h' ? 'HH:mm' : 'h:mm a'}`,
    },

    currency: {
      code: loc.currencyCode,
      symbol: loc.currencySymbol,
      symbol_position: loc.currencySymbolPosition,
      decimal_places: loc.currencyDecimalPrecision,
    },

    regional: {
      decimal_separator: loc.decimalSeparator,
      thousands_separator: loc.thousandsSeparator,
      country_code: loc.countryCode,
      country_name: loc.countryConfig?.countryName ?? loc.countryCode,
      first_day_of_week: dayName(loc.firstDayOfWeek),
    },

    measurement: {
      system: loc.measurementSystem,
      distance_unit: loc.measurementSystem === 'imperial' ? 'mi' : 'km',
      temperature_unit: loc.measurementSystem === 'imperial' ? 'fahrenheit' : 'celsius',
      weight_unit: loc.measurementSystem === 'imperial' ? 'lb' : 'kg',
    },

    terminology: {},

    licensing: {
      plan: config.licensing.planName ?? 'trial',
      status: config.licensing.status ?? 'trial',
      trial_expires_at: config.licensing.trialEndsAt,
      max_seats: config.licensing.maxUsers,
      used_seats: null,
      billing_cycle: null,
      renews_at: config.licensing.currentPeriodEnd,
    },

    modules: {
      jobs: moduleFlag('jobs'),
      time_tracking: moduleFlag('time_tracking'),
      checklists: moduleFlag('checklists'),
      issue_reports: moduleFlag('issue_reports'),
      supply_requests: moduleFlag('supply_requests'),
      messages: moduleFlag('messages'),
      documents: moduleFlag('documents'),
      notes: moduleFlag('notes'),
      schedule: moduleFlag('schedule'),
      compliance: moduleFlag('compliance'),
      digital_professional: dp?.status === 'active',
    },

    security: {
      password_policy: passwordRules(sec?.passwordPolicy),
      session_policy: { timeout_minutes: timeoutMinutes(sec?.sessionTimeout) },
      mfa: { required: sec?.mfaRequired ?? false, method: null },
      access_control: {
        biometric_allowed: true,
        ip_allowlist: sec?.ipWhitelistEnabled ? (sec?.ipWhitelist ?? []) : [],
        max_login_attempts: 5,
        lockout_duration_minutes: 15,
      },
    },

    digital_professional: {
      enabled: dp?.status === 'active',
      capabilities: {
        ai_assistant: dpCapabilities.has('ai_assistant'),
        auto_checklist: dpCapabilities.has('auto_checklist'),
        predictive_alerts: dpCapabilities.has('predictive_alerts'),
        voice_transcription: dpCapabilities.has('voice_transcription'),
        auto_report_drafting: dpCapabilities.has('auto_report_drafting'),
        smart_scheduling: dpCapabilities.has('smart_scheduling'),
      },
      ai_model_identifier: null,
      daily_ai_request_limit: null,
    },

    partner: {
      id: config.partner?.partnerId ?? null,
      name: config.partner?.partnerName ?? null,
      logo_url: null,
      support_url: null,
      support_email: null,
      show_partner_branding: Boolean(config.partner?.hasPartner),
      metadata: {},
    },

    features: Object.fromEntries(
      (config.featureRegistry?.flags ?? []).map((f) => [f.key, f.status === 'enabled'])
    ),

    org_hierarchy: {
      company_id: config.organisationId,
      nodes: (config.organisationalHierarchy?.units ?? []).map((u) => ({
        id: u.id,
        name: u.name,
        type: u.type,
        parent_id: u.parentId,
        metadata: {},
      })),
      current_worker_node_id: null,
    },

    api_version: config.configVersion,
  };
}
