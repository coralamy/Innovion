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

import {
  bootIntegrated,
  tryAsRole,
  outstandingRebases,
  verifySnapshot,
  VERIFIED_AGAINST,
} from './integration-harness.mjs';

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
    // Any rebase still only DECLARED, not yet made in the owning team's tree.
    // Now normally empty: collisions are detected from the trees rather than
    // declared, because a declared list goes stale — this one did.
    const outstanding = outstandingRebases();
    check(
      "every declared rebase has been applied in the owning team's tree",
      outstanding.length === 0,
      outstanding.map((o) => `${o.target} → ${o.version}`).join('; ')
    );
  }
  {
    // Team D's foundation migration was renamed three times in ten minutes
    // during this integration. Results that straddle a rename are worthless, and
    // one such run produced a negative control that passed for the wrong reason.
    // Everything below is only meaningful against the pinned revision.
    const drift = await verifySnapshot();
    check(
      `Team B and Team D trees are at the verified revision (${VERIFIED_AGAINST.capturedAt})`,
      drift.length === 0,
      drift.map((d) => `[${d.team}] ${d.file}: ${d.kind} — ${d.detail}`).join(' | ')
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
  group('K. PLATFORM PRIVILEGE TIERS — the platform_engineer adjudication');
  // Team D asked whether platform_engineer is intended to hold ALL-command write
  // over partners / partner_products / partner_revenue. Ruled: not intended.
  // These assertions are what makes that ruling real rather than a comment.
  const ENGINEER = 'eeeeeeee-0000-0000-0000-00000000000e';
  const FOUNDER = 'ffffffff-0000-0000-0000-00000000000f';
  {
    await db.exec(`
      INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
        ('${ENGINEER}','engineer@platform.test',now()),
        ('${FOUNDER}','founder@platform.test', now())
      ON CONFLICT (id) DO NOTHING;
      UPDATE public.identity_user_profiles SET platform_role='platform_engineer' WHERE id='${ENGINEER}';
      UPDATE public.identity_user_profiles SET platform_role='founder'           WHERE id='${FOUNDER}';
      INSERT INTO public.partners(id,partner_code,partner_name)
        VALUES ('11111111-2222-3333-4444-555555555555','TEST-P1','Test Partner')
        ON CONFLICT DO NOTHING;
      INSERT INTO public.partner_revenue(partner_id,company_id,period_start,period_end,commission_amount)
        VALUES ('11111111-2222-3333-4444-555555555555','${CO_B}','2026-08-01','2026-08-31',4200);
    `);
    const AS_ENG = claims(ENGINEER);
    const AS_FOUNDER = claims(FOUNDER);

    // The tier assignments must be real, or every assertion below is vacuous.
    const engIsAdmin = await tryAsRole(db, 'authenticated', AS_ENG, `select public.is_platform_admin() v`);
    check(
      'CONTROL: platform_engineer really does hold is_platform_admin()',
      engIsAdmin.rows?.[0]?.v === true,
      `got ${engIsAdmin.rows?.[0]?.v ?? engIsAdmin.error} — if false, the denials below prove nothing`
    );
    const engIsFounder = await tryAsRole(db, 'authenticated', AS_ENG, `select public.is_platform_founder() v`);
    check(
      'CONTROL: platform_engineer is NOT is_platform_founder()',
      engIsFounder.rows?.[0]?.v === false,
      `got ${engIsFounder.rows?.[0]?.v ?? engIsFounder.error}`
    );

    // READ tier — the engineer keeps what diagnosing a partner deployment needs.
    check(
      'platform_engineer READS public.partners',
      (await countAs('authenticated', AS_ENG, 'partners')) >= 1
    );
    check(
      'platform_engineer READS public.partner_products',
      (await countAs('authenticated', AS_ENG, 'partner_products')) !== 'ERR'
    );

    // WRITE tier — narrowed. Commercial terms are not an engineering surface.
    for (const t of ['partners', 'partner_products']) {
      const r = await tryAsRole(
        db,
        'authenticated',
        AS_ENG,
        `update public.${t} set updated_at = now() returning id`
      );
      check(
        `platform_engineer CANNOT write public.${t}`,
        !!r.error || r.rows.length === 0,
        r.error ? 'denied' : `${r.rows.length} ROWS WRITTEN`
      );
    }
    {
      const r = await tryAsRole(
        db,
        'authenticated',
        AS_ENG,
        `insert into public.partners(id,partner_code,partner_name) values (gen_random_uuid(),'ENG-X','engineer-created') returning id`
      );
      check(
        'platform_engineer CANNOT insert into public.partners',
        !!r.error,
        r.error ? 'denied' : 'ROW CREATED'
      );
    }

    // partner_revenue is financial: the engineer does not read it at all.
    // Paired with its control, so a zero cannot mean "there was nothing there".
    check(
      'CONTROL: the founder/steward tier DOES read the partner_revenue row',
      (await countAs('authenticated', AS_FOUNDER, 'partner_revenue')) === 1,
      'if 0, the engineer denial below is vacuous'
    );
    check(
      'platform_engineer CANNOT read public.partner_revenue',
      (await countAs('authenticated', AS_ENG, 'partner_revenue')) === 0,
      'financial records are steward-tier only'
    );
    // The pre-existing tenant read path must survive the narrowing: a company
    // still sees its own revenue rows.
    check(
      'a tenant still reads its OWN partner_revenue rows',
      (await countAs('authenticated', claims(STAFF_B), 'partner_revenue')) === 1
    );

    // The founder tier must still work, or least privilege has become no privilege.
    check(
      'founder holds innovion_is_platform_steward()',
      (await tryAsRole(db, 'authenticated', AS_FOUNDER, `select public.innovion_is_platform_steward() v`))
        .rows?.[0]?.v === true
    );
    {
      const r = await tryAsRole(
        db,
        'authenticated',
        AS_FOUNDER,
        `insert into public.partners(id,partner_code,partner_name) values (gen_random_uuid(),'FDR-X','founder-created') returning id`
      );
      check('founder CAN write public.partners', !r.error && r.rows.length === 1, r.error ?? 'ok');
    }
    // And an ordinary tenant admin gets none of it.
    check(
      'a tenant admin reads no partner rows',
      (await countAs('authenticated', AS_STAFF_A, 'partners')) === 0
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('L. A↔D TENANCY CONTRACT — the directory Team D projects from');
  {
    const dir = await q(`select company_id, tenant_id, display_name from public.innovion_tenant_directory order by display_name`);
    check('tenant directory lists every Team A company', dir.length === 2, `${dir.length} rows`);
    check(
      'canonical tenant_id is company:<uuid>',
      dir.every((r) => r.tenant_id === `company:${r.company_id}`),
      dir.map((r) => r.tenant_id).join(', ')
    );

    const mem = await q(`select user_id, tenant_id, tenant_role from public.innovion_tenant_membership_directory`);
    const roleOf = (u) => mem.find((m) => m.user_id === u)?.tenant_role ?? null;
    check('company owner projects as tenant_owner', roleOf(STAFF_A) === 'tenant_owner', `${roleOf(STAFF_A)}`);
    check(
      'a viewer projects as NOTHING — Platform membership carries publish/audit authority',
      roleOf(VIEWER_A) === null,
      `${roleOf(VIEWER_A)}`
    );
    check(
      'a Workforce contractor projects as NOTHING',
      roleOf(WORKER_A) === null,
      `${roleOf(WORKER_A)}`
    );
    check(
      'exactly one row per (user, tenant) — the highest role wins',
      mem.length === new Set(mem.map((m) => `${m.user_id}|${m.tenant_id}`)).size,
      `${mem.length} rows`
    );

    // Non-forgeability: the contract must not be reachable from metadata.
    const defs = await q(`
      select viewname, pg_get_viewdef(('public.'||viewname)::regclass, true) d
      from pg_views where schemaname='public'
        and viewname in ('innovion_tenant_directory','innovion_tenant_membership_directory')`);
    check(
      'neither directory view reads client-writable metadata',
      defs.every((v) => !/user_metadata|raw_user_meta_data|raw_app_meta_data/.test(v.d)),
      defs.length ? '' : 'views missing'
    );

    // The views are security_invoker, so a tenant admin sees only their own.
    const seenByA = await tryAsRole(
      db,
      'authenticated',
      AS_STAFF_A,
      `select count(distinct tenant_id)::int c from public.innovion_tenant_directory`
    );
    check(
      'a tenant admin sees only their own tenant in the directory',
      seenByA.rows?.[0]?.c === 1,
      `sees ${seenByA.rows?.[0]?.c ?? seenByA.error} tenants`
    );
    const anonDir = await tryAsRole(db, 'anon', null, `select count(*)::int c from public.innovion_tenant_directory`);
    check(
      'anon reads no tenant directory rows',
      !!anonDir.error || anonDir.rows[0].c === 0,
      anonDir.error ? 'denied' : `${anonDir.rows[0].c} rows`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('M. WORKFORCE CARVE-OUTS — behaviour, not policy existence');
  // Team B reported that nothing asserted the public.settings restrictions after
  // policy ownership moved to Team A. The structural guard now lives in
  // 20260818000300; these are the behavioural counterparts, because a policy
  // being present is not the same claim as a worker being unable to write.
  {
    const COLLEAGUE = 'ccccccc2-0000-0000-0000-00000000000a';
    await db.exec(`
      INSERT INTO public.contractors(id,name,company_id,email)
        VALUES ('${COLLEAGUE}','Colleague A','${CO_A}','colleagueA@a.test');
      INSERT INTO public.settings(company_id,company_name,abn)
        VALUES ('${CO_A}','Tenant A Pty Ltd','11111111111');
      INSERT INTO public.compliance_items(company_id,title,assigned_to)
        VALUES ('${CO_A}','White Card','Worker A'),
               ('${CO_A}','Asbestos Awareness','Colleague A');
    `);

    // Control: the principal really is workforce-only, or every denial below is
    // vacuous — a staff user would be denied by nothing and pass anyway.
    const wfo = await tryAsRole(db, 'authenticated', AS_WORKER_A,
      `select public.is_workforce_only_user() v`);
    check(
      'CONTROL: Worker A really is a workforce-only principal',
      wfo.rows?.[0]?.v === true,
      `got ${wfo.rows?.[0]?.v ?? wfo.error}`
    );

    // settings — READ is the carve-out and must work.
    check(
      'a worker READS settings (branding loads on cold start)',
      (await countAs('authenticated', AS_WORKER_A, 'settings')) === 1
    );
    // settings — WRITE stays closed on all three commands.
    {
      const r = await tryAsRole(db, 'authenticated', AS_WORKER_A,
        `update public.settings set company_name='seized', abn='00000000000' returning id`);
      check('a worker CANNOT update settings (company name, ABN, currency)',
        !!r.error || r.rows.length === 0,
        r.error ? 'denied' : `${r.rows.length} ROWS WRITTEN`);
    }
    {
      const r = await tryAsRole(db, 'authenticated', AS_WORKER_A,
        `insert into public.settings(company_id,company_name) values ('${CO_A}','rogue') returning id`);
      check('a worker CANNOT insert settings', !!r.error, r.error ? 'denied' : 'ROW CREATED');
    }
    {
      const r = await tryAsRole(db, 'authenticated', AS_WORKER_A,
        `delete from public.settings returning id`);
      check('a worker CANNOT delete settings',
        !!r.error || r.rows.length === 0,
        r.error ? 'denied' : `${r.rows.length} ROWS DELETED`);
    }
    // Control: the settings row is genuinely mutable by someone, so the denials
    // above are not passing because the row was unreachable to begin with.
    {
      const r = await tryAsRole(db, 'authenticated', AS_STAFF_A,
        `update public.settings set phone='0400000000' returning id`);
      check('CONTROL: a tenant admin CAN update settings',
        !r.error && r.rows.length === 1, r.error ?? `${r.rows?.length} rows`);
    }

    // compliance_items — own record only, and read-only.
    check(
      "a worker READS their OWN compliance record",
      (await countAs('authenticated', AS_WORKER_A, 'compliance_items')) === 1
    );
    check(
      "...and NOT a colleague's",
      (await countAs('authenticated', AS_WORKER_A, 'compliance_items',
        `title = 'Asbestos Awareness'`)) === 0
    );
    check(
      'CONTROL: a tenant admin sees both compliance records',
      (await countAs('authenticated', AS_STAFF_A, 'compliance_items')) === 2
    );
    {
      const r = await tryAsRole(db, 'authenticated', AS_WORKER_A,
        `update public.compliance_items set comp_status='compliant' returning id`);
      check('a worker CANNOT update their own compliance status',
        !!r.error || r.rows.length === 0,
        r.error ? 'denied' : `${r.rows.length} ROWS WRITTEN`);
    }
    {
      const r = await tryAsRole(db, 'authenticated', AS_WORKER_A,
        `insert into public.compliance_items(company_id,title,assigned_to)
         values ('${CO_A}','Self-issued ticket','Worker A') returning id`);
      check('a worker CANNOT insert a compliance item', !!r.error,
        r.error ? 'denied' : 'ROW CREATED');
    }
    {
      const r = await tryAsRole(db, 'authenticated', AS_WORKER_A,
        `delete from public.compliance_items returning id`);
      check('a worker CANNOT delete a compliance item',
        !!r.error || r.rows.length === 0,
        r.error ? 'denied' : `${r.rows.length} ROWS DELETED`);
    }
    // Cross-tenant: Tenant B's worker sees neither.
    check(
      "Tenant B's worker reads no Tenant A settings",
      (await countAs('authenticated', AS_WORKER_B, 'settings')) === 0
    );
    check(
      "Tenant B's worker reads no Tenant A compliance records",
      (await countAs('authenticated', AS_WORKER_B, 'compliance_items')) === 0
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
