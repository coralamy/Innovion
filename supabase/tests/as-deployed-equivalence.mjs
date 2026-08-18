/**
 * AS-DEPLOYED vs CLEAN-CHAIN EQUIVALENCE
 * ===========================================================================
 * Every other suite builds the schema from empty, in version order. Production
 * was not built that way. It was built as:
 *
 *   35 migrations hand-applied before any ledger existed (one PARTIALLY)
 *   + hand-added drift the chain never produces
 *   + a repair migration
 *   + the remaining 22
 *
 * The end states ought to be identical. "Ought to" is exactly the assumption
 * that produced the mid-deployment failure, so it is tested rather than assumed.
 *
 * If the two schemas are equivalent, every guarantee the other suites establish
 * transfers to production. Where they differ, the difference is the finding.
 *
 * Local only. Production is not contacted - the credential was rotated and
 * removed after deployment.
 */
import { collectMigrations, TEST_ENCRYPTION_KEY } from './integration-harness.mjs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The 35 versions production's ledger held before the repair. */
const PRE_REPAIR = [
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

async function boot() {
  const db = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } });
  await db.exec(await readFile(join(HERE, '00_supabase_shim.sql'), 'utf8'));
  await db.query(`select set_config('app.settings.encryption_key', $1, false)`, [TEST_ENCRYPTION_KEY]);
  return db;
}

const { all } = await collectMigrations();

/* ── A: the clean chain, from empty, in version order ────────────────────── */
const clean = await boot();
for (const m of all) await clean.exec(await readFile(m.path, 'utf8'));

/* ── B: as production was actually built ─────────────────────────────────── */
const asDeployed = await boot();
for (const m of all.filter((x) => PRE_REPAIR.includes(x.rawVersion))) {
  await asDeployed.exec(await readFile(m.path, 'utf8'));
}
// Hand-added drift the chain never produces.
await asDeployed.exec(`
  ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id);
  ALTER TABLE public.user_roles ALTER COLUMN company_id SET NOT NULL;
  CREATE OR REPLACE FUNCTION public.get_user_company_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $fn$ SELECT public.get_my_company_id(); $fn$;
`);
// The partial application of Team B 20260727000006.
await asDeployed.exec(`
  DROP INDEX IF EXISTS idx_issue_reports_company_id;
  ALTER TABLE public.issue_reports DROP COLUMN IF EXISTS company_id CASCADE;
  DROP POLICY IF EXISTS "authenticated_read_issue_reports"   ON public.issue_reports;
  DROP POLICY IF EXISTS "authenticated_insert_issue_reports" ON public.issue_reports;
  CREATE POLICY "authenticated_read_issue_reports"   ON public.issue_reports
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "authenticated_insert_issue_reports" ON public.issue_reports
    FOR INSERT TO authenticated WITH CHECK (true);
`);
// Then the repair and the remaining 22, exactly as the push applied them.
for (const m of all.filter((x) => !PRE_REPAIR.includes(x.rawVersion))) {
  await asDeployed.exec(await readFile(m.path, 'utf8'));
}

console.log('── inventories ──');
const inv = async (db) => ({
  tables: (await db.query(`select table_name k from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`)).rows.map((r) => r.k).sort(),
  columns: (await db.query(`select table_name||'.'||column_name k from information_schema.columns where table_schema='public'`)).rows.map((r) => r.k).sort(),
  policies: (await db.query(`select schemaname||'.'||tablename||'.'||policyname k from pg_policies where schemaname in ('public','storage')`)).rows.map((r) => r.k).sort(),
  functions: (await db.query(`select p.proname k from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`)).rows.map((r) => r.k).sort(),
  triggers: (await db.query(`select c.relname||'.'||t.tgname k from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal`)).rows.map((r) => r.k).sort(),
  indexes: (await db.query(`select indexname k from pg_indexes where schemaname='public'`)).rows.map((r) => r.k).sort(),
  enums: (await db.query(`select t.typname||'.'||e.enumlabel k from pg_enum e join pg_type t on t.oid=e.enumtypid`)).rows.map((r) => r.k).sort(),
  rlsOff: (await db.query(`select c.relname k from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)).rows.map((r) => r.k).sort(),
});
const A = await inv(clean);
const B = await inv(asDeployed);
console.log(`   clean chain : ${A.tables.length} tables, ${A.columns.length} columns, ${A.policies.length} policies, ${A.functions.length} functions`);
console.log(`   as deployed : ${B.tables.length} tables, ${B.columns.length} columns, ${B.policies.length} policies, ${B.functions.length} functions`);

console.log('\n── equivalence ──');
for (const key of ['tables', 'columns', 'policies', 'functions', 'triggers', 'indexes', 'enums']) {
  const onlyClean = A[key].filter((x) => !B[key].includes(x));
  const onlyDeployed = B[key].filter((x) => !A[key].includes(x));
  check(`${key} identical`, onlyClean.length === 0 && onlyDeployed.length === 0,
    onlyClean.length || onlyDeployed.length
      ? `only in clean: [${onlyClean.slice(0, 5).join(', ')}]  only in deployed: [${onlyDeployed.slice(0, 5).join(', ')}]`
      : `${A[key].length} each`);
}
check('no table has RLS disabled in either', A.rlsOff.length === 0 && B.rlsOff.length === 0,
  `clean ${A.rlsOff.length}, deployed ${B.rlsOff.length}`);

console.log('\n── policy predicates are identical, not merely present ──');
const preds = async (db) => Object.fromEntries(
  (await db.query(`select schemaname||'.'||tablename||'.'||policyname k,
                          permissive||'|'||cmd||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'') v
                     from pg_policies where schemaname in ('public','storage')`)).rows.map((r) => [r.k, r.v])
);
const pa = await preds(clean); const pb = await preds(asDeployed);
const differing = Object.keys(pa).filter((k) => k in pb && pa[k] !== pb[k]);
check('every shared policy has an identical predicate', differing.length === 0,
  differing.length ? differing.slice(0, 4).join('; ') : `${Object.keys(pa).length} compared`);

console.log('\n── the drift the chain never produces, resolved identically ──');
const fk = async (db) => (await db.query(
  `select conname||' '||pg_get_constraintdef(oid) v from pg_constraint
    where conrelid='public.user_roles'::regclass and contype='f' and confrelid='public.companies'::regclass`)).rows[0]?.v;
check('user_roles -> companies FK identical', (await fk(clean)) === (await fk(asDeployed)),
  `${await fk(asDeployed)}`);

const irCols = async (db) => (await db.query(
  `select count(*)::int v from information_schema.columns where table_schema='public' and table_name='issue_reports'`)).rows[0].v;
check('issue_reports column count identical', (await irCols(clean)) === (await irCols(asDeployed)),
  `${await irCols(asDeployed)} columns`);

await clean.close();
await asDeployed.close();
console.log('\n' + '='.repeat(72));
console.log(`  ${pass} passed, ${fail.length} failed`);
fail.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
console.log(fail.length === 0
  ? '  -> The as-deployed schema is EQUIVALENT to the clean chain.\n     Every guarantee the other suites establish transfers to production.'
  : '  -> The schemas DIFFER. Each difference above is a finding.');
console.log('='.repeat(72));
process.exit(fail.length ? 1 : 0);
