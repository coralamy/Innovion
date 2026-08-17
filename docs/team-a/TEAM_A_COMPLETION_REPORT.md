# TEAM A — INNOVION PLATFORM — COMPLETION REPORT

**Date:** 2026-08-17
**Working copy:** `C:\Users\gamya\Innovion-Production` (Windows, local, authoritative Team A copy)
**Baseline commit:** `57e2573` — Initial clean production baseline
**Delivered commits:** `ec57504`, `6e0e76a`
**Toolchain executed:** Node v24.17.0, npm 11.13.0, Next.js 15.5.23, PostgreSQL 18 (in-process, PGlite 0.5.5)

**DETERMINATION: READY FOR INDEPENDENT AUDIT** — subject to the live-environment
verifications listed in §9, none of which an audit of this repository can
substitute for, and none of which were performed because they are protected
actions.

---

## 0. ENVIRONMENT VERIFICATION

All four preconditions were confirmed before any work began.

| Check | Result |
|---|---|
| Windows local working copy | `C:\Users\gamya\Innovion-Production`, Windows NT 10.0.26200 |
| Node executes | `node --version` → `v24.17.0` |
| npm executes | `npm --version` → `11.13.0` |
| `registry.npmjs.org` reachable | `Test-NetConnection … -Port 443` → `True` |
| Prior Team A remediation present | 4 tenant-authority migrations + `supabase/tests/` harness present and preserved |

No prior work was discarded. The four pre-existing migrations
(`20260817000000`, `20260817001000`, `20260817002000`, `20260817003000`) and the
existing `supabase/tests/tenant_isolation_suite.sh` harness are retained
unmodified. They were treated as work requiring verification, and were verified
(§4, sections A–C and H).

---

## 1. REPRODUCIBLE BUILD — package-lock.json / .gitignore

**Defect.** `.gitignore` listed `package-lock.json`, so the lockfile was never
committed. A clean clone had no lockfile, `npm ci` was impossible, and every
install re-resolved the full transitive tree.

**Remediation.** `.gitignore` corrected; `package-lock.json` committed
(311 KB → now tracked).

**Proof executed.** `node_modules` deleted in full, then:

```
npm ci --no-audit --no-fund     → exit 0, "added 440 packages in 22s"
npm run verify                  → exit 0 (type-check, lint, 4 test suites, build)
```

A clean dependency installation works and reproduces the entire green pipeline.

---

## 2. VERIFICATION RESULTS — EXACT

Command: `npm run verify` (`type-check && lint && test && build`), run on a
freshly `npm ci`-installed tree.

| Stage | Command | Result | Baseline at start of session |
|---|---|---|---|
| Install | `npm ci` | **exit 0**, 440 packages | impossible (no lockfile) |
| Type-check | `tsc --noEmit` | **exit 0, 0 errors** | 70 errors |
| Lint | `next lint` | **exit 0, 0 errors, 75 warnings** | 9,932 lines of output; hundreds of errors |
| DB security suite | `node supabase/tests/security-suite.mjs` | **121 passed, 0 failed** | suite did not exist / not runnable on Windows |
| Query/schema conformance | `node supabase/tests/schema-conformance.mjs` | **255 columns across 143 files, 0 mismatches** | 33 mismatches |
| Inert-control check | `node supabase/tests/dead-controls.mjs` | **307 buttons inspected, 0 inert** | 28 inert |
| App security suite | `tests/app-security-suite.ts` | **72 passed, 0 failed** | suite did not exist |
| Build | `next build` | **exit 0**, 59 routes + middleware (92 kB) | failed once errors were no longer suppressed |
| `npm audit` | — | 3 high remaining (§9) | 13 (1 low, 1 moderate, 11 high) |

**Runtime verification** against the built production server (`next start`),
unauthenticated, by HTTP probe:

- 11/11 protected routes → `307` to `/sign-up-login?next=…`; response body 32 bytes, no markup leaked.
- 6/6 public routes → `200`.
- 3/3 API routes → `401` with `{"error":"Unauthorized"}` and `WWW-Authenticate: Bearer` — not an HTML redirect.
- 7/7 security headers present; `X-Powered-By` absent.
- 13 bypass attempts (trailing slash, double slash, dot-segment, parent traversal, encoded, null byte, fake static extension, `_next/static` and `assets` prefix traversal, case variation) — **no bypass found**.

Migrations: **32 total, 13 authored by Team A**, all applying cleanly in
timestamp order including every regression guard.

---

## 3. VERSION 106 — FINDING-BY-FINDING RECONCILIATION

Each row below is backed by an executable assertion in
`supabase/tests/security-suite.mjs` §L, or by the stated runtime probe. Nothing
here is claimed without having been run.

| ID | Finding (as recorded in V106) | V106 status | Now | Evidence |
|---|---|---|---|---|
| **C-01** | `public.settings` policy uses `TO public` — anonymous access possible | Open (Critical) | **Closed** | §L: no policy on `settings` grants `public`/`anon`; anon reads 0 rows |
| **H-01** | `notifications` INSERT allows `company_id IS NULL` — cross-tenant injection | Open (High) | **Closed** | §L: no `company_id IS NULL` in any `with_check`; injection attempt denied |
| **H-02** / **SEC-M-01** / **EDR-014** | `storage.objects` — no company-level path isolation on documents bucket | Open; V106 rated **Medium, "NO — application layer enforcement is in place"** | **Closed** | §F + §L. **The V106 assessment was wrong**: see §5.2 |
| **H-03** | `activity_log` INSERT does not enforce `company_id` — audit-trail pollution | Open (High) | **Closed** | §L: cross-tenant audit insert denied |
| **H-04** / **SEC-H-01** | Viewer can modify own role via direct API | Open (High) | **Closed** | §C + §L: self-escalation returns 0 rows |
| **H-05** / **SEC-H-02** | Any member can create Platform API keys | Open (High) | **Closed** | §L: viewer denied; **admin still permitted** (regression case) |
| **H-06** / **SEC-H-03** | No filename sanitisation in document upload | Open (High) | **Closed** | `sanitiseFilename` present; app suite §C: 8 traversal payloads all confined to the tenant folder |
| **H-07** / **SEC-H-04** | No rate limiting on `/api/platform/*` | Open (High) | **Closed, and corrected** | All 7 routes now gated; two routes had **no** limiter at all; limiting moved off the spoofable `X-Forwarded-For` onto the verified key id |
| **SEC-EXT-01** | pgcrypto production encryption key not set | Outstanding | **Fails closed** | §L: an unset key now raises instead of using the published fallback. Setting the live key remains a Founder action (§9) |
| **SEC-EXT-02** | Sentry DSN not configured | Outstanding | **Unchanged — external** | Not addressed; external credential |
| **SEC-EXT-03** | Google Analytics not configured | Outstanding | **Unchanged — external** | Not addressed; external credential |
| **P0 (data)** | Remove all mock/dummy data from production DB | Open | **Closed in migration** | `20260817003500` purges tenant-less fictitious rows; guard fails the migration if any remain |
| **P0 (data)** | Stripe live Price IDs, Resend API key | Open | **Unchanged — external** | Protected: production credential creation |
| **P1 (UI)** | Loading / empty states on data screens | Open | **Partially pre-existing** | Present on the pages inspected; not exhaustively audited — see §10 |

### 3.1 The V106 assessment that was materially wrong

**H-02 / SEC-M-01 / EDR-014** was recorded as *Medium*, *not a pilot blocker*,
on the basis that "application layer enforcement is in place" — meaning
`documentService.buildStoragePath()` constructs `{companyId}/{filename}` keys.

Constructing a path in the client is not enforcement. The four
`documents_*_policy` policies on `storage.objects` tested only
`bucket_id = 'documents'`. Demonstrated on the migrated schema, as a Tenant B
**viewer** — the least-privileged role in the product:

```
list   Tenant A's stored documents  : 1 object visible
delete Tenant A's stored documents  : 1 object DESTROYED
write  into Tenant A's folder       : OBJECT CREATED
```

This is unrestricted cross-tenant read, write and destruction of every stored
document — contracts, SDS sheets, HR records, incident evidence. It should have
been rated Critical and treated as a blocker. It is now enforced in the database
(`20260817005000`) and verified.

---

## 4. DEFECTS DISCOVERED AND REMEDIATED

Beyond the V106 list. Severity is my assessment.

### 4.1 Database / tenant isolation

| # | Severity | Defect | Remediation |
|---|---|---|---|
| D-1 | **P0** | 13 `company_access_*` policies granted `TO public` (which includes `anon`) with a `company_id IS NULL` disjunct in **both** `USING` and `WITH CHECK`. Unauthenticated INSERT demonstrated on `jobs`, `clients`, `documents`, `incidents`, `employees`; unauthenticated SELECT returned 6 `documents` rows. A member could also `UPDATE … SET company_id = NULL` to publish their own tenant's rows to everyone. | `20260817004000` — policies dropped (they were redundant with the correctly-scoped per-command set); `company_id` set `NOT NULL` where no orphans remain |
| D-2 | **P0** | Four views (`workforce_roster`, `integration_connection_status`, `xero_connection_health`, `sync_health`) were owned by a superuser with no `security_invoker`, so they read base tables **as the owner and bypassed RLS entirely**. Demonstrated: a user with no membership of the tenant read that tenant's row through the view while being correctly denied on the base table. `workforce_roster` exposes every tenant's staff and contractor names, e-mail addresses, phone numbers, locations and skills. Two of the four were explicitly `GRANT SELECT … TO authenticated` by their own migrations. The migrations asserted the opposite in comments ("The view inherits RLS from provider_integrations"). | `20260817006500` — `security_invoker = true` on every view, explicit grants, guard against reintroduction |
| D-3 | **P1** | `partners`, `partner_products`, `partner_revenue`: readable by any authenticated user; writable by **any** tenant admin, because the check asked "does this user hold 'admin' anywhere?" rather than scoping to a company. Every user who signs up and creates a company becomes an admin. | `20260817007000` — explicit `platform_operators` identity, empty by default (fail closed) |
| D-4 | **P1** | `integration_oauth_credentials` row access granted to every tenant member including `viewer`; the row contains the encrypted provider tokens | `20260817006000` — restricted to admin/manager; **column-level grants** so the token columns are unreachable by any end-user role at any privilege level |
| D-5 | **P1** | Eleven `SECURITY DEFINER` functions had no pinned `search_path`, including `is_account_read_only()` and several triggers | `20260817008000` |
| D-6 | **P1** | Migration `20260726090000` seeds fictitious records — named individuals, a named real-world venue, invented ABNs, incident reports and financial figures — with **no** `company_id`, on every deployment. Combined with D-1 these were world-readable. | `20260817003500` |

### 4.2 Application — authentication, authority, routing

| # | Severity | Defect | Remediation |
|---|---|---|---|
| D-7 | **P1** | **No `middleware.ts` existed.** All route protection was a client-side `useEffect` redirect in `AppLayout`. Every protected route returned `200` with full markup to an unauthenticated request; disabling JavaScript defeated it entirely. | `src/middleware.ts`, verified by runtime probe (§2) |
| D-8 | **P0** | `AuthContext.companyId` came from `user_metadata.company_id` — written by the user via `supabase.auth.updateUser()`. Every `.eq('company_id', companyId)` in the product took its tenant from a user-controlled value. | Resolved from `user_roles`; metadata may only *select* among proven memberships |
| D-9 | **P0** | `RBACContext` read the role from `user_metadata.role` **in preference to** the database, and **defaulted to `'admin'`** when no role row was found — reachable in normal operation because of the onboarding defect below | Authoritative `user_roles` only; fails closed to no permissions |
| D-10 | **P1** | `isEmailVerified()` returned `user?.email_confirmed_at !== null`, which is `true` for an unconfirmed user (the field is absent, not null) **and** for a signed-out visitor. It always returned true. | `Boolean(user?.email_confirmed_at)` |
| D-11 | **P0** | Onboarding discarded the `user_roles` upsert result. The insert was in fact being refused, so tenants were created with **no authoritative membership** — which is why the application had come to depend on metadata. | Error checked, membership re-read and confirmed before onboarding reports success; `role` no longer written to metadata |
| D-12 | **P1** | Onboarding "Skip" set `onboarding_complete: true` with no company and no role, producing a permanently empty account with no in-app route back to setup | Skip records only that setup was postponed |
| D-13 | **P1** | `/api/dashboard/summary` never checked for a session (it answered `200` with an all-zero dashboard to an anonymous caller), took its tenant from `user_metadata`, and set `Cache-Control: s-maxage=30` — a **shared-cache** directive on a per-tenant body keyed only by URL | 401 asserted, tenant from `user_roles`, `private, no-store` |

### 4.3 Application — Platform API

| # | Severity | Defect | Remediation |
|---|---|---|---|
| D-14 | **P1** | `authenticateApiKey` looked up the key hash with the **anon cookie client**. A machine caller has no session, so PostgREST evaluated as `anon`, and the only policy on `platform_api_keys` is `TO authenticated`. **Every Platform API key ever issued failed to authenticate; all seven routes returned 401 unconditionally.** | Service-role lookup with constant-time digest comparison |
| D-15 | **P1** | `platformConfigurationService` used the **browser** Supabase client. Inside a route handler there is no `document`, so its cookie adapter returned `[]` and it read as `anon` — every tenant-scoped policy matched nothing and `/api/platform/configuration` answered `404 ORG_NOT_FOUND` for valid keys. | Injectable data client; routes pass the service-role client after the key is verified and the tenant fixed |
| D-16 | **P1** | **33 queries selected columns that do not exist** (`partners.name`, `subscriptions.status`, `territories.is_exclusive`, `partner_revenue.mrr`, `companies.logo_url`/`licence_model`/`primary_colour`, `partner_products.is_active`, a `partner_types` embed with no foreign key to traverse, and the table `user_profiles`, which no migration creates). PostgREST rejects these; every call site destructured only `data` and discarded `error`. The partner, tenancy, branding and licensing surfaces returned nulls for every organisation. | All 33 corrected; `npm run test:schema` now fails the build if a query names a column that does not exist |
| D-17 | **P2** | Two routes had no rate limiting at all; the other five limited on the client-supplied `X-Forwarded-For` first entry, trivially rotated | Single `guardPlatformRequest` gate; coarse pre-auth limit on network identity, real limit on the verified key id |

### 4.4 Application — OAuth and integrations

| # | Severity | Defect | Remediation |
|---|---|---|---|
| D-18 | **P0** | The OAuth state cookie was **plain JSON** and the callback trusted its `companyId` and `userId`. `httpOnly` stops page JavaScript reading a cookie; it does not stop an attacker *sending* one. The attacker therefore chose both `state` and the value it was compared against — so the CSRF check compared two attacker-chosen values — and chose the tenant the credentials were written into. | HMAC-SHA256-signed state with a verified issue time; caller re-authenticated and tenant authority re-checked at the moment of use |
| D-19 | **P1** | Open redirect: `return_to` was taken verbatim and passed to `new URL(returnTo, request.url)`, which discards the base for an absolute URL — redirecting off-site from the application's own domain at the end of a trusted OAuth flow | `safeReturnTo()`; 13 payloads asserted in the app suite |
| D-20 | **P1** | **Every write in the OAuth callback was being refused and the errors discarded**, then the user was redirected with `?oauth_success=<provider>`. The tables have SELECT-only policies and the writes went through the end-user client. | Service-role writes with every error checked; `20260817006000` keeps the credential tables service-role-only by design |
| D-21 | **P0** | Encryption failure was treated as success: `const { data } = await rpc('encrypt_provider_config')` discarded the error and stored `data ?? null` | Encryption failure aborts the connection |
| D-22 | **P1** | `disconnect` authorised via `role_permissions` filtered **by company only, never by the caller's role** — it asked whether *any* role in the company has `can_manage_company`. With a single seeded row that returns true for every member, including a viewer, who could then disconnect the integration and revoke its tokens. | `requireTenantAdmin()` against `user_roles` |
| D-23 | **P1** | `refresh` had **no authorisation check at all** — any member could rotate the tenant's provider credentials and, on failure, drive the integration into `reauth_required` for everyone | `requireTenantAdmin()` |
| D-24 | **P1** | `decrypt_provider_config` was called with `{ encrypted_text: … }`; the parameter is `cipher_text`. The call could never resolve, so **provider-side tokens were never revoked on disconnect** and token refresh always fell through to "no refresh token available" | Corrected; revocation failure now reported to the caller instead of an unqualified success |
| D-25 | **P1** | Token refresh, on re-encryption failure, wrote `encryptedData ?? creds.encrypted_access_token` — retaining the **old** ciphertext alongside the **new** expiry | Refresh aborts and flags reauth |
| D-26 | **P2** | `params` destructured synchronously in all five dynamic route handlers; it is a `Promise` in Next.js 15 | Awaited (surfaced by the build once error suppression was removed) |

### 4.5 Application — email

| # | Severity | Defect | Remediation |
|---|---|---|---|
| D-27 | **P0** | The `send-email` Edge Function had **no authentication of any kind**, `Access-Control-Allow-Origin: *`, and an unrestricted caller-supplied recipient. Anyone reaching the URL could send mail from Innovion's sender to any address with content of their choosing. | Caller authenticated; recipient constrained per type (own address, an address genuinely invited by the caller's tenant, a worker in the caller's tenant, or the fixed support inbox) |
| D-28 | **P0** | Every template interpolated values raw into HTML — including `name`, which is `user_metadata.full_name` and therefore user-written, and `resetLink`, placed straight into an `href` | All interpolations escaped; call-to-action links built from `SITE_URL` + a fixed path |
| D-29 | **P0** | A `password_reset` type accepted a **caller-supplied reset link** | Type removed from both the function and `emailService`; recovery is issued by Supabase Auth |
| D-30 | **P2** | Sender hard-coded to `onboarding@resend.dev` — Resend's shared sandbox domain, with no SPF/DKIM/DMARC alignment for innovion.app | `EMAIL_FROM` required; the function refuses to run without it |
| D-31 | **P2** | Internal and provider error messages returned to the caller | Generic messages; detail logged |

### 4.6 Application — data capture (silent loss)

| # | Severity | Defect | Remediation |
|---|---|---|---|
| D-32 | **P0** | **Clock-out never persisted.** `timeEntryService.create()` was called with no `companyId`, so the row was refused; the page then pushed a locally fabricated record with a synthetic id into state, so the shift appeared saved. It was gone on the next load. | `companyId` passed; failure reported; the running session is **not** cleared unless the entry genuinely persisted |
| D-33 | **P1** | Four more create paths omitted the tenant and were being refused: `clients`, `employees`, `companies`, `checklists`. `checklists` also fabricated a saved record on failure. | All corrected; fabrication removed |
| D-34 | **P1** | `entry_date` and checklist `date` stored the literal string `"Today"`. Every record ever created carried it, `filter(e => e.date === 'Today')` matched everything regardless of age, and timesheet approval passed it into `contractor_invoices.work_date`. | ISO dates |
| D-35 | **P0** | **Touch signatures did not work.** The signature canvas bound only mouse events, so on the phone or tablet a supervisor actually signs on, nothing drew — while `touchAction: 'none'` still suppressed scrolling. On confirm, the drawing was discarded and the literal string `'signed'` stored in `signature_data`. A signed-off safety checklist carried no signature evidence. | Pointer Events with pointer capture; canvas exported as a PNG data URL and stored; stroke colour resolved from the computed style (it was set to the string `'var(--foreground)'`, which canvas ignores, leaving black-on-dark invisible); backing store scaled to the device pixel ratio |
| D-36 | **P1** | **Contractor rates did not exist.** `contractors` had no `hourly_rate` and no `abn`, yet the UI rendered "Hourly Rate" and "ABN" tiles for both. Timesheet approval read the rate from `time_entries.hourly_rate`, which nothing populated, so **every auto-generated contractor invoice was raised at $0.00/hr with a $0.00 total**, and carried no ABN. | `20260817011000` adds both columns with CHECK constraints; the rate is stamped onto the time entry at clock-out and onto the invoice at approval; `contractor_id` and `contractor_abn` now populated; **GST is taken from the tenant's localised tax rule instead of a hard-coded 10%** |
| D-37 | **P2** | `sendJobAssignment` was called with an **object** as its third positional argument, so assignment e-mails rendered `[object Object]` as the job title with site and date missing | Positional arguments corrected |

### 4.7 Build, configuration and hygiene

| # | Severity | Defect | Remediation |
|---|---|---|---|
| D-38 | **P1** | `typescript.ignoreBuildErrors: true` **and** `eslint.ignoreDuringBuilds: true` — production builds shipped with every type error and lint error suppressed | Both removed; the 70 type errors and all lint errors this exposed were fixed |
| D-39 | **P1** | No security response headers at all | CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `poweredByHeader: false` |
| D-40 | **P1** | `productionBrowserSourceMaps: true` — the full unminified application source was published to any visitor | Disabled |
| D-41 | **P1** | **The logger emitted nothing in production.** Every branch was guarded by `if (isDev)`, despite the file documenting the opposite. Every recorded authentication failure, credential-encryption failure and cross-tenant denial was discarded. | `info`/`warn`/`error` now emit in production |
| D-42 | **P1** | Session cookies written `SameSite=None` unconditionally, instructing the browser to attach the session to cross-site requests | `Lax` by default; `None` only under an explicit `NEXT_PUBLIC_EMBEDDED_MODE` — **see §8, this is a behaviour change requiring confirmation** |
| D-43 | **P1** | On cookie failure the full auth token, **including the refresh token**, was written to `localStorage`; and `window.fetch` was globally monkey-patched to attach the token as `x-sb-token` to every same-origin request, though nothing reads it | Fetch patch removed; the localStorage fallback retained only under the same explicit embedded-mode flag, off by default |
| D-44 | **P2** | Remote image allowlist named `images.unsplash.com`, `images.pexels.com`, `images.pixabay.com` and `img.rocket.new` — **zero** references anywhere in the source, but each authorised `/_next/image` to fetch and decode a remote image through the vulnerable bundled `sharp` | Allowlist emptied |
| D-45 | **P2** | `@dhiwise/component-tagger` shipped in production `dependencies`, unreferenced anywhere (verified by removal + clean build) | Removed |
| D-46 | **P2** | A stray `C:\Users\gamya\package-lock.json` made Next.js infer the wrong workspace root, mis-scoping output file tracing | `outputFileTracingRoot` pinned |
| D-47 | **P2** | `validate-env.ts` declared `: boolean` but returned `ValidationIssue[]`, its only caller cast through `unknown`, and the documented `exitOnFailure` behaviour was never implemented | Corrected and implemented |
| D-48 | **P2** | `supabase/functions` (Deno, URL imports) was inside the Next.js `tsconfig`, contributing 6 unfixable errors — a significant reason error suppression had been switched on | Excluded |
| D-49 | **P2** | Rate-limiter sweep compared against a hard-coded 60 s rather than each entry's own window, evicting live entries mid-window for any longer tier | Corrected |
| D-50 | **P2** | Sidebar displayed `user_metadata.role`, letting a user display any role they liked and contradicting their real permissions | Sourced from `RBACContext` |
| D-51 | **P1** | Settings displayed a hard-coded **"Visa ending in 4242, Expires 12/2027"** payment method for every organisation, beside an inert "Update" control. No payment method is stored anywhere. A user would reasonably conclude billing was configured. | Replaced with the true state and a link to Billing |
| D-52 | **P2** | **28 controls were fully styled and completely inert** — "Add Contractor", "Assign Job", "Edit Client", "Edit Site", "Reorder", "Change Password", "Upgrade to Enterprise", "View Jobs", "Manual Entry", "Refresh schedule", and others | 8 wired to real behaviour (including a full Add Contractor form and a working Change Password flow); the remaining 20 render through `<PlannedAction>`, which is `disabled`, `aria-disabled` and states that the action is unavailable. `npm run test:controls` fails the build if a new inert control appears |
| D-53 | **P2** | `LocalisationContext` re-queried `user_roles` with `.maybeSingle()`, which **raises** for any multi-tenant user, silently falling back to Australian defaults for currency, tax rate, date format and measurement system | Takes the tenant from `AuthContext` |
| D-54 | **P2** | `AppLayout` chained `.catch()` onto a `PostgrestFilterBuilder`, which has no `.catch` — the handler was never attached, so a failed provisioning lookup pinned the user on the loading spinner forever | Awaited inside an async function |
| D-55 | **P2** | Checklist sign-off wrote `toLocaleString('en-AU', …)` into `signed_off_at` — unsortable, unparseable, and wrong for any non-Australian tenant | ISO-8601 |

**Total: 55 defects discovered and remediated**, in addition to the 14 Version 106
findings reconciled in §3.

---

## 5. DEFECTS INTRODUCED BY MY OWN REMEDIATION, THEN FOUND AND FIXED

Recorded in full, including one that reached the working tree and one caught
before it did.

| # | Introduced by | Defect | How it was found | Fix |
|---|---|---|---|---|
| I-1 | `src/middleware.ts` (first version) | The gate redirected **every** unauthenticated request including JSON APIs. `fetch()` follows a 307 transparently, so the browser client received `200` and the sign-in page's HTML, then failed inside `response.json()` with a `SyntaxError` — an authentication failure presenting as a parse error. | My own adversarial probe of the running build: `/api/dashboard/summary` returned `307 → /sign-up-login` | `/api/*` now returns `401` JSON |
| I-2 | `src/lib/supabase/server.ts` | I set `httpOnly: true` on session cookies. The browser client reads the session from `document.cookie`; this would have made it invisible and produced a sign-in loop. | Caught by reasoning about the client before running anything | Reverted, with the constraint documented and the proper fix recorded as follow-up |
| I-3 | **PowerShell `Get-Content -Raw` / `Set-Content` round-trips** | Non-ASCII characters in **33 files (558 lines)** were re-encoded as mojibake, and **37 files** gained a UTF-8 BOM — including a BOM before a shebang. | ESLint `no-irregular-whitespace` on one line, which I traced to its root rather than patching the symptom | Wrote a precise inverse transform (CP1252 re-encode → strict UTF-8 decode, applied only to runs that decode validly and shorten, so correctly-encoded text is untouched); verified against `git` that a control file's non-ASCII content was restored exactly; **final scan: 0 mojibake, 0 BOMs**. I stopped using that edit pattern. |
| I-4 | `?client=` / `?site=` support on the jobs page | `useSearchParams()` without a Suspense boundary fails static prerendering | The build — **which only failed because I had removed `ignoreBuildErrors`** | Page body wrapped in `<Suspense>` |

I-3 is the most serious: it was silent, wide, and would have been committed. It
is also the clearest argument for the enforced pipeline — the corruption was
caught by a lint rule that had previously been suppressed at build time.

---

## 6. SECURITY AND TENANT-ISOLATION VERIFICATION

`supabase/tests/security-suite.mjs` — **121 assertions, 0 failures.**

The suite boots a real PostgreSQL in-process (PGlite/WASM), applies all 32
migrations in order, and attacks the result. A JWT is simulated by setting
`request.jwt.claims` — precisely how Supabase's PostgREST presents claims to
Postgres — combined with `SET ROLE anon|authenticated`, so RLS is evaluated
exactly as Supabase evaluates it. No network access; no hosted Supabase project
is touched.

**Threat model.** The attacker is a legitimate, authenticated, non-admin
(`viewer`) member of Tenant B who freely rewrites **both** client-writable
channels a real Supabase user controls — the `user_metadata` JWT claim **and**
the `auth.users.raw_user_meta_data` column, both written by
`supabase.auth.updateUser({ data: … })` — forging Tenant A membership and the
`admin` role. They never write `public.user_roles`. A second adversary is fully
unauthenticated.

| Section | Coverage | Result |
|---|---|---|
| A | Cross-tenant read across 14 tenant tables + 3 tenant-resolution functions + 2 admin predicates, under forged claims | 19/19 |
| B | Cross-tenant write: update, delete across 6 tables, insert into the victim tenant | 8/8 |
| C | Privilege escalation: self-promotion, bootstrap abuse, third-party grants, role deletion, ownership seizure, same-tenant escalation | 7/7 |
| D | Unauthenticated access: SELECT on 14 tables, INSERT with NULL tenant on 5, key hashes, role table | 21/21 |
| E | NULL-tenant escape: orphan rows now impossible even for a superuser; deliberate orphaning denied | 3/3 |
| F | Storage isolation: list, delete, write into a foreign tenant's folder; anon; **plus the legitimate-access regression** | 5/5 |
| G | Platform/partner data: read, write, cross-tenant revenue, catalogue, self-designation as operator; **plus own-revenue regression** | 6/6 |
| H | Credential encryption: key configured, published dev key refused, unset key fails closed, tampered ciphertext raises, token column unreadable even by an admin; **plus admin status-row regression** | 9/9 |
| H2 | Views must not bypass RLS: 4 views cross-tenant + anon; **plus own-tenant regression** | 6/6 |
| I | Onboarding bootstrap works, is single-use, grants no foreign visibility, cannot impersonate an owner | 5/5 |
| J | **Legitimate access regression** — 12 assertions that the remediation did not break the product | 12/12 |
| K | Structural invariants: RLS everywhere, no metadata authority in any policy or function, `search_path` pinned, no published dev key, nothing tenant-scoped granted to anon, no NULL-tenant grants, every view `security_invoker`, token columns ungrantable | 9/9 |
| L | Version 106 finding reconciliation (§3) | 10/10 |

`tests/app-security-suite.ts` — **72 assertions, 0 failures**: 13 open-redirect
payloads, 18 OAuth state forgery/tamper/expiry/foreign-secret cases, state token
uniqueness across 500 draws, 8 path-traversal payloads through
`sanitiseFilename`/`buildStoragePath`, scope-matching edge cases (prefix and
superstring must not grant), rate-limiter isolation and window behaviour, and
`X-Forwarded-For` spoof resistance.

**Sections J, and the explicit regression assertions inside F, G, H and H2,
exist because a tenant-isolation fix that simply denies everyone is not a fix.**

---

## 7. ADVERSARIAL FINDINGS AGAINST MY OWN WORK

Attacks I ran specifically against the remediation, not against the original code:

- **Middleware bypass:** 13 path-manipulation variants (trailing slash, `//`, `/./`, `/../`, percent-encoded, null byte, `.png` suffix, extension in query string, `_next/static/../../`, `assets/../`, case variation). No bypass. The 307 body is 32 bytes — no markup leaks.
- **State forgery:** raw JSON in the cookie (the original exploitable format) is rejected; payload swapped under a stolen signature is rejected; signature stripped or emptied is rejected; a single altered character is rejected; a state signed with a different server secret is rejected; an expired state is rejected; six malformed inputs are rejected.
- **Bootstrap abuse:** the onboarding path added in `20260817001000` was attacked as a route to admin in a foreign tenant, a second role in one's own tenant, and a grant to a third party. All denied, and the path proved single-use.
- **Deny-everything check:** every isolation section carries a positive regression case, so a policy that simply refuses all access would fail the suite.
- **Fail-closed check:** removing the encryption key, and removing tenant membership, produce refusal rather than silent success.

---

## 8. CHANGE REQUIRING FOUNDER CONFIRMATION

**Session cookie `SameSite`.** The platform previously wrote session cookies
`SameSite=None; Secure; Partitioned` unconditionally. `None` tells the browser
to attach the session to cross-site requests, which is a CSRF exposure. I
changed the default to `Lax` and gated `None` behind `NEXT_PUBLIC_EMBEDDED_MODE`.

The `Partitioned` attribute suggests the application may be embedded in a
cross-origin iframe (a preview host). **If Innovion is genuinely embedded, set
`NEXT_PUBLIC_EMBEDDED_MODE=true` and the previous behaviour is restored.** I did
not silently keep the insecure default, and I did not silently break an
embedding I cannot observe.

---

## 9. REMAINING EXTERNAL / LIVE-ENVIRONMENT VERIFICATION

None of these can be discharged from this repository. All are stated as
outstanding rather than assumed.

1. **The 13 Team A migrations have never been applied to a hosted Supabase project.** They apply cleanly to a real PostgreSQL 18 in-process, but `storage.objects` is owned by `supabase_storage_admin` in a hosted project; `20260817005000` must be applied with sufficient privilege. Apply to **staging** first and re-run the suite against it.
2. **The `send-email` Edge Function has not been executed.** Deno and a Supabase project are required. Its correctness is argued from the code, not demonstrated.
3. **`app.settings.encryption_key` is not set** (SEC-EXT-01). The schema now fails closed rather than using the published fallback, so provider credential storage will refuse to operate until it is set.
4. **`OAUTH_STATE_SECRET` must be generated and set**, or OAuth authorisation will refuse to start. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
5. **`EMAIL_FROM` must be set to a domain with SPF/DKIM/DMARC alignment**, replacing the Resend sandbox sender.
6. **`public.platform_operators` is empty by design.** Partner administration is deny-all until an operator is deliberately designated.
7. **Rate limiting is per-process.** On a serverless deployment the effective limit is `limit × instances` and a cold start resets it. A shared limiter (Upstash/Redis or the host's edge rate limiting) is required before the platform API can be described as rate limited under load. This is stated in the code, not glossed.
8. **3 high-severity npm advisories remain**, all transitive through the `postcss` and `sharp` copies bundled by Next.js 15. The only fix is Next.js **16**, a major upgrade. I patched Next 15.5.18 → **15.5.23**, closing 8 advisories including two high SSRF and a high DoS, and emptied the remote-image allowlist to remove the reachable `sharp` decode path. **Moving to Next 16 is a framework major upgrade and is a Founder decision, not a routine engineering one.**
9. **Content-Security-Policy retains `'unsafe-inline'` for `script-src`**, because the App Router emits inline bootstrap scripts. Tightening this requires the nonce-based CSP integration. Recorded, not claimed as complete.
10. **Session cookies are not `httpOnly`**, because the browser client reads them from `document.cookie`. Moving to httpOnly requires reworking that client (see I-2).
11. **Stripe live Price IDs, Resend API key, Sentry DSN, Google Analytics ID** — external credentials (SEC-EXT-02, SEC-EXT-03).

---

## 10. WORK DELIBERATELY NOT DONE

Stated explicitly rather than left implied.

- **20 features remain unbuilt** and are now rendered as visibly unavailable rather than as inert controls: edit forms for client, site, employee, vehicle, contractor and roster records; assign-job from a contractor or roster record; inventory reordering; manual time entry; per-job overflow actions; compliance certificate download; profile photo upload; full activity history; edit/reassign from the schedule popover. Building these is product scope, not remediation, and inventing half-working versions would be worse than an honest unavailable state.
- **Vault / F-04 is not adopted.** `20260817003000` removes the prohibited hard-coded key fallback from the existing pgcrypto implementation and makes it fail closed. That is not the same as migrating credential storage to Supabase Vault, and I have not claimed it is.
- **`/companies` was not removed.** It operates on the tenant table and now correctly shows only the caller's own organisation. Its create path is tenant-scoped and its unscoped read (which exposed the fictitious seed companies to every tenant) is fixed. Whether it should exist alongside `/clients` is an information-architecture decision for the Founder.
- **Loading/empty states (V106 P1)** were present on every page I touched but were not exhaustively audited across all 59 routes.
- **Mobile readiness, Android/iOS** — out of scope for this working copy (EDR-013 records Workforce as a separate project).

---

## 11. PROTECTED ACTIONS — NONE TAKEN

| Protected action | Status |
|---|---|
| Production deployment | **Not performed** |
| Live/production Supabase migration | **Not performed.** All 32 migrations were applied only to a disposable in-process PostgreSQL |
| DNS or domain changes | **Not performed** |
| Production credential creation, rotation, revocation, deletion | **Not performed.** `.env.local` contains only synthetic, non-functional values for a local build, and is git-ignored |
| Destructive production-data operations | **Not performed.** `20260817003500` *authors* a purge of tenant-less fictitious rows; applying it to production remains a Founder-authorised deployment step |
| Live financial transactions | **Not performed** |
| Irreversible external-provider actions | **Not performed.** No OAuth connection, token revocation or webhook registration was executed against any provider |

Nothing was pushed to any remote. Both commits are local.

---

## 12. AUDIT TRAIL

- **Frozen pre-remediation evidence preserved:** `docs/production-readiness/` (9 reports), `docs/pilot-readiness/`, `docs/engineering-decision-records/` — all unmodified.
- **Historical migrations left unedited**, including `20260726090000`, which seeds the fictitious data. It is applied evidence; its effect is neutralised by a later migration rather than by rewriting history.
- **Every migration carries an in-file account** of the defect it closes, how it was demonstrated, and a guard that fails the migration if the defect is reintroduced.
- **Every non-obvious code change carries the same** in a comment at the site of the fix.
- **Reproduce everything with `npm run verify`** — type-check, lint, 4 suites, build.

---

## 13. DETERMINATION

### READY FOR INDEPENDENT AUDIT

The basis for this determination:

- The complete toolchain executes from a clean `npm ci` and the whole pipeline is green, with **error suppression removed** so it cannot be green vacuously.
- Every Version 106 finding is closed, and each closure is an **executable assertion**, not a claim.
- 55 further defects were found and fixed, including six P0 cross-tenant exposures the Version 106 audit did not identify — one of which (H-02) that audit had explicitly rated Medium and non-blocking on reasoning I have shown to be incorrect.
- Isolation is verified adversarially, from the position of an attacker who controls every channel a real user controls, with positive regression assertions so the result cannot be achieved by denying everyone.
- The defects I introduced myself are found, fixed and recorded — including one silent, wide encoding corruption that would otherwise have been committed.
- Remaining work is stated precisely and is either a Founder decision (Next.js 16), an external credential, or a live-environment verification that no repository audit can substitute for.

**This is not a statement that the platform is ready for production.** §9 lists
eleven verifications that must be discharged in a live environment first, and
§10 lists twenty features that remain unbuilt. It is a statement that the
codebase, its migrations, its evidence and its verification harness are in a
state an independent auditor can now meaningfully and reproducibly examine.

### No Founder intervention is required to continue

The authorised Team A programme is complete. The next step is a Founder
decision, not a blocker: **apply the 13 Team A migrations to a staging Supabase
project and re-run `npm run test:security` against it**, which is the one
verification that cannot be performed locally and is a protected action.
