# Team A — Adjudication of Team D Cross-Team Findings

**Role:** Integration authority, Teams A / B / D
**Working copy:** `C:\Users\gamya\Innovion-Production` (Team A, authoritative)
**Date:** 2026-08-18
**Verified against:** Team B and Team D trees pinned at `2026-08-18T12:02:00+10:00` (hashes in `supabase/tests/integration-manifest.mjs` → `VERIFIED_AGAINST`)

**DETERMINATION: READY FOR RESTORED-COPY REHEARSAL**, subject to the three preconditions in §9.

---

## 0. A finding that governs everything below

During this work, Team D's foundation migration was renamed **three times in ten minutes** by a process outside Team A:

| Observed | Filename | SHA-256 (16) | Size |
| --- | --- | --- | --- |
| ~11:50 | `20260807045000_platform_foundation_schema.sql` | `B1FC64E4…` | 35795 |
| ~11:56 | `20260807050000_platform_foundation_schema.sql` | `B1FC64E4…` | 35795 |
| ~12:01 | `20260807050002_platform_foundation_schema.sql` | `B1FC64E4…` | 35795 |

The content never changed. Only the version prefix did — and it settled on `20260807050002`, which is precisely the rename the Founder countermanded pending adjudication, and which Team D's own addendum (written 01:10 that morning) says they would *not* make unilaterally.

Two consequences, both material:

1. **Two of my test runs straddled a rename and reported results that belonged to the rename, not to any code.** One of them was a negative control that *appeared to pass* while actually proving nothing: Team D's foundation file was momentarily unreadable, so `is_platform_admin()` was never created, so the guard's structural fallback fired instead of the behavioural probe. A control that passes for the wrong reason is worse than one that fails.
2. Integration verdicts are only meaningful against a **pinned revision**. All suites now hash Team B's and Team D's trees against `VERIFIED_AGAINST` and fail loudly on drift. Drift is not an error — it means the other team moved and the verdict must be re-established, not carried forward.

At the time of writing, the live Team B and Team D trees match the pinned revision exactly, and every result below was re-confirmed against the live trees, not only the snapshot.

---

## 1. P0 — Migration ordering (Team D's finding)

### Independently verified. Team D is correct.

I read Team D's `20260807050002_platform_foundation_schema.sql` directly rather than accepting the report. It defines:

```sql
CREATE OR REPLACE FUNCTION public.is_platform_admin() ... AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth.uid()
    AND (au.raw_user_meta_data->>'platform_role' IN ('founder','platform_engineer')
      OR au.raw_app_meta_data->>'platform_role' IN ('founder','platform_engineer')))
$$;
```

`raw_user_meta_data` is written by the end user via `supabase.auth.updateUser({ data: … })`. Team A's `20260818000100` bridges `innovion_is_platform_operator()` to `is_platform_admin()`. If the bridge lands while Team D's hardening has not, any authenticated user can write `platform_role: 'founder'` about themselves and inherit Team A's platform-operator authority.

**Proven, not argued.** The replay suite builds that exact database and asserts the escalation is real before asserting the guard blocks it:

```
PASS  NEGATIVE CONTROL: the unhardened function really is escalatable
      (is_platform_admin()=true — if false, the guard above proves nothing)
```

### Guard replaced: existence check → behavioural probe

Team D recommended a source-text check (`pg_get_functiondef(...) !~ 'raw_user_meta_data'`). I did not adopt it. A text scan tests the *spelling* of the implementation, and is evaded by any aliasing of the accessor. The Founder's instruction was explicit: test the required security state, not the presence of a name.

`20260818000100` now creates a synthetic principal whose **only** claim to authority is forged metadata, asks the real function what it thinks, and rolls the probe back inside a subtransaction:

```sql
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (probe_uid, 'abd-integration-probe@innovion.invalid',
          jsonb_build_object('platform_role','founder'));
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', probe_uid::text, 'role','authenticated')::text, true);
  SELECT public.is_platform_admin() INTO probe_admin;
  probe_ran := true;
  RAISE EXCEPTION USING ERRCODE='raise_exception', MESSAGE='ABD_PROBE_ROLLBACK';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'ABD_PROBE_ROLLBACK' THEN probe_ran := false; END IF;
END;

IF probe_ran AND probe_admin THEN
  RAISE EXCEPTION 'Refusing to bridge platform authority: …' USING ERRCODE='insufficient_privilege';
END IF;
```

PL/pgSQL variables survive subtransaction rollback, so the verdict is retained while the synthetic user is not. If the probe cannot run at all, `probe_ran` is false and a structural fallback applies — it fails toward *not bridging*.

### A second, independent defence — found, not designed

While building the replay suite I discovered the dangerous window is refused **twice, at two different points in the chain, by two unrelated mechanisms**. Team A's `20260817002000` metadata-vector guard runs earlier and catches Team D's unhardened functions on their own merits:

```
PASS  ...and 20260817002000 independently refuses it EARLIER in the chain
      (Tenant authority regression: function(s) is_platform_admin, is_platform_founder
       resolve tenant identity from client-writable metadata without authoritative validation)
```

### Required ordering — ratified

> **Team D `20260817000500_platform_authority_hardening.sql` must be applied before, or in the same deployment as, Team A `20260818000100_abd_authority_reconciliation.sql`. They must never be separated across deployments.**

This is now enforced by the schema itself, not by process discipline. Team A's `20260818000100` cannot apply without it.

---

## 2. P1 — The duplicate `20260807050000`

### Ruling

> **Team D's `platform_foundation_schema` moves forward to `20260807050002`. Team A's `20260807050000_workforce_roster_notifications.sql` does not move. Neither file's content is edited. At deploy time the moved file is reconciled with `supabase migration repair`, not by running it.**

### Team D's premise, corrected

Team D declined to re-stamp on the grounds that *"re-stamping an applied migration rewrites the ledger"*. That is the crux of the item, and it is not correct:

- `supabase_migrations.schema_migrations` is append-only in normal use. `db push` **INSERTs** one row per version it applies. It never UPDATEs or DELETEs a row because a file was renamed — it has no way to know a file was renamed at all.
- A rename therefore **destroys no history**. The row for `20260807050000` survives untouched.
- What a rename *does* do is manufacture a version the ledger has never seen, which `db push` will then try to **run**. The hazard is re-execution, not ledger corruption.
- `supabase migration repair --status applied <version>` exists for exactly this: it INSERTs a row asserting the objects are already present, without executing the file. An append, not a rewrite.

Team D's caution was sound; only the mechanism was misread. But their conclusion — *neither file may move* — proves too much. If neither moves, the collision is permanent and a clean rebuild can never reproduce the live schema. Something has to move.

### Why the ruling does not depend on reading the ledger

Only one row can exist at `20260807050000`; it is a primary key. Exactly one of the two files is recorded there and the other is applied-but-unrecorded. **Team A cannot determine which.** No ledger artefact exists in any local tree — no `supabase/config.toml`, no `.temp`, no `schema_migrations` dump — and reading the live ledger is a protected action. That is stated as a limit, not papered over.

The ruling is built so it does not need to be known. Both branches are verified by execution:

| Branch | Assertion | Result |
| --- | --- | --- |
| Team D's file must be re-run | `20260807050002` re-applied onto a clean final schema | **FAILS** — `column "platform_role" does not exist`. Confirms `migration repair` is required, not execution. |
| Team A's file must be re-run | `20260807050000` re-applied onto a clean final schema | **PASSES** — safe to re-run, so the ruling holds even if Team A's is the unrecorded one. |

### Why forward (`050002`) and not backward (`045000`)

`045000` appeared transiently on disk and is rejected on the merits. Backdating manufactures an out-of-order migration: on a project where `050000` is already recorded, a newly-appearing `045000` sorts *before* it, and the CLI treats out-of-order migrations as an error condition. Forward-stamping always sorts after everything recorded, which is what an unapplied migration needs. `050002` also keeps Team D's foundation ahead of their own event bus (`20260810000000`) and hardening (`20260817000500`) — the only ordering constraint its content actually imposes.

### Deploy-time ledger reconciliation — a Founder action

Recorded in full in `integration-manifest.mjs` → `REQUIRED_LEDGER_RECONCILIATION`. Summary:

```sql
-- Read only. No migration is applied by this step.
SELECT version FROM supabase_migrations.schema_migrations
 WHERE version IN ('20260807050000','20260807050002');
SELECT to_regclass('public.platform_tenants')      IS NOT NULL AS foundation_present,
       to_regclass('public.notification_preferences') IS NOT NULL AS teama_present;
```

| State | Action |
| --- | --- |
| `foundation_present` true, `050002` absent | `supabase migration repair --status applied 20260807050002`. **Do not run the file.** |
| `foundation_present` false | Push normally; the file runs and creates the objects. |
| `050002` already present | Already reconciled. Do nothing. |
| `teama_present` false | Team A's file is the unrecorded one: `migration repair --status reverted 20260807050000`, then push so it executes. Verified safe. |

**Explicitly do not** `DELETE` or `UPDATE` any row in `supabase_migrations.schema_migrations`. Nothing in this plan requires it.

---

## 3. P1 — The authoritative A↔D tenancy contract

Team D correctly reported that Team A's `companies.id uuid` and Team D's `platform_tenants.tenant_id text` have no join, no foreign key and no mapping, so a legitimate Innovion tenant administrator is a stranger to Platform Foundation: `platform_has_tenant_access()` returns false and their Platform event publish and audit write are refused. Team D declined to invent a mapping. That was the right call.

### Ruling: one source of truth, projected, never duplicated

> Team A's `companies` is the sole authority for **which tenants exist**.
> Team A's `user_roles` (plus `companies.owner_id`) is the sole authority for **who belongs to one**.
> Team D's `platform_tenants` and `identity_tenant_memberships` become a **projection** of those — never an independent register.

Team A publishes the correspondence as two read-only views; Team D projects from them. Team A does not write Team D's tables, and Team D does not decide who is a tenant member. Both views are `security_invoker = true`, granted to `authenticated` and `service_role` only, and revoked from `anon`.

### The contract Team D implements

**Canonical tenant id** — deterministic, computable without a lookup, cannot drift:

```
tenant_id := 'company:' || companies.id::text
```

**Correspondence column** — Team D adds to `public.platform_tenants`:

```sql
company_id uuid UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE
```

`UNIQUE` because the correspondence is one-to-one. `ON DELETE CASCADE` because a tenant that no longer exists in Team A must not survive in Team D.

**Sources** — Team A now provides:

| View | Columns |
| --- | --- |
| `public.innovion_tenant_directory` | `company_id`, `tenant_id`, `display_name`, `is_active` |
| `public.innovion_tenant_membership_directory` | `user_id`, `company_id`, `tenant_id`, `tenant_role` |

**Membership projection rules:**

| Team A principal | Team D `tenant_role` |
| --- | --- |
| `companies.owner_id` | `tenant_owner` |
| `user_roles.role = 'admin'` | `tenant_admin` |
| `user_roles.role IN ('manager','supervisor')` | `tenant_member` |
| `user_roles.role IN ('viewer','contractor')` | **no membership** |
| Workforce `contractors` | **no membership** |

Viewers and contractors are excluded deliberately. Platform Foundation membership carries event-bus publish and audit-write authority; a read-only viewer and a field worker have no Platform Foundation business, and granting it would widen authority in the name of a bridge. Where a user qualifies more than once for the same tenant, the **highest** role wins — the view already resolves this, so Team D does not have to decide.

**Direction** — strictly one-way, A → D. Team D must not create a `platform_tenants` row with no `companies` row behind it, and must not grant a membership the directory does not report. Team D's own platform-operations tenants (e.g. `tenant-coralamy-root`) are unaffected: they simply have `company_id IS NULL` and are not projected.

**Forgery** — every column derives from `companies`, `companies.owner_id` and `user_roles`. No metadata is read anywhere in the contract, and this is asserted rather than asserted-in-prose:

```
PASS  neither directory view reads client-writable metadata
PASS  a tenant admin sees only their own tenant in the directory  (sees 1 tenants)
PASS  anon reads no tenant directory rows  (denied)
PASS  a viewer projects as NOTHING — Platform membership carries publish/audit authority
PASS  a Workforce contractor projects as NOTHING
```

---

## 4. `platform_engineer` authority

### Ruling: NOT intended. Narrowed.

Team D asked whether `platform_engineer` is intended to hold ALL-command write over `partners`, `partner_products` and `partner_revenue`, which it inherited because Team A's bridge calls `is_platform_admin()` — and that function spans **both** `founder` and `platform_engineer`.

It is excessive:

- `partner_revenue` carries `commission_amount`, `royalty_amount`, `mrr_amount`, `arr_amount`. Those are partner **financial** records. Altering what a partner is owed is a commercial act, not an engineering one.
- `partners` carries `commission_rate`, `royalty_rate` and contract dates — the commercial terms themselves.
- The tier is named for engineering. Least privilege says the authority should match the name.

Team D was right to flag it rather than let green tests stand as consent. **Tests permitting an authority is not evidence that it was intended.**

### The boundary, as implemented

| Tier | Members | Authority |
| --- | --- | --- |
| `innovion_is_platform_operator()` — **read** | `platform_operators` ∪ founder ∪ platform_engineer | SELECT on `partners`, `partner_products`, `coralamy_products` |
| `innovion_is_platform_steward()` — **write** | `platform_operators` ∪ founder — **not** platform_engineer | ALL on `partners`, `partner_products`, `partner_revenue`; sole non-tenant reader of `partner_revenue` |

`platform_operators` remains write-capable: membership is granted out-of-band by a database administrator, deliberately, one user at a time. It is not a self-service tier.

### Verified behaviourally, with controls against vacuous passes

```
PASS  CONTROL: platform_engineer really does hold is_platform_admin()   (got true)
PASS  CONTROL: platform_engineer is NOT is_platform_founder()           (got false)
PASS  platform_engineer READS public.partners
PASS  platform_engineer READS public.partner_products
PASS  platform_engineer CANNOT write public.partners                    (0 ROWS WRITTEN)
PASS  platform_engineer CANNOT write public.partner_products            (denied)
PASS  platform_engineer CANNOT insert into public.partners              (denied)
PASS  CONTROL: the founder/steward tier DOES read the partner_revenue row
PASS  platform_engineer CANNOT read public.partner_revenue
PASS  a tenant still reads its OWN partner_revenue rows
PASS  founder holds innovion_is_platform_steward()
PASS  founder CAN write public.partners
PASS  a tenant admin reads no partner rows
```

Each denial is paired with a control proving the row was reachable and the tier was real, so a zero cannot mean *"there was nothing there"*.

**Team D action:** none required in their tree. The narrowing is entirely within Team A's policies. Team D should be aware that `is_platform_admin()` is no longer sufficient for partner writes.

---

## 5. Reconciling Team B's latest results

Team B's DEP-1 / DEP-2 / DEP-6 resolution, withdrawal of their competing resolver, 131 tests and 63/63 integrated isolation checks are consistent with what Team A measures against their pinned tree. Their two contributed migrations both apply in the combined chain.

### One defect: duplicate ownership of the same policies

Team B's `20260818000200_workforce_data_access_carveouts.sql` creates **seven policies** — `compliance_items_workforce_own_only`, `…_readonly`, `…_no_update`, `…_no_delete`, `settings_workforce_readonly`, `…_no_update`, `…_no_delete`. Team A adopted those carve-outs into `20260818000100` (sections 4a/4b), so both migrations now define the same seven policy names, and **Team B's runs later, so Team B's definitions win**.

They are currently equivalent — removing Team B's migration entirely leaves all 106 integration security assertions passing:

```
integration WITHOUT Team B 20260818000200: 106 passed, 1 failed
   (the single failure is the revision-pinning check detecting the removed file — expected)
```

That equivalence is coincidence, not architecture. If Team A later tightens `compliance_items_workforce_own_only`, Team B's later migration silently reverts it. This is precisely the duplicate-authority failure mode the integration exists to eliminate.

### Exact change required of Team B

> **Reduce `20260818000200_workforce_data_access_carveouts.sql` to its guard only.** Delete the seven `DROP POLICY` / `CREATE POLICY` pairs (lines ~54–120). Keep the two `RAISE EXCEPTION` assertion blocks (~lines 149 and 165) unchanged.

This preserves everything valuable in the migration — it still fails closed if Team A's carve-outs are absent or lost — while leaving a single owner for each policy. That protection is verified:

```
PASS  Team B's carve-outs REFUSE to apply without Team A's reconciliation
PASS  ...naming the Platform tables that would have been left undefended
      (clients employees inventory vehicles contractor_invoices subscriptions
       provider_integrations pending_invites role_permissions activity_log timesheet_audit_log)
```

No other change is required of Team B. `20260817000003_isolation_policy_consolidation.sql` is accepted as-is.

### Piecemeal application is refused by the schema

Per the Founder's instruction, A / B / D are not separable where separation recreates a vulnerability. Two separations are now blocked by the migrations themselves rather than by process:

| Separation | Result |
| --- | --- |
| Team A reconciliation without Team D hardening | Chain aborts twice — at `20260817002000` and again at `20260818000100` |
| Team B carve-outs without Team A reconciliation | Chain aborts at `20260818000200`, naming 11 undefended Platform tables |

---

## 6. Cross-team regression — what was actually executed

Environment: Node v22 on Windows 11, PGlite (in-process PostgreSQL 18) with `pgcrypto` and `uuid-ossp`. Supabase claims simulated via `set_config('request.jwt.claims', …)` + `SET ROLE`.

### Results — every one executed, exit codes checked

| Suite | Assertions | Exit | Result |
| --- | --- | --- | --- |
| `type-check` (`tsc --noEmit`) | — | 0 | clean |
| `lint` (`next lint`) | — | 0 | 0 errors (pre-existing `no-explicit-any` warnings only) |
| `build` (`next build`) | — | 0 | compiled in 4.6s, 102 kB shared JS |
| `test:security` | 121 | 0 | 121 passed, 0 failed |
| `test:schema` | 261 columns / 146 files | 0 | all selected columns exist |
| `test:app` | 72 | 0 | 72 passed, 0 failed |
| `test:controls` | 307 buttons | 0 | no silently inert controls |
| `test:workforce` | 123 | 0 | 123 passed, 0 failed |
| `test:integration` (A+B+D) | 107 | 0 | 107 passed, 0 failed |
| `test:replay` (new) | 27 | 0 | 27 passed, 0 failed |

**450 behavioural assertions**, plus 261 schema-column and 307 dead-control checks. Re-run **three consecutive times**; identical counts and exit codes each time. Re-confirmed against the **live** Team B and Team D trees, not only the snapshot.

### Migration-chain replay (`supabase/tests/migration-replay-suite.mjs`, new this turn)

- 51 migrations across A+B+D apply from an empty database
- No two migrations share a 14-digit version — **detected from the trees, not declared**
- Re-stamp safety established for every re-stamped file, on its own fresh database
- All nine Team A guard migrations re-run cleanly against a **fresh** final integrated schema — the state a restored-copy rehearsal actually replays them in
- Negative controls: unsafe configurations abort, and the danger they guard against is separately proven real

### Fault injection — proving the suites can fail

Removing Team D's hardening from the snapshot:

```
integration EXIT=2 (harness abort)   replay EXIT=1 (22 passed, 5 failed)
```

Both non-zero. A green run is a result, not a default.

### Defects introduced by my own remediation, found and corrected

| # | Defect | How found | Fix |
| --- | --- | --- | --- |
| 1 | `20260817002000` allowlist had gone stale against Team A's **own** refactored `get_my_company_id()`; would abort on re-run against the final schema — exactly what a rehearsal does | Team D item 9.5 | Recognise `innovion_tenant_ids` / `innovion_auth_company_ids` as authoritative |
| 2 | Same guard scanned `pg_get_functiondef()` **including comments** — a comment could fail a deployment | Team D item 9.6 | Strip line comments before matching |
| 3 | Test shim granted `auth.users` to `anon`/`authenticated`, which hosted Supabase does not | Team D item 9.7 | Restricted to `service_role` |
| 4 | `20260817007000` and `20260818000100` created policies without `DROP … IF EXISTS`, so neither was re-runnable | Replay suite §4 | Added the missing drops |
| 5 | **`NOT LIKE ANY` instead of `NOT LIKE ALL`** in the platform-data guard — an ANY/ALL inversion that made the predicate true for nearly every policy, aborting the whole chain | Replay suite §1 | `ALL`, with a comment recording why |
| 6 | First draft of the replay suite reused one database across phases, so a later phase reported five failures caused by an earlier phase's mutations | Reading the output rather than the summary | Every phase now gets its own database |
| 7 | Integration manifest still declared a rebase Team D had already superseded | Integration suite §0 | Collisions are now **computed from the trees**; a declared list can go stale, and this one did |

Items 5 and 6 were introduced *during this turn* and caught by the suite built in the same turn.

---

## 7. External verification boundary — what is NOT proven

Stated plainly, because none of it can be inferred from a green local run.

**Not verified — requires an authorised non-production Supabase environment:**

- **The positive authentication path.** Every Workforce auth test is a *rejection* test or runs against a shimmed `auth.users`. No genuinely signed Supabase JWT has been minted by real GoTrue and accepted end-to-end by `authenticateWorkforceRequest()`. Local rejection tests do not prove the accept path.
- **Real RLS under hosted Supabase.** PGlite is genuine PostgreSQL 18, so policy semantics are real; but `auth.users`, `auth.jwt()`, `storage.objects` and GoTrue are shims. Behaviour under Supabase's actual `auth` schema, storage service and connection pooling is unverified.
- **`supabase db push` against a real project.** The chain is proven to apply in dependency order in-process. The CLI's own ordering, advisory locking and ledger behaviour are not exercised.
- **The ledger state itself.** Which file is recorded at `20260807050000` is unknown. §2 is constructed to work either way, and both branches are verified — but the branch that will actually be taken has not been observed.

**Not verified — requires physical hardware:**

- **No mobile device capability is claimed.** No APK was built, installed or run. Team B's Workforce client was read as source only. Geofencing, background location, push delivery, offline sync and camera/photo capture are **entirely unverified** by Team A.

**Not performed — protected actions:**

No live Supabase migration; no production deployment; no DNS change; no production credential created, rotated, revoked or deleted; no destructive production-data operation; no live financial transaction; no irreversible external-provider action. Team D's `.env` and Team B's `env.json` were deliberately never opened. Team B's and Team D's trees were read only — nothing was written to either.

---

## 8. Adjudication summary

| # | Item | Ruling |
| --- | --- | --- |
| 1 | P0 migration ordering | **Team D correct.** Verified independently. Behavioural fail-closed probe replaces the existence check; a second independent guard found at `20260817002000`. Ordering now enforced by the schema. |
| 2 | Duplicate `20260807050000` | **Team D's file moves forward to `050002`; Team A's does not move.** Team D's "rename rewrites the ledger" premise corrected. Ledger reconciliation is by `migration repair` (an append), documented with a decision table that works without knowing the ledger state. |
| 3 | A↔D tenancy model | **Contract defined.** `tenant_id = 'company:'‖uuid`; `platform_tenants.company_id` UNIQUE FK; membership projected from two new Team A views; viewers and contractors excluded; one-way A→D. |
| 4 | `platform_engineer` authority | **Excessive. Narrowed.** Read tier keeps `partners`/`partner_products`; write tier and all `partner_revenue` access restricted to founder + `platform_operators`. |
| 5 | Team B reconciliation | **Accepted, one change required:** reduce `20260818000200` to its guard only. Piecemeal application now refused by the schema in both directions. |
| 6 | Cross-team regression | **450 assertions, 0 failures, 3× stable, exit codes verified, fault injection confirms the suites can fail.** Seven self-inflicted defects found and fixed, two of them introduced this turn. |
| 7 | External boundary | **Stated, not claimed.** Positive auth path, hosted-Supabase RLS, CLI push behaviour, ledger state and all mobile-device capability remain unverified. |
| 8 | Determination | **READY FOR RESTORED-COPY REHEARSAL**, per §9. |

### Changes made in Team A's tree this turn

| File | Change |
| --- | --- |
| `20260818000100_abd_authority_reconciliation.sql` | Behavioural P0 probe; §3b two-tier platform privilege; §3c A↔D tenancy directory views; idempotent policy drops |
| `20260817007000_platform_operator_scoping.sql` | Guard accepts either platform predicate; ANY→ALL fix; idempotent policy drops |
| `20260817002000_tenant_authority_close_metadata_vectors.sql` | Allowlist un-staled (D 9.5); comments stripped before scanning (D 9.6) |
| `supabase/tests/00_supabase_shim.sql` | `auth.users` granted to `service_role` only (D 9.7) |
| `supabase/tests/integration-manifest.mjs` | Countermanded rebase removed; collision detection moved to the trees; `VERIFIED_AGAINST` revision pinning; `REQUIRED_LEDGER_RECONCILIATION` |
| `supabase/tests/integration-harness.mjs` | `verifySnapshot()` drift detection |
| `supabase/tests/integration-security-suite.mjs` | Sections K and L (+22 assertions); revision-pinning check |
| `supabase/tests/migration-replay-suite.mjs` | **New** — 27 assertions: chain replay, version uniqueness, re-stamp safety, guard re-run, negative controls |
| `package.json` | `test:replay`; `test:abd` extended |

Committed locally on `main`. **Not pushed.**

---

## 9. Determination

# READY FOR RESTORED-COPY REHEARSAL

The combined A+B+D chain applies deterministically from empty, carries no version collision, refuses both known unsafe separations, and survives being replayed against its own final schema — which is what a restored-copy rehearsal does. The one unknown that could disrupt a rehearsal, the ledger state at `20260807050000`, has a documented decision table whose every branch is verified by execution.

**Three preconditions, all Founder actions:**

1. **Deploy A + B + D as one unit.** Team D `20260817000500` must not be separated from Team A `20260818000100`; Team A `20260818000100` must not be separated from Team B `20260818000200`. The migrations enforce this, but a failed deployment is worse than a correct one.
2. **Run the read-only ledger reconciliation of §2 first**, and act on the decision table before pushing. This is a `SELECT` against `supabase_migrations.schema_migrations` and two `to_regclass()` calls — no migration is applied by it.
3. **Re-establish the verdict if Team B's or Team D's trees have moved.** `npm run test:abd` fails loudly on drift. Given that Team D's tree changed three times during this work, check before rehearsing rather than after.

**Not blocking the rehearsal, but blocking production:**

- Team B must reduce `20260818000200` to its guard only (§5).
- Team D must implement the tenancy projection (§3). Until then, Innovion tenant administrators remain unknown to Platform Foundation — a functional gap, not a security one.
- The external verification in §7 must be closed in an authorised non-production environment. **In particular: no positive authentication path and no mobile-device capability has been verified by Team A, and neither should be treated as proven.**

**This is not a determination that the platform is ready for production.** It is a determination that the migration chain and authority architecture are coherent enough to be rehearsed against a restored copy, which is the next step the Founder asked about.
