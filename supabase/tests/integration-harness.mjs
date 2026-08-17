/**
 * Innovion A/B/D — integrated migration harness
 * ===========================================================================
 * Boots an in-process PostgreSQL and applies the migrations of ALL THREE teams
 * in the order Supabase would apply them (ascending `version`, which is the
 * 14-digit timestamp prefix), so that integration conflicts surface here rather
 * than in a hosted project.
 *
 * The Team B and Team D trees are read-only inputs. Nothing is written to them.
 *
 * Env overrides (used by the reconciliation work):
 *   INNOVION_TEAM_B_MIGRATIONS
 *   INNOVION_TEAM_D_MIGRATIONS
 */

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { effectiveVersion, outstandingRebases } from './integration-manifest.mjs';

export { outstandingRebases };

const HERE = dirname(fileURLToPath(import.meta.url));
const SHIM = join(HERE, '00_supabase_shim.sql');

export const TREES = {
  A: join(HERE, '..', 'migrations'),
  B:
    process.env.INNOVION_TEAM_B_MIGRATIONS ??
    'C:/Users/gamya/Desktop/team_b___innovion_workforce/innovionworkforce/supabase/migrations',
  D:
    process.env.INNOVION_TEAM_D_MIGRATIONS ??
    'C:/Users/gamya/Desktop/team_d___platform_foundation/team_d___platform_foundation/supabase/migrations',
};

export const TEST_ENCRYPTION_KEY = 'harness-only-key-0123456789abcdef-not-a-secret';

/**
 * Collect every migration across the selected trees and order them exactly as
 * Supabase would: ascending version. Where two teams share a version — which is
 * itself a defect, since `version` is the primary key of
 * `supabase_migrations.schema_migrations` — the tie is broken deterministically
 * by team letter so the run is at least reproducible, and the collision is
 * reported.
 */
export async function collectMigrations(teams = ['A', 'B', 'D']) {
  const all = [];
  for (const team of teams) {
    const dir = TREES[team];
    for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql'))) {
      const rawVersion = file.slice(0, 14);
      all.push({
        team,
        file,
        rawVersion,
        // Ordered by the CANONICAL version from the integration manifest, so
        // the chain verified here is the chain that would be deployed once the
        // declared rebases are in place.
        version: effectiveVersion(team, file, rawVersion),
        path: join(dir, file),
      });
    }
  }
  all.sort((a, b) =>
    a.version === b.version ? a.team.localeCompare(b.team) : a.version.localeCompare(b.version)
  );

  const seen = new Map();
  const collisions = [];
  for (const m of all) {
    if (seen.has(m.version)) {
      collisions.push({ version: m.version, files: [seen.get(m.version), m] });
    } else {
      seen.set(m.version, m);
    }
  }
  return { all, collisions };
}

export async function bootIntegrated({ quiet = false, teams = ['A', 'B', 'D'] } = {}) {
  const db = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } });

  await db.exec(await readFile(SHIM, 'utf8'));
  await db.query(`select set_config('app.settings.encryption_key', $1, false)`, [
    TEST_ENCRYPTION_KEY,
  ]);

  const { all, collisions } = await collectMigrations(teams);

  const applied = [];
  for (const m of all) {
    const sql = await readFile(m.path, 'utf8');
    try {
      await db.exec(sql);
      applied.push({ ...m, ok: true });
      if (!quiet) console.log(`  ok    [${m.team}] ${m.file}`);
    } catch (err) {
      applied.push({ ...m, ok: false, error: err.message });
      if (!quiet) console.log(`  FAIL  [${m.team}] ${m.file}\n          ${err.message}`);
    }
  }

  return { db, applied, collisions };
}

export async function asRole(db, role, claims, sql, params = []) {
  await db.exec(`RESET ROLE; SET ROLE ${role};`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    claims ? JSON.stringify(claims) : '',
  ]);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('RESET ROLE');
  }
}

export async function tryAsRole(db, role, claims, sql, params = []) {
  try {
    const r = await asRole(db, role, claims, sql, params);
    return { rows: r.rows };
  } catch (err) {
    return { error: err.message };
  }
}
