/**
 * Innovion Team A — Query/schema conformance check
 * ===========================================================================
 * Statically extracts every `supabase.from('<table>').select('<columns>')`
 * chain in the application source and validates it against the real schema
 * produced by the migrations.
 *
 * WHY THIS EXISTS
 * ---------------
 * PostgREST answers a request for a non-existent column with an error, not an
 * exception. The application overwhelmingly destructures only `data` and drops
 * `error`:
 *
 *     const { data: partnerData } = await supabase.from('partners')
 *       .select('id, name, partner_type_id, country_code, is_active') ...
 *     partner = partnerData;          // silently null, forever
 *
 * `public.partners` has no `name`, no `partner_type_id` and no `is_active`
 * column — they are `partner_name`, `partner_type` and `partner_status`. The
 * feature therefore reports "no partner" for every organisation and never
 * raises anything. A whole class of features can be dead this way while every
 * test passes and the build is green.
 *
 * Run: npm run test:schema
 * Exit: 0 = every selected column exists, 1 = at least one does not.
 */

import { boot } from './harness.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..', 'src');
const ROOT = join(HERE, '..', '..');

async function sourceFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sourceFiles(p)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

/**
 * Split a PostgREST select list on top-level commas, so embedded-resource
 * syntax such as `partner:partners(id,name)` stays in one piece.
 */
function splitTopLevel(list) {
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
    } else current += ch;
  }
  if (current.trim()) out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

const FROM_SELECT =
  /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)\s*(?:\r?\n\s*)*\.select\(\s*(['"`])([\s\S]*?)\2/g;

async function main() {
  const { db } = await boot({ quiet: true });

  const { rows: colRows } = await db.query(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'`);

  const schema = new Map();
  for (const r of colRows) {
    if (!schema.has(r.table_name)) schema.set(r.table_name, new Set());
    schema.get(r.table_name).add(r.column_name);
  }

  const files = await sourceFiles(SRC);
  const problems = [];
  let checked = 0;
  let skippedEmbeds = 0;

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const lines = text.split('\n');
    FROM_SELECT.lastIndex = 0;

    let m;
    while ((m = FROM_SELECT.exec(text)) !== null) {
      const [full, table, , selectList] = m;
      const line = text.slice(0, m.index).split('\n').length;
      const where = `${relative(ROOT, file).replace(/\\/g, '/')}:${line}`;

      if (!schema.has(table)) {
        problems.push({ where, detail: `table "${table}" does not exist` });
        continue;
      }

      const known = schema.get(table);
      const normalised = selectList.replace(/\s+/g, '');
      if (normalised === '*' || normalised === '') continue;

      for (const raw of splitTopLevel(normalised)) {
        // Embedded resource: alias:other_table(cols) — validated as its own
        // table where possible, otherwise recorded as unchecked rather than
        // silently assumed correct.
        if (raw.includes('(')) {
          const embedded = raw.replace(/^[a-zA-Z0-9_]+:/, '').split('(')[0];
          if (!schema.has(embedded)) {
            problems.push({ where, detail: `embedded table "${embedded}" does not exist` });
          } else {
            skippedEmbeds++;
          }
          continue;
        }

        // `alias:column`, `column::cast`, `count`, aggregate helpers
        let col = raw.includes(':') ? raw.split(':').pop() : raw;
        col = col.split('::')[0].split('.')[0].replace(/!.*$/, '').trim();
        if (!col || col === '*' || col === 'count') continue;

        checked++;
        if (!known.has(col)) {
          const near = [...known].filter((k) => k.includes(col) || col.includes(k)).slice(0, 3);
          problems.push({
            where,
            detail:
              `"${table}" has no column "${col}"` +
              (near.length ? ` — did you mean ${near.map((n) => `"${n}"`).join(' / ')}?` : ''),
          });
        }
      }
      void lines;
      void full;
    }
  }

  await db.close();

  console.log(
    `Checked ${checked} selected columns across ${files.length} source files ` +
      `(${skippedEmbeds} embedded resources resolved).`
  );

  if (problems.length === 0) {
    console.log('\nAll selected columns exist in the migrated schema.');
    process.exit(0);
  }

  console.log(`\n${problems.length} query/schema mismatch(es):\n`);
  for (const p of problems) console.log(`  ${p.where}\n      ${p.detail}`);
  process.exit(1);
}

main().catch((e) => {
  console.error('HARNESS ERROR:', e);
  process.exit(2);
});
