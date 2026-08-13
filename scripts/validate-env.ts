#!/usr/bin/env ts-node
/**
 * Innovion Platform — Environment Variable Validator
 * ===================================================
 * Validates that all required environment variables are present and contain
 * real values (not placeholders) before the application starts or deploys.
 *
 * Usage (standalone):
 *   npx ts-node scripts/validate-env.ts
 *
 * Usage (in next.config.mjs or startup):
 *   import { validateEnv } from '../scripts/validate-env';
 *   validateEnv();
 *
 * Exit codes:
 *   0 — All required variables present and valid
 *   1 — One or more required variables missing or invalid
 */

// ─── Colour helpers ───────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

// ─── Placeholder patterns that indicate unconfigured values ──────────────────
const PLACEHOLDER_PATTERNS = [
  /^your[-_]/i,
  /[-_]here$/i,
  /^placeholder/i,
  /^dummy/i,
  /^test[-_]key/i,
  /^sk-test_/i,           // Stripe test secret key
  /^pk-test_/i,           // Stripe test publishable key (warn only)
  /^example\./i,
  /localhost/i,
  /^changeme/i,
  /^todo/i,
  /^fixme/i,
  /^xxx/i,
];

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => p.test(value));
}

// ─── Variable definitions ─────────────────────────────────────────────────────
type Severity = 'required' | 'recommended' | 'optional';

interface EnvVar {
  key: string;
  description: string;
  severity: Severity;
  /** Minimum character length for a plausible real value */
  minLength?: number;
  /** If true, warn when value looks like a test/placeholder */
  checkPlaceholder?: boolean;
  /** Custom validation function */
  validate?: (value: string) => string | null; // returns error message or null
}

const ENV_VARS: EnvVar[] = [
  // ── Supabase (Critical) ────────────────────────────────────────────────────
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL',
    severity: 'required',
    minLength: 20,
    checkPlaceholder: true,
    validate: (v) => {
      try {
        const url = new URL(v);
        if (!url.hostname.includes('supabase')) {
          return 'URL does not appear to be a Supabase project URL (expected *.supabase.co)';
        }
        return null;
      } catch {
        return 'Not a valid URL';
      }
    },
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous (public) API key',
    severity: 'required',
    minLength: 100,
    checkPlaceholder: true,
    validate: (v) => {
      // Supabase anon keys are JWTs — three base64 segments separated by dots
      const parts = v.split('.');
      if (parts.length !== 3) return 'Does not appear to be a valid JWT (expected 3 segments)';
      return null;
    },
  },

  // ── Stripe (Critical for billing) ─────────────────────────────────────────
  {
    key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    description: 'Stripe publishable key (client-side)',
    severity: 'required',
    minLength: 20,
    checkPlaceholder: true,
    validate: (v) => {
      if (!v.startsWith('pk_')) return 'Stripe publishable key must start with "pk_"';
      if (v.startsWith('pk_test_')) return 'WARNING: Using Stripe TEST publishable key in production';
      return null;
    },
  },
  {
    key: 'STRIPE_SECRET_KEY',
    description: 'Stripe secret key (server-side)',
    severity: 'required',
    minLength: 20,
    checkPlaceholder: true,
    validate: (v) => {
      if (!v.startsWith('sk_')) return 'Stripe secret key must start with "sk_"';
      if (v.startsWith('sk_test_')) return 'WARNING: Using Stripe TEST secret key in production';
      return null;
    },
  },

  // ── Email (Required for transactional email) ───────────────────────────────
  {
    key: 'RESEND_API_KEY',
    description: 'Resend API key for transactional email',
    severity: 'required',
    minLength: 20,
    checkPlaceholder: true,
    validate: (v) => {
      if (!v.startsWith('re_')) return 'Resend API key should start with "re_"';
      return null;
    },
  },

  // ── Site URL ───────────────────────────────────────────────────────────────
  {
    key: 'NEXT_PUBLIC_SITE_URL',
    description: 'Production site URL (used for OAuth redirects)',
    severity: 'required',
    minLength: 10,
    checkPlaceholder: true,
    validate: (v) => {
      try {
        const url = new URL(v);
        if (url.protocol !== 'https:') {
          return 'Production site URL should use HTTPS';
        }
        if (url.hostname === 'localhost') {
          return 'NEXT_PUBLIC_SITE_URL is set to localhost — update to production domain';
        }
        return null;
      } catch {
        return 'Not a valid URL';
      }
    },
  },

  // ── Analytics (Recommended) ────────────────────────────────────────────────
  {
    key: 'NEXT_PUBLIC_GA_MEASUREMENT_ID',
    description: 'Google Analytics Measurement ID',
    severity: 'recommended',
    checkPlaceholder: true,
    validate: (v) => {
      if (!v.startsWith('G-')) return 'GA Measurement ID should start with "G-"';
      return null;
    },
  },
  {
    key: 'NEXT_PUBLIC_ADSENSE_ID',
    description: 'Google AdSense Publisher ID',
    severity: 'optional',
    checkPlaceholder: true,
  },

  // ── AI Services (Optional — feature-gated) ─────────────────────────────────
  {
    key: 'OPENAI_API_KEY',
    description: 'OpenAI API key',
    severity: 'optional',
    checkPlaceholder: true,
    validate: (v) => {
      if (!v.startsWith('sk-')) return 'OpenAI API key should start with "sk-"';
      return null;
    },
  },
  {
    key: 'GEMINI_API_KEY',
    description: 'Google Gemini API key',
    severity: 'optional',
    checkPlaceholder: true,
  },
  {
    key: 'ANTHROPIC_API_KEY',
    description: 'Anthropic Claude API key',
    severity: 'optional',
    checkPlaceholder: true,
    validate: (v) => {
      if (!v.startsWith('sk-ant-')) return 'Anthropic key should start with "sk-ant-"';
      return null;
    },
  },
  {
    key: 'PERPLEXITY_API_KEY',
    description: 'Perplexity API key',
    severity: 'optional',
    checkPlaceholder: true,
  },
];

// ─── Validation logic ─────────────────────────────────────────────────────────
interface ValidationIssue {
  key: string;
  severity: Severity;
  type: 'missing' | 'placeholder' | 'invalid' | 'warning';
  message: string;
}

export function validateEnv(exitOnFailure = false): boolean {
  const issues: ValidationIssue[] = [];

  for (const def of ENV_VARS) {
    const value = process.env[def.key];

    // Missing check
    if (!value || value.trim() === '') {
      if (def.severity === 'required') {
        issues.push({
          key: def.key,
          severity: def.severity,
          type: 'missing',
          message: `${def.description} — MISSING`,
        });
      } else if (def.severity === 'recommended') {
        issues.push({
          key: def.key,
          severity: def.severity,
          type: 'missing',
          message: `${def.description} — not set (recommended)`,
        });
      }
      continue;
    }

    // Minimum length check
    if (def.minLength && value.length < def.minLength) {
      issues.push({
        key: def.key,
        severity: def.severity,
        type: 'invalid',
        message: `${def.description} — value too short (${value.length} chars, expected ≥${def.minLength})`,
      });
      continue;
    }

    // Placeholder check
    if (def.checkPlaceholder && isPlaceholder(value)) {
      issues.push({
        key: def.key,
        severity: def.severity,
        type: 'placeholder',
        message: `${def.description} — appears to be a placeholder value`,
      });
      continue;
    }

    // Custom validation
    if (def.validate) {
      const error = def.validate(value);
      if (error) {
        const type = error.startsWith('WARNING') ? 'warning' : 'invalid';
        issues.push({
          key: def.key,
          severity: def.severity,
          type,
          message: `${def.description} — ${error}`,
        });
      }
    }
  }

  return issues;
}

// ─── CLI output ───────────────────────────────────────────────────────────────
function runCli(): void {
  console.log(`\n${BOLD}╔══════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║   Innovion — Environment Variable Validator       ║${RESET}`);
  console.log(`${BOLD}╚══════════════════════════════════════════════════╝${RESET}\n`);

  const issues = validateEnv() as unknown as ValidationIssue[];
  const required    = ENV_VARS.filter((v) => v.severity === 'required');
  const recommended = ENV_VARS.filter((v) => v.severity === 'recommended');
  const optional    = ENV_VARS.filter((v) => v.severity === 'optional');

  // Print status for each variable
  console.log(`${BOLD}Required Variables (${required.length})${RESET}`);
  for (const def of required) {
    const issue = issues.find((i) => i.key === def.key);
    const value = process.env[def.key];
    if (!issue && value) {
      const masked = value.slice(0, 6) + '••••••••' + value.slice(-4);
      console.log(`  ${GREEN}✔${RESET}  ${def.key.padEnd(40)} ${CYAN}${masked}${RESET}`);
    } else if (issue?.type === 'warning') {
      console.log(`  ${YELLOW}⚠${RESET}  ${def.key.padEnd(40)} ${YELLOW}${issue.message}${RESET}`);
    } else if (issue) {
      console.log(`  ${RED}✘${RESET}  ${def.key.padEnd(40)} ${RED}${issue.message}${RESET}`);
    }
  }

  console.log(`\n${BOLD}Recommended Variables (${recommended.length})${RESET}`);
  for (const def of recommended) {
    const issue = issues.find((i) => i.key === def.key);
    const value = process.env[def.key];
    if (!issue && value) {
      console.log(`  ${GREEN}✔${RESET}  ${def.key.padEnd(40)} ${CYAN}set${RESET}`);
    } else if (issue) {
      console.log(`  ${YELLOW}⚠${RESET}  ${def.key.padEnd(40)} ${YELLOW}${issue.message}${RESET}`);
    }
  }

  console.log(`\n${BOLD}Optional Variables (${optional.length})${RESET}`);
  for (const def of optional) {
    const issue = issues.find((i) => i.key === def.key);
    const value = process.env[def.key];
    if (!issue && value) {
      console.log(`  ${GREEN}✔${RESET}  ${def.key.padEnd(40)} ${CYAN}set${RESET}`);
    } else if (issue?.type === 'placeholder' || issue?.type === 'invalid') {
      console.log(`  ${YELLOW}⚠${RESET}  ${def.key.padEnd(40)} ${YELLOW}${issue.message}${RESET}`);
    } else {
      console.log(`     ${def.key.padEnd(40)} ${YELLOW}not set${RESET}`);
    }
  }

  // Summary
  const criticalIssues = issues.filter(
    (i) => i.severity === 'required' && (i.type === 'missing' || i.type === 'placeholder' || i.type === 'invalid')
  );
  const warnings = issues.filter(
    (i) => i.type === 'warning' || (i.severity === 'recommended' && i.type === 'missing')
  );

  console.log(`\n${BOLD}══════════════════════════════════════════════════${RESET}`);

  if (criticalIssues.length === 0 && warnings.length === 0) {
    console.log(`${GREEN}${BOLD}✔  All environment variables are correctly configured.${RESET}`);
    console.log(`${GREEN}   Platform is ready for production deployment.${RESET}\n`);
    process.exit(0);
  }

  if (criticalIssues.length > 0) {
    console.log(`\n${RED}${BOLD}BLOCKING ISSUES (${criticalIssues.length}):${RESET}`);
    for (const issue of criticalIssues) {
      console.log(`  ${RED}✘${RESET}  ${issue.key}: ${issue.message}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n${YELLOW}${BOLD}WARNINGS (${warnings.length}):${RESET}`);
    for (const issue of warnings) {
      console.log(`  ${YELLOW}⚠${RESET}  ${issue.key}: ${issue.message}`);
    }
  }

  console.log('');

  if (criticalIssues.length > 0) {
    console.log(`${RED}${BOLD}✘  Environment validation FAILED.${RESET}`);
    console.log(`${RED}   Resolve all blocking issues before deploying to production.${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${YELLOW}${BOLD}⚠  Environment validation passed with warnings.${RESET}`);
    console.log(`${YELLOW}   Review warnings before deploying to production.${RESET}\n`);
    process.exit(0);
  }
}

// Run when executed directly
if (require.main === module) {
  runCli();
}
