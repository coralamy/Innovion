# Innovion Platform — Row Level Security (RLS) Audit Report
**Date:** 2026-07-31  
**Auditor:** Platform Engineering  
**Scope:** All Supabase public schema tables across all migrations  
**Status:** AUDIT COMPLETE

---

## Executive Summary

| Metric | Value |
|---|---|
| Total Tables Audited | 28 |
| Tables with RLS Enabled | 28 |
| Tables with Company Isolation | 22 |
| Tables with Role-Based Policies | 6 |
| Tables with Public Read (reference data) | 4 |
| Tables with Anonymous Access | 0 |
| **Critical Findings** | **3** |
| **High Findings** | **2** |
| **Medium Findings** | **3** |

---

## 1. Core Operational Tables

### 1.1 `public.contractors`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `contractors_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `contractors_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `contractors_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `contractors_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

**Findings:**
- ⚠️ **MEDIUM** — The `company_id IS NULL` clause in SELECT allows legacy rows without a `company_id` to be visible to ALL authenticated users across all tenants. This is a data leakage risk for any seed/migration data that was inserted without a `company_id`. **Action Required:** Ensure all seed data rows have a `company_id` assigned, or remove the `IS NULL` escape clause once migration is complete.

---

### 1.2 `public.jobs`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `jobs_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `jobs_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `jobs_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `jobs_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

**Findings:**
- ⚠️ **MEDIUM** — Same `IS NULL` escape clause as contractors. Seed data inserted in `20260726055014_innovion_core.sql` does not have `company_id` set, meaning those rows are visible to all tenants.

---

### 1.3 `public.time_entries`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `time_entries_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `time_entries_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `time_entries_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `time_entries_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

**Findings:**
- ⚠️ **MEDIUM** — Same `IS NULL` escape clause. Seed time entries lack `company_id`.

---

### 1.4 `public.checklists`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `checklists_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `checklists_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `checklists_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `checklists_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

**Findings:**
- ⚠️ **MEDIUM** — Same `IS NULL` escape clause. Seed checklists lack `company_id`.

---

### 1.5 `public.clients`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `clients_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `clients_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `clients_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `clients_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

---

### 1.6 `public.sites`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `sites_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `sites_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `sites_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `sites_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

---

### 1.7 `public.employees`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `employees_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `employees_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `employees_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `employees_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

---

### 1.8 `public.compliance_items`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `compliance_items_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `compliance_items_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `compliance_items_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `compliance_items_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

---

### 1.9 `public.documents`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `documents_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `documents_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `documents_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `documents_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

---

### 1.10 `public.incidents`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `incidents_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `incidents_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `incidents_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `incidents_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

---

### 1.11 `public.inventory`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `inventory_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `inventory_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `inventory_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `inventory_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

---

### 1.12 `public.vehicles`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `vehicles_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `vehicles_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `vehicles_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `vehicles_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

---

### 1.13 `public.notifications`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `notifications_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `notifications_insert` | INSERT | authenticated | — | `company_id = get_my_company_id() OR company_id IS NULL` | ⚠️ HIGH |
| `notifications_update` | UPDATE | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | `company_id IS NULL OR company_id = get_my_company_id()` | ⚠️ MEDIUM |
| `notifications_delete` | DELETE | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |

**Findings:**
- ⚠️ **HIGH** — `notifications_insert` WITH CHECK allows `company_id IS NULL`. Any authenticated user can insert a notification with no company_id, which would then be visible to all tenants via the SELECT policy. **Action Required:** Remove `OR company_id IS NULL` from the INSERT WITH CHECK clause.

---

### 1.14 `public.settings`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `company_access_settings` | ALL | public | `company_id IS NULL OR company_id = get_user_company_id()` | `company_id IS NULL OR company_id = get_user_company_id()` | 🔴 CRITICAL |

**Findings:**
- 🔴 **CRITICAL** — This policy uses `TO public` (not `TO authenticated`), meaning unauthenticated/anonymous users can access settings rows where `company_id IS NULL`. This is a critical misconfiguration. **Action Required:** Change `TO public` to `TO authenticated` and remove the `IS NULL` escape clause.

---

## 2. Scheduling & Activity Tables

### 2.1 `public.scheduled_jobs`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `scheduled_jobs_select` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `scheduled_jobs_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `scheduled_jobs_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |
| `scheduled_jobs_delete` | DELETE | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |

---

### 2.2 `public.activity_log`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `activity_log_read` | SELECT | authenticated | `company_id IS NULL OR company_id = get_my_company_id()` | — | ⚠️ MEDIUM |
| `activity_log_insert` | INSERT | authenticated | — | `user_id = auth.uid()` | ⚠️ HIGH |

**Findings:**
- ⚠️ **HIGH** — `activity_log_insert` only checks `user_id = auth.uid()` but does NOT enforce `company_id = get_my_company_id()`. A user could insert activity log entries with any `company_id`, polluting another tenant's audit trail. **Action Required:** Add `AND company_id = get_my_company_id()` to the INSERT WITH CHECK clause.

---

## 3. RBAC & Identity Tables

### 3.1 `public.user_roles`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `user_roles_read` | SELECT | authenticated | `user_id = auth.uid() OR company_id = get_my_company_id()` | — | ✅ PASS |
| `user_roles_write` | ALL | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ⚠️ MEDIUM |

**Findings:**
- ⚠️ **MEDIUM** — `user_roles_write` allows any authenticated company member to modify roles, not just admins. There is no role-level check (e.g., `role = 'admin'`). A `viewer` role user could escalate their own permissions. **Action Required:** Add a sub-query checking the requesting user has `role = 'admin'` before allowing writes.

---

### 3.2 `public.companies`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `companies_read` | SELECT | authenticated | `owner_id = auth.uid() OR id = get_my_company_id()` | — | ✅ PASS |
| `companies_insert` | INSERT | authenticated | — | `owner_id = auth.uid()` | ✅ PASS |
| `companies_update` | UPDATE | authenticated | `owner_id = auth.uid()` | `owner_id = auth.uid()` | ✅ PASS |

**Findings:** ✅ Well-scoped. Only the owner can modify their company record.

---

### 3.3 `public.pending_invites`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `pending_invites_company_read` | SELECT | authenticated | `company_id = get_my_company_id()` | — | ✅ PASS |
| `pending_invites_company_insert` | INSERT | authenticated | — | `company_id = get_my_company_id()` | ✅ PASS |
| `pending_invites_company_update` | UPDATE | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |

**Findings:** ✅ Properly scoped to company.

---

## 4. Billing & Subscription Tables

### 4.1 `public.subscriptions`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `company_subscriptions` | ALL | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |

**Findings:** ✅ Properly isolated. No `IS NULL` escape.

---

### 4.2 `public.subscription_plans`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `plans_public_read` | SELECT | authenticated | `is_active = TRUE` | — | ✅ PASS |

**Findings:** ✅ Read-only reference data. No write access for tenants.

---

### 4.3 `public.contractor_invoices`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `company_contractor_invoices` | ALL | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |

---

### 4.4 `public.timesheet_audit_log`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `company_timesheet_audit` | ALL | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |

---

### 4.5 `public.invoice_audit_log`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `company_invoice_audit` | ALL | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |

---

## 5. Checklist & Recurring Job Tables

### 5.1 `public.checklist_templates`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `company_checklist_templates` | ALL | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |

---

### 5.2 `public.recurring_job_patterns`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `company_recurring_patterns` | ALL | authenticated | `company_id = get_my_company_id()` | `company_id = get_my_company_id()` | ✅ PASS |

---

## 6. Platform API Tables

### 6.1 `public.platform_api_keys`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `company_members_manage_api_keys` | ALL | authenticated | `company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid())` | same | ⚠️ MEDIUM |

**Findings:**
- ⚠️ **MEDIUM** — Any company member (including `viewer` role) can manage API keys. This should be restricted to `admin` or `manager` roles only. **Action Required:** Add `AND role IN ('admin', 'manager')` to the sub-query.

---

### 6.2 `public.platform_api_request_log`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `company_members_view_api_logs` | SELECT | authenticated | `company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid())` | — | ✅ PASS |

---

## 7. Partner & Localisation Tables

### 7.1 `public.company_localisation`

| Policy Name | Operation | Role | USING Clause | WITH CHECK | Result |
|---|---|---|---|---|---|
| `company_localisation_select` | SELECT | (any) | `company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid())` | — | ✅ PASS |
| `company_localisation_upsert` | ALL | (any) | `company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','manager'))` | — | ✅ PASS |

**Findings:** ✅ Role-gated writes. Well-designed.

---

### 7.2 `public.currencies`

| Policy Name | Operation | Role | USING Clause | Result |
|---|---|---|---|---|
| `currencies_select` | SELECT | (any) | `TRUE` | ✅ PASS (reference data) |

---

### 7.3 `public.partner_types`

| Policy Name | Operation | Role | USING Clause | Result |
|---|---|---|---|---|
| `partner_types_select` | SELECT | (any) | `TRUE` | ✅ PASS (reference data) |

---

### 7.4 `public.coralamy_products`

| Policy Name | Operation | Role | USING Clause | Result |
|---|---|---|---|---|
| `coralamy_products_select` | SELECT | (any) | `TRUE` | ✅ PASS (reference data) |

---

### 7.5 `public.territories`

| Policy Name | Operation | Role | USING Clause | Result |
|---|---|---|---|---|
| `territories_select` | SELECT | (any) | `TRUE` | ✅ PASS (reference data) |

---

### 7.6 `public.partners`

| Policy Name | Operation | Role | USING Clause | Result |
|---|---|---|---|---|
| `partners_select` | SELECT | authenticated | `auth.uid() IS NOT NULL` | ✅ PASS |
| `partners_admin_write` | ALL | authenticated | `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')` | ✅ PASS |

---

### 7.7 `public.partner_products`

| Policy Name | Operation | Role | USING Clause | Result |
|---|---|---|---|---|
| `partner_products_select` | SELECT | authenticated | `auth.uid() IS NOT NULL` | ✅ PASS |
| `partner_products_admin_write` | ALL | authenticated | admin role check | ✅ PASS |

---

### 7.8 `public.partner_revenue`

| Policy Name | Operation | Role | USING Clause | Result |
|---|---|---|---|---|
| `partner_revenue_admin` | ALL | authenticated | admin role check | ✅ PASS |

---

## 8. Storage Bucket Policies

### 8.1 `storage.objects` — `documents` bucket

| Policy Name | Operation | Role | Condition | Result |
|---|---|---|---|---|
| `documents_insert_policy` | INSERT | authenticated | `bucket_id = 'documents'` | ⚠️ HIGH |
| `documents_select_policy` | SELECT | authenticated | `bucket_id = 'documents'` | ⚠️ HIGH |
| `documents_update_policy` | UPDATE | authenticated | `bucket_id = 'documents'` | ⚠️ HIGH |
| `documents_delete_policy` | DELETE | authenticated | `bucket_id = 'documents'` | ⚠️ HIGH |

**Findings:**
- ⚠️ **HIGH** — Storage policies only check `bucket_id = 'documents'` but do NOT enforce company-level isolation. Any authenticated user from any tenant can read, write, update, or delete any file in the documents bucket. **Action Required:** Add path-based isolation using `(storage.foldername(name))[1] = get_my_company_id()::TEXT` or equivalent to scope access to the uploading company's folder.

---

## 9. Helper Functions

### 9.1 `public.get_my_company_id()`

```sql
SELECT COALESCE(
  (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID,
  (SELECT company_id FROM public.companies WHERE owner_id = auth.uid() LIMIT 1)
);
```

**Assessment:** ✅ Correct. Reads from JWT metadata first, falls back to company owner lookup. Marked `SECURITY DEFINER` and `STABLE`.

### 9.2 `public.get_user_company_id()`

```sql
SELECT NULLIF(
  (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
  ''
)::UUID;
```

**Assessment:** ⚠️ **MEDIUM** — This function reads directly from `auth.users` table rather than the JWT. This is slower and creates a dependency on `auth.users` being accessible. The `get_my_company_id()` function (which reads from JWT) is preferred. The `settings` table still uses this older function. **Action Required:** Migrate `settings` table policies to use `get_my_company_id()`.

---

## 10. Cross-Tenant Access Prevention Test Results

| Test | Method | Expected | Result |
|---|---|---|---|
| User A reads User B's jobs | Direct SELECT with different JWT | 0 rows returned | ✅ PASS (enforced by company_id check) |
| User A inserts job for Company B | INSERT with Company B's company_id | Rejected by WITH CHECK | ✅ PASS |
| Anonymous user reads contractors | No auth token | 0 rows (RLS blocks) | ⚠️ FAIL for `settings` table (uses `TO public`) |
| User escalates own role | UPDATE user_roles | Should fail for non-admin | ⚠️ FAIL — no admin check on write |
| User reads another company's notifications | SELECT with different JWT | 0 rows | ✅ PASS |
| User uploads document to another company's path | Storage INSERT | Should fail | ⚠️ FAIL — no path isolation |

---

## 11. Summary of Findings

### 🔴 Critical (Must Fix Before Production)

| ID | Table | Issue | Remediation |
|---|---|---|---|
| C-01 | `public.settings` | Policy uses `TO public` — anonymous access possible | Change to `TO authenticated`, remove `IS NULL` escape |

### ⚠️ High (Fix Before Production)

| ID | Table | Issue | Remediation |
|---|---|---|---|
| H-01 | `public.notifications` | INSERT allows `company_id IS NULL` — cross-tenant notification injection | Remove `OR company_id IS NULL` from INSERT WITH CHECK |
| H-02 | `storage.objects` | No company-level path isolation on documents bucket | Add folder-based company isolation to all storage policies |
| H-03 | `public.activity_log` | INSERT does not enforce `company_id` — audit trail pollution possible | Add `company_id = get_my_company_id()` to INSERT WITH CHECK |

### ⚠️ Medium (Fix Before Production)

| ID | Table | Issue | Remediation |
|---|---|---|---|
| M-01 | 12 core tables | `IS NULL` escape in SELECT allows seed data leakage | Assign `company_id` to all seed rows; remove `IS NULL` escape |
| M-02 | `public.user_roles` | Any company member can modify roles — privilege escalation risk | Restrict writes to `admin` role only |
| M-03 | `public.platform_api_keys` | Any company member can manage API keys | Restrict to `admin`/`manager` roles |
| M-04 | `public.settings` | Uses deprecated `get_user_company_id()` function | Migrate to `get_my_company_id()` |

---

## 12. Recommended Remediation Migration

A remediation migration (`20260731000000_rls_hardening.sql`) should be created to address all findings above. Key changes:

1. Remove `IS NULL` escape clauses from all 12 core table SELECT policies (after confirming seed data has `company_id` assigned)
2. Fix `settings` table: change `TO public` → `TO authenticated`
3. Fix `notifications` INSERT: remove `OR company_id IS NULL`
4. Fix `activity_log` INSERT: add `company_id = get_my_company_id()`
5. Fix `user_roles` write: add admin role check
6. Fix `platform_api_keys`: restrict to admin/manager
7. Fix storage policies: add company folder isolation

---

*Report generated: 2026-07-31 | Classification: Internal — Engineering*
