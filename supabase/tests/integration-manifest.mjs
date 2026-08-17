/**
 * Innovion A/B/D — canonical integrated migration manifest
 * ===========================================================================
 * `supabase_migrations.schema_migrations.version` is a PRIMARY KEY, and the
 * version is the 14-digit filename prefix. Two migration files that share a
 * prefix therefore cannot both be recorded in one project: `supabase db push`
 * refuses, or the second is silently never applied.
 *
 * This manifest is the single declaration of the reconciled ordering. The
 * integration harness honours it, so the chain that the suites verify is the
 * chain that would actually be deployed.
 *
 * ── Convention ─────────────────────────────────────────────────────────────
 * A colliding migration is REBASED FORWARD, never backward, and Team A's file
 * is never the one moved.
 *
 *   * Forward is the safe direction. A forward-dated migration is applied after
 *     everything already recorded, which is what a new migration needs. A
 *     backdated one is applied out of logical order relative to migrations that
 *     are already in the database.
 *   * Team A is the target project: Team B consumes Team A's API, Team B and
 *     Team A share `companies`, `contractors`, `user_roles`, `jobs`,
 *     `time_entries` and the documents bucket, and Team A's files at the
 *     colliding versions are the older ones and so the more likely to be
 *     already recorded there.
 *   * Team D has already applied this convention once, unprompted: their
 *     `platform_authority_hardening` migration was rebased from 20260817000000
 *     to 20260817000500 to clear its collision with Team A's
 *     20260817000000_tenant_authority_remediation.sql.
 *
 * ── Outstanding ────────────────────────────────────────────────────────────
 * One collision remains, and it is the single action this integration cannot
 * take for itself: the file belongs to Team D's tree, which this work is
 * authorised to inspect but not modify.
 */

/**
 * Rebases required for a collision-free chain.
 *   key   — "<team>:<original filename>"
 *   value — { version, reason, applied }
 *
 * `applied: false` means the rename has NOT yet been made in that team's tree.
 * The harness still orders by the rebased version, so the reconciled chain is
 * verified; the suite reports the outstanding rename separately so it cannot be
 * mistaken for done.
 */
export const REBASES = {
  'D:20260807050000_platform_foundation_schema.sql': {
    version: '20260807050002',
    reason:
      'Collides with Team A 20260807050000_workforce_roster_notifications.sql. ' +
      'Both create objects in public; the version, not the content, is the conflict.',
    applied: false,
  },
};

/** Rebases Team D has already made, recorded so the history stays legible. */
export const COMPLETED_REBASES = [
  {
    team: 'D',
    from: '20260817000000_platform_authority_hardening.sql',
    to: '20260817000500_platform_authority_hardening.sql',
    reason: 'Collided with Team A 20260817000000_tenant_authority_remediation.sql.',
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
