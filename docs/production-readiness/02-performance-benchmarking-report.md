# Innovion Platform — Performance Benchmarking Report
**Date:** 2026-07-31  
**Environment:** Pre-Production (Supabase hosted, Next.js on GoDaddy VPS)  
**Methodology:** Static analysis of query patterns, component architecture, and service layer design. Baseline targets established for production validation.

---

## Executive Summary

Performance benchmarking has been conducted through static analysis of the codebase, database schema, query patterns, and component architecture. Live load testing requires a production environment with real data volumes. This report establishes:

1. **Baseline performance targets** for each key flow
2. **Identified optimisation opportunities** from code analysis
3. **Recommended monitoring thresholds** for production

---

## 1. Performance Targets (Production Baseline)

| Flow | Target P50 | Target P95 | Target P99 | Method |
|---|---|---|---|---|
| Login (email/password) | < 400ms | < 800ms | < 1,200ms | Supabase Auth |
| Dashboard load (initial) | < 1,200ms | < 2,000ms | < 3,000ms | Parallel API calls |
| Dashboard load (cached) | < 300ms | < 600ms | < 1,000ms | Client cache |
| Search (jobs/contractors) | < 200ms | < 500ms | < 800ms | DB indexed query |
| Checklist load | < 300ms | < 600ms | < 1,000ms | Single table query |
| Photo upload (< 5MB) | < 2,000ms | < 4,000ms | < 6,000ms | Supabase Storage |
| Scheduling view load | < 500ms | < 1,000ms | < 1,500ms | Date-filtered query |
| Reports generation | < 1,500ms | < 3,000ms | < 5,000ms | Aggregation queries |
| Inventory load | < 300ms | < 600ms | < 1,000ms | Single table query |
| Time entry submission | < 300ms | < 600ms | < 1,000ms | Single row insert |
| General API response | < 200ms | < 400ms | < 700ms | Next.js API routes |

---

## 2. Flow-by-Flow Analysis

### 2.1 Login

**Current Implementation:**
- Supabase `signInWithPassword()` via `AuthContext`
- Auth callback at `/auth/callback/route.ts` with try/catch hardening
- JWT stored in Supabase session cookie

**Identified Issues:**
- ⚠️ No login rate limiting at the application layer (Supabase has built-in limits, but no custom throttle)
- ⚠️ `auth/callback/route.ts` performs a redirect after code exchange — ensure redirect validation does not add latency

**Optimisation Opportunities:**
- Consider pre-fetching company configuration immediately after login to warm the cache
- Implement optimistic navigation to dashboard while session is being established

**Estimated Baseline:** 350–600ms (Supabase Auth + redirect)

---

### 2.2 Dashboard Load

**Current Implementation:**
- `DashboardMetrics` component fetches from multiple Supabase tables in parallel
- `ActivityFeed`, `UpcomingJobs`, `DashboardCharts`, `WeeklyJobsChart`, `RevenueByServiceChart` are separate components
- `ComplianceAlertBanner` makes an additional query

**Identified Issues:**
- 🔴 **HIGH IMPACT** — Dashboard makes 6–8 independent Supabase queries on mount with no query batching or server-side aggregation. Each query incurs a separate round-trip.
- ⚠️ No `React.Suspense` boundaries — all components block on their slowest sibling
- ⚠️ `DashboardCharts` and `WeeklyJobsChart` both query `jobs` table independently — duplicate queries

**Optimisation Opportunities:**
1. Create a single `/api/dashboard/summary` endpoint that runs all dashboard queries server-side and returns a single JSON payload
2. Add `React.Suspense` with skeleton loaders for each dashboard widget
3. Deduplicate `jobs` queries — share a single data fetch between chart components
4. Add `stale-while-revalidate` caching headers to dashboard API

**Estimated Baseline:** 1,200–2,500ms (6–8 parallel queries, no batching)  
**Post-Optimisation Target:** 400–800ms (single batched server query)

---

### 2.3 Search

**Current Implementation:**
- Client-side filtering on already-loaded data arrays in most modules
- No full-text search index (e.g., `pg_trgm`) in migrations

**Identified Issues:**
- ⚠️ Search operates on client-side data — works for small datasets but will degrade as data grows
- ⚠️ No `ilike` or `fts` indexes on searchable columns (`name`, `title`, `email`)

**Optimisation Opportunities:**
1. Add `pg_trgm` GIN indexes on high-frequency search columns:
   ```sql
   CREATE INDEX idx_contractors_name_trgm ON public.contractors USING GIN (name gin_trgm_ops);
   CREATE INDEX idx_jobs_title_trgm ON public.jobs USING GIN (title gin_trgm_ops);
   CREATE INDEX idx_clients_name_trgm ON public.clients USING GIN (name gin_trgm_ops);
   ```
2. Implement server-side search with debounced API calls for large datasets

**Estimated Baseline:** < 50ms (client-side, small dataset)  
**At Scale (10k+ records):** Requires server-side search

---

### 2.4 Checklist Loading

**Current Implementation:**
- Single `SELECT * FROM checklists WHERE company_id = ?` query
- `sections` stored as JSONB — parsed client-side

**Identified Issues:**
- ⚠️ `sections` JSONB column can be large (full checklist with photos) — consider lazy-loading photo data
- No pagination on checklist list view

**Optimisation Opportunities:**
1. Add pagination (limit 25 per page) to checklist list queries
2. Exclude `sections` JSONB from list queries — load only on detail view

**Estimated Baseline:** 200–400ms

---

### 2.5 Photo Uploads

**Current Implementation:**
- Supabase Storage (`documents` bucket, 50MB limit)
- Upload via `supabase.storage.from('documents').upload()`

**Identified Issues:**
- ⚠️ No client-side image compression before upload
- ⚠️ No upload progress indicator in UI
- ⚠️ Storage policies do not enforce company folder isolation (see RLS Audit H-02)

**Optimisation Opportunities:**
1. Compress images client-side to < 1MB before upload using `canvas` API
2. Add upload progress tracking with `onUploadProgress` callback
3. Implement CDN caching for frequently accessed documents

**Estimated Baseline:** 1,500–4,000ms (depending on file size and connection)

---

### 2.6 Scheduling

**Current Implementation:**
- `WeekViewCalendar` component loads `scheduled_jobs` filtered by date range
- `SchedulingModule` manages state for the week view

**Identified Issues:**
- ⚠️ No index on `(company_id, scheduled_date)` composite — queries scan by `company_id` then filter by date
- ⚠️ Conflict detection trigger runs on every INSERT/UPDATE — adds latency to scheduling operations

**Optimisation Opportunities:**
1. Add composite index: `CREATE INDEX idx_scheduled_jobs_company_date ON public.scheduled_jobs(company_id, scheduled_date);`
2. Consider async conflict detection (background job) for non-blocking UX

**Estimated Baseline:** 400–800ms

---

### 2.7 Reports

**Current Implementation:**
- Reports page aggregates data from multiple tables
- No pre-computed aggregation tables or materialised views

**Identified Issues:**
- 🔴 **HIGH IMPACT** — Reports run live aggregation queries on large tables without materialised views
- ⚠️ No caching of report results

**Optimisation Opportunities:**
1. Implement materialised views for common report aggregations (monthly revenue, job counts by status)
2. Cache report results for 5 minutes using Next.js `unstable_cache` or Redis
3. Add date range indexes: `CREATE INDEX idx_jobs_scheduled_date ON public.jobs(company_id, scheduled_date);`

**Estimated Baseline:** 1,000–3,000ms (live aggregation)  
**Post-Optimisation Target:** 200–500ms (cached/materialised)

---

### 2.8 Inventory

**Current Implementation:**
- Single table query with company isolation
- Client-side filtering and sorting

**Identified Issues:**
- ⚠️ No index on `inv_status` + `company_id` composite for status-filtered views

**Optimisation Opportunities:**
1. Add composite index: `CREATE INDEX idx_inventory_company_status ON public.inventory(company_id, inv_status);`

**Estimated Baseline:** 200–400ms

---

### 2.9 Time Entry

**Current Implementation:**
- Single row INSERT to `time_entries`
- Approval workflow triggers `timesheet_audit_log` INSERT

**Identified Issues:**
- ⚠️ No optimistic UI updates — user waits for server confirmation before UI updates

**Optimisation Opportunities:**
1. Implement optimistic updates with rollback on error

**Estimated Baseline:** 200–400ms

---

### 2.10 General API Response Times

**Current Implementation:**
- Next.js API routes at `/api/platform/*`
- Supabase server client created per-request

**Identified Issues:**
- ⚠️ Supabase server client is instantiated on every API request — no connection pooling at the application layer
- ⚠️ Platform Configuration Service assembles 17 domains in parallel but has no result caching

**Optimisation Opportunities:**
1. Add `Cache-Control: s-maxage=60, stale-while-revalidate=300` to Platform Configuration API responses
2. Implement in-memory LRU cache for Platform Configuration (TTL: 5 minutes)
3. Use Supabase connection pooling (PgBouncer) for high-concurrency scenarios

**Estimated Baseline:** 150–350ms (simple queries), 500–1,200ms (Platform Config assembly)

---

## 3. Database Index Audit

### Existing Indexes (from migrations)

| Table | Index | Type | Status |
|---|---|---|---|
| contractors | `idx_contractors_availability` | B-tree | ✅ |
| contractors | `idx_contractors_compliance` | B-tree | ✅ |
| contractors | `idx_contractors_company_id` | B-tree | ✅ |
| jobs | `idx_jobs_status` | B-tree | ✅ |
| jobs | `idx_jobs_priority` | B-tree | ✅ |
| jobs | `idx_jobs_company_id` | B-tree | ✅ |
| time_entries | `idx_time_entries_date` | B-tree | ✅ |
| time_entries | `idx_time_entries_status` | B-tree | ✅ |
| time_entries | `idx_time_entries_company_id` | B-tree | ✅ |
| checklists | `idx_checklists_status` | B-tree | ✅ |
| checklists | `idx_checklists_type` | B-tree | ✅ |
| scheduled_jobs | `idx_scheduled_jobs_company` | B-tree | ✅ |
| scheduled_jobs | `idx_scheduled_jobs_date` | B-tree | ✅ |
| activity_log | `idx_activity_log_company` | B-tree | ✅ |
| activity_log | `idx_activity_log_created` | B-tree DESC | ✅ |
| platform_api_keys | `idx_platform_api_keys_key_hash` | B-tree | ✅ |

### Missing Indexes (Recommended)

| Table | Recommended Index | Reason |
|---|---|---|
| jobs | `(company_id, scheduled_date)` | Date-range scheduling queries |
| jobs | `(company_id, job_status)` | Status-filtered dashboard queries |
| contractors | `name gin_trgm_ops` | Full-text search |
| clients | `name gin_trgm_ops` | Full-text search |
| compliance_items | `(company_id, comp_status)` | Compliance dashboard |
| inventory | `(company_id, inv_status)` | Stock level queries |
| notifications | `(company_id, is_read, created_at)` | Unread notification count |

---

## 4. Frontend Performance Analysis

### Bundle Size Concerns
- `recharts` library (~500KB) loaded on dashboard — consider lazy loading
- No code splitting observed for heavy modules (scheduling, reports)

### Rendering Performance
- `WeekViewCalendar` renders 7 days × N jobs — no virtualisation for large job counts
- `ActivityFeed` renders all activity items — no pagination/virtualisation

### Recommended Frontend Optimisations
1. Lazy-load `recharts` with `dynamic(() => import('recharts'), { ssr: false })`
2. Add `React.memo` to calendar day cells
3. Implement virtual scrolling for activity feed and job lists > 50 items
4. Add skeleton loading states to all data-fetching components

---

## 5. Production Monitoring Thresholds

| Metric | Warning | Critical | Action |
|---|---|---|---|
| API P95 response time | > 1,000ms | > 3,000ms | Investigate query performance |
| Dashboard load time | > 2,000ms | > 5,000ms | Check parallel query count |
| Database connection count | > 80% pool | > 95% pool | Scale or add PgBouncer |
| Storage upload failure rate | > 1% | > 5% | Check bucket policies |
| Auth failure rate | > 5% | > 20% | Check for brute force |
| Error rate (5xx) | > 0.5% | > 2% | Immediate investigation |

---

*Report generated: 2026-07-31 | Classification: Internal — Engineering*
