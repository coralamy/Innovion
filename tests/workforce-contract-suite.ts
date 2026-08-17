/**
 * Innovion A/B — Workforce configuration contract suite
 * ===========================================================================
 * Asserts that `toWorkforceConfiguration()` emits exactly the document Team B's
 * `PlatformConfiguration.fromJson` parses.
 *
 * The expected key set is not written by hand and is not a guess: it is read at
 * run time out of Team B's own parser,
 *   lib/services/platform_settings_model.dart
 * so this suite fails if Team B changes their contract and Team A does not
 * follow — which is the failure DEP-2 describes.
 *
 * Run: npm run test:workforce
 */

import { readFileSync, existsSync } from 'node:fs';
import { toWorkforceConfiguration } from '../src/lib/services/workforceConfigurationAdapter';
import type { PlatformOrganisationConfig } from '../src/lib/services/platformConfigurationService';

const TEAM_B_MODEL =
  process.env.INNOVION_TEAM_B_MODEL ??
  'C:/Users/gamya/Desktop/team_b___innovion_workforce/innovionworkforce/lib/services/platform_settings_model.dart';

let passed = 0;
const failures: string[] = [];
let section = '';

const group = (n: string) => {
  section = n;
  console.log(`\n── ${n}`);
};
const check = (desc: string, ok: boolean, detail = '') => {
  if (ok) {
    passed++;
    console.log(`   PASS  ${desc}${detail ? `  (${detail})` : ''}`);
  } else {
    failures.push(`[${section}] ${desc}${detail ? ` — ${detail}` : ''}`);
    console.log(`   FAIL  ${desc}${detail ? `  (${detail})` : ''}`);
  }
};

/** Keys a named Dart class reads out of its JSON, extracted from the source. */
function dartKeys(src: string, className: string): Set<string> {
  const classAt = src.indexOf(`class ${className} {`);
  if (classAt === -1) return new Set();
  const next = src.indexOf('\nclass ', classAt + 1);
  const body = src.slice(classAt, next === -1 ? src.length : next);

  const fromJsonAt = body.indexOf('.fromJson(');
  if (fromJsonAt === -1) return new Set();
  const section = body.slice(fromJsonAt);

  const keys = new Set<string>();
  for (const m of section.matchAll(/json\[\s*'([^']+)'\s*\]/g)) keys.add(m[1]);
  return keys;
}

/** Keys read from a local map variable, e.g. `i18n['language_code']`. */
function dartLocalKeys(src: string, className: string, localVar: string): Set<string> {
  const classAt = src.indexOf(`class ${className} {`);
  if (classAt === -1) return new Set();
  const next = src.indexOf('\nclass ', classAt + 1);
  const body = src.slice(classAt, next === -1 ? src.length : next);

  const keys = new Set<string>();
  const re = new RegExp(`\\b${localVar}\\[\\s*'([^']+)'\\s*\\]`, 'g');
  for (const m of body.matchAll(re)) keys.add(m[1]);
  return keys;
}

// ── A representative, fully-populated Platform configuration ───────────────
const sample = {
  configVersion: '3.0.0',
  organisationId: 'aaaaaaaa-0000-0000-0000-00000000000a',
  retrievedAt: '2026-08-18T00:00:00.000Z',
  manifest: {
    schemaVersion: '3.0.0',
    configVersion: 42,
    configHash: 'abc123',
    generatedAt: '2026-08-18T00:00:00.000Z',
    apiVersion: 'v3',
    minimumClientVersion: '1.0',
    compatibleClientTypes: ['workforce'],
    organisationId: 'aaaaaaaa-0000-0000-0000-00000000000a',
    domainCount: 16,
    isPartial: false,
  },
  branding: {
    organisationName: 'Tenant A',
    primaryColour: '#2563EB',
    secondaryColour: '#0F1C2E',
    logoUrl: 'https://example.test/logo.png',
    faviconUrl: null,
    customDomain: null,
    showPoweredBy: true,
  },
  localisation: {
    countryCode: 'AU',
    country: 'AU',
    timezone: 'Australia/Sydney',
    language: 'en-AU',
    currencyCode: 'AUD',
    currencySymbol: '$',
    currencyDecimalPrecision: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    currencySymbolPosition: 'before',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    firstDayOfWeek: 1,
    measurementSystem: 'metric',
    countryConfig: { countryName: 'Australia' },
  },
  licensing: {
    licenceModel: 'direct',
    planName: 'professional',
    status: 'active',
    maxUsers: 25,
    maxJobs: 1000,
    planFeatures: [],
    isReadOnly: false,
    isActive: true,
    trialEndsAt: null,
    currentPeriodEnd: '2026-12-31T00:00:00.000Z',
    productId: 'innovion',
    productName: 'Innovion',
  },
  modules: {
    // Mirrors Team A's real registry shape: `available` lists every Platform
    // module, `enabledIds` the subset switched on for this organisation.
    available: [
      {
        id: 'jobs',
        name: 'Jobs',
        description: '',
        status: 'enabled',
        requiresAddOn: false,
        routes: [],
      },
      {
        id: 'time_tracking',
        name: 'Time',
        description: '',
        status: 'enabled',
        requiresAddOn: false,
        routes: [],
      },
      {
        id: 'checklists',
        name: 'Checklists',
        description: '',
        status: 'enabled',
        requiresAddOn: false,
        routes: [],
      },
      {
        id: 'documents',
        name: 'Documents',
        description: '',
        status: 'enabled',
        requiresAddOn: false,
        routes: [],
      },
      // Present in the Platform registry but switched OFF for this tenant.
      {
        id: 'incidents',
        name: 'Incidents',
        description: '',
        status: 'disabled',
        requiresAddOn: false,
        routes: [],
      },
      {
        id: 'compliance',
        name: 'Compliance',
        description: '',
        status: 'disabled',
        requiresAddOn: false,
        routes: [],
      },
    ],
    enabledIds: ['jobs', 'time_tracking', 'checklists', 'documents'],
  },
  security: {
    mfaRequired: true,
    mfaEnabled: true,
    sessionTimeout: '4h',
    ipWhitelistEnabled: true,
    ipWhitelist: ['203.0.113.0/24'],
    auditLogEnabled: true,
    passwordPolicy: 'strong',
    ssoEnabled: false,
    ssoProvider: null,
    readOnlyAllowedPaths: [],
    readOnlyTriggerStatuses: [],
  },
  digitalProfessional: {
    status: 'active',
    personaName: null,
    avatarUrl: null,
    primaryLanguage: 'en-AU',
    capabilities: [
      {
        id: 'ai_assistant',
        name: 'AI assistant',
        enabled: true,
        supportedLanguages: [],
        provider: null,
        config: {},
      },
      {
        id: 'smart_scheduling',
        name: 'Smart scheduling',
        enabled: false,
        supportedLanguages: [],
        provider: null,
        config: {},
      },
    ],
    dataAccessEnabled: true,
    maxTokensPerRequest: 4096,
  },
  partner: {
    hasPartner: true,
    partnerId: 'p-1',
    partnerName: 'Global Partner Co',
    partnerType: 'regional_partner',
    territory: null,
    customerOwnership: 'direct',
    mrr: null,
    arr: null,
    partnerProducts: [],
  },
  featureRegistry: {
    flags: [
      {
        key: 'recurring_jobs',
        name: 'Recurring jobs',
        status: 'enabled',
        planGated: false,
        minimumPlan: null,
        rolloutPercentage: 100,
      },
      {
        key: 'ai_scheduling',
        name: 'AI scheduling',
        status: 'disabled',
        planGated: true,
        minimumPlan: 'enterprise',
        rolloutPercentage: 0,
      },
    ],
    enabledKeys: ['recurring_jobs'],
  },
  organisationalHierarchy: {
    tier: 'standalone',
    parentOrganisationId: null,
    childOrganisationIds: [],
    units: [{ id: 'u1', name: 'Sydney', type: 'site', parentId: null, isActive: true }],
    multiSiteEnabled: true,
    siteCount: 1,
  },
} as unknown as PlatformOrganisationConfig;

const out = toWorkforceConfiguration(sample);

// ═══════════════════════════════════════════════════════════════════════════
group("A. TOP-LEVEL DOMAINS — against Team B's knownKeys");

if (!existsSync(TEAM_B_MODEL)) {
  check('Team B model is readable (contract source of truth)', false, `not found: ${TEAM_B_MODEL}`);
} else {
  const src = readFileSync(TEAM_B_MODEL, 'utf8');
  check('Team B model is readable (contract source of truth)', true);

  // The literal `knownKeys` set in PlatformConfiguration.fromJson.
  const knownBlock = /const knownKeys = \{([\s\S]*?)\};/.exec(src);
  const known = new Set([...(knownBlock?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]));
  check('extracted Team B knownKeys', known.size > 10, `${known.size} keys`);

  // Everything Team B knows about, except the two the CLIENT supplies itself.
  const clientSupplied = new Set(['fetched_at', 'company']);
  for (const key of known) {
    if (clientSupplied.has(key)) continue;
    check(`emits "${key}"`, key in out);
  }

  // Nothing emitted should land in Team B's `extensions` bucket unnoticed.
  const unknownEmitted = Object.keys(out).filter((k) => !known.has(k));
  check(
    'emits no key Team B would file under extensions',
    unknownEmitted.length === 0,
    unknownEmitted.join(', ')
  );

  // ═════════════════════════════════════════════════════════════════════════
  group('B. SUB-DOCUMENT KEYS — against each fromJson factory');

  const domainChecks: Array<[string, string, Record<string, unknown>]> = [
    ['BrandingConfig', 'branding', out.branding],
    ['LicensingConfig', 'licensing', out.licensing],
    ['PartnerConfig', 'partner', out.partner],
    ['OrgHierarchyConfig', 'org_hierarchy', out.org_hierarchy],
  ];

  for (const [cls, domain, emitted] of domainChecks) {
    const keys = dartKeys(src, cls);
    check(`${cls}: keys extracted`, keys.size > 0, `${keys.size}`);
    for (const k of keys) {
      // `metadata` and `nodes` are containers Team B tolerates as absent.
      check(`${domain}.${k} emitted`, k in emitted, k in emitted ? '' : 'MISSING');
    }
  }

  // Nested documents read through a local variable.
  const nested: Array<[string, string, string, Record<string, unknown>]> = [
    ['LocalisationConfig', 'i18n', 'i18n', out.i18n],
    ['LocalisationConfig', 'currency', 'currency', out.currency],
    ['LocalisationConfig', 'regional', 'regional', out.regional],
    ['LocalisationConfig', 'measurement', 'measurement', out.measurement],
    [
      'SecurityConfig',
      'pwd',
      'security.password_policy',
      out.security.password_policy as Record<string, unknown>,
    ],
    [
      'SecurityConfig',
      'session',
      'security.session_policy',
      out.security.session_policy as Record<string, unknown>,
    ],
    ['SecurityConfig', 'mfa', 'security.mfa', out.security.mfa as Record<string, unknown>],
    [
      'SecurityConfig',
      'access',
      'security.access_control',
      out.security.access_control as Record<string, unknown>,
    ],
    [
      'DigitalProfessionalConfig',
      'caps',
      'digital_professional.capabilities',
      out.digital_professional.capabilities as Record<string, unknown>,
    ],
  ];

  for (const [cls, localVar, label, emitted] of nested) {
    const keys = dartLocalKeys(src, cls, localVar);
    check(`${label}: keys extracted from ${cls}`, keys.size > 0, `${keys.size}`);
    for (const k of keys) {
      check(`${label}.${k} emitted`, k in emitted, k in emitted ? '' : 'MISSING');
    }
  }

  // ModulesConfig reads its keys directly from the modules map.
  for (const k of dartKeys(src, 'ModulesConfig')) {
    check(`modules.${k} emitted`, k in out.modules);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
group('C. VALUE TRANSLATION — Team A vocabulary → Team B vocabulary');

check(
  'firstDayOfWeek 1 → "monday"',
  out.regional.first_day_of_week === 'monday',
  String(out.regional.first_day_of_week)
);
check(
  "sessionTimeout '4h' → 240 minutes",
  (out.security.session_policy as { timeout_minutes: number }).timeout_minutes === 240,
  String((out.security.session_policy as { timeout_minutes: number }).timeout_minutes)
);
check(
  "passwordPolicy 'strong' → min_length 12",
  (out.security.password_policy as { min_length: number }).min_length === 12,
  String((out.security.password_policy as { min_length: number }).min_length)
);
check(
  'metric → km / celsius / kg',
  out.measurement.distance_unit === 'km' &&
    out.measurement.temperature_unit === 'celsius' &&
    out.measurement.weight_unit === 'kg'
);
check(
  '24h clock → date_time_format uses HH:mm',
  String(out.i18n.date_time_format).includes('HH:mm'),
  String(out.i18n.date_time_format)
);
check(
  'enabled capability id → capability boolean true',
  (out.digital_professional.capabilities as Record<string, boolean>).ai_assistant === true
);
check(
  'disabled capability id → capability boolean false',
  (out.digital_professional.capabilities as Record<string, boolean>).smart_scheduling === false
);
check('feature flag status enabled → true', out.features.recurring_jobs === true);
check('feature flag status disabled → false', out.features.ai_scheduling === false);
check(
  'Workforce module with no Platform counterpart stays on',
  out.modules.messages === true &&
    out.modules.notes === true &&
    out.modules.supply_requests === true &&
    out.modules.schedule === true
);
check(
  'Platform module enabled → Workforce module on',
  out.modules.jobs === true && out.modules.time_tracking === true && out.modules.checklists === true
);
check(
  'Platform module disabled → Workforce module off (incidents → issue_reports)',
  out.modules.issue_reports === false,
  String(out.modules.issue_reports)
);
check(
  'Platform module disabled → compliance off',
  out.modules.compliance === false,
  String(out.modules.compliance)
);
check('company_id is the organisation id', out.company_id === sample.organisationId);
check(
  'ipWhitelist passed through when enabled',
  Array.isArray((out.security.access_control as { ip_allowlist: string[] }).ip_allowlist) &&
    (out.security.access_control as { ip_allowlist: string[] }).ip_allowlist.length === 1
);

// ═══════════════════════════════════════════════════════════════════════════
group('D. MANIFEST — accepted by Team B without translation');
// ConfigurationManifest.fromJson accepts camelCase and snake_case for every
// field, so Team A's manifest is emitted unchanged. The values that matter are
// the two whose absence made hasChangedFrom() compare 0 with 0.
check('manifest carries a non-zero configVersion', out.manifest.configVersion === 42);
check('manifest carries a configHash', out.manifest.configHash === 'abc123');
check('manifest organisationId present', out.manifest.organisationId === sample.organisationId);

// ═══════════════════════════════════════════════════════════════════════════
group('E. SERIALISABILITY');
{
  let json = '';
  let threw = false;
  try {
    json = JSON.stringify({ data: out });
  } catch {
    threw = true;
  }
  check('payload is JSON-serialisable', !threw && json.length > 0, `${json.length} bytes`);
  check('payload contains no undefined-valued keys after round-trip', !json.includes('undefined'));
}

console.log('\n' + '═'.repeat(78));
console.log(`  ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\n  FAILURES');
  failures.forEach((f, i) => console.log(`   ${String(i + 1).padStart(2)}. ${f}`));
}
console.log('═'.repeat(78));
process.exit(failures.length ? 1 : 0);
