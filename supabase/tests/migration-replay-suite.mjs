/**
 * Innovion A/B/D — migration replay, re-stamp safety & negative controls
 * ===========================================================================
 * Answers, by execution rather than argument, the questions a restored-copy
 * rehearsal actually turns on.
 *
 * ── A note on what this suite does NOT assert ───────────────────────────────
 * It does not require every historical migration to be idempotent. That would
 * be a fabricated requirement: Supabase never re-applies a migration it has
 * recorded, and an early migration re-run against a much later schema will
 * legitimately fail on columns that later migrations renamed. An earlier draft
 * of this suite did assert it, and produced sixteen failures that meant nothing.
 *
 * Idempotency is asserted only where something actually depends on it:
 *
 *   RE-STAMPED FILES — a re-stamp gives a file a version the live ledger has
 *     never seen, so the CLI WILL run it again against a database that already
 *     holds its objects. Whether that is safe is a question with a real answer.
 *
 *   TEAM A'S GUARD MIGRATIONS — these are assertions about the final security
 *     state, not one-shot DDL. A restored-copy rehearsal replays them against
 *     the fully integrated schema. If a guard only passes at its own point in
 *     the chain, it is not guarding the thing it claims to guard.
 *
 * EVERY PHASE GETS ITS OWN DATABASE. Phases that re-apply migrations mutate the
 * schema, and a later phase reading that mutated schema would report failures
 * that belong to the test, not the code. An earlier draft did exactly that.
 *
 * Run: npm run test:replay
 */

import {
  bootIntegrated,
  collectMigrations,
  verifySnapshot,
  TREES,
  TEST_ENCRYPTION_KEY,
} from './integration-harness.mjs';
import { COMPLETED_REBASES, VERIFIED_AGAINST } from './integration-manifest.mjs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

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
const clip = (s, n = 170) => (s ?? '').replace(/\s+/g, ' ').slice(0, n);

/** Boot a database with an arbitrary, explicitly-ordered migration list. */
async function bootWith(list) {
  const db = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } });
  await db.exec(await readFile(join(HERE, '00_supabase_shim.sql'), 'utf8'));
  await db.query(`select set_config('app.settings.encryption_key', $1, false)`, [
    TEST_ENCRYPTION_KEY,
  ]);
  const applied = [];
  for (const m of list) {
    try {
      await db.exec(await readFile(m.path, 'utf8'));
      applied.push({ ...m, ok: true });
    } catch (err) {
      applied.push({ ...m, ok: false, error: err.message });
    }
  }
  return { db, applied };
}

/** Apply `file` to a FRESH final integrated schema. Returns the error, or null. */
async function reapplyOnFreshFinalSchema(path) {
  const { db } = await bootIntegrated({ quiet: true });
  let err = null;
  try {
    await db.exec(await readFile(path, 'utf8'));
  } catch (e) {
    err = e.message;
  }
  await db.close();
  return err;
}

async function main() {
  // ═══════════════════════════════════════════════════════════════════════════
  group('0. REVISION PINNING — is this still the revision that was verified?');
  // Runs first and reports loudly, because everything below is meaningless if
  // another team's tree moved underneath it. Two earlier runs of this suite
  // straddled a rename of Team D's foundation migration and produced failures —
  // and one spurious pass — that belonged entirely to the rename.
  {
    const drift = await verifySnapshot();
    check(
      `Team B and Team D trees match the verified revision (${VERIFIED_AGAINST.capturedAt})`,
      drift.length === 0,
      drift.map((d) => `[${d.team}] ${d.file}: ${d.kind} — ${d.detail}`).join(' | ')
    );
    if (drift.length) {
      console.log(
        '\n   NOTE: drift does not mean anything is broken. It means the other team has\n' +
          '   moved and the integration verdict must be re-established, not carried forward.'
      );
    }
  }

  const { all, collisions } = await collectMigrations();

  // ═══════════════════════════════════════════════════════════════════════════
  group('1. FULL CHAIN FROM EMPTY');
  {
    const { db, applied } = await bootIntegrated({ quiet: true });
    const failed = applied.filter((a) => !a.ok);
    check(
      `all ${applied.length} migrations across A+B+D apply from an empty database`,
      failed.length === 0,
      failed.map((f) => `[${f.team}] ${f.file}: ${f.error}`).join(' | ')
    );
    await db.close();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('2. VERSION UNIQUENESS — detected from the trees, not declared');
  // The previous approach declared required renames in a manifest. A declared
  // list goes stale: Team D re-stamped their foundation schema to 20260807045000
  // and Team A's manifest still demanded a rename of a file that no longer
  // existed. This check reads the trees, so it cannot drift.
  check(
    'no two migrations across A+B+D share a 14-digit version',
    collisions.length === 0,
    collisions
      .map((c) => `${c.version}: ${c.files.map((f) => `[${f.team}] ${f.file}`).join(' vs ')}`)
      .join(' | ')
  );
  {
    const d = all.find((m) => m.team === 'D' && m.file.includes('platform_foundation_schema'));
    check(
      "Team D's foundation schema is re-stamped FORWARD, clear of Team A 20260807050000",
      d?.rawVersion === '20260807050002',
      d ? d.file : 'not found'
    );
    check(
      '...and still sorts before Team D\'s own event bus and hardening, which depend on it',
      Boolean(
        d &&
          all
            .filter((m) => m.team === 'D' && m !== d)
            .every((m) => m.version > d.version)
      ),
      d ? `foundation at ${d.version}` : 'n/a'
    );
    const a = all.find((m) => m.rawVersion === '20260807050000');
    check(
      'Team A retains 20260807050000 and is not the file that moved',
      a?.team === 'A' && a.file === '20260807050000_workforce_roster_notifications.sql',
      a ? `[${a.team}] ${a.file}` : 'not found'
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('3. RE-STAMP SAFETY — will a re-stamped file survive being re-run?');
  // A re-stamp makes the CLI apply the file again on any project where the OLD
  // version is recorded. Each candidate is tested on its own fresh copy of the
  // final schema.
  for (const r of COMPLETED_REBASES) {
    const m = all.find((x) => x.team === r.team && x.file === r.to);
    if (!m) {
      check(`re-stamped file present: [${r.team}] ${r.to}`, false, 'file not found in tree');
      continue;
    }
    const err = await reapplyOnFreshFinalSchema(m.path);
    const expectedSafe = !/MATERIAL/.test(r.ledgerImpact ?? '');
    if (expectedSafe) {
      check(`[${r.team}] ${r.to} re-applies cleanly onto the final schema`, err === null, clip(err));
    } else {
      // The manifest already states this one is NOT safe to re-run and requires
      // a `migration repair` instead. Assert that, so the manifest cannot
      // quietly become wrong in either direction.
      check(
        `[${r.team}] ${r.to} is confirmed NOT re-runnable — repair is required, as the manifest states`,
        err !== null,
        err ? clip(err) : 'it re-applied cleanly; the manifest overstates the risk and should be corrected'
      );
    }
  }
  // The other branch of the 20260807050000 ruling. Team A cannot read the live
  // ledger, so the ruling is built to work whichever file turns out to be the
  // recorded one. That is only true if Team A's file survives being re-run.
  {
    const a = all.find((m) => m.file === '20260807050000_workforce_roster_notifications.sql');
    const err = await reapplyOnFreshFinalSchema(a.path);
    check(
      '[A] 20260807050000_workforce_roster_notifications.sql re-applies cleanly — so the ruling holds even if Team A\'s file is the unrecorded one',
      err === null,
      clip(err)
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('4. TEAM A GUARDS RE-RUN AGAINST A FRESH FINAL INTEGRATED SCHEMA');
  // Each on its own database, so one guard's failure cannot cause the next.
  const GUARD_MIGRATIONS = [
    '20260817000000_tenant_authority_remediation.sql',
    '20260817002000_tenant_authority_close_metadata_vectors.sql',
    '20260817004000_close_null_tenant_escape.sql',
    '20260817005000_storage_tenant_isolation.sql',
    '20260817006000_integration_credential_authority.sql',
    '20260817006500_view_security_invoker.sql',
    '20260817007000_platform_operator_scoping.sql',
    '20260817008000_secdef_search_path_hardening.sql',
    '20260818000100_abd_authority_reconciliation.sql',
    '20260818000300_workforce_carveout_assertions.sql',
    '20260818000500_tenant_directory_scope.sql',
    '20260818000600_tenancy_projection_refresh.sql',
    '20260818000700_user_roles_company_fk.sql',
  ];
  for (const file of GUARD_MIGRATIONS) {
    const err = await reapplyOnFreshFinalSchema(join(TREES.A, file));
    check(`${file} still passes on the final schema`, err === null, clip(err, 200));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  group('5. NEGATIVE CONTROLS — the chain must FAIL where it is unsafe');

  // 5a. Team A's reconciliation deployed while Team D is present but NOT
  //     hardened: the P0 deployment window Team D proved. The behavioural guard
  //     must refuse, so the escalation can never be created.
  {
    const withoutHardening = all.filter(
      (m) => !(m.team === 'D' && m.file.includes('platform_authority_hardening'))
    );
    const { db: d2, applied: a2 } = await bootWith(withoutHardening);

    const recon = a2.find((m) => m.file === '20260818000100_abd_authority_reconciliation.sql');
    check(
      'A+B+D-base (no Team D hardening): reconciliation REFUSES to apply',
      Boolean(recon && !recon.ok),
      recon?.ok ? 'IT APPLIED — the escalation window is open' : clip(recon?.error)
    );
    check(
      '...and refuses for the right reason (platform-authority bridge)',
      Boolean(recon && !recon.ok && /bridge platform authority/i.test(recon.error)),
      clip(recon?.error)
    );

    // A SECOND, INDEPENDENT fail-closed defence, found while building this
    // suite rather than designed in: Team A's metadata-vector guard runs at
    // 20260817002000 — BEFORE the reconciliation — and its function scan catches
    // Team D's unhardened is_platform_admin()/is_platform_founder() on its own
    // merits, because they genuinely do resolve authority from client-writable
    // metadata. The dangerous window is therefore refused twice, at two
    // different points in the chain, by two unrelated mechanisms.
    const vectors = a2.find(
      (m) => m.file === '20260817002000_tenant_authority_close_metadata_vectors.sql'
    );
    check(
      '...and 20260817002000 independently refuses it EARLIER in the chain',
      Boolean(vectors && !vectors.ok && /is_platform_admin/.test(vectors.error)),
      clip(vectors?.error)
    );

    // Prove the window is genuinely dangerous, so the guard is not theatre.
    await d2.exec(`
      INSERT INTO auth.users(id,email,raw_user_meta_data)
      VALUES ('0000000a-0000-0000-0000-00000000000a','attacker@x.test',
              jsonb_build_object('platform_role','founder'))
      ON CONFLICT (id) DO NOTHING;`);
    await d2.exec(`RESET ROLE; SET ROLE authenticated;`);
    await d2.query(`select set_config('request.jwt.claims', $1, false)`, [
      JSON.stringify({ sub: '0000000a-0000-0000-0000-00000000000a', role: 'authenticated' }),
    ]);
    const esc = await d2.query(`select public.is_platform_admin() v`);
    await d2.exec('RESET ROLE');
    check(
      'NEGATIVE CONTROL: the unhardened function really is escalatable',
      esc.rows[0].v === true,
      `is_platform_admin()=${esc.rows[0].v} — if false, the guard above proves nothing`
    );

    const bridged = await d2.query(`
      select coalesce(pg_get_functiondef(to_regprocedure('public.innovion_is_platform_operator()')), '') d`);
    check(
      '...so innovion_is_platform_operator() never bound to it',
      !/is_platform_admin/.test(bridged.rows[0].d),
      bridged.rows[0].d ? 'function present, unbridged' : 'function absent'
    );
    await d2.close();
  }

  // 5b. Team A alone, and Team A + Team B, must still apply — the reconciliation
  //     must not have become dependent on Team D being present.
  for (const teams of [['A'], ['A', 'B']]) {
    const { all: subset } = await collectMigrations(teams);
    const { db: d3, applied: a3 } = await bootWith(subset);
    const bad = a3.filter((m) => !m.ok);
    check(
      `${teams.join('+')} alone applies cleanly`,
      bad.length === 0,
      bad.map((m) => `${m.file}: ${m.error}`).join(' | ')
    );
    await d3.close();
  }

  // 5b-bis. CARVE-OUT INTEGRITY (guard 6e).
  //     Team B reported that nothing asserted the public.settings restrictions
  //     once policy ownership moved to Team A. Confirmed, and wider than
  //     reported: the compliance_items write denials were unguarded too, because
  //     Team B's guard 3b is satisfied by the own-only SELECT policy alone.
  //     Each removal below must now abort Team A's migration by name.
  {
    const assertions = join(TREES.A, '20260818000300_workforce_carveout_assertions.sql');
    const assertSql = await readFile(assertions, 'utf8');
    // Deliberately NOT 20260818000100: re-running that file recreates the
    // policies in sections 4a/4b before its own §6e check runs, so it heals the
    // removal and reports nothing. Measured, not assumed — this is why
    // 20260818000300 exists as a separate assertion-only migration.
    const REMOVALS = [
      { label: 'settings UPDATE denial alone', expect: 'settings.UPDATE',
        sql: `DROP POLICY "settings_workforce_no_update" ON public.settings;` },
      { label: 'settings all three write denials', expect: 'settings.INSERT',
        sql: `DROP POLICY "settings_workforce_readonly"  ON public.settings;
              DROP POLICY "settings_workforce_no_update" ON public.settings;
              DROP POLICY "settings_workforce_no_delete" ON public.settings;` },
      { label: 'compliance_items write denials, own-only SELECT retained',
        expect: 'compliance_items.UPDATE',
        sql: `DROP POLICY "compliance_items_workforce_readonly"  ON public.compliance_items;
              DROP POLICY "compliance_items_workforce_no_update" ON public.compliance_items;
              DROP POLICY "compliance_items_workforce_no_delete" ON public.compliance_items;` },
      { label: 'compliance_items own-only SELECT', expect: 'compliance_items.SELECT',
        sql: `DROP POLICY "compliance_items_workforce_own_only" ON public.compliance_items;` },
      // Widening rather than removal: keep a restrictive SELECT policy, but stop
      // scoping it to the caller's own record. Passes a per-command check;
      // every worker would read every colleague's compliance history.
      { label: 'compliance_items SELECT widened off get_my_contractor_id()',
        expect: 'own record',
        sql: `DROP POLICY "compliance_items_workforce_own_only" ON public.compliance_items;
              CREATE POLICY "compliance_items_workforce_own_only" ON public.compliance_items
                AS RESTRICTIVE FOR SELECT TO authenticated
                USING (true OR NOT public.is_workforce_only_user());` },
    ];
    for (const r of REMOVALS) {
      const { db: d5 } = await bootIntegrated({ quiet: true });
      await d5.exec(r.sql);
      let err = null;
      try {
        await d5.exec(assertSql);
      } catch (e) {
        err = e.message;
      }
      check(
        `20260818000300 aborts on: ${r.label}`,
        Boolean(err && err.includes(r.expect)),
        err ? clip(err) : 'IT PASSED — the removal went unnoticed'
      );
      await d5.close();
    }
    // Control: with nothing removed, the same re-run must pass — so the aborts
    // above are caused by the removal and not by re-running the file.
    const clean = await reapplyOnFreshFinalSchema(assertions);
    check(
      'CONTROL: with nothing removed, 20260818000300 passes',
      clean === null,
      clip(clean)
    );
    // Control: 20260818000100 must NOT be relied on for this — it heals the
    // removal by recreating the policy. Asserting the limitation keeps the
    // ownership split honest if someone later moves the check back.
    const { db: d6 } = await bootIntegrated({ quiet: true });
    await d6.exec(`DROP POLICY "settings_workforce_no_update" ON public.settings;`);
    let healed = null;
    try {
      await d6.exec(await readFile(join(TREES.A, '20260818000100_abd_authority_reconciliation.sql'), 'utf8'));
    } catch (e) {
      healed = e.message;
    }
    check(
      'CONTROL: 20260818000100 §6e cannot detect a later removal (it recreates it) — which is why 300 exists',
      healed === null,
      healed ? `it aborted: ${clip(healed)}` : 'recreated and passed, as documented'
    );
    await d6.close();
  }

  // 5b-quater. DISARM ON REGRESSION.
  //     Team D's membership carve-out ships as a CREATE OR REPLACE in their
  //     20260818000400, overriding the stricter definition in their
  //     20260817000500. Re-running 20260817000500 alone therefore reverts it.
  //     If Team A's refresh triggers stayed armed against a reverted guard,
  //     every companies and user_roles write would fail. The migration must take
  //     back what it armed, not merely decline to arm again.
  {
    const { db: d9 } = await bootIntegrated({ quiet: true });
    const armed = async () =>
      (await d9.query(`select count(*)::int c from pg_trigger
                        where tgname like 'innovion_tenancy_projection%'`)).rows[0].c;
    const carved = async () =>
      /tenant_company IS NULL AND NOT public.is_platform_admin()/.test(
        (await d9.query(
          `select pg_get_functiondef(to_regprocedure('public.identity_membership_guard()')) d`
        )).rows[0].d);

    check('CONTROL: the full chain arms the refresh triggers', (await armed()) === 2, `${await armed()}`);
    check('CONTROL: and the Team D carve-out is in place', await carved());

    await d9.exec(await readFile(join(TREES.D, '20260817000500_platform_authority_hardening.sql'), 'utf8'));
    check('re-running Team D 20260817000500 alone reverts the carve-out', !(await carved()),
      'this is the regression the disarm exists for');

    let err = null;
    try {
      await d9.exec(await readFile(join(TREES.A, '20260818000600_tenancy_projection_refresh.sql'), 'utf8'));
    } catch (e) { err = e.message; }
    check('Team A 20260818000600 re-runs without aborting the deployment', err === null, clip(err));
    check('...and DISARMS the triggers rather than leaving them against a refusing guard',
      (await armed()) === 0,
      `${await armed()} trigger(s) still armed — companies and user_roles writes would fail`);

    // And the system must still work: writes succeed, just unprojected.
    let writeErr = null;
    try {
      await d9.exec(`INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-00000000ab01','disarm@x.test');
                     INSERT INTO public.companies(id,name,owner_id)
                       VALUES ('00000000-0000-0000-0000-00000000ab02','Post-disarm tenant','00000000-0000-0000-0000-00000000ab01');`);
    } catch (e) { writeErr = e.message; }
    check('...so tenant creation still succeeds after the regression', writeErr === null, clip(writeErr));
    await d9.close();
  }

  // 5b-ter. REFERENTIAL INTEGRITY (Team D P2).
  //     user_roles is the authority table. Before 20260818000700 a role grant
  //     could name a company that does not exist AND be published through the
  //     A-to-D membership directory as a tenant administrator of it.
  {
    const fk = join(TREES.A, '20260818000700_user_roles_company_fk.sql');
    const fkSql = await readFile(fk, 'utf8');

    // The constraint must actually reject the row it was added to reject.
    const { db: d7 } = await bootIntegrated({ quiet: true });
    await d7.exec(`INSERT INTO auth.users(id,email) VALUES
      ('99999999-0000-0000-0000-00000000000f','orphan@x.test');`);
    let orphanErr = null;
    try {
      await d7.exec(`INSERT INTO public.user_roles(user_id,company_id,role) VALUES
        ('99999999-0000-0000-0000-00000000000f','deadbeef-0000-0000-0000-00000000dead','admin');`);
    } catch (e) { orphanErr = e.message; }
    check(
      'a role grant naming a non-existent company is now REJECTED',
      Boolean(orphanErr && /foreign key/i.test(orphanErr)),
      orphanErr ? clip(orphanErr, 90) : 'IT WAS ACCEPTED — the FK is not enforcing'
    );

    // Deleting a company must take its grants with it, not strand them.
    await d7.exec(`
      INSERT INTO auth.users(id,email) VALUES ('99999999-0000-0000-0000-00000000000e','u@x.test');
      INSERT INTO public.companies(id,name) VALUES ('eeeeeeee-0000-0000-0000-00000000000e','Doomed');
      INSERT INTO public.user_roles(user_id,company_id,role) VALUES
        ('99999999-0000-0000-0000-00000000000e','eeeeeeee-0000-0000-0000-00000000000e','admin');
      DELETE FROM public.companies WHERE id='eeeeeeee-0000-0000-0000-00000000000e';`);
    check(
      'deleting a company cascades away its role grants',
      (await d7.query(`select count(*)::int c from public.user_roles
        where company_id='eeeeeeee-0000-0000-0000-00000000000e'`)).rows[0].c === 0
    );
    await d7.close();

    // And the guard must fire if the constraint is ever dropped.
    const { db: d8 } = await bootIntegrated({ quiet: true });
    await d8.exec(`ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_company_id_fkey;`);
    let guardErr = null;
    try { await d8.exec(fkSql); } catch (e) { guardErr = e.message; }
    check(
      '20260818000700 re-adds the constraint if it has been dropped',
      guardErr === null,
      guardErr ? clip(guardErr) : 're-added'
    );
    await d8.close();
  }

  // 5c. PIECEMEAL APPLICATION MUST FAIL.
  //     Team B's carve-out migration amends denials that Team A's reconciliation
  //     creates. Shipping B's without A's does not merely fail to help — it
  //     removes Workforce denials from Platform tables with nothing in their
  //     place. The chain has to refuse that, rather than produce a widened
  //     schema that still looks green.
  {
    const noRecon = all.filter(
      (m) => m.file !== '20260818000100_abd_authority_reconciliation.sql'
    );
    const { db: d4, applied: a4 } = await bootWith(noRecon);
    const carve = a4.find((m) => m.file === '20260818000200_workforce_data_access_carveouts.sql');
    check(
      "Team B's carve-outs REFUSE to apply without Team A's reconciliation",
      Boolean(carve && !carve.ok),
      carve?.ok
        ? 'THEY APPLIED — Workforce denials would be removed from Platform tables with no replacement'
        : clip(carve?.error)
    );
    check(
      '...naming the Platform tables that would have been left undefended',
      Boolean(carve && !carve.ok && /without a replacement/i.test(carve.error)),
      clip(carve?.error)
    );
    await d4.close();
  }

  // ═══════════════════════════════════════════════════════════════════════════
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
