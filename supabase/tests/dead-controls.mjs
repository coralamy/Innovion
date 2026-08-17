/**
 * Innovion Team A — Inert-control regression check
 * ===========================================================================
 * Fails if any `<button>` in the application is rendered with no `onClick`, no
 * `type="submit"` and no `disabled` attribute — i.e. a control that looks live
 * and does nothing when clicked.
 *
 * WHY
 * ---
 * An audit of the interface found 28 such controls: "Add Contractor",
 * "Assign Job", "Edit Client", "Edit Site", "Edit" (employees, vehicles,
 * roster), "Reorder", "Change Password", "Upgrade to Enterprise", "View Jobs",
 * "Manual Entry", "View all", "Reassign", "Refresh schedule", the jobs row
 * overflow menu, the compliance download icon, the profile avatar control, the
 * notification call-to-action, and the Topbar help button. Every one was fully
 * styled, showed a pointer cursor and responded to hover and press.
 *
 * A control that is indistinguishable from a working one, and silently does
 * nothing, is not an incomplete feature — it is a defect. The user cannot tell
 * it from a failure, so they retry, then assume the operation succeeded.
 *
 * Each has since been wired to real behaviour or rendered through
 * `<PlannedAction>`, which is `disabled`, `aria-disabled`, visually
 * de-emphasised and carries an explanatory title. This check keeps it that way.
 *
 * Run: npm run test:controls
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SRC = join(ROOT, 'src');

/**
 * Reviewed exceptions. A file:label pair listed here has been examined and is
 * legitimately inert. Empty by design — every case found in the audit was
 * either wired up or converted to <PlannedAction>. Add an entry only with a
 * written justification.
 */
const REVIEWED_EXCEPTIONS = new Set();

async function tsxFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await tsxFiles(p)));
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Read the opening tag's attribute list, respecting braces and quotes. */
function readAttributes(text, start) {
  let i = start;
  let depth = 0;
  let quote = null;
  let attrs = '';
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) break;
    attrs += ch;
    i++;
  }
  return { attrs, end: i };
}

const offenders = [];
let inspected = 0;

/**
 * Blank out comment bodies, preserving offsets so reported line numbers stay
 * correct. Without this the scanner flags `<button>` written inside a doc
 * comment — including the one in PlannedAction.tsx that documents this very
 * check.
 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
}

for (const file of await tsxFiles(SRC)) {
  const text = stripComments(await readFile(file, 'utf8'));
  const re = /<button\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    inspected++;
    const { attrs, end } = readAttributes(text, m.index + '<button'.length);

    const interactive =
      /\bonClick\b/.test(attrs) || /type=["']submit["']/.test(attrs) || /\bdisabled\b/.test(attrs);
    if (interactive) continue;

    const line = text.slice(0, m.index).split('\n').length;
    const close = text.indexOf('</button>', end);
    const label = text
      .slice(end + 1, close === -1 ? end + 160 : close)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\{[^}]*\}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);

    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (REVIEWED_EXCEPTIONS.has(`${rel}:${label}`)) continue;
    offenders.push({ file: rel, line, label });
  }
}

console.log(`Inspected ${inspected} <button> elements.`);

if (offenders.length === 0) {
  console.log('\nNo silently inert controls found.');
  process.exit(0);
}

console.log(
  `\n${offenders.length} control(s) with no onClick, no type="submit" and no disabled:\n`
);
for (const o of offenders) {
  console.log(`  ${o.file}:${o.line}  ${o.label ? `"${o.label}"` : '(icon only)'}`);
}
console.log(
  '\nWire the control to real behaviour, or render it through ' +
    '<PlannedAction> so the interface states that it is unavailable.'
);
process.exit(1);
