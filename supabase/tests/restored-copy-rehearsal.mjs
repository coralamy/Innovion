/**
 * Innovion — RESTORED-COPY REHEARSAL (fully local)
 * ===========================================================================
 * Reproduces the AUTHORITATIVE LIVE PRODUCTION BASELINE established by
 * read-only inspection on 2026-08-18, then applies the outstanding migrations
 * in version order and reports every abort.
 *
 * No connection to production. No migration, repair, push or deployment. Team B
 * and Team D source files are read only.
 *
 * ── Why this is not the same as "the chain applies from empty" ──────────────
 * The chain applies cleanly from empty; that has been verified for days. It
 * tells us nothing about deploying into THIS database, because production is
 * not an empty database and is not a prefix of the chain:
 *
 *   * 30 of 56 migrations are applied, with GAPS — 20260728010000 and
 *     20260816120000 are absent while later migrations are present, and
 *     20260817002000 is applied while 20260817000000 and 20260817001000 are not.
 *   * There is no migration ledger at all, so nothing records any of this.
 *   * The live schema contains an object the chain never creates: a
 *     user_roles.company_id foreign key with ON DELETE NO ACTION.
 *
 * A guard migration that asserts an end-state can pass from empty and abort
 * here. That is exactly what this rehearsal exists to find.
 */

import { collectMigrations, TEST_ENCRYPTION_KEY } from './integration-harness.mjs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/* ── The live baseline, as established by read-only inspection ───────────── */

const APPLIED = new Set([
  // Team A core, through 20260811000000
  '20260726055014', '20260726090000', '20260727010000', '20260727020000',
  '20260727030000', '20260727040000', '20260728000000', '20260728020000',
  '20260728030000', '20260731070000', '20260806130000', '20260807030000',
  '20260807040000', '20260807050000', '20260809160000', '20260810140000',
  '20260810160000', '20260811000000',
  // NOT here. See DRIFT: only this migration's PHASE 1 function change is
  // present in production. The file as a whole cannot have been applied,
  // because its own PHASE 3 guard refuses the 13 metadata-bearing policies that
  // are still live. Measured: applying it at the baseline aborts.
  // Team B
  '20260727000001', '20260727000002', '20260727000003', '20260727000004',
  '20260727000005', '20260727000006', '20260728000001', '20260728000002',
  '20260731000001', '20260809000001',
  // Team D foundation only
  '20260807050002',
]);

/** Migrations the inspection could not determine. Moot: all depend on
 *  20260818000100, which is absent, or create nothing. Applied in RUN 2. */
const UNDETERMINED = new Set([
  '20260817003500', '20260818000200', '20260818000300', '20260818000500',
]);

/** Facts true of production that the migration chain does NOT produce. */
const DRIFT = `
  -- The live foreign key. Hand-added; no migration in the chain creates it.
  -- ON DELETE NO ACTION, which is what 20260818000700's guard rejects.
  ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id);
  ALTER TABLE public.user_roles ALTER COLUMN company_id SET NOT NULL;

  -- PHASE 1 of 20260817002000, hand-applied without the rest of the file.
  -- Production shows get_user_company_id() delegating to the unified resolver,
  -- but the migration's own guard would have refused to run against the 13
  -- company_access_* policies that are still present -- so the file was never
  -- applied as a unit. This reproduces exactly that: the effect, not the
  -- migration.
  CREATE OR REPLACE FUNCTION public.get_user_company_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$ SELECT public.get_my_company_id(); $fn$;
`;

/** The production readings this simulation must reproduce, or it is worthless. */
const EXPECTED = [
  ['company_access_% policies', 13,
   `select count(*)::int v from pg_policies where schemaname='public' and policyname like 'company_access_%'`],
  ['views without security_invoker', 4,
   `select count(*)::int v from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='v'
       and not coalesce(c.reloptions,'{}') && array['security_invoker=true','security_invoker=on']`],
  ['views total', 4,
   `select count(*)::int v from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='v'`],
  ['SECURITY DEFINER unpinned', 18,
   `select count(*)::int v from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) cfg where cfg like 'search_path=%')`],
  ['SECURITY DEFINER total', 21,
   `select count(*)::int v from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.prosecdef`],
  ['documents bucket', 1, `select count(*)::int v from storage.buckets where id='documents'`],
  ['get_user_company_id delegates', 1,
   `select count(*)::int v from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='get_user_company_id'
       and pg_get_functiondef(p.oid) like '%get_my_company_id%'`],
  ['user_roles FK is NO ACTION', 1,
   `select count(*)::int v from pg_constraint
     where conrelid='public.user_roles'::regclass and contype='f'
       and confrelid='public.companies'::regclass and confdeltype='a'`],
  ['innovion_owns_company absent', 0,
   `select count(*)::int v from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='innovion_owns_company'`],
  ['geofence_anomaly enum absent', 0,
   `select count(*)::int v from pg_enum e join pg_type t on t.oid=e.enumtypid
     where t.typname='notification_type' and e.enumlabel='geofence_anomaly'`],
  ['contractors_select_own absent', 0,
   `select count(*)::int v from pg_policies
     where schemaname='public' and tablename='contractors' and policyname='contractors_select_own'`],
  ['idx_compliance_items_company_status present', 1,
   `select count(*)::int v from pg_indexes where schemaname='public' and indexname='idx_compliance_items_company_status'`],
  ['idx_contractors_user_id present', 1,
   `select count(*)::int v from pg_indexes where schemaname='public' and indexname='idx_contractors_user_id'`],
];

async function buildBaseline(all) {
  const db = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } });
  await db.exec(await readFile(join(HERE, '00_supabase_shim.sql'), 'utf8'));
  await db.query(`select set_config('app.settings.encryption_key', $1, false)`, [TEST_ENCRYPTION_KEY]);

  const problems = [];
  for (const m of all.filter((x) => APPLIED.has(x.rawVersion))) {
    try {
      await db.exec(await readFile(m.path, 'utf8'));
    } catch (err) {
      problems.push(`[${m.team}] ${m.file}: ${err.message}`);
    }
  }
  await db.exec(DRIFT);
  return { db, problems };
}

async function main() {
  const { all } = await collectMigrations();
  const applied = all.filter((m) => APPLIED.has(m.rawVersion));
  const outstanding = all.filter((m) => !APPLIED.has(m.rawVersion) && !UNDETERMINED.has(m.rawVersion));
  const undetermined = all.filter((m) => UNDETERMINED.has(m.rawVersion));

  console.log('═'.repeat(78));
  console.log('  RESTORED-COPY REHEARSAL — local reproduction of the live baseline');
  console.log('═'.repeat(78));
  console.log(`  chain total : ${all.length}`);
  console.log(`  applied     : ${applied.length}   (reproduced as the starting state)`);
  console.log(`  outstanding : ${outstanding.length}   (applied in RUN 1)`);
  console.log(`  undetermined: ${undetermined.length}   (added in RUN 2)`);

  /* ── Baseline fidelity ─────────────────────────────────────────────────── */
  console.log('\n── BASELINE FIDELITY — does the simulation match production? ──');
  const { db, problems } = await buildBaseline(all);
  if (problems.length) {
    console.log('  baseline migrations that failed to apply:');
    problems.forEach((p) => console.log('    ' + p));
  }
  let mismatches = 0;
  for (const [label, want, sql] of EXPECTED) {
    const got = (await db.query(sql)).rows[0].v;
    const ok = got === want;
    if (!ok) mismatches++;
    console.log(`  ${ok ? 'match  ' : 'DIFFER '} ${label.padEnd(46)} live=${String(want).padStart(3)}  sim=${String(got).padStart(3)}`);
  }
  console.log(mismatches === 0
    ? '  -> baseline reproduces production on every measured dimension.'
    : `  -> ${mismatches} dimension(s) differ; findings below are correspondingly weaker.`);
  await db.close();

  /* ── The runs ──────────────────────────────────────────────────────────── */
  for (const [label, list] of [
    ['RUN 1 - the outstanding migrations, in version order', outstanding],
    ['RUN 2 - outstanding + undetermined (what a real push would attempt)',
      [...outstanding, ...undetermined].sort((a, b) => a.version.localeCompare(b.version))],
  ]) {
    console.log(`\n── ${label} ──`);
    const { db: d } = await buildBaseline(all);
    const results = [];
    for (const m of list) {
      try {
        await d.exec(await readFile(m.path, 'utf8'));
        results.push({ m, ok: true });
      } catch (err) {
        results.push({ m, ok: false, error: err.message });
      }
    }
    const aborted = results.filter((r) => !r.ok);
    for (const r of results) {
      const tag = UNDETERMINED.has(r.m.rawVersion) ? ' (undetermined)' : '';
      console.log(`  ${r.ok ? 'ok    ' : 'ABORT '} [${r.m.team}] ${r.m.file}${tag}`);
      if (!r.ok) console.log(`         ${r.error.replace(/\s+/g, ' ').slice(0, 200)}`);
    }
    console.log(`  ${results.length - aborted.length} applied, ${aborted.length} aborted`);
    await d.close();
  }

  console.log('\n' + '═'.repeat(78));
  console.log('  No production connection was made. Nothing was applied, repaired,');
  console.log('  pushed or deployed. Team B and Team D sources were read only.');
  console.log('═'.repeat(78));
}

main().catch((e) => {
  console.error('\nHARNESS ERROR:', e);
  process.exit(2);
});
