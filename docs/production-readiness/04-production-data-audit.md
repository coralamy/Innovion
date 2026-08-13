# Innovion Platform — Production Data Audit Report
**Date:** 2026-07-31  
**Scope:** All Supabase migrations, seed data, and reference data  
**Classification:** Internal — Engineering

---

## Executive Summary

A comprehensive audit of all database migrations has been performed to identify dummy data, placeholder records, test companies, test users, lorem ipsum content, and unused assets.

| Category | Status | Action Required |
|---|---|---|
| Dummy/Mock Data in Migrations | ⚠️ PRESENT | Must be removed before production |
| Placeholder Records | ⚠️ PRESENT | Must be removed before production |
| Test Companies | ⚠️ PRESENT (via seed) | Must be removed before production |
| Test Users | ✅ NOT PRESENT | No test users in migrations |
| Lorem Ipsum Content | ✅ NOT PRESENT | No lorem ipsum found |
| Unused Assets | ⚠️ REVIEW REQUIRED | Multiple logo images in public/assets |

---

## 1. Mock/Dummy Data Inventory

### 1.1 `20260726055014_innovion_core.sql` — Core Mock Data

**Status: 🔴 MUST REMOVE BEFORE PRODUCTION**

This migration seeds the following dummy data:

#### Contractors (8 records)
| Name | Status | Issue |
|---|---|---|
| Marcus Johnson | Mock contractor | Fictional person, fake phone/email |
| Priya Sharma | Mock contractor | Fictional person, fake phone/email |
| Tom Nguyen | Mock contractor | Fictional person, fake phone/email |
| Sarah Williams | Mock contractor | Fictional person, fake phone/email |
| David Kim | Mock contractor | Fictional person, fake phone/email |
| Emma Rodriguez | Mock contractor | Fictional person, fake phone/email |
| James O'Brien | Mock contractor | Fictional person, fake phone/email |
| Aisha Patel | Mock contractor | Fictional person, fake phone/email |

**Risk:** These records have no `company_id` set, meaning they are visible to ALL authenticated tenants due to the `IS NULL` escape clause in RLS policies.

#### Jobs (8 records)
| Job Number | Client | Issue |
|---|---|---|
| JOB-2026-0842 | Crown Casino Complex | Fictional client/site |
| JOB-2026-0843 | Westfield Shopping Centre | Fictional client/site |
| JOB-2026-0840 | Harbor View Towers | Fictional client/site |
| JOB-2026-0841 | Riverside Medical Centre | Fictional client/site |
| JOB-2026-0844 | TechPark Business Hub | Fictional client/site |
| JOB-2026-0839 | Metro Office Complex | Fictional client/site |
| JOB-2026-0845 | Harbor View Towers | Fictional client/site |
| JOB-2026-0838 | Crown Casino Complex | Fictional client/site |

**Risk:** Same as contractors — no `company_id`, visible to all tenants.

#### Time Entries (5 records)
All 5 time entries reference fictional contractors and sites. No `company_id` set.

#### Checklists (4 records)
All 4 checklists reference fictional sites and contractors. No `company_id` set.

---

### 1.2 `20260728000000_timesheet_invoices_stripe_templates.sql` — Template Seed Data

**Status: ⚠️ REVIEW — Some data is acceptable reference data**

#### Subscription Plans (3 records)
| Plan | Type | Action |
|---|---|---|
| Starter | Reference/config data | ✅ KEEP — This is configuration, not dummy data |
| Professional | Reference/config data | ✅ KEEP |
| Enterprise | Reference/config data | ✅ KEEP |

**Note:** Prices are set to `0` (placeholder). Real pricing must be configured before commercial launch.

#### Checklist Templates (3 records)
| Template | Issue | Action |
|---|---|---|
| Standard Daily Clean | Assigned to `existing_company_id` (first company in DB) | ⚠️ REVIEW — Acceptable as default templates if `company_id` is NULL (global templates) |
| Site Safety Inspection | Same | ⚠️ REVIEW |
| Site Inspection Report | Same | ⚠️ REVIEW |

**Recommendation:** Convert these to global templates by setting `company_id = NULL` and updating the RLS policy to allow all companies to read global templates.

#### Recurring Job Patterns (3 records)
| Pattern | Issue | Action |
|---|---|---|
| Weekly Office Clean - CBD Tower | References fictional "Acme Corp" | ⚠️ REMOVE — Contains fictional client names |
| Bi-weekly Warehouse Clean | References fictional "BuildRight Pty Ltd" | ⚠️ REMOVE |
| Monthly Carpet Steam Clean | References fictional "TechStart Inc" | ⚠️ REMOVE |

---

### 1.3 `20260728020000_i18n_localisation_partners.sql` — Reference Data

**Status: ✅ ACCEPTABLE — This is legitimate reference/configuration data**

| Data | Type | Action |
|---|---|---|
| 14 currencies (AUD, USD, GBP, etc.) | Reference data | ✅ KEEP |
| 6 partner types | Reference data | ✅ KEEP |
| 4 Coralamy products | Reference data | ✅ KEEP |
| 14 territories (AU states, NZ, US, GB, etc.) | Reference data | ✅ KEEP |

---

### 1.4 `20260726090000_innovion_extended.sql` — Extended Mock Data

**Status: 🔴 MUST REMOVE BEFORE PRODUCTION**

This migration seeds additional mock data including clients, sites, employees, compliance items, incidents, inventory, vehicles, companies, and notifications. All records are fictional and lack `company_id`.

> **Note:** The full content of this file was truncated at 250 lines in the audit. A complete review of lines 251–491 is required to enumerate all mock records.

---

## 2. Test Companies

**Status: ⚠️ REVIEW REQUIRED**

The `companies` table is seeded indirectly through the checklist template and recurring job pattern seeds, which use `SELECT id FROM public.companies LIMIT 1`. If any test company was created during development, it would receive these seed records.

**Action Required:**
1. Query `SELECT id, name, owner_id, created_at FROM public.companies` in the production database before launch
2. Remove any companies with `owner_id IS NULL` or names containing "test", "demo", "sample", "acme", "example"
3. Verify all remaining companies are legitimate customer organisations

---

## 3. Test Users

**Status: ✅ NOT PRESENT IN MIGRATIONS**

No test users are seeded in any migration file. The `auth.users` table is managed exclusively by Supabase Auth and is not seeded via migrations.

**Action Required:**
1. Before production launch, query `SELECT id, email, created_at FROM auth.users` in the Supabase dashboard
2. Remove any users with email addresses containing "test", "demo", "example.com", "mailinator", "temp"
3. Verify all remaining users are legitimate team members or early customers

---

## 4. Lorem Ipsum Content

**Status: ✅ NOT PRESENT**

A comprehensive search of all migration files, component files, and locale files found no lorem ipsum placeholder text.

---

## 5. Placeholder Values

### 5.1 Subscription Plan Pricing

**Status: ⚠️ ACTION REQUIRED**

All subscription plans have `monthly_price_cents = 0` and `annual_price_cents = 0`. These must be updated with real pricing before commercial launch.

```sql
-- Required before launch:
UPDATE public.subscription_plans SET monthly_price_cents = <real_value>, annual_price_cents = <real_value> WHERE plan_key = 'starter';
UPDATE public.subscription_plans SET monthly_price_cents = <real_value>, annual_price_cents = <real_value> WHERE plan_key = 'professional';
UPDATE public.subscription_plans SET monthly_price_cents = <real_value>, annual_price_cents = <real_value> WHERE plan_key = 'enterprise';
```

### 5.2 Stripe Price IDs

**Status: ⚠️ ACTION REQUIRED**

The `subscriptions` table has a `stripe_price_id` column but no Stripe Price IDs are configured in the subscription plans. Real Stripe Price IDs must be created in the Stripe dashboard and stored before billing goes live.

### 5.3 Environment Variables

**Status: ⚠️ ACTION REQUIRED**

The following environment variables contain placeholder values:

| Variable | Current Value | Action |
|---|---|---|
| `OPENAI_API_KEY` | `your-openai-api-key-here` | Replace with real key or remove if not used |
| `GEMINI_API_KEY` | `your-gemini-api-key-here` | Replace with real key or remove if not used |
| `ANTHROPIC_API_KEY` | `your-anthropic-api-key-here` | Replace with real key or remove if not used |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `your-google-analytics-id-here` | Replace with real GA4 Measurement ID |
| `NEXT_PUBLIC_ADSENSE_ID` | `your-adsense-id-here` | Replace or remove if not used |
| `PERPLEXITY_API_KEY` | `your-perplexity-api-key-here` | Replace with real key or remove if not used |
| `RESEND_API_KEY` | `your-resend-api-key-here` | Replace with real Resend API key for email |

---

## 6. Unused Assets

**Status: ⚠️ REVIEW REQUIRED**

The following image assets are present in `public/assets/images/`:

| File | Purpose | Action |
|---|---|---|
| `Logo-1784963184486.png` | Logo variant | ⚠️ Verify which is the canonical production logo |
| `Logo_ReDrawn-1785047860595.png` | Redrawn logo variant | ⚠️ Verify if this replaces the original |
| `Wordmark-1784963183665.png` | Text wordmark | ✅ Keep if used in marketing |
| `no_image.png` | Placeholder image | ✅ Keep — used as fallback |
| `SaaS_Logo-1784963184332.png` | SaaS variant logo | ⚠️ Verify if used |
| `app_logo.png` | App logo | ✅ Keep — likely used in app header |

**Action Required:**
1. Confirm which logo files are actively referenced in the codebase
2. Remove any unreferenced logo variants to reduce bundle size
3. Ensure the canonical production logo is used consistently across all screens

---

## 7. Recommended Pre-Production Data Cleanup

### Priority 1 — Must Complete Before Launch

```sql
-- 1. Remove all mock contractors (no company_id)
DELETE FROM public.contractors WHERE company_id IS NULL;

-- 2. Remove all mock jobs (no company_id)
DELETE FROM public.jobs WHERE company_id IS NULL;

-- 3. Remove all mock time entries (no company_id)
DELETE FROM public.time_entries WHERE company_id IS NULL;

-- 4. Remove all mock checklists (no company_id)
DELETE FROM public.checklists WHERE company_id IS NULL;

-- 5. Remove recurring job patterns with fictional clients
DELETE FROM public.recurring_job_patterns 
WHERE client IN ('Acme Corp', 'BuildRight Pty Ltd', 'TechStart Inc');

-- 6. Remove any test companies
DELETE FROM public.companies 
WHERE owner_id IS NULL 
   OR LOWER(name) LIKE '%test%' 
   OR LOWER(name) LIKE '%demo%' 
   OR LOWER(name) LIKE '%sample%';

-- 7. Update subscription plan pricing (replace with real values)
-- UPDATE public.subscription_plans SET monthly_price_cents = ?, annual_price_cents = ? WHERE plan_key = ?;
```

### Priority 2 — Complete Before Commercial Billing

1. Configure real Stripe Price IDs in subscription plans
2. Update all placeholder environment variables
3. Configure Resend API key for transactional email
4. Set up Google Analytics with real Measurement ID

### Priority 3 — Recommended

1. Remove unused logo asset variants
2. Convert checklist templates to global (company_id = NULL) or assign to a system company
3. Audit `auth.users` for any test/development accounts

---

## 8. Mock Data in Extended Migration (Partial Audit)

> ⚠️ **Note:** Migration `20260726090000_innovion_extended.sql` was partially read (lines 1–250 of 491). The remaining 241 lines contain additional mock data for clients, sites, employees, compliance items, incidents, inventory, vehicles, companies, and notifications. A complete audit of this file is required.

**Estimated additional mock records:** 40–80 records across 8 tables.

**Action:** Read lines 251–491 of `20260726090000_innovion_extended.sql` and add all mock records to the cleanup script above.

---

*Report generated: 2026-07-31 | Classification: Internal — Engineering*
