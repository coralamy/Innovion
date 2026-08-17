/**
 * Innovion Team A — Application-layer security regression suite
 * ===========================================================================
 * Exercises the pure security logic introduced or corrected during the
 * 2026-08-17 remediation, adversarially.
 *
 * Every case below corresponds to a defect that was actually present in this
 * codebase, or to an attack the corrected code must withstand. It is a
 * regression suite, not a demonstration.
 *
 * Run:  npm run test:app
 * Exit: 0 = all assertions passed, 1 = at least one failed.
 */

process.env.OAUTH_STATE_SECRET =
  process.env.OAUTH_STATE_SECRET ?? 'test-suite-oauth-state-secret-not-a-real-secret-0123456789';

import {
  signState,
  verifyState,
  safeReturnTo,
  newStateToken,
  OAUTH_STATE_MAX_AGE_MS,
  type OAuthStatePayload,
} from '../src/lib/integrations/oauthState';
import { sanitiseFilename, buildStoragePath } from '../src/lib/services/documentService';
import {
  hasScope,
  apiKeyRateLimitIdentifier,
  type ApiKeyContext,
} from '../src/lib/platformApiAuth';
import { checkRateLimit, getRequestIdentifier } from '../src/lib/rateLimit';

let passed = 0;
const failures: string[] = [];
let section = '';

function group(name: string) {
  section = name;
  console.log(`\n── ${name}`);
}
function check(desc: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`   PASS  ${desc}${detail ? `  (${detail})` : ''}`);
  } else {
    failures.push(`[${section}] ${desc}${detail ? ` — ${detail}` : ''}`);
    console.log(`   FAIL  ${desc}${detail ? `  (${detail})` : ''}`);
  }
}

const basePayload = (over: Partial<OAuthStatePayload> = {}): OAuthStatePayload => ({
  state: newStateToken(),
  codeVerifier: 'verifier',
  companyId: 'aaaaaaaa-0000-0000-0000-00000000000a',
  userId: '11111111-1111-1111-1111-111111111111',
  provider: 'xero',
  returnTo: '/settings/integrations',
  acquisitionSource: 'direct',
  createdAt: Date.now(),
  ...over,
});

// ═══════════════════════════════════════════════════════════════════════════
group('A. OPEN REDIRECT — safeReturnTo must reduce to a local path');

// Every one of these, passed as ?return_to=, previously reached
// `new URL(returnTo, request.url)`, which discards the base for an absolute
// URL and redirects off-site from the application's own domain.
const REDIRECT_PAYLOADS: Array<[string, string]> = [
  ['https://evil.example', 'absolute https'],
  ['http://evil.example/x', 'absolute http'],
  ['//evil.example', 'protocol-relative'],
  ['//evil.example/path', 'protocol-relative with path'],
  ['///evil.example', 'triple slash'],
  ['\\\\evil.example', 'backslash authority'],
  ['/\\evil.example', 'slash-backslash'],
  ['javascript:alert(1)', 'javascript scheme'],
  ['data:text/html,<script>alert(1)</script>', 'data scheme'],
  ['https:/evil.example', 'single-slash scheme'],
  ['HtTpS://evil.example', 'mixed-case scheme'],
  [' https://evil.example', 'leading space'],
  ['/settings\\..\\..\\evil', 'backslash traversal'],
];

for (const [payload, label] of REDIRECT_PAYLOADS) {
  const result = safeReturnTo(payload);
  const isLocal = result.startsWith('/') && !result.startsWith('//') && !result.includes('://');
  check(`rejects ${label}`, isLocal, `→ ${result}`);
}

for (const good of ['/settings/integrations', '/dashboard', '/jobs?tab=open', '/a/b/c']) {
  check(`REGRESSION: preserves legitimate path ${good}`, safeReturnTo(good) === good);
}
check('empty input falls back to the default', safeReturnTo('') === '/settings/integrations');
check('null input falls back to the default', safeReturnTo(null) === '/settings/integrations');

// ═══════════════════════════════════════════════════════════════════════════
group('B. OAUTH STATE — an attacker must not be able to mint or edit one');

{
  const payload = basePayload();
  const signed = signState(payload);
  const v = verifyState(signed, Date.now());
  check('a state this server signed verifies', v.ok, v.ok ? '' : v.reason);
  if (v.ok) {
    check('...and round-trips its tenant unchanged', v.payload.companyId === payload.companyId);
    check('...and round-trips its user unchanged', v.payload.userId === payload.userId);
  }
}

{
  // THE ORIGINAL ATTACK: the state cookie was plain JSON, so an attacker sent
  // `Cookie: oauth_state_xero={"companyId":"<victim>", ...}` and the callback
  // wrote OAuth credentials into the victim's tenant.
  const forged = JSON.stringify(basePayload({ companyId: 'victim-tenant' }));
  const v = verifyState(forged, Date.now());
  check(
    'raw JSON (the original forgeable format) is rejected',
    !v.ok,
    v.ok ? 'ACCEPTED' : v.reason
  );
}

{
  // Attacker keeps a valid signature but swaps the payload for one naming the
  // victim tenant.
  const legit = signState(basePayload());
  const mac = legit.slice(legit.lastIndexOf('.') + 1);
  const evilBody = Buffer.from(
    JSON.stringify(basePayload({ companyId: 'bbbbbbbb-0000-0000-0000-00000000000b' })),
    'utf8'
  ).toString('base64url');
  const v = verifyState(`${evilBody}.${mac}`, Date.now());
  check(
    'payload swapped under a stolen signature is rejected',
    !v.ok,
    v.ok ? 'ACCEPTED' : v.reason
  );
}

{
  const legit = signState(basePayload());
  const body = legit.slice(0, legit.lastIndexOf('.'));
  const v = verifyState(`${body}.`, Date.now());
  check('empty signature is rejected', !v.ok, v.ok ? 'ACCEPTED' : v.reason);
}

{
  const legit = signState(basePayload());
  const v = verifyState(legit.slice(0, legit.lastIndexOf('.')), Date.now());
  check('signature stripped entirely is rejected', !v.ok, v.ok ? 'ACCEPTED' : v.reason);
}

{
  // Single-bit tamper of the body.
  const legit = signState(basePayload());
  const idx = legit.lastIndexOf('.');
  const body = legit.slice(0, idx);
  const flipped = (body[10] === 'A' ? 'B' : 'A') + body.slice(1);
  const v = verifyState(`${flipped}.${legit.slice(idx + 1)}`, Date.now());
  check('a single altered character is rejected', !v.ok, v.ok ? 'ACCEPTED' : v.reason);
}

{
  // `createdAt` was written and never checked; only the cookie's own maxAge
  // limited it, and cookie expiry is enforced by the client.
  const stale = signState(basePayload({ createdAt: Date.now() - OAUTH_STATE_MAX_AGE_MS - 1000 }));
  const v = verifyState(stale, Date.now());
  check(
    'a state older than its maximum age is rejected',
    !v.ok && v.reason === 'expired',
    v.ok ? 'ACCEPTED' : v.reason
  );
}

{
  const fresh = signState(basePayload({ createdAt: Date.now() - 1000 }));
  const v = verifyState(fresh, Date.now());
  check('REGRESSION: a state one second old is accepted', v.ok, v.ok ? '' : v.reason);
}

{
  // A state minted under a different server secret must not verify.
  const previous = process.env.OAUTH_STATE_SECRET;
  process.env.OAUTH_STATE_SECRET = 'a-completely-different-secret-of-sufficient-length-1234567890';
  const foreign = signState(basePayload());
  process.env.OAUTH_STATE_SECRET = previous;
  const v = verifyState(foreign, Date.now());
  check('a state signed with another secret is rejected', !v.ok, v.ok ? 'ACCEPTED' : v.reason);
}

for (const junk of ['', 'not-a-state', '.', '..', 'a.b.c', '{}', 'null']) {
  const v = verifyState(junk, Date.now());
  check(`malformed input ${JSON.stringify(junk)} is rejected`, !v.ok, v.ok ? 'ACCEPTED' : v.reason);
}

{
  const tokens = new Set(Array.from({ length: 500 }, () => newStateToken()));
  check('state tokens are unique across 500 draws', tokens.size === 500, `${tokens.size} distinct`);
  check('state tokens are 256 bits', [...tokens][0].length === 64);
}

// ═══════════════════════════════════════════════════════════════════════════
group('C. STORAGE PATHS — the first segment is the tenant boundary');

const TRAVERSALS = [
  '../../../etc/passwd',
  '..\\..\\windows\\system32',
  'a/../../b.pdf',
  './../../secret.pdf',
  '%2e%2e%2fsecret.pdf',
  'nul.pdf',
  'file:with:colons.pdf',
  'sp ace/../escape.pdf',
];

for (const name of TRAVERSALS) {
  const safe = sanitiseFilename(name);
  check(
    `sanitiseFilename removes separators from ${JSON.stringify(name)}`,
    !safe.includes('/') && !safe.includes('\\') && !safe.includes('..'),
    `→ ${safe}`
  );
}

{
  // The A/B/D layout is <company_id>/<user_id>/<file>: segment 1 is the tenant
  // boundary Team A enforces, segment 2 is the uploader that Team B's
  // restrictive `workforce_documents_own_files_only` policy matches on. A
  // traversal payload must not be able to escape either segment.
  const tenant = 'aaaaaaaa-0000-0000-0000-00000000000a';
  const uploader = '77777777-7777-7777-7777-777777777777';
  for (const name of TRAVERSALS) {
    const path = buildStoragePath(tenant, uploader, name);
    const segments = path.split('/');
    check(
      `buildStoragePath keeps ${JSON.stringify(name)} inside <tenant>/<uploader>/`,
      segments[0] === tenant && segments[1] === uploader && segments.length === 3,
      `→ ${path}`
    );
  }
}

check(
  'REGRESSION: an ordinary filename keeps its extension',
  sanitiseFilename('Site Safety Report.pdf') === 'Site_Safety_Report.pdf',
  sanitiseFilename('Site Safety Report.pdf')
);

// ═══════════════════════════════════════════════════════════════════════════
group('D. API KEY SCOPES');

const ctx = (scopes: string[]): ApiKeyContext => ({
  apiKeyId: 'key-1',
  companyId: 'aaaaaaaa-0000-0000-0000-00000000000a',
  scopes,
});

check('an exact scope grants access', hasScope(ctx(['tenancy:read']), 'tenancy:read'));
check('an unrelated scope does not', !hasScope(ctx(['localisation:read']), 'tenancy:read'));
check('an empty scope list grants nothing', !hasScope(ctx([]), 'tenancy:read'));
check(
  'a prefix of the required scope does not grant it',
  !hasScope(ctx(['tenancy']), 'tenancy:read')
);
check(
  'a superstring of the required scope does not grant it',
  !hasScope(ctx(['tenancy:read:all']), 'tenancy:read')
);
check(
  'the wildcard still grants (documented, and now logged)',
  hasScope(ctx(['*']), 'tenancy:read')
);
check(
  'rate-limit identity is the key id, not a client-supplied header',
  apiKeyRateLimitIdentifier(ctx([])) === 'key:key-1'
);

// ═══════════════════════════════════════════════════════════════════════════
group('E. RATE LIMITER');

{
  const cfg = { limit: 3, windowMs: 60_000, prefix: `t${Date.now()}` };
  const id = 'subject-a';
  const results = [1, 2, 3, 4, 5].map(() => checkRateLimit(id, cfg));
  check(
    'the first N requests are allowed',
    results.slice(0, 3).every((r) => r.success)
  );
  check('request N+1 is refused', !results[3].success);
  check('and it stays refused', !results[4].success);
  check('remaining counts down to zero', results[2].remaining === 0, `${results[2].remaining}`);
}

{
  // Distinct identifiers must not share a bucket — otherwise one noisy tenant
  // locks out every other.
  const cfg = { limit: 1, windowMs: 60_000, prefix: `t${Date.now()}b` };
  check(
    'separate identifiers have separate budgets',
    checkRateLimit('x', cfg).success && checkRateLimit('y', cfg).success
  );
  check('...and each is then exhausted independently', !checkRateLimit('x', cfg).success);
}

{
  // getRequestIdentifier reads the LAST XFF entry: a client may prepend
  // arbitrary values, but trusted infrastructure appends.
  const req = new Request('http://localhost/', {
    headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9, 203.0.113.7' },
  });
  check(
    'the last X-Forwarded-For entry is used, not the client-controlled first',
    getRequestIdentifier(req) === '203.0.113.7',
    getRequestIdentifier(req)
  );
}

{
  const req = new Request('http://localhost/', { headers: { 'x-real-ip': '203.0.113.9' } });
  check('falls back to X-Real-IP', getRequestIdentifier(req) === '203.0.113.9');
  check(
    'falls back to "unknown" with no headers',
    getRequestIdentifier(new Request('http://localhost/')) === 'unknown'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(78));
console.log(`  ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\n  FAILURES');
  failures.forEach((f, i) => console.log(`   ${String(i + 1).padStart(2)}. ${f}`));
}
console.log('═'.repeat(78));
process.exit(failures.length ? 1 : 0);
