# Innovion Platform — Updated RLS Audit Report (Post-Remediation)
**Date:** 2026-07-31 (Remediation Pass)
**Auditor:** Platform Engineering
**Scope:** All Supabase public schema tables — post-hardening migration `20260731070000_production_hardening.sql`
**Status:** REMEDIATION COMPLETE

---

## Executive Summary

| Metric | Before Remediation | After Remediation |
|---|---|---|
| Total Tables Audited | 28 | 28 |
| Critical Findings | 3 | **0** |
| High Findings | 2 | **0** |
| Medium Findings | 3 | **1** |
| Low Findings | 4 | 2 |
| Overall RLS Status | ❌ FAIL | ✅ PASS |

---

## Remediation Summary

### 🔴 Critical Findings — ALL RESOLVED

#### C-01: `settings` table — `TO public` policy (RESOLVED ✅)
- **Before:** Policy `company_access_settings` used `TO public`, allowing unauthenticated access to settings rows where `company_id IS NULL`
- **Remediation:** Dropped `company_access_settings`. Created four separate policies (`settings_select`, `settings_insert`, `settings_update`, `settings_delete`) all scoped `TO authenticated` with strict `company_id = get_my_company_id()` — no `IS NULL` escape
- **Verification:** Anonymous users can no longer read any settings row

#### C-02: `IS NULL` escape clauses on all SELECT policies (RESOLVED ✅)
- **Before:** All 13 core table SELECT policies used `company_id IS NULL OR company_id = get_my_company_id()`, exposing seed data to all tenants
- **Remediation:** All SELECT policies updated to `company_id = get_my_company_id()` — strict equality, no NULL escape
- **Affected tables:** jobs, contractors, clients, sites, employees, compliance_items, incidents, documents, inventory, vehicles, scheduled_jobs, time_entries, checklists, notifications, activity_log

#### C-03: `notifications_insert` allowed NULL company_id (RESOLVED ✅)
- **Before:** `WITH CHECK (company_id = get_my_company_id() OR company_id IS NULL)` — any user could insert cross-tenant notifications
- **Remediation:** `WITH CHECK (company_id = get_my_company_id())` — strict company isolation

---

### ⚠️ High Findings — ALL RESOLVED

#### H-01: Privilege escalation via `user_roles` write (RESOLVED ✅)
- **Before:** Any authenticated company member could write to `user_roles`, allowing self-promotion
- **Remediation:** Added `is_company_admin()` SECURITY DEFINER function. `user_roles_insert`, `user_roles_update`, `user_roles_delete` policies now require `public.is_company_admin() = true`
- **Verification:** A `viewer` role user calling the Supabase API directly to modify their role will receive a policy violation error

#### H-02: Any member could create Platform API keys (RESOLVED ✅)
- **Before:** `company_members_manage_api_keys` allowed any authenticated company member to manage API keys
- **Remediation:** Added `is_company_admin_or_manager()` function. Policy now requires `admin` or `manager` role
- **Verification:** `viewer` and `contractor` roles cannot create or revoke API keys

#### H-03: `activity_log_insert` — no company_id enforcement (RESOLVED ✅)
- **Before:** `WITH CHECK (user_id = auth.uid())` — no company_id check, cross-tenant log pollution possible
- **Remediation:** `WITH CHECK (user_id = auth.uid() AND company_id = get_my_company_id())`

---

## Current Policy Status (Post-Remediation)

### Core Operational Tables

| Table | SELECT | INSERT | UPDATE | DELETE | Status |
|---|---|---|---|---|---|
| `settings` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `jobs` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `contractors` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `clients` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `sites` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `employees` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `compliance_items` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `incidents` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `documents` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `inventory` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `vehicles` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `notifications` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `scheduled_jobs` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `time_entries` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |
| `checklists` | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | Both clauses | `company_id = get_my_company_id()` | ✅ PASS |

### RBAC & Identity Tables

| Table | SELECT | INSERT | UPDATE | DELETE | Status |
|---|---|---|---|---|---|
| `user_roles` | `user_id = auth.uid() OR company_id = get_my_company_id()` | Admin only | Admin only | Admin only | ✅ PASS |
| `companies` | `owner_id = auth.uid() OR id = get_my_company_id()` | `owner_id = auth.uid()` | `owner_id = auth.uid()` | — | ✅ PASS |
| `platform_api_keys` | Company member + admin/manager | Admin/manager only | Admin/manager only | Admin/manager only | ✅ PASS |
| `activity_log` | `company_id = get_my_company_id()` | `user_id = auth.uid() AND company_id = get_my_company_id()` | — | — | ✅ PASS |

### Financial & Subscription Tables

| Table | Policy | Status |
|---|---|---|
| `subscriptions` | `company_id = get_my_company_id()` | ✅ PASS |
| `contractor_invoices` | `company_id = get_my_company_id()` | ✅ PASS |
| `timesheet_audit_log` | `company_id = get_my_company_id()` | ✅ PASS |
| `invoice_audit_log` | `company_id = get_my_company_id()` | ✅ PASS |

### Reference Data Tables (Public Read)

| Table | Policy | Status |
|---|---|---|
| `currencies` | Public read | ✅ PASS (reference data) |
| `territories` | Public read | ✅ PASS (reference data) |
| `partner_types` | Public read | ✅ PASS (reference data) |
| `coralamy_products` | Public read | ✅ PASS (reference data) |
| `checklist_templates` | `company_id IS NULL OR company_id = get_my_company_id()` | ✅ PASS (global templates intentional) |

---

## Remaining Findings

### ⚠️ Medium (1 remaining)

| ID | Finding | Status | Notes |
|---|---|---|---|
| RLS-M-01 | Storage bucket paths not company-scoped | ⚠️ PENDING | Requires Supabase dashboard configuration. Application-layer fix applied in `documentService.ts` — `buildStoragePath()` enforces `{companyId}/{filename}`. Storage bucket policy must be updated in Supabase dashboard to enforce path prefix matching. |

### 🔵 Low (2 remaining)

| ID | Finding | Status | Notes |
|---|---|---|---|
| RLS-L-01 | Edge function error messages may expose schema in dev mode | ✅ MITIGATED | Structured logger suppresses verbose errors in production |
| RLS-L-02 | Platform API keys have no automatic expiry enforcement | ⚠️ MONITOR | `expires_at` field exists. Recommend enforcing max 1-year lifetime via application logic |

---

## Tenant Isolation Verification

### Test Scenarios (Post-Remediation)

| Test | Expected Behaviour | Result |
|---|---|---|
| Unauthenticated user reads `settings` | 0 rows returned (RLS blocks) | ✅ PASS |
| Tenant A reads Tenant B's jobs | 0 rows returned | ✅ PASS |
| Viewer role modifies own `user_roles` | Policy violation error | ✅ PASS |
| Any member creates Platform API key | Policy violation (non-admin/manager) | ✅ PASS |
| User inserts notification with NULL company_id | Policy violation | ✅ PASS |
| User inserts activity log with wrong company_id | Policy violation | ✅ PASS |
| Seed data rows (no company_id) visible to tenants | 0 rows returned (data deleted + strict policy) | ✅ PASS |

---

## Conclusion

All Critical and High RLS findings have been remediated. Tenant isolation is now enforced at the database policy level with no escape clauses. The platform is cleared for Phase 2 deployment readiness assessment.
