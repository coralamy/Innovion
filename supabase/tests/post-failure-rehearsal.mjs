/**
 * Rehearsal against production's EXACT post-failure state.
 *
 * Production stopped mid-deployment on 2026-08-18: ledger 35, Team B's
 * 20260817000003 aborted on a missing issue_reports.company_id. This builds that
 * state faithfully - the 35 recorded migrations, the hand-added drift, and
 * crucially the MISSING COLUMN and its 4 orphan rows - then applies the repair
 * migration and the remaining chain.
 *
 * Local only. Production is not contacted.
 */
import { collectMigrations, TEST_ENCRYPTION_KEY } from './integration-harness.mjs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Exactly what production's ledger records, verified by reading it. */
const LEDGER = [
  '20260726055014','20260726090000','20260727000001','20260727000002','20260727000003',
  '20260727000004','20260727000005','20260727000006','20260727010000','20260727020000',
  '20260727030000','20260727040000','20260728000000','20260728000001','20260728000002',
  '20260728010000','20260728020000','20260728030000','20260731000001','20260731070000',
  '20260806130000','20260807030000','20260807040000','20260807050000','20260807050002',
  '20260809000001','20260809160000','20260810000000','20260810140000','20260810160000',
  '20260811000000','20260816120000','20260817000000','20260817000001','20260817000002',
];

let pass = 0; const fail = [];
const check = (d, ok, detail = '') => {
  if (ok) { pass++; console.log(`   PASS  ${d}${detail ? `  (${detail})` : ''}`); }
  else { fail.push(d + (detail ? ` - ${detail}` : '')); console.log(`   FAIL  ${d}${detail ? `  (${detail})` : ''}`); }
};

const { all } = await collectMigrations();
const db = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } });
await db.exec(await readFile(join(HERE, '00_supabase_shim.sql'), 'utf8'));
await db.query(`select set_config('app.settings.encryption_key', $1, false)`, [TEST_ENCRYPTION_KEY]);

console.log('── building production\'s post-failure state ──');
let built = 0;
for (const m of all.filter((x) => LEDGER.includes(x.rawVersion))) {
  await db.exec(await readFile(m.path, 'utf8')); built++;
}
console.log(`   ${built} of ${LEDGER.length} ledger migrations applied`);

// Hand-added drift present in production but not produced by the chain.
await db.exec(`
  ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id);
  ALTER TABLE public.user_roles ALTER COLUMN company_id SET NOT NULL;
  CREATE OR REPLACE FUNCTION public.get_user_company_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $fn$ SELECT public.get_my_company_id(); $fn$;
`);

// THE FAULT: Team B's 20260727000006 landed partially. Reproduce it exactly as
// production shows it - no company_id, no isolation policy (it depends on the
// column), and the two permissive USING(true) policies from 20260727000002 still
// in place.
await db.exec(`
  DROP INDEX IF EXISTS idx_issue_reports_company_id;
  ALTER TABLE public.issue_reports DROP COLUMN IF EXISTS company_id CASCADE;

  DROP POLICY IF EXISTS "authenticated_read_issue_reports"   ON public.issue_reports;
  DROP POLICY IF EXISTS "authenticated_insert_issue_reports" ON public.issue_reports;
  DROP POLICY IF EXISTS "reporter_update_issue_reports"      ON public.issue_reports;
  CREATE POLICY "authenticated_read_issue_reports"   ON public.issue_reports
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "authenticated_insert_issue_reports" ON public.issue_reports
    FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "reporter_update_issue_reports"      ON public.issue_reports
    FOR UPDATE TO authenticated USING (reporter_user_id = auth.uid());
`);

// Production's data: 1 company, 0 jobs, 0 role grants, 4 issue reports.
await db.exec(`
  INSERT INTO auth.users(id,email,email_confirmed_at)
    VALUES ('11111111-0000-0000-0000-0000000000f1','owner@prod.test',now());
  INSERT INTO public.companies(id,name,owner_id)
    VALUES ('aaaaaaaa-0000-0000-0000-0000000000f1','Sole Tenant','11111111-0000-0000-0000-0000000000f1');
  INSERT INTO public.issue_reports(title) VALUES ('Report 1'),('Report 2'),('Report 3'),('Report 4');
`);

console.log('\n── baseline fidelity ──');
const one = async (s) => (await db.query(s)).rows[0].v;
check('issue_reports.company_id is ABSENT, as in production',
  (await one(`select count(*)::int v from information_schema.columns where table_schema='public' and table_name='issue_reports' and column_name='company_id'`)) === 0);
check('issue_reports holds 4 rows', (await one(`select count(*)::int v from public.issue_reports`)) === 4);
check('issue_reports has exactly the 3 permissive policies production shows',
  (await one(`select count(*)::int v from pg_policies where schemaname='public' and tablename='issue_reports'`)) === 3);
check('CONTROL: the isolation policy is ABSENT, as in production',
  (await one(`select count(*)::int v from pg_policies where schemaname='public' and tablename='issue_reports' and policyname='issue_reports_company_isolation'`)) === 0);
check('companies holds 1', (await one(`select count(*)::int v from public.companies`)) === 1);
check('jobs holds 0', (await one(`select count(*)::int v from public.jobs`)) === 0);
check('company_access_% policies = 13', (await one(`select count(*)::int v from pg_policies where schemaname='public' and policyname like 'company_access_%'`)) === 13);

console.log('\n── CONTROL: without the repair, 20260817000003 must still fail ──');
{
  const snapshot = await db.dumpDataDir();
  const probe = await PGlite.create({ loadDataDir: snapshot, extensions: { pgcrypto, uuid_ossp } });
  let err = null;
  try { await probe.exec(await readFile(all.find((m) => m.rawVersion === '20260817000003').path, 'utf8')); }
  catch (e) { err = e.message; }
  check('20260817000003 reproduces the production failure',
    Boolean(err && /company_id.*does not exist/i.test(err)), err ? err.slice(0, 80) : 'IT PASSED - the fault is not reproduced');
  await probe.close();
}

console.log('\n── applying the repair and the remaining chain ──');
const remaining = all.filter((m) => !LEDGER.includes(m.rawVersion));
console.log(`   ${remaining.length} migrations to apply (including the new repair)`);
const results = [];
for (const m of remaining) {
  try { await db.exec(await readFile(m.path, 'utf8')); results.push({ m, ok: true }); }
  catch (e) { results.push({ m, ok: false, error: e.message }); }
}
for (const r of results) {
  if (!r.ok) console.log(`   ABORT [${r.m.team}] ${r.m.file}\n         ${r.error.replace(/\s+/g, ' ').slice(0, 180)}`);
}
const aborted = results.filter((r) => !r.ok);
check(`all ${remaining.length} remaining migrations apply`, aborted.length === 0, `${aborted.length} aborted`);

console.log('\n── backfill correctness ──');
check('every issue_reports row has a tenant',
  (await one(`select count(*)::int v from public.issue_reports where company_id is null`)) === 0);
check('all 4 rows assigned to the sole tenant',
  (await one(`select count(*)::int v from public.issue_reports where company_id='aaaaaaaa-0000-0000-0000-0000000000f1'`)) === 4);
check('no issue_reports rows were lost', (await one(`select count(*)::int v from public.issue_reports`)) === 4);

console.log('\n── issue_reports isolation restored ──');
// The repair creates issue_reports_company_isolation, restoring what
// 20260727000006 intended. 20260817000003 section 5 then rebuilds the whole
// tenant-scoped policy set for this table and supersedes it by design, so
// asserting that specific name survives would be asserting the wrong thing.
// What matters is the end state: isolation present, nothing open.
check('issue_reports has a RESTRICTIVE tenant guard',
  (await one(`select count(*)::int v from pg_policies where schemaname='public' and tablename='issue_reports' and permissive='RESTRICTIVE'`)) >= 1);
// Not asserting that every permissive policy names company_id:
// reporter_update_issue_reports is scoped by auth.uid(), which is legitimate and
// is ANDed with the RESTRICTIVE tenant guard above. The check below tests the
// property that actually matters.
check('the USING(true) SELECT policy is gone',
  (await one(`select count(*)::int v from pg_policies where schemaname='public' and tablename='issue_reports' and policyname='authenticated_read_issue_reports'`)) === 0);
check('the USING(true) INSERT policy is gone',
  (await one(`select count(*)::int v from pg_policies where schemaname='public' and tablename='issue_reports' and policyname='authenticated_insert_issue_reports'`)) === 0);
check('no permissive issue_reports policy remains without a tenant predicate',
  (await one(`select count(*)::int v from pg_policies where schemaname='public' and tablename='issue_reports'
              and permissive='PERMISSIVE' and coalesce(qual,with_check,'') not like '%get_my_company_id%'
              and coalesce(qual,with_check,'') not like '%auth.uid%'`)) === 0);

console.log('\n── final security posture (runbook §10 expectations) ──');
const posture = {
  company_access: await one(`select count(*)::int v from pg_policies where schemaname='public' and policyname like 'company_access_%'`),
  views_unsafe: await one(`select count(*)::int v from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and not coalesce(c.reloptions,'{}') && array['security_invoker=true','security_invoker=on']`),
  secdef_unpinned: await one(`select count(*)::int v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) x where x like 'search_path=%')`),
  no_rls: await one(`select count(*)::int v from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`),
  fk: await one(`select (case confdeltype when 'c' then 'CASCADE' else confdeltype::text end) v from pg_constraint where conrelid='public.user_roles'::regclass and contype='f' and confrelid='public.companies'::regclass`),
  triggers: await one(`select count(*)::int v from pg_trigger where tgname like 'innovion_tenancy_projection%'`),
};
check('company_access_% policies = 0', posture.company_access === 0, String(posture.company_access));
check('views bypassing RLS = 0', posture.views_unsafe === 0, String(posture.views_unsafe));
check('SECURITY DEFINER unpinned = 0', posture.secdef_unpinned === 0, String(posture.secdef_unpinned));
check('tables without RLS = 0', posture.no_rls === 0, String(posture.no_rls));
check('user_roles FK = CASCADE', posture.fk === 'CASCADE', String(posture.fk));
check('refresh triggers armed = 2', posture.triggers === 2, String(posture.triggers));
check('companies preserved = 1', (await one(`select count(*)::int v from public.companies`)) === 1);

await db.close();
console.log('\n' + '='.repeat(70));
console.log(`  ${pass} passed, ${fail.length} failed`);
fail.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
console.log('='.repeat(70));
process.exit(fail.length ? 1 : 0);
