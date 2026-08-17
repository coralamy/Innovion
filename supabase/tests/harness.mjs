/**
 * Innovion Team A — Local database security harness (bootstrap)
 * ---------------------------------------------------------------------------
 * Boots an in-process PostgreSQL (PGlite/WASM), applies the Supabase
 * compatibility shim and then every migration in `supabase/migrations` in
 * filename order, exactly as Supabase would.
 *
 * Runs anywhere Node runs — no Docker, no WSL, no PostgreSQL install, no
 * network access, and it never touches a hosted Supabase project.
 *
 * A JWT is simulated by setting `request.jwt.claims`, which is precisely how
 * Supabase's PostgREST presents claims to Postgres, combined with `SET ROLE`
 * to `anon` / `authenticated` so RLS is evaluated the same way.
 */

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(HERE, '..', 'migrations');
const SHIM = join(HERE, '00_supabase_shim.sql');

/** Encryption key used for the local harness only. Never a production value. */
export const TEST_ENCRYPTION_KEY = 'harness-only-key-0123456789abcdef-not-a-secret';

export async function boot({ quiet = false, applyEncryptionKey = true } = {}) {
  const db = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } });

  await db.exec(await readFile(SHIM, 'utf8'));

  // The encryption-key GUC is a database-level setting in production
  // (ALTER DATABASE ... SET app.settings.encryption_key = ...). PGlite has a
  // single session, so a session-level SET is the faithful local equivalent.
  if (applyEncryptionKey) {
    await db.query(`select set_config('app.settings.encryption_key', $1, false)`, [
      TEST_ENCRYPTION_KEY,
    ]);
  }

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  const applied = [];
  for (const f of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, f), 'utf8');
    try {
      await db.exec(sql);
      applied.push({ file: f, ok: true });
      if (!quiet) console.log(`  ok    ${f}`);
    } catch (err) {
      applied.push({ file: f, ok: false, error: err.message });
      if (!quiet) console.log(`  FAIL  ${f}\n        ${err.message}`);
    }
  }

  return { db, applied };
}

/**
 * Insert one row into `table`, supplying a type-appropriate placeholder for
 * every NOT NULL column that has no default and is not overridden.
 *
 * Introspection rather than hard-coded column lists: the fixture keeps working
 * when a migration adds a required column, instead of failing the whole suite
 * for a reason unrelated to security.
 */
let seedCounter = 0;

export async function seedRow(db, table, overrides = {}) {
  const n = ++seedCounter;
  const { rows: cols } = await db.query(
    `select column_name, data_type, is_nullable, column_default
       from information_schema.columns
      where table_schema='public' and table_name=$1
      order by ordinal_position`,
    [table]
  );

  const placeholder = (type) => {
    if (/int|numeric|decimal|real|double/.test(type)) return 0;
    if (type === 'boolean') return false;
    if (/timestamp|date/.test(type)) return '2026-01-01T00:00:00Z';
    if (type === 'uuid') return '00000000-0000-0000-0000-000000000000';
    if (type === 'jsonb' || type === 'json') return '{}';
    if (type === 'ARRAY') return '{}';
    // Text placeholders must be unique: several fixture tables carry UNIQUE
    // constraints (jobs.job_number, provider slugs, key hashes, …).
    return `fixture-${n}`;
  };

  const values = { ...overrides };
  for (const c of cols) {
    if (c.column_name in values) continue;
    if (c.is_nullable === 'NO' && !c.column_default) {
      values[c.column_name] = placeholder(c.data_type);
    }
  }

  const names = Object.keys(values);
  const params = names.map((_, i) => `$${i + 1}`);
  const { rows } = await db.query(
    `insert into public.${table} (${names.map((n) => `"${n}"`).join(',')})
     values (${params.join(',')}) returning id`,
    names.map((n) => values[n])
  );
  return rows[0]?.id;
}

/** Run a statement as `anon`/`authenticated` with a simulated JWT. */
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

/** As above but returns `{ rows }` on success or `{ error }` on failure. */
export async function tryAsRole(db, role, claims, sql, params = []) {
  try {
    const r = await asRole(db, role, claims, sql, params);
    return { rows: r.rows };
  } catch (err) {
    return { error: err.message };
  }
}
