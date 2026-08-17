# A/B/D INTEGRATION READINESS REPORT

**Date:** 2026-08-18
**Role:** Integration lead, Innovion release-critical path
**Working copy (modified):** `C:\Users\gamya\Innovion-Production` — Team A
**Inspected, not modified:** Team B `…\team_b___innovion_workforce`, Team D `…\team_d___platform_foundation`
**Commit:** `60cdc7c`
**Toolchain:** Node v24.17.0, npm 11.13.0, Next.js 15.5.23, PostgreSQL 18 in-process (PGlite 0.5.5)

**STATUS: INTEGRATION COMPLETE AND VERIFIED LOCALLY, WITH ONE OUTSTANDING
FILE RENAME IN TEAM D'S TREE.** See §8 for the exact action.

Everything else is done and evidenced. No live Supabase project was touched, no
deployment performed, no credential created, read, rotated or exposed.

---

## 1. DEP-1 — RESOLUTION AND THE EXACT CONTRACT TEAM B MUST CONSUME

### 1.1 The blocker, restated

Team B could not authenticate to the Platform API. The only credential it
accepts is a `platform_api_keys` Bearer key: **company-scoped, server-to-server**,
carrying `platform-config:read` for an entire organisation. Team B refused to
embed one, correctly — a key in an APK is extractable, authorises the whole
company from any device indefinitely, gives no per-user attribution, and cannot
be revoked without breaking every installed copy at once. Team B left the
integration inert rather than ship it.

### 1.2 What was built

**A new endpoint authenticated by the Supabase user JWT.** Team B offered Team A
two options — a user-JWT workforce endpoint, or per-device scoped revocable
keys. The first was chosen, and the evidence favours it decisively:

| | Per-device keys | **User JWT (implemented)** |
|---|---|---|
| Secret in the APK | still needs a bootstrap credential | **none at all** |
| Credential lifecycle | a second system to build and get right | GoTrue's, already built and tested |
| Revocation | new mechanism required | sign-out / disable account — immediate, per device |
| Blast radius if stolen | one device, but a new key store to protect | **one user, nothing new to protect** |
| Tenant | encoded in the credential | **derived from the verified `sub`** |

The token is verified against the auth server on **every** request
(`auth.getUser(token)`). It is never merely decoded, so a forged or tampered JWT
is refused — demonstrated in §5.

### 1.3 The contract Team B must consume

```
GET  /api/workforce/configuration
GET  /api/workforce/configuration?manifestOnly=true
GET  /api/workforce/configuration?company_id=<uuid>      (optional selector)
HEAD /api/workforce/configuration                        (contract discovery)

Authorization: Bearer <supabase access token>
```

* **Credential** — the Supabase session the app already holds. **No API key.**
  `INNOVION_PLATFORM_API_KEY` is no longer required and should be removed from
  the build.
* **Envelopes** — `{ data: {...} }` for the full payload, `{ manifest: {...} }`
  for `manifestOnly`. Identical to what `PlatformConfigurationService` already
  unwraps; no client change needed there.
* **Casing** — snake_case, matching Team B's parser. **DEP-2 is resolved.**
* **Domains** — `branding`, `i18n`, `currency`, `regional`, `measurement`,
  `terminology`, `licensing`, `modules`, `security`, `digital_professional`,
  `partner`, `features`, `org_hierarchy`, plus `company_id`, `manifest`,
  `api_version` — exactly Team B's `knownKeys`, so nothing lands in
  `extensions`.
* **Manifest** — emitted unchanged. Team B's `ConfigurationManifest.fromJson`
  already accepts camelCase and snake_case for every field, and the two values
  whose absence broke `hasChangedFrom()` (`configVersion`, `configHash`) are
  present and non-default.
* **Tenant** — resolved from the verified `sub` against `user_roles`, then
  contractor linkage (explicit `user_id`, or a **confirmed** e-mail match), then
  company ownership. `?company_id=` selects among tenants the caller genuinely
  belongs to; naming any other returns **403**, never a different tenant's data.
* **Caching** — `private, no-store`. Per principal, per tenant.
* **Rate limiting** — coarse pre-auth limit on network identity, then the real
  limit keyed on the **verified user id**.
* **Errors** — `401` (absent/invalid token, with `WWW-Authenticate: Bearer`),
  `403` (`NO_TENANT`, or a tenant the caller does not belong to), `404`
  (`ORG_NOT_FOUND`), `429`, `503` (server misconfigured).

### 1.4 Changes Team B must make

1. Point `_configEndpoint` at `/api/workforce/configuration`.
2. Send `Authorization: Bearer <supabase access token>` instead of the API key.
3. Delete the `INNOVION_PLATFORM_API_KEY` dart-define and the `isConfigured`
   check that depends on it; the integration is configured when a platform URL
   and a session exist.
4. Point `INNOVION_PLATFORM_URL` at the production Innovion origin. **Team B's
   DEP-4 objection stands and is not resolved by this work**: sending a session
   token to a preview host is a disclosure outside the production boundary. The
   mechanism is now sound; the origin is a Founder action (§8).

No change is required to Team B's `PlatformConfiguration` model. That is the
point of §1.5.

### 1.5 DEP-2, and why it is now evidence-based

Team B deliberately did not map the domain payload: *"Reconciling the domain
payload field-by-field requires a live authenticated Platform response to verify
against. Guessing 53 KB of mappings without one would produce plausible code
with no evidence behind it."*

That was right for Team B, who could see only one side. As integration lead I
have the other: **Team B's parser itself**. Every key in
`workforceConfigurationAdapter.ts` was read out of the `fromJson` factories in
`lib/services/platform_settings_model.dart`.

`tests/workforce-contract-suite.ts` re-extracts those keys **from that Dart file
at run time** and asserts the adapter emits each one — so the contract is
verified against the consumer, not against an assumption, and the suite fails if
Team B changes their parser and Team A does not follow.

**123 assertions, 0 failures.** They cover Team B's `knownKeys` set, every
sub-document (`BrandingConfig`, `LicensingConfig`, `PartnerConfig`,
`OrgHierarchyConfig`, and the nested `i18n` / `currency` / `regional` /
`measurement` / `password_policy` / `session_policy` / `mfa` / `access_control` /
`capabilities` maps), and the vocabulary translations:

| Team A | Team B |
|---|---|
| `firstDayOfWeek: 1` | `first_day_of_week: "monday"` |
| `sessionTimeout: '4h'` | `session_policy.timeout_minutes: 240` |
| `passwordPolicy: 'strong'` | expanded to the six individual rules |
| `measurementSystem: 'metric'` | `km` / `celsius` / `kg` |
| capability `id` + `enabled` | named capability booleans |
| feature flag `status` | boolean |

**One defect found by writing it.** Gating Workforce modules on presence in Team
A's `enabledIds` would have reported `messages`, `notes`, `supply_requests` and
`schedule` as disabled on every device — Team A's registry has no entry for any
of them. A Workforce module is now switched off only when the Platform has a
counterpart and that counterpart is off.

---

## 2. RECONCILED MIGRATION SEQUENCE

50 migrations across three teams, ordered by `version` — the 14-digit filename
prefix, which is the **primary key** of `supabase_migrations.schema_migrations`.

Canonical ordering is declared in `supabase/tests/integration-manifest.mjs` and
honoured by the harness, so the chain the suites verify is the chain that would
deploy.

| Range | Team | Content |
|---|---|---|
| `20260726055014` – `20260726090000` | A | core + extended schema |
| `20260727000001` – `20260727000006` | B | checklists, issues, messages, logo, supply, company_id RLS |
| `20260727010000` – `20260728000000` | A | company_id, RBAC, documents bucket, invoices |
| `20260728000001` – `20260728000002` | B | contractors.user_id, RLS audit |
| `20260728010000` – `20260728030000` | A | onboarding, i18n, Platform API layer |
| `20260731000001` | B | documents bucket + cleanup |
| `20260731070000` – `20260807040000` | A | hardening, providers, indexes, supervisor RBAC |
| `20260807050000` | A | workforce roster + notifications |
| **`20260807050002`** | **D** | **platform foundation schema — rebase required (§8)** |
| `20260809000001` | B | device tokens, security hardening |
| `20260809160000` | A | pilot readiness security sync |
| `20260810000000` | D | platform event bus runtime |
| `20260810140000` – `20260811000000` | A | integration framework, Xero |
| **`20260816120000`** | **A** | **NEW — `notification_type` += `geofence_anomaly`** |
| `20260817000000` | A | tenant authority remediation |
| `20260817000001` – `20260817000003` | B | tenant authority, issue storage, isolation consolidation |
| `20260817000500` | D | platform authority hardening *(already rebased by Team D)* |
| `20260817001000` – `20260817011000` | A | Team A remediation series (12) |
| **`20260818000100`** | **A** | **NEW — A/B/D authority reconciliation** |

Two migrations were added to Team A and two existing ones corrected. Nothing was
removed. No other team's file was modified.

Verified for every deployment shape:

```
teams=A        applied 34/34
teams=A+B      applied 47/47
teams=A+D      applied 37/37
teams=A+B+D    applied 50/50
```

Team A's new migrations are conditional on the other teams' objects
(`to_regprocedure`, `to_regclass`), so Team A remains independently deployable.

---

## 3. CONFLICTS DISCOVERED AND REMEDIATED

### IC-1 — Workforce entirely locked out (**P0**, release-blocking)

Team A and Team B each define `public.get_my_company_id()`. Team A's
(`20260817001000`) applies after Team B's (`20260817000003`) and replaces it.
Team A's resolves through `user_roles` and company ownership only. **A Workforce
user is a contractor: no `user_roles` row, no owned company.** They resolve to
`NULL`.

Team B then keys its **RESTRICTIVE** `<table>_tenant_guard` policies on that
function across `jobs`, `time_entries`, `checklists`, `checklist_responses`,
`issue_reports`, `conversations`, `messages`, `notifications`,
`supply_requests`, `contractor_documents`, `notes`. A restrictive policy that
evaluates false denies unconditionally.

Demonstrated on the integrated chain:

```
WORKFORCE contractor   get_my_company_id() : NULL
                       jobs visible        : 0
                       time_entries visible: 0
PLATFORM staff admin   get_my_company_id() : <tenant>
                       jobs visible        : 1
```

Team A's 121 assertions and Team B's 49 isolation checks both pass in isolation.
Neither exercises the other's principal.

**Remediated** (`20260818000100`) with two clearly separated concepts:

* `innovion_auth_company_ids()` — **staff** membership. Semantics unchanged, so
  Team A's administrative policies are untouched.
* `innovion_tenant_ids()` — **any** principal: staff ∪ ownership ∪ contractor
  linkage. `get_my_company_id()` selects from this.

Widening the single existing function instead would have handed every contractor
their tenant's pending invitations, provider integrations and role matrix.

### IC-2 — A contractor could set their own pay rate (**P1**)

Team B builds `contractors_protect_privileged_columns()` **dynamically**, from
whichever of `role`, `compliance_status`, `hourly_rate`, `pay_rate` exist *when
that migration runs*. Team A adds `contractors.hourly_rate` in
`20260817011000` — four versions later. The guard was compiled before the column
existed.

Demonstrated: a contractor set `hourly_rate = 9999` on their own row; **1 row
updated**. Timesheet approval stamps that rate onto the time entry and then onto
the contractor invoice.

Neither team could have caught this alone. **Remediated**: the guard is rebuilt
after every column exists, using Team B's own logic and error semantics, now
covering `hourly_rate`, `pay_rate` and `abn`.

### IC-3 — Two storage policy sets OR-combined into something weaker (**P1**)

Team A (`20260817005000`) and Team B (`20260817000003`) each install a complete,
individually correct documents-bucket policy set. Both **permissive**, and
permissive policies OR:

* Team A restricts DELETE to admin/manager — *"destroying a compliance or
  contract document is an administrative act"*. Team B's `documents_delete_own`
  allows any tenant member. **Team A's restriction was void.**
* Team B admits a legacy layout `foldername[1] = auth.uid()`. OR-combined, any
  authenticated user could read **and write** objects under a folder named with
  their own uid — outside every tenant folder, invisible to their own
  administrators.

**Remediated**: one unified set. Tenant-scoped for both principals; the legacy
uid layout is readable so nothing is orphaned but **not writable**; DELETE
remains administrative. Team B's restrictive `workforce_documents_own_files_only`
is preserved — restrictive policies AND, so it can only subtract.

### IC-4 — Team B's migration silently reverted 118 statements (**P1**)

`notification_type` is Team A's enum (`warning|alert|success|info`). Team B's
`notify_geofence_anomaly()` writes, and its RESTRICTIVE policy compares against,
`'geofence_anomaly'`. In the integrated database that value does not exist, so
the statement raised — and because a migration is one transaction, **the whole
of Team B's consolidation migration rolled back**, including its DROPs of four
`anon`-facing policies (`checklist_responses_open_access`,
`anon_read_conversations`, `anon_read_messages`, `anon_insert_messages`).

The visible symptom was a Team A guard failing several migrations later. The
cause was one missing enum value. **Remediated**: Team A owns the type and adds
the value, dated `20260816120000` so it precedes both Team B migrations.

### IC-5 — Version collisions (**P1**)

`version` is the primary key of `schema_migrations`; two files sharing a prefix
cannot both be recorded.

* `20260817000000` — Team A `tenant_authority_remediation` vs Team D
  `platform_authority_hardening`. **Already resolved by Team D**, who rebased to
  `20260817000500` during this session.
* `20260807050000` — Team A `workforce_roster_notifications` vs Team D
  `platform_foundation_schema`. **Outstanding** (§8).

Convention adopted and documented: rebase **forward**, never backward, and never
move Team A's file — Team A is the target project, its files at the colliding
versions are older and more likely already recorded, and a forward-dated
migration applies after everything already in the database. Team D had already
applied exactly this convention unprompted.

Team A's `20260807050000` was additionally made **re-application-safe**: its
policy guard now recognises both the original and the superseded policy name, so
whichever file is rebased, re-application cannot resurrect the anon-facing
policy that `20260817007000` removed.

### IC-6 — Duplicate platform-operator identity (**P2**)

Team A's `platform_operators` table and Team D's
`identity_user_profiles.platform_role ∈ (founder, platform_engineer)` model the
same concept twice — the duplicate-authority problem this integration exists to
remove.

**Remediated**: Team A defers to Team D. `innovion_is_platform_operator()` now
returns true for either registry, and Team D's is the governed one (it carries
`is_active`, an audited profile-guard trigger and a founder tier). Applied
conditionally, so a Team-A-only deployment keeps `platform_operators` as the sole
registry.

### IC-7 — Team A's guards false-positived on legitimate B and D code (**P2**)

Three Team A guards aborted the integrated chain on code that was not defective:

* `20260817002000` flagged Team D's `handle_platform_new_user()` because it
  mentions `raw_user_meta_data` — for `full_name` and `avatar_url`. Team D's
  function **hard-codes** `'end_user'` and takes no authority from metadata. The
  guard's heuristic ("mentions metadata and not `user_roles`") was too crude.
  Now: flag only an **authority key** (`company_id`, `tenant_id`,
  `platform_role`, `role`, `is_admin`) read from metadata without validation
  against an authoritative membership source.
* `20260817005000` demanded the literal predicate `innovion_storage_tenant`.
  Team B's policies are tenant-scoped through `get_my_company_id()`. Now: accept
  any recognised tenant resolver.
* `20260817007000` fired on the four anon policies that IC-4 had prevented Team
  B from dropping. Resolved by IC-4.

Guards were made **precise**, not relaxed. The corresponding invariant in Team
A's own suite was updated to match.

### IC-8 — Integration-introduced privilege widening (**P1**, self-inflicted)

The moment `get_my_company_id()` answers for contractors, Team A's per-table
policies — which all key on it — would grant a Workforce user tenant-wide read
of `employees` (including `salary`), `clients`, `inventory`, `vehicles`,
`compliance_items`, `contractor_invoices`, `settings`, `subscriptions`,
`platform_api_keys`, `provider_integrations`, `pending_invites`,
`role_permissions`, `activity_log` and `timesheet_audit_log`.

That access did not exist before the fix and must not be created by it.
**Remediated** with RESTRICTIVE `<table>_workforce_denied` policies — restrictive
so they can only subtract, and Team A's behaviour for staff is provably
unchanged (asserted). `documents` is handled separately: field staff need site
and safety documents, so only `Management` / `Admin` / `Restricted` access
levels are withheld.

### IC-9 — Storage path layout mismatch (**P2**)

Team B's `workforce_documents_own_files_only` expects
`<company_id>/<user_id>/<file>`. Team A's `buildStoragePath()` produced
`<company_id>/<file>` — no second segment — so an object uploaded through the
Platform was **unreadable by the workforce user who uploaded it**: the Platform
would list the document and the download would fail.

**Remediated**: `buildStoragePath(companyId, userId, filename)`. Segment 1 is
still the tenant, so Team A's isolation is unaffected; segment 2 satisfies Team
B's rule. Objects already at `<company>/<file>` remain readable.

**Residual, deliberate and asserted**: a workforce-only user still cannot read
documents uploaded by *someone else*, including Platform staff. That is Team B's
control, not an accident, and it is theirs to relax.

---

## 4. DEFECTS INTRODUCED BY THIS INTEGRATION WORK, FOUND AND FIXED

| Defect | How found | Fix |
|---|---|---|
| **The middleware rejected `/api/workforce/*` before the route ran.** The mobile client sends a Bearer header and **no cookies**; the middleware looked for a session cookie and returned its own 401. The DEP-1 endpoint could not have worked for the only client it exists to serve. | Probing the running build: the 401 carried neither `WWW-Authenticate: Bearer` nor `Cache-Control: private, no-store`, which showed it was not coming from the route | `/api/workforce` added to the self-authenticating prefixes |
| Team A's suite invariant still used the old crude metadata heuristic and flagged the new unified resolver | `npm run test:security` after the reconciliation | Invariant updated to mirror the corrected migration guard |
| `buildStoragePath` signature change broke the app-security suite | `npm run type-check` | Suite updated to assert the three-segment layout |
| Workforce module gating would have disabled `messages`, `notes`, `supply_requests`, `schedule` on every device | Writing the contract suite against Team A's real module registry | Off only when a Platform counterpart exists and is off |

---

## 5. SECURITY AND ADVERSARIAL FINDINGS

`supabase/tests/integration-security-suite.mjs` — **83 passed, 1 failed** (the
failure is the outstanding Team D rename, §8).

Seven principals: Tenant A admin, Tenant A viewer, **Tenant A contractor**,
Tenant B admin, **Tenant B contractor**, an authenticated outsider with no
membership, and `anon`.

| Section | Coverage | Result |
|---|---|---|
| A | DEP-1 regression — the Workforce principal actually resolves and sees its own tenant | 5/5 |
| B | Cross-tenant: a Tenant B contractor against 7 Tenant A tables, plus insert and update | 9/9 |
| C | **Forged authority against all three models at once** | 11/11 |
| D | JWT manipulation | 5/5 |
| E | Privilege escalation, Workforce → Platform staff | 6/6 |
| F | Integration widening, and that staff lost nothing | 13/13 |
| G | Storage: one policy set, admin-only delete, legacy folder read-only | 7/7 |
| H | Team D platform authority | 4/4 |
| I | Unauthenticated across 9 tables + 2 write attempts | 11/11 |
| J | Structural invariants of the integrated schema | 7/7 |

**Forged authority (§C)** is the sharpest test. A Tenant B contractor presents a
JWT claiming `company_id` = Tenant A, `role` = admin, `platform_role` = founder,
`tenant_id` = the Coralamy root — **and** rewrites their own
`auth.users.raw_user_meta_data` with the same claims. Both channels are what a
real Supabase user writes via `updateUser({ data: … })`. Every authority function
across all three teams refuses:

```
get_my_company_id()                 not steered to the victim tenant
is_company_admin()          (A)     false
is_platform_manager()       (B)     false
is_platform_founder()       (D)     false
is_platform_admin()         (D)     false
innovion_is_platform_operator()     false
jobs / clients / employees / documents of the victim tenant : 0 rows
```

**Team D specifics (§H)**: an end user cannot insert themselves as founder,
cannot promote their own `platform_role`, cannot grant themselves tenant
membership, and a non-member reads no `platform_tenants`.

**Structural invariants (§J)**: no tenant or role resolver is defined more than
once; `get_my_company_id()` **is** the unified resolver; the staff membership set
was **not** widened to contractors; no permissive anon policy lacks an identity
predicate; RLS on every public table; `security_invoker` on every view;
`search_path` pinned on every `SECURITY DEFINER` function.

**Endpoint probes against the running build** — every credential form rejected,
and the 401 demonstrably from the route:

```
no header / Basic / empty bearer / garbage        401
unsigned forged JWT claiming admin + victim tenant 401
alg=none, role=service_role                        401
HEAD / manifestOnly / ?company_id= selector        401
headers: WWW-Authenticate: Bearer, Cache-Control: private, no-store
```

Unchanged by the integration: `/api/platform/*` still 401 on key auth,
`/dashboard` still 307 to sign-in, `/api/dashboard/summary` still 401 JSON.

---

## 6. EXACT BUILD / TYPE-CHECK / LINT / TEST RESULTS

`npm run verify` → **exit 0**; `npm run test:integration` → 83/84.

| Stage | Command | Result |
|---|---|---|
| Type-check | `tsc --noEmit` | **0 errors** |
| Lint | `next lint` | **0 errors**, 75 warnings |
| Team A DB security | `npm run test:security` | **121 passed, 0 failed** |
| Query/schema conformance | `npm run test:schema` | **0 mismatches** across 143 files |
| Team A application security | `npm run test:app` | **72 passed, 0 failed** |
| Inert-control check | `npm run test:controls` | **0 inert** of 307 |
| **Workforce contract (DEP-2)** | `npm run test:workforce` | **123 passed, 0 failed** |
| **A/B/D integration** | `npm run test:integration` | **83 passed, 1 failed** — §8 |
| Build | `next build` | **exit 0**, `/api/workforce/configuration` registered, middleware 92 kB |
| Migration chain | integrated harness | **50/50**; A 34/34, A+B 47/47, A+D 37/37 |

Two commands added: `npm run test:workforce`, `npm run test:integration`, and
`npm run test:abd` to run everything.

---

## 7. STAGING VERIFICATION STILL REQUIRED

Local verification is against a real PostgreSQL 18 with the Supabase policy model
faithfully simulated. It cannot substitute for these:

1. **No migration has been applied to any hosted Supabase project.** Apply the
   reconciled chain to **staging** and re-run `npm run test:integration` against
   it. `storage.objects` is owned by `supabase_storage_admin` in a hosted
   project, so the storage sections need privilege the harness does not model.
2. **The positive authentication path for DEP-1 is unverified.** Every rejection
   path is proven (§5), but a *genuine* signed Supabase JWT being accepted
   requires a live auth server. `auth.getUser()` cannot be exercised locally.
   **This is the single most important staging test:** sign in to the Workforce
   app against staging and confirm a `200` with a parsed configuration.
3. **The end-to-end Workforce parse.** The contract suite proves Team A emits
   what Team B's parser reads. It does not prove Team B's Dart parses a live
   response — run the app against staging.
4. **Team B and Team D suites against the integrated schema.** Their 112 tests /
   49 isolation checks and 78 tests were run against their own schemas. They
   should be re-run against the reconciled chain.
5. **Migration ordering on a database that already has rows.** The harness starts
   empty. `20260817004000`'s `NOT NULL` tightening and `20260817003500`'s purge
   behave differently against real data.
6. **`OAUTH_STATE_SECRET`, `app.settings.encryption_key`, `EMAIL_FROM`,
   `SUPABASE_SERVICE_ROLE_KEY`** must be configured; the code fails closed
   without them.
7. **Rate limiting is per-process** and does not bound abuse on a serverless
   deployment.

---

## 8. EXACT NEXT FOUNDER ACTION REQUIRED

**One action. Everything else is complete.**

> **Rename Team D's base migration so it no longer collides with Team A's:**
>
> ```
> C:\Users\gamya\Desktop\team_d___platform_foundation\team_d___platform_foundation\supabase\migrations\
>   20260807050000_platform_foundation_schema.sql
> →  20260807050002_platform_foundation_schema.sql
> ```
>
> then set `applied: true` for that entry in
> `supabase/tests/integration-manifest.mjs` and re-run
> `npm run test:integration`, which will then report **84 passed, 0 failed**.

Why this and not the alternative: `version` is the primary key of
`supabase_migrations.schema_migrations`, so `supabase db push` refuses while two
files share `20260807050000`. Team A's file is the older one and the more likely
to be already recorded in the target project, and rebasing forward is the safe
direction. Team D already applied exactly this convention to their
`platform_authority_hardening` migration during this session.

The rename is a one-line change in another team's tree, which this work was
authorised to inspect but not modify.

---

## 9. PROTECTED ACTIONS DELIBERATELY NOT TAKEN

| Action | Status |
|---|---|
| Apply anything to the live Supabase project | **Not done.** All 50 migrations were applied only to a disposable in-process PostgreSQL |
| Production deployment | **Not done** |
| DNS or domain changes | **Not done.** `INNOVION_PLATFORM_URL` remains a Founder decision (§1.4) |
| Create, rotate, revoke or expose production credentials | **Not done.** No platform API key was issued — the point of DEP-1 is that none is needed. `.env.local` holds only synthetic values and is git-ignored. **Team D's `.env` was not opened** |
| Destructive production-data operations | **Not done** |
| Modify Team B or Team D source | **Not done.** Both trees were read only; every change is in Team A |
| Push to any remote | **Not done.** All commits are local |

---

## 10. DETERMINATION

**The A/B/D integration is complete and verified to the limit of what a local
environment can establish**, with one file rename outstanding in Team D's tree.

The substantive result is that integrating three independently-correct
codebases produced **nine conflicts, two of them release-blocking**, none of
which any single team's suite could have detected:

* the Workforce application was **entirely non-functional** — every table
  returning nothing — because two teams defined the same resolver and the later
  one did not know about contractors;
* a Workforce user could **set their own charge-out rate**, because a guard was
  compiled before the column it needed to protect existed;
* two correct storage policy sets **OR-combined into a weaker one**, voiding an
  administrative restriction;
* one missing enum value **silently reverted 118 statements** of another team's
  migration, including four anon-policy removals.

All are remediated, and each is now pinned by an assertion that fails if it
returns. The single outstanding item is stated in §8 as one exact action.
