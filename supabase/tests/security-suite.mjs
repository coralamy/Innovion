/**
 * Innovion Team A — Database security & tenant-isolation regression suite
 * ===========================================================================
 * Boots an in-process PostgreSQL, applies every migration, then attacks the
 * result from the position of a real adversary.
 *
 *   THREAT MODEL
 *   ------------
 *   The attacker is a legitimate, authenticated, NON-admin ('viewer') member of
 *   Tenant B. They may freely rewrite every channel a real Supabase user can
 *   write to:
 *      1. the `user_metadata` claim in their own JWT, and
 *      2. their own `auth.users.raw_user_meta_data` row,
 *   both of which `supabase.auth.updateUser({ data: { ... } })` exposes.
 *   They may NOT write `public.user_roles` — that is the authoritative table.
 *
 *   A second adversary is fully unauthenticated (`anon`).
 *
 * Run:  npm run test:security
 * Exit: 0 = all assertions passed, 1 = at least one assertion failed.
 */

import { boot, tryAsRole, seedRow, TEST_ENCRYPTION_KEY } from './harness.mjs';

// ── identities ──────────────────────────────────────────────────────────────
const ATTACKER = '11111111-1111-1111-1111-111111111111'; // Tenant B, viewer
const ADMIN_A = '22222222-2222-2222-2222-222222222222'; // Tenant A, admin
const FRESH = '33333333-3333-3333-3333-333333333333'; // no company at all
const VIEWER_A = '44444444-4444-4444-4444-444444444444'; // Tenant A, viewer
const ADMIN_B = '55555555-5555-5555-5555-555555555555'; // Tenant B, admin

// Business tables that must be strictly tenant-scoped.
const TENANT_TABLES = [
  'jobs',
  'clients',
  'employees',
  'documents',
  'time_entries',
  'sites',
  'incidents',
  'inventory',
  'vehicles',
  'contractors',
  'checklists',
  'compliance_items',
  'notifications',
  'provider_integrations',
];

// ── assertion plumbing ──────────────────────────────────────────────────────
let pass = 0;
const failures = [];
let section = '';

function group(name) {
  section = name;
  console.log(`\n── ${name}`);
}
function check(desc, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`   PASS  ${desc}${detail ? `  (${detail})` : ''}`);
  } else {
    failures.push(`[${section}] ${desc}${detail ? ` — ${detail}` : ''}`);
    console.log(`   FAIL  ${desc}${detail ? `  (${detail})` : ''}`);
  }
}

const claims = (sub, meta) => ({
  sub,
  role: 'authenticated',
  ...(meta ? { user_metadata: meta } : {}),
});

async function main() {
  const { db, applied } = await boot({ quiet: true });

  group('0. MIGRATION APPLICATION');
  const failedMigrations = applied.filter((a) => !a.ok);
  check(
    `all ${applied.length} migrations apply cleanly (regression guards included)`,
    failedMigrations.length === 0,
    failedMigrations.map((f) => `${f.file}: ${f.error}`).join(' | ')
  );

  // ── fixtures ──────────────────────────────────────────────────────────────
  await db.exec(`
    INSERT INTO auth.users(id,email) VALUES
      ('${ATTACKER}','attacker@tenantB.test'),
      ('${ADMIN_A}','admin@tenantA.test'),
      ('${FRESH}','newuser@fresh.test'),
      ('${VIEWER_A}','viewer@tenantA.test'),
      ('${ADMIN_B}','admin@tenantB.test')
    ON CONFLICT (id) DO NOTHING;
  `);

  await db.exec(`
    DO $$
    DECLARE cA uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
            cB uuid := 'bbbbbbbb-0000-0000-0000-00000000000b';
    BEGIN
      INSERT INTO public.companies(id,name,owner_id) VALUES
        (cA,'Tenant A','${ADMIN_A}'), (cB,'Tenant B','${ADMIN_B}');

      INSERT INTO public.user_roles(user_id,company_id,role) VALUES
        ('${ATTACKER}', cB, 'viewer'),
        ('${ADMIN_A}',  cA, 'admin'),
        ('${VIEWER_A}', cA, 'viewer'),
        ('${ADMIN_B}',  cB, 'admin');

      -- The attacker forges BOTH client-writable channels at once.
      UPDATE auth.users
         SET raw_user_meta_data = jsonb_build_object('company_id',cA::text,'role','admin')
       WHERE id='${ATTACKER}';
    END $$;
  `);

  const CA = 'aaaaaaaa-0000-0000-0000-00000000000a';
  const CB = 'bbbbbbbb-0000-0000-0000-00000000000b';

  // One Tenant A row in every tenant-scoped table, plus a Tenant B row where
  // the test needs the attacker to own something legitimate.
  for (const t of TENANT_TABLES) {
    if (t === 'provider_integrations') continue;
    await seedRow(db, t, { company_id: CA });
  }
  await seedRow(db, 'jobs', { company_id: CB });
  await seedRow(db, 'provider_integrations', {
    company_id: CA,
    provider_slug: 'ivxtest_xero',
    provider_name: 'Xero (Tenant A)',
    encrypted_config: 'TENANT-A-CIPHERTEXT',
  });
  await seedRow(db, 'platform_api_keys', {
    company_id: CA,
    key_hash: 'HASH-OF-TENANT-A-KEY',
    key_prefix: 'wf_live_',
    label: 'Tenant A key',
  });

  // Attacker's forged JWT: claims to be a Tenant A admin.
  const FORGED = claims(ATTACKER, { company_id: CA, role: 'admin' });
  const HONEST_ADMIN_A = claims(ADMIN_A);
  const HONEST_VIEWER_A = claims(VIEWER_A);

  const countAs = async (role, cl, table, where = `company_id='${CA}'`) => {
    const r = await tryAsRole(
      db,
      role,
      cl,
      `select count(*)::int c from public.${table} where ${where}`
    );
    return r.error ? `ERR:${r.error}` : r.rows[0].c;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  group('A. CROSS-TENANT READ — attacker forges tenant + admin on BOTH channels');
  for (const t of TENANT_TABLES) {
    const seen = await countAs('authenticated', FORGED, t);
    check(`${t}: rows of Tenant A visible to Tenant B viewer`, seen === 0, `saw ${seen}`);
  }

  const idFns = ['get_my_company_id', 'get_user_company_id', 'integration_user_company_id'];
  for (const fn of idFns) {
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED,
      `select coalesce(public.${fn}()::text,'NULL') v`
    );
    check(
      `${fn}() cannot be steered to the victim tenant`,
      r.rows?.[0].v !== CA,
      `returned ${r.rows?.[0].v ?? r.error}`
    );
  }
  {
    const r = await tryAsRole(db, 'authenticated', FORGED, `select public.is_company_admin() v`);
    check(
      'is_company_admin() is false under a forged admin claim',
      r.rows?.[0].v === false,
      `returned ${r.rows?.[0].v ?? r.error}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED,
      `select public.innovion_auth_is_admin('${CA}') v`
    );
    check(
      'innovion_auth_is_admin(victim) is false under forged claim',
      r.rows?.[0].v === false,
      `returned ${r.rows?.[0].v ?? r.error}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('B. CROSS-TENANT WRITE — forged admin attempts mutation of Tenant A');
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED,
      `with u as (update public.provider_integrations set encrypted_config='PWNED' where company_id='${CA}' returning 1) select count(*)::int c from u`
    );
    check(
      'UPDATE provider_integrations of victim tenant',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED,
      `with d as (delete from public.provider_integrations where company_id='${CA}' returning 1) select count(*)::int c from d`
    );
    check(
      'DELETE provider_integrations of victim tenant',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }
  for (const t of ['jobs', 'clients', 'documents', 'time_entries', 'employees']) {
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED,
      `with d as (delete from public.${t} where company_id='${CA}' returning 1) select count(*)::int c from d`
    );
    check(
      `DELETE ${t} of victim tenant`,
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED,
      `insert into public.jobs(company_id,job_number,title) values ('${CA}','EVIL-1','planted') returning id`
    );
    check('INSERT a row INTO the victim tenant', !!r.error, r.error ? 'denied' : 'row created');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('C. PRIVILEGE ESCALATION');
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `with u as (update public.user_roles set role='admin' where user_id='${ATTACKER}' returning 1) select count(*)::int c from u`
    );
    check(
      'viewer promotes self to admin via UPDATE user_roles',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `insert into public.user_roles(user_id,company_id,role) values ('${ATTACKER}','${CA}','admin') returning id`
    );
    check(
      'viewer grants self admin in a foreign tenant (bootstrap abuse)',
      !!r.error,
      r.error ? 'denied' : 'row created'
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `insert into public.user_roles(user_id,company_id,role) values ('${ATTACKER}','${CB}','admin') returning id`
    );
    check(
      'viewer grants self admin in OWN tenant (already a member)',
      !!r.error,
      r.error ? 'denied' : 'row created'
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `insert into public.user_roles(user_id,company_id,role) values ('${FRESH}','${CB}','admin') returning id`
    );
    check(
      'viewer grants a THIRD PARTY admin in own tenant',
      !!r.error,
      r.error ? 'denied' : 'row created'
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `with d as (delete from public.user_roles where company_id='${CA}' returning 1) select count(*)::int c from d`
    );
    check(
      'attacker deletes victim tenant role assignments',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }
  {
    // Tenant A viewer must not be able to escalate within their own tenant.
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_VIEWER_A,
      `with u as (update public.user_roles set role='admin' where user_id='${VIEWER_A}' returning 1) select count(*)::int c from u`
    );
    check(
      'same-tenant viewer promotes self to admin',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_VIEWER_A,
      `with u as (update public.companies set owner_id='${VIEWER_A}' where id='${CA}' returning 1) select count(*)::int c from u`
    );
    check(
      'same-tenant viewer seizes company ownership',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('D. UNAUTHENTICATED (anon) ACCESS');
  for (const t of TENANT_TABLES) {
    const seen = await countAs('anon', null, t, 'true');
    check(`anon SELECT ${t}`, seen === 0, `saw ${seen}`);
  }
  for (const t of ['jobs', 'clients', 'documents', 'incidents', 'employees']) {
    const cols = {
      jobs: "(company_id,job_number,title) values (null,'X','x')",
      clients: "(company_id,name) values (null,'x')",
      documents: "(company_id,name) values (null,'x')",
      incidents: "(company_id,title) values (null,'x')",
      employees: "(company_id,name) values (null,'x')",
    }[t];
    const r = await tryAsRole(db, 'anon', null, `insert into public.${t} ${cols} returning id`);
    check(
      `anon INSERT into ${t} with NULL company_id`,
      !!r.error,
      r.error ? 'denied' : 'ROW CREATED'
    );
  }
  {
    const r = await tryAsRole(
      db,
      'anon',
      null,
      `select count(*)::int c from public.platform_api_keys`
    );
    check(
      'anon reads platform_api_keys (key hashes)',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  {
    const r = await tryAsRole(db, 'anon', null, `select count(*)::int c from public.user_roles`);
    check(
      'anon reads user_roles',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('E. NULL-TENANT ESCAPE HATCH (orphan-row exposure)');
  // Attempt to plant orphan rows with full superuser privilege. After
  // 20260817004000 the schema itself should refuse them.
  for (const [t, cols] of [
    ['jobs', `(company_id,job_number,title) values (null,'ORPHAN-1','orphan')`],
    ['documents', `(company_id,name) values (null,'orphan doc')`],
  ]) {
    let planted = false;
    try {
      await db.exec(`RESET ROLE; insert into public.${t} ${cols};`);
      planted = true;
    } catch {
      /* NOT NULL constraint — the intended outcome */
    }
    check(
      `${t}: a tenant-less row cannot be created even by a superuser`,
      !planted,
      planted ? 'ROW CREATED' : 'rejected by NOT NULL'
    );

    if (planted) {
      for (const [who, cl, role] of [
        ['anon', null, 'anon'],
        ['foreign-tenant viewer', claims(ATTACKER), 'authenticated'],
      ]) {
        const seen = await countAs(role, cl, t, 'company_id is null');
        check(`${who} reads ${t} rows with NULL company_id`, seen === 0, `saw ${seen}`);
      }
    }
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `with u as (update public.jobs set company_id=null where company_id='${CB}' returning 1) select count(*)::int c from u`
    );
    check(
      'member orphans own-tenant rows to make them globally visible',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} rows`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('F. STORAGE (documents bucket) TENANT ISOLATION');
  await db.exec(`RESET ROLE;
    insert into storage.objects(bucket_id,name,owner) values
      ('documents','${CA}/tenant-a-secret.pdf','${ADMIN_A}'),
      ('documents','${CB}/tenant-b-file.pdf','${ADMIN_B}');`);
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED,
      `select count(*)::int c from storage.objects where name like '${CA}/%'`
    );
    check(
      "Tenant B viewer lists Tenant A's stored documents",
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      FORGED,
      `with d as (delete from storage.objects where name like '${CA}/%' returning 1) select count(*)::int c from d`
    );
    check(
      "Tenant B viewer deletes Tenant A's stored documents",
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `${r.rows[0].c} objects`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `insert into storage.objects(bucket_id,name,owner) values ('documents','${CA}/planted.pdf','${ATTACKER}') returning id`
    );
    check(
      "Tenant B viewer writes an object into Tenant A's folder",
      !!r.error,
      r.error ? 'denied' : 'OBJECT CREATED'
    );
  }
  {
    const r = await tryAsRole(
      db,
      'anon',
      null,
      `select count(*)::int c from storage.objects where bucket_id='documents'`
    );
    check(
      'anon lists documents bucket',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select count(*)::int c from storage.objects where name like '${CA}/%'`
    );
    check(
      'REGRESSION: Tenant A admin still reads own documents',
      !r.error && r.rows[0].c === 1,
      r.error ?? `saw ${r.rows?.[0].c}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('G. PARTNER / PLATFORM-OPERATOR DATA');
  await db.exec('RESET ROLE');
  const partnerId = await seedRow(db, 'partners', {
    partner_name: 'Global Partner Co',
    partner_code: 'GP-001',
  });
  await seedRow(db, 'partner_revenue', {
    partner_id: partnerId,
    company_id: CB,
    period_start: '2026-01-01',
    period_end: '2026-01-31',
  });
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `select count(*)::int c from public.partners`
    );
    check(
      'ordinary tenant viewer reads the global partner register',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `insert into public.partners(partner_code,partner_name) values ('EVIL-1','Injected by tenant admin') returning id`
    );
    check(
      'a tenant admin writes the global partner register',
      !!r.error,
      r.error ? 'denied' : 'ROW CREATED'
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select count(*)::int c from public.partner_revenue`
    );
    check(
      "a tenant admin reads ANOTHER tenant's partner revenue",
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select count(*)::int c from public.coralamy_products`
    );
    check(
      'a tenant admin reads the Coralamy product catalogue',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ADMIN_B),
      `select count(*)::int c from public.partner_revenue`
    );
    check(
      'REGRESSION: a tenant admin reads OWN partner revenue',
      !r.error && r.rows[0].c === 1,
      r.error ?? `saw ${r.rows?.[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `insert into public.platform_operators(user_id) values ('${ADMIN_A}') returning user_id`
    );
    check(
      'a tenant admin self-designates as platform operator',
      !!r.error,
      r.error ? 'denied' : 'ROW CREATED'
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('H. PROVIDER-CREDENTIAL ENCRYPTION (F-04 / Vault precursor)');
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select public.encrypt_provider_config('{"a":1}'::jsonb) c`
    );
    check(
      'encryption succeeds when a real key is configured',
      !r.error && typeof r.rows?.[0].c === 'string',
      r.error ?? 'ok'
    );
  }
  {
    await db.exec(`RESET ROLE`);
    await db.query(
      `select set_config('app.settings.encryption_key','innovion-dev-key-change-in-production',false)`
    );
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select public.encrypt_provider_config('{"a":1}'::jsonb) c`
    );
    check(
      'the published development key is refused outright',
      !!r.error,
      r.error ? 'refused' : 'ACCEPTED'
    );
    await db.query(`select set_config('app.settings.encryption_key','',false)`);
    const r2 = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select public.encrypt_provider_config('{"a":1}'::jsonb) c`
    );
    check(
      'encryption fails closed when no key is configured',
      !!r2.error,
      r2.error ? 'refused' : 'SILENTLY ENCRYPTED'
    );
    await db.query(`select set_config('app.settings.encryption_key', $1, false)`, [
      TEST_ENCRYPTION_KEY,
    ]);
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select public.decrypt_provider_config('bm90LWNpcGhlcnRleHQ=') c`
    );
    check(
      'decryption of tampered ciphertext raises instead of returning {}',
      !!r.error,
      r.error ? 'raised' : `returned ${JSON.stringify(r.rows?.[0].c)}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `select count(*)::int c from public.integration_oauth_credentials`
    );
    check(
      'foreign tenant reads integration_oauth_credentials',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  // Credentials are written by server-side routes under the service role only.
  await db.exec(`RESET ROLE`);
  await seedRow(db, 'integration_oauth_credentials', {
    company_id: CA,
    provider_slug: 'xero',
    encrypted_access_token: 'TENANT-A-TOKEN-CIPHER',
  });
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `insert into public.integration_oauth_credentials(company_id,provider_slug,encrypted_access_token)
         values ('${CA}','myob','CIPHER')`
    );
    check(
      'even a tenant admin cannot write credentials directly',
      !!r.error,
      r.error ? 'denied' : 'ROW CREATED'
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select encrypted_access_token from public.integration_oauth_credentials limit 1`
    );
    check(
      'the token column is unreadable even by a tenant admin',
      !!r.error,
      r.error ? 'denied' : `LEAKED ${r.rows?.[0]?.encrypted_access_token}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_VIEWER_A,
      `select count(*)::int c from public.integration_oauth_credentials`
    );
    check(
      'a viewer cannot see credential rows at all',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select count(*)::int c from public.integration_oauth_credentials`
    );
    check(
      'REGRESSION: a tenant admin sees own credential status rows',
      !r.error && r.rows[0].c === 1,
      r.error ?? `saw ${r.rows?.[0].c}`
    );
  }

  group('H2. VIEWS MUST NOT BYPASS RLS');
  for (const v of [
    'integration_connection_status',
    'xero_connection_health',
    'workforce_roster',
    'sync_health',
  ]) {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `select count(*)::int c from public.${v} where company_id='${CA}'`
    );
    check(
      `Tenant B viewer reads Tenant A rows through ${v}`,
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select count(*)::int c from public.workforce_roster where company_id='${CA}'`
    );
    check(
      'REGRESSION: Tenant A admin still reads own workforce_roster',
      !r.error && r.rows[0].c >= 1,
      r.error ?? `saw ${r.rows?.[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'anon',
      null,
      `select count(*)::int c from public.workforce_roster`
    );
    check(
      'anon reads workforce_roster (staff PII)',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('I. ONBOARDING BOOTSTRAP (must work, must not be abusable)');
  {
    const c = await tryAsRole(
      db,
      'authenticated',
      claims(FRESH),
      `insert into public.companies(name,owner_id) values ('Fresh Co','${FRESH}') returning id`
    );
    check('a brand-new user can create their company', !c.error, c.error ?? 'ok');
    if (!c.error) {
      const newCo = c.rows[0].id;
      const r = await tryAsRole(
        db,
        'authenticated',
        claims(FRESH),
        `insert into public.user_roles(user_id,company_id,role) values ('${FRESH}','${newCo}','admin') returning id`
      );
      check('...and claim their own authoritative admin role', !r.error, r.error ?? 'ok');

      const again = await tryAsRole(
        db,
        'authenticated',
        claims(FRESH),
        `insert into public.user_roles(user_id,company_id,role) values ('${FRESH}','${newCo}','admin') returning id`
      );
      check(
        '...but the bootstrap path is single-use',
        !!again.error ||
          (await countAs('authenticated', claims(FRESH), 'user_roles', `user_id='${FRESH}'`)) === 1,
        again.error ? 'denied' : 'duplicated'
      );

      const r2 = await tryAsRole(
        db,
        'authenticated',
        claims(FRESH),
        `select count(*)::int c from public.user_roles where company_id='${CA}'`
      );
      check(
        '...and grants no visibility of other tenants',
        !r2.error && r2.rows[0].c === 0,
        r2.error ?? `saw ${r2.rows?.[0].c}`
      );
    }
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `insert into public.companies(name,owner_id) values ('Impersonated','${ADMIN_A}') returning id`
    );
    check(
      'a user cannot create a company owned by someone else',
      !!r.error,
      r.error ? 'denied' : 'ROW CREATED'
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('J. LEGITIMATE ACCESS (regression — remediation must not break the product)');
  {
    const seen = await countAs('authenticated', HONEST_ADMIN_A, 'provider_integrations');
    check('Tenant A admin reads own provider_integrations', seen === 1, `saw ${seen}`);
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `with u as (update public.provider_integrations set last_error='ok' where company_id='${CA}' returning 1) select count(*)::int c from u`
    );
    check(
      'Tenant A admin writes own provider_integrations',
      !r.error && r.rows[0].c === 1,
      r.error ?? `${r.rows?.[0].c} rows`
    );
  }
  for (const t of ['jobs', 'clients', 'employees', 'documents', 'sites']) {
    const seen = await countAs('authenticated', HONEST_ADMIN_A, t);
    check(`Tenant A admin reads own ${t}`, seen >= 1, `saw ${seen}`);
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select count(*)::int c from public.user_roles`
    );
    check(
      'user_roles SELECT does not recurse infinitely',
      !r.error,
      r.error ?? `${r.rows?.[0].c} rows`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `insert into public.jobs(company_id,job_number,title) values ('${CA}','JOB-A-2','legit') returning id`
    );
    check('Tenant A admin creates a job in own tenant', !r.error, r.error ?? 'ok');
  }
  {
    const seen = await countAs('authenticated', HONEST_VIEWER_A, 'jobs');
    check('Tenant A viewer reads own tenant jobs', seen >= 1, `saw ${seen}`);
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      HONEST_ADMIN_A,
      `select count(*)::int c from public.platform_api_keys`
    );
    check(
      'Tenant A admin reads own platform API keys',
      !r.error && r.rows[0].c === 1,
      r.error ?? `saw ${r.rows?.[0].c}`
    );
  }
  {
    const r = await tryAsRole(
      db,
      'authenticated',
      claims(ATTACKER),
      `select count(*)::int c from public.platform_api_keys`
    );
    check(
      'Tenant B viewer reads Tenant A platform API keys',
      r.error ? true : r.rows[0].c === 0,
      r.error ? 'denied' : `saw ${r.rows[0].c}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('K. STRUCTURAL INVARIANTS');
  await db.exec('RESET ROLE');
  const q = async (sql) => (await db.query(sql)).rows;
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
      await q(`select tablename||'.'||policyname p from pg_policies where schemaname='public'
                          and (coalesce(qual,'')||coalesce(with_check,'')) ~ '(user_metadata|raw_user_meta_data)'`);
    check(
      'no policy derives authority from client-writable metadata',
      rows.length === 0,
      rows.map((r) => r.p).join(', ')
    );
  }
  {
    const rows =
      await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.prokind='f'
                            and pg_get_functiondef(p.oid) ~ '(user_metadata|raw_user_meta_data)'
                            and pg_get_functiondef(p.oid) not like '%user_roles%'`);
    check(
      'no function derives tenant identity from metadata unvalidated',
      rows.length === 0,
      rows.map((r) => r.proname).join(', ')
    );
  }
  {
    const rows =
      await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.prosecdef
                            and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) cfg where cfg like 'search_path=%')`);
    check(
      'every SECURITY DEFINER function pins search_path',
      rows.length === 0,
      `${rows.length} unpinned: ${rows.map((r) => r.proname).join(', ')}`
    );
  }
  {
    const rows =
      await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.prokind='f'
                            and pg_get_functiondef(p.oid) like '%innovion-dev-key-change-in-production%'
                            and p.proname <> 'innovion_encryption_key'`);
    check(
      'the published development encryption key appears in no function',
      rows.length === 0,
      rows.map((r) => r.proname).join(', ')
    );
  }
  {
    const rows =
      await q(`select tablename||'.'||policyname p from pg_policies where schemaname='public'
                          and ('anon'=any(roles) or 'public'=any(roles))
                          and coalesce(qual,with_check,'') ~ 'company_id'`);
    check(
      'no tenant-scoped policy is granted to anon/public',
      rows.length === 0,
      `${rows.length}: ${rows.map((r) => r.p).join(', ')}`
    );
  }
  {
    // checklist_templates_select is a reviewed exception: company_id IS NULL
    // there denotes a system-provided global template, readable but never
    // writable by a tenant, and never offered to anon. See migration
    // 20260817004000 for the full justification.
    const rows =
      await q(`select tablename||'.'||policyname p from pg_policies where schemaname='public'
                          and (coalesce(qual,'')||coalesce(with_check,'')) like '%company_id IS NULL%'
                          and not (tablename='checklist_templates' and cmd='SELECT')`);
    check(
      'no policy grants access via a NULL company_id',
      rows.length === 0,
      `${rows.length}: ${rows.map((r) => r.p).join(', ')}`
    );
  }
  {
    const rows =
      await q(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
                          where n.nspname='public' and c.relkind='v'
                            and not coalesce((select true from unnest(coalesce(c.reloptions,'{}')) o
                                              where o in ('security_invoker=true','security_invoker=on')), false)`);
    check(
      'every view enforces base-table RLS (security_invoker)',
      rows.length === 0,
      rows.map((r) => r.relname).join(', ')
    );
  }
  {
    const rows = await q(`select column_name from information_schema.column_privileges
                          where table_schema='public' and table_name='integration_oauth_credentials'
                            and column_name in ('encrypted_access_token','encrypted_refresh_token')
                            and grantee in ('anon','authenticated','PUBLIC')`);
    check(
      'encrypted token columns are not grantable to end-user roles',
      rows.length === 0,
      rows.map((r) => r.column_name).join(', ')
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
