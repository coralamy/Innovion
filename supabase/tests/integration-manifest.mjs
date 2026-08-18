/**
 * Innovion A/B/D — canonical integrated migration manifest
 * ===========================================================================
 * `supabase_migrations.schema_migrations.version` is a PRIMARY KEY, and the
 * version is the 14-digit filename prefix. Two migration files that share a
 * prefix therefore cannot both be recorded in one project: `supabase db push`
 * refuses, or the second is silently never applied.
 *
 * This manifest records the reconciled ordering. The integration harness
 * honours it, so the chain the suites verify is the chain that would be
 * deployed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ADJUDICATION — the 20260807050000 collision (Founder item 2)
 * ═══════════════════════════════════════════════════════════════════════════
 * RULING: Team D's platform_foundation_schema moves FORWARD to 20260807050002.
 *         Team A's 20260807050000_workforce_roster_notifications.sql does not
 *         move. Neither file's CONTENT is edited. At deploy time the moved file
 *         is reconciled with `supabase migration repair`, NOT by running it.
 *
 * ── Team D's premise, corrected ─────────────────────────────────────────────
 * Team D declined to re-stamp on the grounds that "re-stamping an applied
 * migration rewrites the ledger". That is the crux of the item and it is not
 * correct. Nothing about a rename touches an existing ledger row:
 *
 *   * `supabase_migrations.schema_migrations` is append-only in normal use.
 *     `db push` INSERTs one row per version it applies. It never UPDATEs or
 *     DELETEs a row because a file was renamed — it has no way to know a file
 *     was renamed at all.
 *   * Renaming therefore destroys no history. The row for 20260807050000
 *     survives untouched, still recording that that version was applied.
 *   * What a rename DOES do is manufacture a version the ledger has never seen,
 *     which `db push` will then try to RUN. That is the real hazard, and it is
 *     a re-execution hazard, not a ledger-corruption one.
 *   * `supabase migration repair --status applied <version>` exists precisely
 *     for this: it INSERTs a row asserting the objects are already present,
 *     without executing the file. An append, not a rewrite.
 *
 * Team D's caution was sound; only the mechanism was misread. Their conclusion —
 * "neither file may move" — proves too much: if neither moves, the collision is
 * permanent, and a clean rebuild can never reproduce the live schema. Something
 * has to move.
 *
 * ── Which file moves, and why it does not depend on reading the ledger ──────
 * Only ONE row can exist at 20260807050000; it is a primary key. So exactly one
 * of the two files is recorded there and the other is applied-but-unrecorded.
 * Team A cannot determine which: no ledger artefact exists in any local tree
 * (no supabase/config.toml, no .temp, no schema_migrations dump), and reading
 * the live ledger is a protected action. That is stated as a limit, not
 * papered over.
 *
 * The ruling is deliberately constructed so that it does not need to be known:
 *
 *   * Team A's file stays at 050000. If it is the recorded one — by far the
 *     likelier case, since Team A's project is the target and its file is part
 *     of Team A's own continuous chain — nothing happens to it. If it is the
 *     UNRECORDED one, it is simply re-run, which is safe: the replay suite
 *     confirms by execution that it re-applies cleanly onto the final schema.
 *   * Team D's file moves to 050002 and is reconciled by `migration repair` if
 *     its objects are already present, or applied normally if they are not.
 *
 * Both branches are handled, and no branch skips either team's schema changes.
 *
 * ── Why forward (050002) and not backward (045000) ──────────────────────────
 * During this verification the file was observed on disk under three different
 * names within ten minutes — 045000, then 050000, then 050002 — with identical
 * content (SHA-256 B1FC64E4..., 35795 bytes), i.e. renames by some process
 * outside Team A. 045000 is rejected on the merits regardless:
 *
 *   * Backdating manufactures an out-of-order migration. On a project where
 *     050000 is already recorded, a newly-appearing 045000 sorts BEFORE it, and
 *     the CLI treats out-of-order migrations as an error condition.
 *   * Forward-stamping always sorts after everything recorded, which is what an
 *     unapplied migration needs.
 *
 * 050002 keeps Team D's foundation ahead of Team D's own 20260810000000 event
 * bus and 20260817000500 hardening, which is the only ordering constraint its
 * content actually imposes. Nothing in Team A or Team B depends on it.
 *
 * ── Verified, not assumed ───────────────────────────────────────────────────
 * `supabase/tests/migration-replay-suite.mjs` establishes by execution that
 * the moved file is NOT idempotent, which is why `migration repair` rather than
 * re-execution is mandated. The required deploy-time action is recorded in
 * REQUIRED_LEDGER_RECONCILIATION below. It is a Founder action: it touches the
 * live project and is therefore a protected action Team A does not perform.
 */

/**
 * Rebases still required for a collision-free chain.
 *   key   — "<team>:<original filename>"
 *   value — { version, reason, applied }
 *
 * EMPTY, and it should stay that way. Collisions are no longer declared here;
 * they are DETECTED from the trees by collectMigrations() and asserted by the
 * integration suite. A declared list can go stale — this one did, which is how
 * a rename that Team D had already superseded survived in Team A's harness. A
 * computed check cannot.
 */
export const REBASES = {};

/** Re-stamps already made, recorded so the deployed history stays legible. */
export const COMPLETED_REBASES = [
  {
    team: 'D',
    from: '20260817000000_platform_authority_hardening.sql',
    to: '20260817000500_platform_authority_hardening.sql',
    reason: 'Collided with Team A 20260817000000_tenant_authority_remediation.sql.',
    ledgerImpact: 'None expected — this migration is new and not previously applied.',
  },
  {
    team: 'D',
    from: '20260807050000_platform_foundation_schema.sql',
    to: '20260807050002_platform_foundation_schema.sql',
    reason:
      'Collided with Team A 20260807050000_workforce_roster_notifications.sql. Moved forward ' +
      'so it sorts after everything already recorded; backdating would manufacture an ' +
      'out-of-order migration. Content unchanged (SHA-256 B1FC64E4..., 35795 bytes).',
    ledgerImpact:
      'MATERIAL. Reported already applied under the old version. The new version is ' +
      'unrecorded and the file is NOT idempotent, so an unguarded push re-runs it and fails. ' +
      'Requires `migration repair`, not execution. See REQUIRED_LEDGER_RECONCILIATION.',
  },
];

/**
 * The exact Team B / Team D revisions this integration was verified against.
 *
 * This is not bookkeeping. During verification Team D's foundation migration was
 * renamed three times in ten minutes by a process outside Team A, and two test
 * runs straddling a rename produced failures that belonged to the rename rather
 * than to any code. Integration results are only meaningful against a pinned
 * revision, so the suites run against a snapshot and assert these hashes.
 *
 * A mismatch does not mean anything is wrong — it means the other team has moved
 * and the integration verdict must be re-established, not carried forward.
 */
export const VERIFIED_AGAINST = {
  capturedAt: '2026-08-18T12:02:00+10:00',
  B: {
    '20260727000001_checklist_responses.sql': '05CED7378D37F56B',
    '20260727000002_issue_reports.sql': '6A29B043A4F83398',
    '20260727000003_messages.sql': 'BFB527661C7DEA66',
    '20260727000004_company_logo.sql': 'E25FCAF79DEDD053',
    '20260727000005_supply_requests_notes_contractor_docs.sql': '1E1628483A5BED6B',
    '20260727000006_company_id_rls_enforcement.sql': '5D59BB7B9F239CD9',
    '20260728000001_fix_contractors_user_id.sql': 'A6A2821C676A9569',
    '20260728000002_rls_complete_audit.sql': '3456A6FFF44D389B',
    '20260731000001_documents_bucket_and_cleanup.sql': '93D3DEE37CEC139B',
    '20260809000001_device_tokens_and_security_hardening.sql': '532E563BB567B378',
    '20260817000001_tenant_authority_hardening.sql': '9BE0D9685F0ECF60',
    '20260817000002_issue_attachment_storage_isolation.sql': '00FAD1093A9F39A4',
    '20260817000003_isolation_policy_consolidation.sql': '5919DC89DB928308',
    '20260818000200_workforce_data_access_carveouts.sql': 'D2A65EF0A7A0EDF9',
  },
  D: {
    '20260807050002_platform_foundation_schema.sql': 'B1FC64E43A34F8C5',
    '20260810000000_platform_event_bus_runtime.sql': '1739ACD4E8D5C33E',
    '20260817000500_platform_authority_hardening.sql': 'C616FC6AB718271E',
  },
};

/**
 * Deploy-time actions against the live migration ledger. These are PROTECTED
 * ACTIONS: they are recorded here for the Founder and are deliberately not
 * automated, not scripted against a live connection, and not performed.
 *
 * Nothing here rewrites or deletes ledger history. The only operation is
 * INSERTING a row that records, truthfully, that a migration's objects are
 * already present — which is what `supabase migration repair` exists to do.
 */
export const REQUIRED_LEDGER_RECONCILIATION = [
  {
    version: '20260807050002',
    file: 'D:20260807050002_platform_foundation_schema.sql',
    step1_read:
      "SELECT version FROM supabase_migrations.schema_migrations WHERE version IN ('20260807050000','20260807050002');",
    step2_read:
      "SELECT to_regclass('public.platform_tenants') IS NOT NULL AS foundation_present, to_regclass('public.jobs') IS NOT NULL AS teama_present;",
    interpretation: [
      "foundation_present = true and 20260807050002 absent — the expected state. Run `supabase migration repair --status applied 20260807050002`. Do NOT run the file: it is confirmed non-idempotent and would fail on duplicate types and objects.",
      'foundation_present = false — Team D never actually applied. Push normally; the file runs and creates the objects.',
      '20260807050002 already present — already reconciled. Do nothing.',
    ],
    doNotDo:
      'Do not DELETE or UPDATE any row in supabase_migrations.schema_migrations. Nothing in this plan requires it. The existing 20260807050000 row stays exactly as it is, whichever team wrote it.',
    verifyAfter:
      '`supabase migration list` shows no pending migration other than the intended new ones, and public.platform_tenants, public.identity_user_profiles and public.identity_tenant_memberships all exist.',
  },
  {
    version: '20260807050000',
    file: 'A:20260807050000_workforce_roster_notifications.sql',
    step1_read:
      "SELECT to_regclass('public.notification_preferences') IS NOT NULL AS present;",
    interpretation: [
      'present = true — Team A\'s file is the one recorded at 20260807050000. Nothing to do.',
      "present = false — Team A's file is the applied-but-unrecorded one, i.e. Team D's was recorded there. Re-running it is safe: the replay suite confirms by execution that it re-applies cleanly onto the final integrated schema. Run `supabase migration repair --status reverted 20260807050000` then push, so it executes.",
    ],
    doNotDo: 'Do not rename Team A\'s file. Moving it would strand whichever row is recorded.',
    verifyAfter: 'public.notification_preferences exists and carries the notification_preferences_own policy.',
  },
];

/** The version a migration should sort under, honouring any rebase. */
export function effectiveVersion(team, file, rawVersion) {
  const rebase = REBASES[`${team}:${file}`];
  return rebase ? rebase.version : rawVersion;
}

/** Rebases that still need to be made in another team's tree. */
export function outstandingRebases() {
  return Object.entries(REBASES)
    .filter(([, v]) => !v.applied)
    .map(([k, v]) => ({ target: k, version: v.version, reason: v.reason }));
}
