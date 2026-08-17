/**
 * Innovion A/B/D — integrated security & isolation suite
 * ===========================================================================
 * Applies the migrations of all three teams in Supabase order, then attacks the
 * RESULT — not any one team's schema.
 *
 * Team A's suite (121 assertions) and Team B's (49 isolation checks) both pass
 * against their own schemas. Neither exercises the other's principal, so the
 * failures that matter here are invisible to both.
 *
 *   PRINCIPALS
 *   ----------
 *   staffA      Tenant A admin      — user_roles row, no contractor record
 *   viewerA     Tenant A viewer     — user_roles row
 *   workerA     Tenant A contractor — Workforce user: NO user_roles row
 *   staffB      Tenant B admin
 *   workerB     Tenant B contractor — the attacker in most cases
 *   outsider    authenticated, no membership of any kind
 *   anon        unauthenticated
 *
 * Run:  npm run test:integration
 * Exit: 0 = all assertions passed, 1 = at least one failed.
 */

import { bootIntegrated, tryAsRole, outstandingRebases } from './integration-harness.mjs';

const CO_A = 'aaaaaaaa-0000-0000-0000-00000000000a';
const CO_B = 'bbbbbbbb-0000-0000-0000-00000000000b';

const STAFF_A = '11111111-0000-0000-0000-00000000000a';
const VIEWER_A = '22222222-0000-0000-0000-00000000000a';
const WORKER_A = '33333333-0000-0000-0000-00000000000a';
const STAFF_B = '11111111-0000-0000-0000-00000000000b';
const WORKER_B = '33333333-0000-0000-0000-00000000000b';
const OUTSIDER = '99999999-9999-9999-9999-999999999999';

const CONTRACTOR_A = 'ccccccc1-0000-0000-0000-00000000000a';
const CONTRACTOR_B = 'ccccccc1-0000-0000-0000-00000000000b';

let pass = 0;
const failures = [];
let section = '';

const group = (n) => {
  section = n;
  console.log(`\n── ${n}`);
};
const check = (desc, ok, detail = '') => {
  if (ok) {
    pass++;
    console.log(`   PASS  ${desc}${detail ? `  (${detail})` : ''}`);
  } else {
    failures.push(`[${section}] ${desc}${detail ? ` — ${detail}` : ''}`);
    console.log(`   FAIL  ${desc}${detail ? `  (${detail})` : ''}`);
  }
};

const claims = (sub, meta) => ({
  sub,
  role: 'authenticated',
  ...(meta ? { user_metadata: meta } : {}),
});

async function main() {
  const { db, applied, collisions } = await bootIntegrated({ quiet: true });

  // ═══════════════════════════════════════════════════════════════════════════
  group('0. MIGRATION CHAIN');
  const failed = applied.filter((a) => !a.ok);
  check(
    `all ${applied.length} A/B/D migrations apply in Supabase order`,
    failed.length === 0,
    failed.map((f) => `[${f.team}] ${f.file}: ${f.error}`).join(' | ')
  );
  check(
    'the reconciled chain has no version collision',
    collisions.length === 0,
    collisions.map((c) => `${c.version}: ${c.files.map((f) => f.team).join('/')}`).join(', ')
  );
  {
    // The reconciled ordering above is achieved by the rebases declared in
    // integration-manifest.mjs. Any rebase not yet made in the owning team's
    // tree is reported here so a green chain is never mistaken for a deployed
    // one — `supabase db push` would still refuse until the file is renamed.
    const outstanding = outstandingRebases();
    check(
      "every declared rebase has been applied in the owning team's tree",
      outstanding.length === 0,
      outstanding.map((o) => `${o.target} → ${o.version}`).join('; ')
    );
  }

  // ── fixtures ──────────────────────────────────────────────────────────────
  await db.exec(`
    INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
      ('${STAFF_A}','staffA@a.test',   now()),
      ('${VIEWER_A}','viewerA@a.test', now()),
      ('${WORKER_A}','workerA@a.test', now()),
      ('${STAFF_B}','staffB@b.test',   now()),
      ('${WORKER_B}','workerB@b.test', now()),
      ('${OUTSIDER}','outsider@x.test',now())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.companies(id,name,owner_id) VALUES
      ('${CO_A}','Tenant A','${STAFF_A}'),
      ('${CO_B}','Tenant B','${STAFF_B}');

    INSERT INTO public.user_roles(user_id,company_id,role) VALUES
      ('${STAFF_A}','${CO_A}','admin'),
      ('${VIEWER_A}','${CO_A}','viewer'),
      ('${STAFF_B}','${CO_B}','admin');

    INSERT INTO public.contractors(id,name,company_id,user_id,email) VALUES
      ('${CONTRACTOR_A}','Worker A','${CO_A}','${WORKER_A}','workerA@a.test'),
      ('${CONTRACTOR_B}','Worker B','${CO_B}','${WORKER_B}','workerB@b.test');

    INSERT INTO public.jobs(company_id,job_number,title) VALUES
      ('${CO_A}','JOB-A-1','Tenant A job'),
      ('${CO_B}','JOB-B-1','Tenant B job');

    INSERT INTO public.clients(company_id,name)   VALUES ('${CO_A}','Tenant A client');
    INSERT INTO public.employees(company_id,name,salary) VALUES ('${CO_A}','Tenant A employee','185000');
    INSERT INTO public.sites(company_id,name)     VALUES ('${CO_A}','Tenant A site');
    INSERT INTO public.documents(company_id,name,access_level) VALUES
      ('${CO_A}','Field safety doc','All Staff'),
      ('${CO_A}','Board pack','Management');
    INSERT INTO public.provider_integrations(company_id,provider_slug,provider_name,encrypted_config)
      VALUES ('${CO_A}','xero','Xero','CIPHER-A');
    INSERT INTO public.platform_api_keys(company_id,key_hash,key_prefix,label)
      VALUES ('${CO_A}','HASH-A','wf_live_','Tenant A key');
    INSERT INTO public.pending_invites(company_id,email) VALUES ('${CO_A}','invitee@a.test');
  `);

  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const countAs = async (role, cl, table, where = 'true') => {
    const r = await tryAsRole(
      db,
      role,
      cl,
      `select count(*)::int c from public.${table} where ${where}`
    );
    return r.error ? `ERR` : r.rows[0].c;
  };

  const AS_WORKER_B = claims(WORKER_B);
  const AS_WORKER_A = claims(WORKER_A);
  const AS_STAFF_A = claims(STAFF_A);
  const AS_VIEWER_A = claims(VIEWER_A);
  const AS_OUTSIDER = claims(OUTSIDER);

  // ═══════════════════════════════════════════════════════════════════════════
  group('A. DEP-1 REGRESSION — the Workforce principal must actually resolve');
  // Before reconciliation, Team A's get_my_company_id() replaced Team B's and a
  // contractor resolved to NULL, so every Team B RESTRICTIVE tenant guard
  // denied unconditionally and the whole application returned nothing.
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_A,
      `select coalesce(public.get_my_company_id()::text,'NULL') v`
    );
    check(
      'contractor resolves to their tenant',
      r.rows?.[0].v === CO_A,
      `got ${r.rows?.[0].v ?? r.error}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_STAFF_A,
      `select coalesce(public.get_my_company_id()::text,'NULL') v`
    );
    check(
      'staff still resolves to their tenant',
      r.rows?.[0].v === CO_A,
      `got ${r.rows?.[0].v ?? r.error}`
    );
  }
  check(
    'contractor sees own-tenant jobs',
    (await countAs('authenticated', AS_WORKER_A, 'jobs')) === 1
  );
  check(
    'contractor sees own-tenant sites',
    (await countAs('authenticated', AS_WORKER_A, 'sites')) === 1
  );
  check('staff sees own-tenant jobs', (await countAs('authenticated', AS_STAFF_A, 'jobs')) === 1);

  // ═══════════════════════════════════════════════════════════════════════════
  group('B. CROSS-TENANT — Workforce contractor of Tenant B against Tenant A');
  for (const t of [
    'jobs',
    'clients',
    'employees',
    'sites',
    'documents',
    'contractors',
    'provider_integrations',
  ]) {
    const seen = await countAs('authenticated', AS_WORKER_B, t, `company_id='${CO_A}'`);
    check(
      `${t}: Tenant A rows visible to a Tenant B contractor`,
      seen === 0 || seen === 'ERR',
      `saw ${seen}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_B,
      `insert into public.jobs(company_id,job_number,title) values ('${CO_A}','EVIL','planted') returning id`
    );
    check(
      'contractor inserts into the victim tenant',
      !!r.error,
      r.error ? 'denied' : 'ROW CREATED'
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_B,
      `with u as (update public.jobs set title='PWNED' where company_id='${CO_A}' returning 1) select count(*)::int c from u`
    );
    check(
      'contractor updates victim-tenant jobs',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('C. FORGED AUTHORITY — metadata forging against all three models');
  const FORGED_A = claims(WORKER_B, {
    company_id: CO_A,
    role: 'admin',
    platform_role: 'founder',
    tenant_id: 'tenant-coralamy-root',
  });
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED_A,
      `select coalesce(public.get_my_company_id()::text,'NULL') v`
    );
    check(
      'forged user_metadata.company_id cannot steer the tenant',
      r.rows?.[0].v !== CO_A,
      `got ${r.rows?.[0].v ?? r.error}`
    );
  }
  for (const t of ['jobs', 'clients', 'employees', 'documents']) {
    const seen = await countAs('authenticated', FORGED_A, t, `company_id='${CO_A}'`);
    check(
      `${t}: forged admin claim yields no Tenant A rows`,
      seen === 0 || seen === 'ERR',
      `saw ${seen}`
    );
  }
  {
    // Team A's role authority
    const r = await tryAsRole(db, 'authenticated', FORGED_A, `select public.is_company_admin() v`);
    check(
      'is_company_admin() false under forged admin claim',
      r.rows?.[0].v === false,
      `got ${r.rows?.[0].v ?? r.error}`
    );
  }
  {
    // Team B's role authority
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED_A,
      `select public.is_platform_manager() v`
    );
    check(
      'is_platform_manager() false under forged admin claim',
      r.rows?.[0].v === false,
      `got ${r.rows?.[0].v ?? r.error}`
    );
  }
  {
    // Team D's platform authority — metadata claims founder
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED_A,
      `select public.is_platform_founder() v`
    );
    check(
      'is_platform_founder() false under forged platform_role claim',
      r.rows?.[0].v === false,
      `got ${r.rows?.[0].v ?? r.error}`
    );
  }
  {
    const r = await tryAsRole(db, 'authenticated', FORGED_A, `select public.is_platform_admin() v`);
    check(
      'is_platform_admin() false under forged platform_role claim',
      r.rows?.[0].v === false,
      `got ${r.rows?.[0].v ?? r.error}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED_A,
      `select public.innovion_is_platform_operator() v`
    );
    check(
      'unified platform-operator check false under forged claim',
      r.rows?.[0].v === false,
      `got ${r.rows?.[0].v ?? r.error}`
    );
  }
  {
    // The other client-writable channel: auth.users.raw_user_meta_data
    await db.exec(`RESET ROLE; UPDATE auth.users
      SET raw_user_meta_data = jsonb_build_object('company_id','${CO_A}','role','admin','platform_role','founder')
      WHERE id='${WORKER_B}';`);
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_B,
      `select coalesce(public.get_my_company_id()::text,'NULL') v`
    );
    check(
      'forged raw_user_meta_data cannot steer the tenant',
      r.rows?.[0].v !== CO_A,
      `got ${r.rows?.[0].v ?? r.error}`
    );
    const seen = await countAs('authenticated', AS_WORKER_B, 'jobs', `company_id='${CO_A}'`);
    check(
      'forged raw_user_meta_data yields no Tenant A jobs',
      seen === 0 || seen === 'ERR',
      `saw ${seen}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('D. JWT MANIPULATION');
  for (const [label, cl] of [
    ['role claim service_role', { sub: WORKER_B, role: 'service_role' }],
    ['role claim postgres', { sub: WORKER_B, role: 'postgres' }],
    ['no sub at all', { role: 'authenticated' }],
    ['sub of a different user', claims(STAFF_A)],
  ]) {
    // The last case is not a forgery the DB can detect — GoTrue signs `sub` —
    // it is included to show the harness would notice if `sub` stopped being
    // authoritative. It is expected to succeed for STAFF_A.
    const seen = await countAs('authenticated', cl, 'jobs', `company_id='${CO_A}'`);
    if (label === 'sub of a different user') {
      check('a genuine Tenant A staff sub still resolves (control)', seen === 1, `saw ${seen}`);
    } else {
      check(`${label}: no Tenant A jobs`, seen === 0 || seen === 'ERR', `saw ${seen}`);
    }
  }
  {
    // is_end_user_session() (Team B) must not treat a claimed service_role as
    // an end user, and must not be fooled into granting more.
    const r = await tryAsRole(
      db,
      'authenticated',
      { sub: WORKER_B, role: 'service_role' },
      `select public.is_end_user_session() v`
    );
    check(
      'is_end_user_session() false when the token claims service_role',
      r.rows?.[0].v === false,
      `got ${r.rows?.[0].v ?? r.error}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('E. PRIVILEGE ESCALATION — Workforce → Platform staff');
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_A,
      `insert into public.user_roles(user_id,company_id,role) values ('${WORKER_A}','${CO_A}','admin') returning id`
    );
    check(
      'contractor grants themselves admin in their own tenant',
      !!r.error,
      r.error ? 'denied' : 'ROW CREATED'
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_A,
      `insert into public.user_roles(user_id,company_id,role) values ('${WORKER_A}','${CO_A}','manager') returning id`
    );
    check('contractor grants themselves manager', !!r.error, r.error ? 'denied' : 'ROW CREATED');
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_A,
      `with u as (update public.contractors set company_id='${CO_B}' where id='${CONTRACTOR_A}' returning 1) select count(*)::int c from u`
    );
    check(
      'contractor moves themselves into another tenant',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_A,
      `with u as (update public.contractors set role='admin' where id='${CONTRACTOR_A}' returning 1) select count(*)::int c from u`
    );
    check(
      'contractor edits their own platform-managed role column',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_A,
      `with u as (update public.contractors set hourly_rate = 9999 where id='${CONTRACTOR_A}' returning 1) select count(*)::int c from u`
    );
    check(
      'contractor edits their own pay rate',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_A,
      `insert into public.platform_operators(user_id) values ('${WORKER_A}') returning user_id`
    );
    check(
      'contractor self-designates as platform operator',
      !!r.error,
      r.error ? 'denied' : 'ROW CREATED'
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('F. INTEGRATION WIDENING — a contractor must not inherit staff reach');
  // These tables became reachable the moment get_my_company_id() started
  // answering for contractors. Section 4 of 20260818000100 closes them.
  for (const t of [
    'clients',
    'employees',
    'provider_integrations',
    'platform_api_keys',
    'pending_invites',
    'role_permissions',
  ]) {
    const seen = await countAs('authenticated', AS_WORKER_A, t, `company_id='${CO_A}'`);
    check(`contractor reads ${t} of their own tenant`, seen === 0 || seen === 'ERR', `saw ${seen}`);
  }
  {
    const seen = await countAs(
      'authenticated',
      AS_WORKER_A,
      'documents',
      `access_level='Management'`
    );
    check(
      'contractor reads Management-only documents',
      seen === 0 || seen === 'ERR',
      `saw ${seen}`
    );
  }
  {
    const seen = await countAs(
      'authenticated',
      AS_WORKER_A,
      'documents',
      `access_level='All Staff'`
    );
    check('REGRESSION: contractor still reads field documents', seen === 1, `saw ${seen}`);
  }
  // And none of it may cost the staff principal anything.
  for (const [t, expect] of [
    ['clients', 1],
    ['employees', 1],
    ['provider_integrations', 1],
    ['platform_api_keys', 1],
    ['pending_invites', 1],
  ]) {
    const seen = await countAs('authenticated', AS_STAFF_A, t, `company_id='${CO_A}'`);
    check(`REGRESSION: staff admin still reads ${t}`, seen === expect, `saw ${seen}`);
  }
  {
    const seen = await countAs('authenticated', AS_STAFF_A, 'documents');
    check(
      'REGRESSION: staff admin still reads all own-tenant documents',
      seen === 2,
      `saw ${seen}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('G. STORAGE — one policy set, not two OR-combined');
  await db.exec(`RESET ROLE;
    insert into storage.objects(bucket_id,name,owner) values
      ('documents','${CO_A}/tenantA.pdf','${STAFF_A}'),
      ('documents','${CO_B}/tenantB.pdf','${STAFF_B}'),
      ('documents','${WORKER_B}/legacy.pdf','${WORKER_B}');`);
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_B,
      `select count(*)::int c from storage.objects where name like '${CO_A}/%'`
    );
    check(
      "Tenant B contractor lists Tenant A's objects",
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_A,
      `with d as (delete from storage.objects where name like '${CO_A}/%' returning 1) select count(*)::int c from d`
    );
    check(
      'contractor deletes an own-tenant object (must be admin-only)',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} deleted`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_A,
      `insert into storage.objects(bucket_id,name,owner) values ('documents','${WORKER_A}/new-legacy.pdf','${WORKER_A}') returning id`
    );
    check(
      'legacy per-uid folder is not writable',
      !!r.error,
      r.error ? 'denied' : 'OBJECT CREATED'
    );
  }
  {
    // The agreed layout is <company_id>/<user_id>/<file>: segment 1 is the
    // tenant (Team A's isolation), segment 2 is the uploader (Team B's
    // workforce_documents_own_files_only restriction). Team A's
    // buildStoragePath now emits exactly this.
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_A,
      `insert into storage.objects(bucket_id,name,owner) values ('documents','${CO_A}/${WORKER_A}/from-worker.pdf','${WORKER_A}') returning id`
    );
    check(
      'REGRESSION: contractor writes to <tenant>/<uid>/ and can read it back',
      !r.error,
      r.error ?? 'ok'
    );
  }
  {
    // Same tenant, but a path with no uploader segment: Team B's restrictive
    // policy denies the read-back. This is the cross-team layout contract, and
    // it is asserted so a future change to buildStoragePath cannot break it
    // silently.
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_A,
      `select count(*)::int c from storage.objects where name = '${CO_A}/tenantA.pdf'`
    );
    check(
      'workforce user cannot read a tenant-root object (Team B own-files rule)',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_STAFF_A,
      `select count(*)::int c from storage.objects where name = '${CO_A}/tenantA.pdf'`
    );
    check(
      'REGRESSION: staff DO read tenant-root objects',
      !r.error && r.rows[0].c === 1,
      r.error ?? `saw ${r.rows?.[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_STAFF_A,
      `with d as (delete from storage.objects where name = '${CO_A}/${WORKER_A}/from-worker.pdf' returning 1) select count(*)::int c from d`
    );
    check(
      'REGRESSION: tenant admin can still delete',
      !r.error && r.rows[0].c === 1,
      r.error ?? `${r.rows?.[0].c} deleted`
    );
  }
  {
    const rows = await q(`select policyname from pg_policies where schemaname='storage'
                          and policyname in ('documents_select_own','documents_insert_own','documents_update_own','documents_delete_own')`);
    check(
      'duplicate documents-bucket policy set removed',
      rows.length === 0,
      rows.map((r) => r.policyname).join(', ')
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('H. TEAM D — platform authority');
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_OUTSIDER,
      `select count(*)::int c from public.platform_tenants`
    );
    check(
      'a non-member reads platform_tenants',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_B,
      `insert into public.identity_user_profiles(id,email,platform_role,tenant_id)
         values ('${WORKER_B}','workerB@b.test','founder','tenant-coralamy-root') returning id`
    );
    check(
      'a contractor inserts themselves as platform founder',
      !!r.error,
      r.error ? 'denied' : 'ROW CREATED'
    );
  }
  {
    await db.exec(`RESET ROLE;
      insert into public.identity_user_profiles(id,email,platform_role,tenant_id,is_active)
        values ('${WORKER_B}','workerB@b.test','end_user','tenant-coralamy-root',true)
      on conflict (id) do nothing;`);
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_B,
      `with u as (update public.identity_user_profiles set platform_role='founder' where id='${WORKER_B}' returning 1) select count(*)::int c from u`
    );
    check(
      'an end_user promotes their own platform_role',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      AS_WORKER_B,
      `insert into public.identity_tenant_memberships(user_id,tenant_id,role)
         values ('${WORKER_B}','tenant-coralamy-root','owner') returning user_id`
    );
    check(
      'an end_user grants themselves tenant membership',
      !!r.error,
      r.error ? 'denied' : 'ROW CREATED'
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('I. UNAUTHENTICATED');
  for (const t of [
    'jobs',
    'clients',
    'employees',
    'documents',
    'contractors',
    'time_entries',
    'messages',
    'conversations',
    'checklist_responses',
  ]) {
    const seen = await countAs('anon', null, t);
    check(`anon reads ${t}`, seen === 0 || seen === 'ERR', `saw ${seen}`);
  }
  for (const [t, cols] of [
    ['messages', "(content) values ('injected')"],
    ['conversations', '(id) values (gen_random_uuid())'],
  ]) {
    const r = await tryAsRole(db, 'anon', null, `insert into public.${t} ${cols} returning id`);
    check(`anon inserts into ${t}`, !!r.error, r.error ? 'denied' : 'ROW CREATED');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('J. STRUCTURAL INVARIANTS OF THE INTEGRATED SCHEMA');
  {
    const rows = await q(`select proname, count(*)::int c from pg_proc p
                          join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and proname in
                            ('get_my_company_id','get_user_company_id','integration_user_company_id',
                             'is_company_admin','is_platform_manager','innovion_is_platform_operator')
                          group by proname having count(*) > 1`);
    check(
      'no tenant/role resolver is defined more than once',
      rows.length === 0,
      rows.map((r) => `${r.proname}×${r.c}`).join(', ')
    );
  }
  {
    const def = (
      await q(`select pg_get_functiondef(to_regprocedure('public.get_my_company_id()')) d`)
    )[0].d;
    check('get_my_company_id() is the unified resolver', /innovion_tenant_ids/.test(def));
  }
  {
    const def = (
      await q(`select pg_get_functiondef(to_regprocedure('public.innovion_auth_company_ids()')) d`)
    )[0].d;
    check('staff membership set was NOT widened to contractors', !/contractor/i.test(def));
  }
  {
    const rows = await q(`select tablename||'.'||policyname p from pg_policies
                          where schemaname='public' and ('anon'=any(roles) or 'public'=any(roles))
                            and permissive='PERMISSIVE'
                            and coalesce(qual,with_check,'') !~ 'auth\\.uid\\(\\)|get_my_company_id|is_end_user_session'`);
    check(
      'no permissive anon policy without an identity predicate',
      rows.length === 0,
      `${rows.length}: ${rows
        .map((r) => r.p)
        .slice(0, 6)
        .join(', ')}`
    );
  }
  {
    const rows =
      await q(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
                          where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
    check(
      'every public table has RLS enabled',
      rows.length === 0,
      rows.map((r) => r.relname).join(', ')
    );
  }
  {
    const rows =
      await q(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
                          where n.nspname='public' and c.relkind='v'
                            and not coalesce((select true from unnest(coalesce(c.reloptions,'{}')) o
                                              where o in ('security_invoker=true','security_invoker=on')), false)`);
    check(
      'every view enforces base-table RLS',
      rows.length === 0,
      rows.map((r) => r.relname).join(', ')
    );
  }
  {
    const rows =
      await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.prosecdef
                            and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) cfg
                                            where cfg like 'search_path=%')`);
    check(
      'every SECURITY DEFINER function pins search_path',
      rows.length === 0,
      `${rows.length}: ${rows
        .map((r) => r.proname)
        .slice(0, 8)
        .join(', ')}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  await db.close();
  console.log('\n' + '═'.repeat(78));
  console.log(`  ${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\n  FAILURES');
    failures.forEach((f, i) => console.log(`   ${String(i + 1).padStart(2)}. ${f}`));
  }
  console.log('═'.repeat(78));
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error('\nHARNESS ERROR:', e);
  process.exit(2);
});
