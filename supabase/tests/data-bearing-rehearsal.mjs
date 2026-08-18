/**
 * Innovion — DATA-BEARING REHEARSAL (fully local)
 * ===========================================================================
 * The restored-copy rehearsal proved the outstanding migrations APPLY against a
 * faithful copy of the live schema. It ran on an EMPTY schema, so it could not
 * say what they do to DATA.
 *
 * Two migrations in the outstanding set touch production rows:
 *
 *   20260817003500_purge_fictitious_seed_data   DELETEs rows
 *   20260818000700_user_roles_company_fk        DELETEs rows, then drops and
 *                                               re-adds a constraint over the table
 *
 * This seeds a realistic tenant estate on top of the live baseline, applies the
 * outstanding chain, and reports exactly what is destroyed.
 *
 * No production connection. Nothing is applied, repaired, pushed or deployed.
 */

import { collectMigrations, TEST_ENCRYPTION_KEY } from './integration-harness.mjs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const APPLIED = new Set([
  '20260726055014', '20260726090000', '20260727010000', '20260727020000',
  '20260727030000', '20260727040000', '20260728000000', '20260728020000',
  '20260728030000', '20260731070000', '20260806130000', '20260807030000',
  '20260807040000', '20260807050000', '20260809160000', '20260810140000',
  '20260810160000', '20260811000000',
  '20260727000001', '20260727000002', '20260727000003', '20260727000004',
  '20260727000005', '20260727000006', '20260728000001', '20260728000002',
  '20260731000001', '20260809000001',
  '20260807050002',
]);

const DRIFT = `
  ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id);
  ALTER TABLE public.user_roles ALTER COLUMN company_id SET NOT NULL;
  CREATE OR REPLACE FUNCTION public.get_user_company_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $fn$ SELECT public.get_my_company_id(); $fn$;
`;

/* ── A realistic estate ────────────────────────────────────────────────────
 * The proportions matter more than the absolute numbers. What matters is that
 * public.companies holds BOTH kinds of row, because company_type defaults to
 * 'client' and the table doubles as a customer directory:
 *
 *   TENANTS   owner_id set        - real Innovion tenants
 *   CUSTOMERS owner_id NULL       - customer records of those tenants
 *
 * The second group is the one 20260817003500 deletes.
 */
const TENANTS = 40;
const CUSTOMERS = 120;
const USERS_PER_TENANT = 6;
const JOBS_PER_TENANT = 40;

async function seed(db) {
  await db.exec(`SET session_replication_role = replica;`); // silence app triggers while bulk loading
  await db.exec(`
    INSERT INTO auth.users(id, email, email_confirmed_at)
    SELECT gen_random_uuid(), 'user' || g || '@tenant.test', now()
      FROM generate_series(1, ${TENANTS * USERS_PER_TENANT}) g;
  `);
  await db.exec(`
    -- Real tenants: an owner, and a non-client company_type.
    INSERT INTO public.companies(id, name, owner_id, company_type)
    SELECT gen_random_uuid(), 'Tenant ' || g, u.id, 'contractor'
      FROM generate_series(1, ${TENANTS}) g
      JOIN LATERAL (SELECT id FROM auth.users ORDER BY id OFFSET g-1 LIMIT 1) u ON true;

    -- Customer records: NO owner_id, company_type defaults to 'client'.
    -- These are legitimate business data, not seed rubbish.
    INSERT INTO public.companies(id, name)
    SELECT gen_random_uuid(), 'Customer Pty Ltd ' || g
      FROM generate_series(1, ${CUSTOMERS}) g;
  `);
  await db.exec(`
    INSERT INTO public.user_roles(user_id, company_id, role)
    SELECT u.id, c.id,
           (ARRAY['admin','manager','supervisor','viewer'])[1 + (row_number() over ()) % 4]
      FROM (SELECT id FROM public.companies WHERE owner_id IS NOT NULL) c
      CROSS JOIN LATERAL (SELECT id FROM auth.users ORDER BY random() LIMIT ${USERS_PER_TENANT}) u
    ON CONFLICT (user_id, company_id) DO NOTHING;
  `);
  await db.exec(`
    INSERT INTO public.jobs(company_id, job_number, title)
    SELECT c.id, 'JOB-' || c.id || '-' || g, 'Job ' || g
      FROM (SELECT id FROM public.companies WHERE owner_id IS NOT NULL) c,
           generate_series(1, ${JOBS_PER_TENANT}) g;

    INSERT INTO public.clients(company_id, name)
    SELECT c.id, 'Client ' || g
      FROM (SELECT id FROM public.companies WHERE owner_id IS NOT NULL) c,
           generate_series(1, 12) g;

    INSERT INTO public.employees(company_id, name, salary)
    SELECT c.id, 'Employee ' || g, '95000'
      FROM (SELECT id FROM public.companies WHERE owner_id IS NOT NULL) c,
           generate_series(1, 8) g;

    INSERT INTO public.contractors(id, name, company_id, email)
    SELECT gen_random_uuid(), 'Contractor ' || g, c.id, 'c' || g || '-' || c.id || '@w.test'
      FROM (SELECT id FROM public.companies WHERE owner_id IS NOT NULL) c,
           generate_series(1, 5) g;

    INSERT INTO public.sites(company_id, name)
    SELECT c.id, 'Site ' || g
      FROM (SELECT id FROM public.companies WHERE owner_id IS NOT NULL) c,
           generate_series(1, 4) g;

    INSERT INTO public.documents(company_id, name, access_level)
    SELECT c.id, 'Doc ' || g, 'All Staff'
      FROM (SELECT id FROM public.companies WHERE owner_id IS NOT NULL) c,
           generate_series(1, 6) g;
  `);
  await db.exec(`SET session_replication_role = origin;`);
}

/** Tables 20260817003500 sweeps for company_id IS NULL. */
const SWEPT = ['documents', 'incidents', 'inventory', 'vehicles', 'notifications',
  'compliance_items', 'contractors', 'jobs', 'time_entries', 'checklists',
  'clients', 'employees', 'sites', 'settings'];

async function census(db) {
  const out = {};
  for (const t of [...SWEPT, 'companies', 'user_roles']) {
    try {
      out[t] = (await db.query(`select count(*)::int v from public.${t}`)).rows[0].v;
    } catch { out[t] = null; }
  }
  out['companies(owner_id IS NULL)'] =
    (await db.query(`select count(*)::int v from public.companies where owner_id is null`)).rows[0].v;
  out['user_roles'] = (await db.query(`select count(*)::int v from public.user_roles`)).rows[0].v;
  return out;
}

async function main() {
  const { all } = await collectMigrations();
  const db = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } });
  await db.exec(await readFile(join(HERE, '00_supabase_shim.sql'), 'utf8'));
  await db.query(`select set_config('app.settings.encryption_key', $1, false)`, [TEST_ENCRYPTION_KEY]);
  for (const m of all.filter((x) => APPLIED.has(x.rawVersion))) {
    await db.exec(await readFile(m.path, 'utf8'));
  }
  await db.exec(DRIFT);

  console.log('═'.repeat(78));
  console.log('  DATA-BEARING REHEARSAL');
  console.log('═'.repeat(78));
  await seed(db);
  const before = await census(db);
  console.log(`\n  seeded: ${before.companies} companies (${before['companies(owner_id IS NULL)']} customer records`
    + ` / ${before.companies - before['companies(owner_id IS NULL)']} tenants), `
    + `${before.user_roles} role grants, ${before.jobs} jobs, ${before.clients} clients, `
    + `${before.employees} employees, ${before.contractors} contractors, ${before.documents} documents`);

  // Pre-flight: what will 20260818000700's cleanup match?
  const orphans = (await db.query(
    `select count(*)::int v from public.user_roles ur
      where ur.company_id is null
         or not exists (select 1 from public.companies c where c.id = ur.company_id)`)).rows[0].v;
  console.log(`  user_roles rows 20260818000700 would delete: ${orphans}`);

  console.log('\n── applying the outstanding migrations ──');
  const outstanding = all.filter((m) => !APPLIED.has(m.rawVersion));
  const timings = [];
  for (const m of outstanding) {
    const t0 = Date.now();
    try {
      await db.exec(await readFile(m.path, 'utf8'));
      timings.push({ file: m.file, ms: Date.now() - t0, ok: true });
    } catch (err) {
      timings.push({ file: m.file, ms: Date.now() - t0, ok: false, error: err.message });
    }
  }
  const failed = timings.filter((t) => !t.ok);
  console.log(`  ${timings.length - failed.length} applied, ${failed.length} aborted`);
  failed.forEach((f) => console.log(`  ABORT ${f.file}\n        ${f.error.replace(/\s+/g, ' ').slice(0, 180)}`));
  const slow = timings.filter((t) => t.ms >= 200).sort((a, b) => b.ms - a.ms).slice(0, 5);
  if (slow.length) {
    console.log('  slowest:');
    slow.forEach((s) => console.log(`    ${String(s.ms).padStart(6)} ms  ${s.file}`));
  }

  const after = await census(db);
  console.log('\n── DATA EFFECT ──');
  let destroyed = 0;
  for (const k of Object.keys(before)) {
    const b = before[k], a = after[k];
    if (b === null || a === null || b === a) continue;
    destroyed += b - a;
    console.log(`  ${k.padEnd(30)} ${String(b).padStart(6)} -> ${String(a).padStart(6)}   (${a - b})`);
  }
  if (destroyed === 0) console.log('  no rows destroyed.');

  console.log('\n── FINAL CONSTRAINT STATE ──');
  const fk = (await db.query(
    `select conname, pg_get_constraintdef(oid) d from pg_constraint
      where conrelid='public.user_roles'::regclass and contype='f' order by conname`)).rows;
  fk.forEach((r) => console.log(`  ${r.conname.padEnd(30)} ${r.d}`));

  await db.close();
  console.log('\n' + '═'.repeat(78));
  console.log('  Local only. No production connection, migration, repair, push or deploy.');
  console.log('═'.repeat(78));
}

main().catch((e) => {
  console.error('\nHARNESS ERROR:', e);
  process.exit(2);
});
