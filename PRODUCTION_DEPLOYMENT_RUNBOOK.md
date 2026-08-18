# Production Deployment Runbook — A/B/D Migration Chain

**Status: APPROVED. Founder GO given 2026-08-18. Execution in progress — see `DEPLOYMENT_LOG.md`.**

All pre-deployment gates are resolved: A1–A5 and A7–A8 cleared by measurement,
**A6 waived by the Founder** on the record. §3 and §4 remain outstanding.

**A5 CLEARED.** The full runbook — baseline, push, verification — was executed end
to end by the real Supabase CLI 2.115.0 against a faithful replica of the live
baseline served over TCP. Evidence in §8. That rehearsal found two further
blockers, both fixed here: §3.0 (file consolidation) and `--include-all` in §4.
Execution then found a third: §3.-1 (the direct connection is IPv6-only).

Prepared 2026-08-19 · Team A, integration authority
Target: the live Innovion Supabase project
Chain: 56 migrations — 29 already applied, 27 to execute

---

## 0. Read this first

Production has **no application migration ledger**. `supabase_migrations` does not
exist; the three `schema_migrations` tables found belong to Supabase's own
GoTrue, Realtime and Storage services. The schema was applied by hand.

Therefore `supabase db push` **cannot be run directly**. It would create a fresh
ledger, conclude that nothing has been applied, and attempt all 56 migrations
against a database that already holds most of those objects. The early
migrations are not idempotent; it would fail partway and leave production in a
worse state than it is in now.

The chain must be **baselined** first — §3.

### Verification status

1. **§8 — ledger creation.** DONE. `migration repair` creates the schema and table.
   No disposable Supabase project was needed; see §8.
2. **§9 — data-bearing rehearsal.** DONE. Results in §7.

---

## 1. What is being deployed, and why it matters

Production is running the **pre-remediation schema**. Measured by read-only
inspection on 2026-08-18:

| Live reading | Meaning |
| --- | --- |
| 13 `company_access_*` policies | The null-tenant escape hatch is **open**. Cross-tenant read vector over jobs, clients, employees, documents, time entries. |
| 4 of 4 views bypass RLS | No view has `security_invoker`; each reads base tables as owner. |
| 18 of 21 SECURITY DEFINER functions unpinned | No `search_path` pinning. |
| Team B `20260817000001-3` absent | Workforce tenant-authority hardening absent. |
| Team A `20260817000000` absent | Tenant-authority remediation absent. |

Every P0 closed locally is still open in production. That is the reason to
deploy, and it does not justify deploying carelessly: a chain that aborts halfway
leaves production worse off than it is today.

---

## 2. Pre-deployment checks and abort conditions

Run all of these read-only. **Any ABORT condition means stop — do not proceed.**

```sql
-- 2.1 Ledger state. Expected: zero rows (no ledger yet).
SELECT count(*) AS ledger_rows
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'supabase_migrations' AND c.relname = 'schema_migrations';

-- 2.2 Baseline still matches what was inspected. Expected exactly:
--     company_access=13  views_total=4  views_unsafe=4
--     secdef_total=21    secdef_unpinned=18
SELECT
  (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND policyname LIKE 'company_access_%')          AS company_access,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v')                                AS views_total,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v'
      AND NOT COALESCE(c.reloptions,'{}') && ARRAY['security_invoker=true','security_invoker=on'])
                                                                               AS views_unsafe,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef)                                  AS secdef_total,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig,'{}')) cfg WHERE cfg LIKE 'search_path=%'))
                                                                               AS secdef_unpinned;

-- 2.3 The hand-added foreign key. Expected: NO ACTION.
SELECT conname,
       CASE confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'c' THEN 'CASCADE'
                        WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL'
                        WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
  FROM pg_constraint
 WHERE conrelid='public.user_roles'::regclass AND contype='f';

-- 2.4 Rows the deployment will touch. See §6.
SELECT
  (SELECT count(*) FROM public.companies WHERE owner_id IS NULL)               AS ownerless_companies,
  (SELECT count(*) FROM public.documents WHERE company_id IS NULL)             AS tenantless_documents,
  (SELECT count(*) FROM public.settings  WHERE company_id IS NULL)             AS tenantless_settings,
  (SELECT count(*) FROM public.user_roles ur
    WHERE ur.company_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ur.company_id))
                                                                               AS orphan_role_grants;
```

### Abort conditions

| # | Condition | Why |
| --- | --- | --- |
| A1 | 2.1 returns **1** (a ledger already exists) | Someone has run the CLI since inspection. The 29-item baseline is no longer safe; re-derive it. |
| A2 | Any 2.2 value differs from the expected figures | The schema has moved since inspection. The rehearsal no longer models production. Re-run §2 inspection and the rehearsal. |
| A3 | 2.3 returns `CASCADE` or no row | Someone changed the constraint. `20260818000700`'s behaviour is then untested against this state. |
| A4 | 2.4 `orphan_role_grants` > 0 | Impossible while the FK exists. If non-zero, the FK is gone — see A3. |
| A5 | ~~§8 ledger verification~~ | **CLEARED** — see §8. Retained for numbering. |
| A6 | No verified-restorable backup taken within the last hour | See §5. **WAIVED by the Founder 2026-08-18** — grounds and scope in `DEPLOYMENT_LOG.md`. |
| A7 | Team B or Team D tree hashes differ from `integration-manifest.mjs → VERIFIED_AGAINST` | You would be deploying migrations that were never integration-tested together. Run `npm run test:abd`. |
| A8 | §3.0 staged directory does not contain exactly 56 files | Migrations would be silently skipped or unexpected ones applied. |
| A9 | `db push` is run without `--include-all` | It will refuse; see §4. |

---

## 3.0 Assemble the deployment directory — MANDATORY FIRST STEP

**`supabase db push` reads exactly one migrations directory.** Team A's
`supabase/migrations/` holds 38 files. The chain is 56: Team B's 14 and Team D's
4 live in their own repositories.

Discovered by executing the CLI: `migration repair` refuses a version whose file
it cannot find -

```
glob supabase/migrations/20260727000001_*.sql: file does not exist
```

Without this step, **10 of the 29 baseline commands fail** (9 Team B + Team D's
`20260807050002`) and **6 of the 27 push migrations cannot be applied at all**.

```bash
STAGE=~/innovion-deploy-stage
rm -rf "$STAGE" && mkdir -p "$STAGE/supabase/migrations"

cp <team-a-repo>/supabase/migrations/*.sql  "$STAGE/supabase/migrations/"
cp <team-b-repo>/supabase/migrations/*.sql  "$STAGE/supabase/migrations/"
cp <team-d-repo>/supabase/migrations/*.sql  "$STAGE/supabase/migrations/"

ls "$STAGE/supabase/migrations"/*.sql | wc -l    # MUST be 56
```

**ABORT if the count is not exactly 56.** A missing file means a migration is
silently skipped; a surplus means something untested is about to be applied.

Copy `config.toml` from the Team A repo, then run every later command with
`--workdir "$STAGE"`. Nothing is copied back; Team B and Team D repositories are
read-only inputs.

Verify the staged files match the integration-tested revisions before proceeding:

```bash
cd <team-a-repo> && npm run test:abd     # fails loudly on any hash drift
```

---

## 3.-1 CONNECTION — use the SESSION POOLER, not the direct connection

Found during execution on 2026-08-18. The direct-connection hostname publishes an
**AAAA record only**:

    db.<ref>.supabase.co  ->  2406:da14:25a:5800:...        (no A record)

Supabase made direct-connection hostnames IPv6-only unless the IPv4 add-on is
purchased. A deploying machine without routable IPv6 fails at DNS, before any
authentication:

    getaddrinfo ENOTFOUND db.<ref>.supabase.co

This is not a credential or project fault. Verify the project is healthy
independently - its REST host answers HTTP 401 - then use the **session pooler**:

    postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres

Two differences from the direct string: the host, and the username, which becomes
`postgres.<ref>`. Take the exact value from **Dashboard -> Project Settings ->
Database -> Connection string -> Session pooler**; the region and the `aws-0` /
`aws-1` prefix vary by project.

**Port 5432 on the pooler is SESSION mode**, which supports the transactions,
advisory locks and DDL that migrations require. **Port 6543 is TRANSACTION mode
and cannot run migrations** - `deploy.ps1` rejects it, and that guard is correct.

Confirm reachability before starting:

```powershell
Resolve-DnsName aws-0-<region>.pooler.supabase.com -Type A
Test-NetConnection aws-0-<region>.pooler.supabase.com -Port 5432
```

---

## 3. Baseline the ledger — 29 versions

These record that a migration's objects are already present. **They execute no
SQL from the migration files** and change no application data.

The CLI accepts all 29 in **one** command, which is what was rehearsed. Both
forms are equivalent; the single command is less error-prone.

```bash
supabase --workdir "$STAGE" migration repair --status applied \
  20260726055014 20260726090000 20260727000001 20260727000002 20260727000003 \
  20260727000004 20260727000005 20260727000006 20260727010000 20260727020000 \
  20260727030000 20260727040000 20260728000000 20260728000001 20260728000002 \
  20260728020000 20260728030000 20260731000001 20260731070000 20260806130000 \
  20260807030000 20260807040000 20260807050000 20260807050002 20260809000001 \
  20260809160000 20260810140000 20260810160000 20260811000000
```

Or individually, in this order:

```bash
supabase --workdir "$STAGE" migration repair --status applied 20260726055014   # [A] innovion_core
supabase --workdir "$STAGE" migration repair --status applied 20260726090000   # [A] innovion_extended
supabase --workdir "$STAGE" migration repair --status applied 20260727000001   # [B] checklist_responses
supabase --workdir "$STAGE" migration repair --status applied 20260727000002   # [B] issue_reports
supabase --workdir "$STAGE" migration repair --status applied 20260727000003   # [B] messages
supabase --workdir "$STAGE" migration repair --status applied 20260727000004   # [B] company_logo
supabase --workdir "$STAGE" migration repair --status applied 20260727000005   # [B] supply_requests_notes_contractor_docs
supabase --workdir "$STAGE" migration repair --status applied 20260727000006   # [B] company_id_rls_enforcement
supabase --workdir "$STAGE" migration repair --status applied 20260727010000   # [A] add_company_id
supabase --workdir "$STAGE" migration repair --status applied 20260727020000   # [A] scheduled_jobs_activity_rbac
supabase --workdir "$STAGE" migration repair --status applied 20260727030000   # [A] documents_storage_bucket
supabase --workdir "$STAGE" migration repair --status applied 20260727040000   # [A] rls_notifications_invites
supabase --workdir "$STAGE" migration repair --status applied 20260728000000   # [A] timesheet_invoices_stripe_templates
supabase --workdir "$STAGE" migration repair --status applied 20260728000001   # [B] fix_contractors_user_id
supabase --workdir "$STAGE" migration repair --status applied 20260728000002   # [B] rls_complete_audit
supabase --workdir "$STAGE" migration repair --status applied 20260728020000   # [A] i18n_localisation_partners
supabase --workdir "$STAGE" migration repair --status applied 20260728030000   # [A] platform_api_layer
supabase --workdir "$STAGE" migration repair --status applied 20260731000001   # [B] documents_bucket_and_cleanup
supabase --workdir "$STAGE" migration repair --status applied 20260731070000   # [A] production_hardening
supabase --workdir "$STAGE" migration repair --status applied 20260806130000   # [A] provider_integrations
supabase --workdir "$STAGE" migration repair --status applied 20260807030000   # [A] schema_push_indexes
supabase --workdir "$STAGE" migration repair --status applied 20260807040000   # [A] supervisor_rbac_encrypted_secrets
supabase --workdir "$STAGE" migration repair --status applied 20260807050000   # [A] workforce_roster_notifications
supabase --workdir "$STAGE" migration repair --status applied 20260807050002   # [D] platform_foundation_schema
supabase --workdir "$STAGE" migration repair --status applied 20260809000001   # [B] device_tokens_and_security_hardening
supabase --workdir "$STAGE" migration repair --status applied 20260809160000   # [A] pilot_readiness_security_sync
supabase --workdir "$STAGE" migration repair --status applied 20260810140000   # [A] integration_framework_phase1a
supabase --workdir "$STAGE" migration repair --status applied 20260810160000   # [A] integration_prereqs_phase1b
supabase --workdir "$STAGE" migration repair --status applied 20260811000000   # [A] xero_connector_phase1b
```

### Two entries that are not obvious

- **`20260807050002` (Team D).** Its objects are present under the *old* version
  `20260807050000`, which was never recorded because there is no ledger. Marking
  the new version applied is correct and is why no rename repair is needed.
- **`20260817002000` is deliberately ABSENT from this list.** Production shows its
  PHASE 1 function change, hand-applied — but the file as a whole cannot have
  been applied, because its own PHASE 3 guard refuses the 13 metadata-bearing
  policies that are still live. It therefore belongs in the push set, where it
  applies cleanly because `20260817000000` now precedes it and removes them.

### Verify the baseline before pushing

```sql
SELECT count(*) AS recorded FROM supabase_migrations.schema_migrations;   -- expect 29
```

**ABORT if this is not exactly 29.**

---

## 4. The push

```bash
supabase --workdir "$STAGE" migration list      # confirm 27 pending, matching §4.1
supabase --workdir "$STAGE" db push --include-all
```

### `--include-all` is REQUIRED, not optional

Without it the push **refuses to start**:

```
Found local migration files to be inserted before the last migration on remote database.
Rerun the command with --include-all flag to apply these migrations:
  supabase/migrations/20260728010000_seed_onboarding.sql
  supabase/migrations/20260810000000_platform_event_bus_runtime.sql
```

Those are the two **gap** migrations: both sort before the last already-applied
version (`20260811000000`), and the CLI treats out-of-order migrations as an
error condition. This is the direct consequence of production's applied set not
being a contiguous prefix. Both were applied successfully in rehearsal.

### 4.1 Expected push set — 27 migrations, in this order

```
20260728010000  [A] seed_onboarding
20260810000000  [D] platform_event_bus_runtime
20260816120000  [A] notification_type_geofence_anomaly
20260817000000  [A] tenant_authority_remediation
20260817000001  [B] tenant_authority_hardening
20260817000002  [B] issue_attachment_storage_isolation
20260817000003  [B] isolation_policy_consolidation
20260817000500  [D] platform_authority_hardening
20260817001000  [A] tenant_authority_helpers_and_bootstrap
20260817002000  [A] tenant_authority_close_metadata_vectors
20260817003000  [A] remove_dev_encryption_key_fallback
20260817003500  [A] purge_fictitious_seed_data          <-- deletes rows, see §6
20260817004000  [A] close_null_tenant_escape
20260817005000  [A] storage_tenant_isolation
20260817006000  [A] integration_credential_authority
20260817006500  [A] view_security_invoker
20260817007000  [A] platform_operator_scoping
20260817008000  [A] secdef_search_path_hardening
20260817010000  [A] company_branding_columns
20260817011000  [A] contractor_rates
20260818000100  [A] abd_authority_reconciliation
20260818000200  [B] workforce_data_access_carveouts
20260818000300  [A] workforce_carveout_assertions
20260818000400  [D] innovion_tenancy_projection
20260818000500  [A] tenant_directory_scope
20260818000600  [A] tenancy_projection_refresh
20260818000700  [A] user_roles_company_fk               <-- alters a constraint, see §6
```

**ABORT if `migration list` shows any other count or any other migration.**

Rehearsed result against a faithful copy of the live baseline: **27 applied, 0
aborted**, stable across repeated runs.

---

## 5. Backup — mandatory, before §3

Take a Supabase point-in-time or on-demand backup and **verify it restores**.
An unverified backup is not a backup.

Record: backup ID, timestamp, and the restore-test result. Abort condition A6
depends on this.

The two data-affecting migrations in §6 are not transactionally reversible once
`db push` has committed them.

---

## 6. Production-data effects — explicit

### 6.1 `20260817003500_purge_fictitious_seed_data` — DELETES ROWS

**Deletes:** rows with `company_id IS NULL` from 14 tables — `documents`,
`incidents`, `inventory`, `vehicles`, `notifications`, `compliance_items`,
`contractors`, `jobs`, `time_entries`, `checklists`, `clients`, `employees`,
`sites`, `settings`.

These rows have no tenant. They are unreachable by every policy once
`20260817004000` closes the null-tenant escape, and no policy could ever have
created them for a real tenant — they were only ever visible *through* the escape
hatch, to everyone. On a bare schema the count is 6 `documents` and 1 `settings`,
seeded by the early migrations' own mock-data blocks.

**Does NOT delete:** anything from `public.companies`.

> **This migration was rewritten on 2026-08-19 after the data-bearing rehearsal
> caught it destroying real data.** The original deleted
> `FROM public.companies WHERE owner_id IS NULL`, on the reasoning that a real
> tenant always has an owner. The reasoning is right; the conclusion was wrong.
> `public.companies` is also the **customer directory** — `company_type` is
> (client, contractor, partner) and **defaults to `client`** — and a customer
> record legitimately has no owner because nobody signs in as a customer.
>
> Measured on a realistic estate of 40 tenants and 120 customer records:
> `companies 160 -> 40`. **Every customer record destroyed**, silently, mid-deployment.
>
> It now purges child tables only and *reports* ownerless companies via
> `RAISE WARNING` without touching them. Re-measured: **0 rows destroyed** beyond
> the 6 documents and 1 settings row.

Check 2.4 `ownerless_companies` before deploying. Whatever the number, they are
now preserved — the check exists so you see the figure and can confirm the
warning in the deploy log matches it.

### 6.2 `20260818000700_user_roles_company_fk` — ALTERS A CONSTRAINT

**Deletes:** `user_roles` rows whose `company_id` is NULL or names a company that
does not exist. **Expected count in production: 0** — the existing foreign key
already guarantees referential integrity and `company_id` is already `NOT NULL`.
Confirmed by check 2.4 (`orphan_role_grants`) and by the rehearsal, which
measured 0 with 240 role grants present.

**Alters:** drops `user_roles_company_id_fkey` (`ON DELETE NO ACTION`) and
re-adds it as `ON DELETE CASCADE`.

- Takes a brief `ACCESS EXCLUSIVE` lock on `user_roles` and re-validates the
  constraint. On this table size, milliseconds.
- **Behaviour change:** deleting a company will now cascade to its role grants
  instead of being refused. This matches the other twelve `companies` foreign
  keys in the schema and Team D's `platform_tenants.company_id`.
- Also sets `company_id NOT NULL` — already true in production, so a no-op.

The original version would have **aborted the deployment here**: it found the
constraint present, skipped creation, then failed its own `CASCADE` guard. The
restored-copy rehearsal caught that as the single abort in the chain.

### 6.3 Everything else

The other 25 migrations create or replace functions, policies, triggers, views,
columns, indexes and tables. None deletes application rows.

`20260818000600` installs two statement-level triggers on `user_roles` and
`companies` that call Team D's projection synchronously. After deployment, a
role change that fails to project will **abort the originating write** — that is
the intended fail-closed behaviour, not a fault.

---

## 7. Rehearsal evidence

Both run locally against PGlite, reproducing the live baseline exactly.

**Restored-copy rehearsal** (`npm run test:rehearsal`) — baseline fidelity 13 of
13 dimensions match production. RUN 1: 23 outstanding applied, 0 aborted. RUN 2
(including the 4 undetermined): 27 applied, 0 aborted. Stable across repeats.

**Data-bearing rehearsal** (`node supabase/tests/data-bearing-rehearsal.mjs`) —
40 tenants, 120 customer records, 240 role grants, 1600 jobs, 480 clients, 320
employees, 200 contractors, 246 documents.

| | before | after |
| --- | --- | --- |
| documents | 246 | 240 (−6, tenant-less) |
| settings | 1 | 0 (−1, tenant-less) |
| **companies** | **160** | **160 (unchanged)** |
| **customer records** | **120** | **120 (unchanged)** |
| user_roles | 240 | 240 (unchanged) |
| user_roles FK | NO ACTION | CASCADE |

Slowest migration: `20260818000400` at 202 ms.

**Post-deployment posture the push produces, measured:**

| | before | after |
| --- | --- | --- |
| `company_access_*` policies | 13 | **0** |
| Views bypassing RLS | 4 of 4 | **0** |
| SECURITY DEFINER unpinned | 18 of 21 | **0** |
| Tables without RLS | — | **0** |
| A→D refresh triggers | — | **armed** |

---

## 8. A5 — ledger creation, and full CLI rehearsal. CLEARED.

No disposable Supabase project was required. The Supabase CLI accepts
`--db-url`, so the entire runbook was executed by the **real CLI** against a
faithful replica of the live baseline served over TCP from PGlite. That is a
higher-fidelity test than a bare empty project would have been, because the
replica reproduces production's actual state.

**CLI version: 2.115.0** (`npx supabase@latest --version`).

### A5 answered

```
$ supabase migration repair --status applied 20260726055014 --db-url <replica>
Connecting to remote database...
Repaired migration history: [20260726055014] => applied
```

Against a database where `supabase_migrations` did **not** exist. Immediately
after, the schema and table were present:

```
schema=1  table=1  versions=[20260726055014]
```

**`supabase migration repair` creates `supabase_migrations.schema_migrations`
when it is absent.** Abort condition A5 is cleared.

### Full runbook rehearsal, end to end

| Step | Result |
| --- | --- |
| Replica built: 29 applied, no ledger, drift reproduced | `ledger_schema=0 company_access=13` |
| §3 baseline, 29 versions in one command | ledger **29** |
| `migration list` | 56 listed, **27 pending** — matches §4.1 exactly |
| `db push` without `--include-all` | **REFUSED** (see §4) |
| `db push --include-all` | **27 applied, 0 failed**, ledger **56** |
| `db push --dry-run` afterwards | `Remote database is up to date` |

### Verification, measured through the CLI path

| | after baseline | after push | §10 expects |
| --- | --- | --- | --- |
| `applied_total` | 29 | **56** | 56 |
| `company_access_remaining` | 13 | **0** | 0 |
| `views_bypassing_rls` | 4 | **0** | 0 |
| `secdef_unpinned` | 18 | **0** | 0 |
| `tables_without_rls` | 0 | **0** | 0 |
| `fk_on_delete` | NO ACTION | **CASCADE** | CASCADE |
| `refresh_triggers` | 0 | **2** | 2 |

Every §10 expected result was produced.

### Two blockers this rehearsal found

Neither was visible to the in-process rehearsals, because both are CLI
behaviours rather than SQL behaviours.

1. **Migration files are split across three repositories.** `migration repair`
   refuses a version whose file it cannot see, and `db push` only applies files
   in its own directory. 18 of 56 were missing from Team A's tree. Fixed by §3.0.
2. **`--include-all` is mandatory.** The two gap migrations sort before the last
   applied version and the CLI refuses out-of-order migrations by default. Fixed
   in §4.

### One local-only artifact, not applicable to production

The replica speaks unencrypted Postgres, so the rehearsal used
`?sslmode=disable`. **Do not carry that flag to production.** The live project
requires TLS and the CLI negotiates it by default.

---

## 9. Rollback and recovery

`supabase db push` applies **each migration in its own transaction**. A failure
part-way leaves earlier migrations committed and recorded, and the failing one
rolled back. The chain stops there.

### If the push fails part-way

1. **Do not re-run `db push`.** Establish what is applied first:
   ```sql
   SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
   ```
2. Capture the CLI's full error output and the failing version.
3. Re-run the §2 checks. The schema is now a partial state that no rehearsal
   modelled.
4. **Report before acting.** Team A will reproduce the exact partial state
   locally and determine whether to fix forward or restore.

### Choosing between fix-forward and restore

- **Fix forward** when the failure is a guard aborting on a state the migration
  can be made to accept — as `20260818000700` did in rehearsal. No data has been
  lost; the remaining migrations have not run. This is the expected case.
- **Restore from backup** when data has been deleted or a constraint altered and
  the outcome is wrong. This is the only reason §5 is mandatory.

### Rollback boundaries

| Point of failure | Reversible? |
| --- | --- |
| Before `20260817003500` | Yes — no data change yet. Fix forward. |
| `20260817003500` onward | Deleted rows are gone. Restore from backup if wrong. |
| `20260818000700` onward | Constraint replaced. Reversible by hand: drop and re-add as `NO ACTION`. |

There is no `supabase db reset` path for production, and none is proposed.

---

## 10. Post-deployment verification

Run read-only immediately after the push.

```sql
-- 10.1 Ledger complete. Expected: 56.
SELECT count(*) AS applied_total FROM supabase_migrations.schema_migrations;

-- 10.2 Security posture. Expected ALL ZERO.
SELECT
  (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND policyname LIKE 'company_access_%')          AS company_access_remaining,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v'
      AND NOT COALESCE(c.reloptions,'{}') && ARRAY['security_invoker=true','security_invoker=on'])
                                                                               AS views_bypassing_rls,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig,'{}')) cfg WHERE cfg LIKE 'search_path=%'))
                                                                               AS secdef_unpinned,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity)       AS tables_without_rls;

-- 10.3 Constraint replaced. Expected: CASCADE.
SELECT conname,
       CASE confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'a' THEN 'NO ACTION' END AS on_delete
  FROM pg_constraint
 WHERE conrelid='public.user_roles'::regclass AND contype='f'
   AND confrelid='public.companies'::regclass;

-- 10.4 A->D projection live. Expected: 2 triggers, tenants projected.
SELECT
  (SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'innovion_tenancy_projection%') AS refresh_triggers,
  (SELECT count(*) FROM public.platform_tenants WHERE company_id IS NOT NULL)        AS projected_tenants,
  (SELECT count(*) FROM public.innovion_tenant_directory)                            AS directory_tenants;

-- 10.5 Data preserved. Compare against the 2.4 figures taken before the push.
SELECT
  (SELECT count(*) FROM public.companies)                                AS companies_total,
  (SELECT count(*) FROM public.companies WHERE owner_id IS NULL)         AS ownerless_companies,
  (SELECT count(*) FROM public.user_roles)                               AS role_grants,
  (SELECT count(*) FROM public.jobs)                                     AS jobs;
```

### Expected results

| Query | Expected | If it differs |
| --- | --- | --- |
| 10.1 | `56` | Push incomplete. §9. |
| 10.2 | all `0` | The remediation did not take effect. Investigate before announcing success. |
| 10.3 | `CASCADE` | `20260818000700` did not complete. |
| 10.4 | `refresh_triggers = 2`; `projected_tenants` = `directory_tenants` | Projection not armed, or tenants not projected. Not a security failure — Platform Foundation membership will be stale. |
| 10.5 | `companies_total` and `ownerless_companies` **unchanged from 2.4**; `role_grants` unchanged | If `ownerless_companies` dropped to 0, an old copy of `20260817003500` ran. Restore from backup. |

### Application smoke test — not optional

The migrations change tenant resolution and add restrictive policies. After
verification, confirm with a real login that a tenant administrator can still
see their own jobs, clients and documents, and that a Workforce contractor can
still see their assigned jobs and their own compliance record.

The local suites cover these behaviourally, but against a shim — not against
hosted Supabase auth. This is the first time the remediated policies meet a real
GoTrue token.

---

## 11. Approval

| Gate | Status |
| --- | --- |
| §8 ledger creation verified (A5) | **COMPLETE** — CLI 2.115.0, §8 |
| §8 full CLI rehearsal, baseline + push + verify | **COMPLETE** — §8 |
| §9 data-bearing rehearsal | **COMPLETE** — §7 |
| Runbook reviewed and approved | **PENDING — Founder** |
| Verified-restorable backup taken | **PENDING — Founder** |
| §2 pre-deployment checks pass | **PENDING — at deploy time** |

Nothing in this runbook has been executed. No production migration, repair,
push, deployment, credential or DNS change has been made.
