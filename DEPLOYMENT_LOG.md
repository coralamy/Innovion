# Production Deployment Log — A/B/D Migration Chain

Chronological record of the actual deployment. Entries are appended as steps
complete. Times are UTC.

---

## Gate results

| Gate | Verdict | Evidence |
| --- | --- | --- |
| A1 ledger absent | CLEAR | `2_1_ledger_exists = 0` |
| A2 baseline unchanged | CLEAR | company_access 13 · views 4/4 · secdef 21/18 — all six match |
| A3 FK unchanged | CLEAR | `NO ACTION` |
| A4 orphan role grants | CLEAR | 0 |
| A5 ledger creation proven | CLEAR | CLI 2.115.0 rehearsal, runbook §8 |
| A6 backup freshness | **WAIVED** | see below |
| A7 Team B/D hash drift | CLEAR | no drift, 18/18 files match `VERIFIED_AGAINST` |
| A8 staged file count | CLEAR | 56/56, 56 distinct versions, 0 differ from source |
| A9 `--include-all` | enforced by `deploy.ps1` at §4 | |

---

## A6 WAIVER — recorded 2026-08-18

**Waived by:** Founder, explicitly, on the record.

**Stated grounds:** "Production holds no material business data."

**Restore point of record:** scheduled backup completed **2026-08-18 16:01:21 UTC**.

**Corroborating measurement.** §2 against production returned
`ref_companies_total = 1`, `ref_role_grants = 0`, `ref_jobs = 0`. The §5 restore
verification independently returned `companies 1`, `jobs 0`. A6 exists so that a
rollback loses little data between the restore point and the deployment; with no
role grants and no jobs there is nothing material to lose and no write traffic to
create a gap.

**Why the waiver was needed rather than a fresh backup.** Three backups aged past
the 60-minute window in succession while an unrelated connectivity fault was
diagnosed — the direct-connection hostname
`db.hdncgxmanqsixhkxdlml.supabase.co` publishes an AAAA record only and the
deploying machine has no routable IPv6 address. Each new backup aged out during
that diagnosis. The waiver ends the cycle; it does not paper over an unknown.

**What the waiver does NOT cover.** The 16:01:21 backup remains the only restore
point. Rollback under runbook §9 restores to that instant. Any production write
after 16:01:21 UTC is outside coverage. Nothing else in §2 or §5 is affected, and
no other abort condition is relaxed.

**Residual risk accepted:** loss of any data written after 16:01:21 UTC in the
event of a §9 restore. Assessed as negligible on measured volumes.

---

## Runbook §3.0 — deployment directory assembled

**Completed** before §3.

    C:\Users\gamya\innovion-deploy-stage\supabase\migrations\

| Check | Result |
| --- | --- |
| Team A / B / D files | 38 + 14 + 4 = **56** |
| A8 file count | 56/56 — CLEAR |
| Distinct version prefixes | 56 — no duplicates |
| Byte-for-byte vs source | 0 files differ |
| A7 hash drift | none — 18/18 match |
| Integration suites | security 121 · schema ok · app 72 · controls ok · workforce 123 · integration 141 · replay 47 — 0 failures |

`config.toml` written with a placeholder `project_id`; the deployment uses
`--db-url` and does not rely on it.

---

## Connectivity fault and correction

The runbook §3 instruction to use the **direct connection** on port 5432 cannot be
followed from this machine.

| Finding | |
| --- | --- |
| `db.hdncgxmanqsixhkxdlml.supabase.co` | AAAA only — `2406:da14:25a:5800:…`; no A record |
| Deploying machine | no routable IPv6 on any interface |
| Project health | alive — REST host answers HTTP 401 |
| `aws-0-ap-southeast-2.pooler.supabase.com` | A records present; TCP 5432 reachable |

**Correction:** use the **session pooler** on port 5432 (`postgres.<ref>` username
form). Session mode supports the transactions, advisory locks and DDL migrations
require. Port 6543 is transaction mode and cannot run migrations — `deploy.ps1`
rejects it.

The runbook is to be amended to record this.

---

## §3 — ledger baseline: COMPLETE

`supabase migration repair --status applied` × 29, one command, via the session
pooler. `supabase_migrations.schema_migrations` **did not exist and was created
by the repair** — the A5 behaviour rehearsed locally, confirmed on production.

**Ledger 0 → 29.** Verified by direct query, not by exit status: PowerShell wrapped
the CLI's stderr progress as a `NativeCommandError`, so the exit code was
misleading.

§2 was re-run live immediately before, and all eight gated values still matched.

---

## §4 — push: COMPLETE, after one failure and a repair

### First attempt — FAILED part-way

6 of 27 applied, ledger 29 → 35, then Team B's `20260817000003` aborted:

    ERROR: column "company_id" does not exist (SQLSTATE 42703)   at statement 97

It indexes `(company_id, idempotency_key)` on four tables. `public.issue_reports`
had no `company_id`. No data lost — the migration ran in its own transaction and
rolled back. The two data-touching migrations had not yet run.

**Cause.** Team B's `20260727000006` is recorded as applied and its function is
present, but its `ALTER TABLE` statements did not all run: the migration was
hand-applied before a ledger existed and landed **partially**. The baseline
treated partial application as full, so every prior rehearsal modelled a database
that does not exist.

### A live P0 found while investigating

`issue_reports_company_isolation` depends on the missing column, so production had
neither. The table was governed by `authenticated_read_issue_reports USING (true)`
and `authenticated_insert_issue_reports WITH CHECK (true)` — **every authenticated
principal could read every issue report across all tenants**, including
photographs, voice notes and GPS coordinates. Negligible at one tenant and zero
role grants; a live cross-tenant leak on the second tenant.

### Gap scan

Read-only column-by-column diff of production against a locally built replica of
the exact 35 recorded migrations: **0 missing tables, 1 missing column, 0 missing
enum values**, and of the 21 remaining migrations only `20260817000003` referenced
it. (33 "missing" functions were pgcrypto/uuid-ossp in the `extensions` schema —
verified callable, a harness artifact.)

### Repair

`20260816130000_issue_reports_company_id_repair` — adds the column, backfills from
the owning job then the sole tenant, RAISES rather than guessing, creates the
index, and restores the isolation policy verbatim from Team B's own migration.
Guarded on Team B being present so Team A remains deployable alone. Team B source
untouched.

Rehearsed against production's **exact** post-failure state — 35 migrations, the
drift, the missing column, the missing policy, the two open policies, 4 orphan
rows, 1 company, 0 jobs. A control first reproduced the production failure; then
the repair and all 22 remaining migrations applied, 0 aborted. **23 of 23.**

### Second attempt — SUCCEEDED

All 22 applied. **Ledger 35 → 57.**

---

## §10 — post-deployment verification: PASS

| Check | Expected | Actual | |
| --- | --- | --- | --- |
| `applied_total` | 57 | **57** | PASS |
| `company_access_remaining` | 0 | **0** | PASS |
| `views_bypassing_rls` | 0 | **0** | PASS |
| `secdef_unpinned` | 0 | **0** | PASS |
| `tables_without_rls` | 0 | **0** | PASS |
| `fk_on_delete` | CASCADE | **CASCADE** | PASS |
| `refresh_triggers` | 2 | **2** | PASS |

`projected_tenants = directory_tenants = 1` — the A→D projection is live.

### Data preserved

| | before (§2) | after (§10) |
| --- | --- | --- |
| companies | 1 | **1** |
| ownerless companies | 0 | **0** |
| role grants | 0 | **0** |
| jobs | 0 | **0** |
| tenant-less documents | 6 | **0** — purged by `20260817003500`, as designed |
| tenant-less settings | 1 | **0** — purged, as designed |

No commercial data was destroyed. The only rows removed were the 7 tenant-less
mock seed rows the purge migration exists to remove.

`issue_reports`: 4 rows, **all 4 now carrying a tenant**, governed by

    issue_reports_tenant_access   ALL  PERMISSIVE   company_id = get_my_company_id()
    issue_reports_tenant_guard    ALL  RESTRICTIVE  company_id IS NOT NULL AND company_id = get_my_company_id()
    reporter_update_issue_reports UPDATE PERMISSIVE reporter_user_id = auth.uid()

The `USING (true)` policies are gone.

---

## Outstanding

1. **Rotate the database password.** It was exposed in this session: `deploy.ps1`
   echoed its full command line including `--db-url`. Team A's error. The script
   now redacts it. Dashboard → Project Settings → Database → Reset database
   password.
2. **Delete the credential file:** `Remove-Item C:Usersgamyainnovion-deploy-stage.dburl`
3. **Application smoke test.** Not performed: production has 0 role grants and 0
   jobs, so there is no principal to sign in as. The remediated policies will
   first meet a real GoTrue token when a user onboards. Watch that closely.
4. **Team B follow-up:** `20260817000003` should guard on the column, not just the
   table. Their `20260727000006` is recorded as applied but landed partially —
   worth checking whether other objects from it are missing beyond the one found.
