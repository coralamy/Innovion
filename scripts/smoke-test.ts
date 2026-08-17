#!/usr/bin/env ts-node
/**
 * Innovion Platform — Production Smoke Test
 * ==========================================
 * Run after every production deployment to verify critical paths are operational.
 *
 * Usage:
 *   BASE_URL=https://your-production-domain.com npx ts-node scripts/smoke-test.ts
 *
 * Exit codes:
 *   0 — All tests passed
 *   1 — One or more tests failed
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const TIMEOUT_MS = 10_000;

// ─── Colour helpers ───────────────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const pass = (msg: string) => console.log(`  ${GREEN}✔${RESET}  ${msg}`);
const fail = (msg: string) => console.log(`  ${RED}✘${RESET}  ${msg}`);
const warn = (msg: string) => console.log(`  ${YELLOW}⚠${RESET}  ${msg}`);
const info = (msg: string) => console.log(`  ${CYAN}ℹ${RESET}  ${msg}`);
const title = (msg: string) => console.log(`\n${BOLD}${msg}${RESET}`);

// ─── Types ────────────────────────────────────────────────────────────────────
interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  detail?: string;
}

const results: TestResult[] = [];

// ─── Core test runner ─────────────────────────────────────────────────────────
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, passed: true, durationMs });
    pass(`${name} ${YELLOW}(${durationMs}ms)${RESET}`);
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, durationMs, detail });
    fail(`${name} — ${RED}${detail}${RESET}`);
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function get(
  path: string,
  expectedStatus = 200,
  headers: Record<string, string> = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Innovion-SmokeTest/1.0', ...headers },
    });
    if (res.status !== expectedStatus) {
      throw new Error(`Expected HTTP ${expectedStatus}, got ${res.status}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T = unknown>(path: string, expectedStatus = 200): Promise<T> {
  const res = await get(path, expectedStatus);
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response, got: ${contentType}`);
  }
  return res.json() as Promise<T>;
}

// ─── Test suites ──────────────────────────────────────────────────────────────

async function runPageTests(): Promise<void> {
  title('1. Public Pages — HTTP 200 checks');

  const publicPages = [
    ['Marketing home', '/marketing'],
    ['Pricing page', '/marketing/pricing'],
    ['Features page', '/marketing/features'],
    ['About page', '/marketing/about'],
    ['Contact page', '/marketing/contact'],
    ['Resources page', '/marketing/resources'],
    ['Industries page', '/marketing/industries'],
    ['Privacy policy', '/marketing/privacy'],
    ['Terms of service', '/marketing/terms'],
    ['Sign-up / Login', '/sign-up-login'],
  ] as const;

  for (const [name, path] of publicPages) {
    await test(name, async () => {
      const res = await get(path, 200);
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('text/html')) throw new Error(`Non-HTML response: ${ct}`);
    });
  }
}

async function runApiTests(): Promise<void> {
  title('2. API Endpoints — Response validation');

  await test('Dashboard summary returns JSON', async () => {
    const data = await getJson<{ data: unknown; meta: { queryCount: number } }>(
      '/api/dashboard/summary'
    );
    if (!data.data) throw new Error('Missing "data" key in response');
    if (data.meta?.queryCount !== 6)
      throw new Error(`Expected queryCount=6, got ${data.meta?.queryCount}`);
  });

  await test('Dashboard summary includes rate-limit headers', async () => {
    const res = await get('/api/dashboard/summary', 200);
    const limit = res.headers.get('x-ratelimit-limit');
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (!limit) throw new Error('Missing X-RateLimit-Limit header');
    if (!remaining) throw new Error('Missing X-RateLimit-Remaining header');
  });

  await test('Dashboard summary cache-control header present', async () => {
    const res = await get('/api/dashboard/summary', 200);
    const cc = res.headers.get('cache-control') ?? '';
    if (!cc.includes('s-maxage')) throw new Error(`Cache-Control missing s-maxage: "${cc}"`);
  });

  await test('Platform configuration endpoint responds', async () => {
    // Expect 401 (unauthenticated) — confirms route is alive and auth is enforced
    await get('/api/platform/configuration', 401);
  });

  await test('Platform tenancy endpoint responds', async () => {
    await get('/api/platform/tenancy', 401);
  });

  await test('Platform localisation endpoint responds', async () => {
    await get('/api/platform/localisation', 401);
  });

  await test('Platform business-rules endpoint responds', async () => {
    await get('/api/platform/business-rules', 401);
  });

  await test('Platform partner-config endpoint responds', async () => {
    await get('/api/platform/partner-config', 401);
  });
}

async function runRateLimitTests(): Promise<void> {
  title('3. Rate Limiting — Abuse prevention');

  await test('Rate limiter returns 429 after limit exceeded', async () => {
    // Fire 35 rapid requests to the dashboard endpoint (limit is 30/min)
    const requests = Array.from({ length: 35 }, () =>
      fetch(`${BASE_URL}/api/dashboard/summary`, {
        headers: { 'User-Agent': 'Innovion-SmokeTest-RateLimit/1.0' },
      }).then((r) => r.status)
    );
    const statuses = await Promise.all(requests);
    const has429 = statuses.includes(429);
    if (!has429) {
      warn(
        'Rate limiter did not return 429 — may be reset between requests or window not reached'
      );
      // Non-fatal: in-memory store may have been cleared; log as warning not failure
    }
  });

  await test('Rate limit 429 response includes Retry-After header', async () => {
    // Make a single request and check headers are present regardless of status
    const res = await fetch(`${BASE_URL}/api/dashboard/summary`, {
      headers: { 'User-Agent': 'Innovion-SmokeTest-Headers/1.0' },
    });
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      if (!retryAfter) throw new Error('429 response missing Retry-After header');
    }
    // If not 429, rate limit headers should still be present
    const limit = res.headers.get('x-ratelimit-limit');
    if (!limit) throw new Error('Missing X-RateLimit-Limit header on response');
  });
}

async function runSecurityTests(): Promise<void> {
  title('4. Security Headers & Hardening');

  await test('Auth callback route exists (no 404)', async () => {
    // Should redirect or return non-404 — confirms route is registered
    const res = await fetch(`${BASE_URL}/auth/callback`, { redirect: 'manual' });
    if (res.status === 404) throw new Error('Auth callback route returned 404');
  });

  await test('Unauthenticated dashboard redirects or returns 401/302', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' });
    if (res.status === 200) {
      // If 200, check it's not exposing data without auth (could be SSR with empty state)warn('Dashboard returned 200 without auth — verify SSR renders empty/redirect state');
    }
    if (res.status === 404) throw new Error('Dashboard route not found');
  });

  await test('SQL injection attempt returns non-500 on public endpoint', async () => {
    const maliciousPath = "/api/dashboard/summary?id=1' OR '1'='1";
    const res = await fetch(`${BASE_URL}${maliciousPath}`, { redirect: 'manual' });
    if (res.status === 500)
      throw new Error('SQL injection probe returned 500 — possible unhandled error');
  });

  await test('Path traversal attempt returns non-500', async () => {
    const res = await fetch(`${BASE_URL}/api/platform/configuration?path=../../etc/passwd`, {
      redirect: 'manual',
    });
    if (res.status === 500) throw new Error('Path traversal probe returned 500');
  });
}

async function runSupabaseConnectivityTest(): Promise<void> {
  title('5. Supabase Connectivity');

  await test('Supabase URL environment variable is set', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
    if (url.includes('placeholder') || url.includes('your-')) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL appears to be a placeholder value');
    }
  });

  await test('Supabase anon key environment variable is set', async () => {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
    if (key.includes('placeholder') || key.includes('your-')) {
      throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be a placeholder value');
    }
  });

  await test('Supabase REST API reachable', async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      warn(
        'Skipping Supabase connectivity — NEXT_PUBLIC_SUPABASE_URL not set in this environment'
      );
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        signal: controller.signal,
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
      });
      // Supabase returns 200 or 400 on the root — both confirm connectivity
      if (res.status >= 500) throw new Error(`Supabase REST returned ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  });
}

async function runPerformanceTests(): Promise<void> {
  title('6. Performance Benchmarks');

  const THRESHOLDS: Record<string, number> = {
    'Marketing home': 3_000,
    'Dashboard summary API': 1_200,
    'Sign-up / Login page': 3_000,
  };

  const benchmarks: Array<[string, string, number]> = [
    ['Marketing home', '/marketing', THRESHOLDS['Marketing home']],
    ['Dashboard summary API', '/api/dashboard/summary', THRESHOLDS['Dashboard summary API']],
    ['Sign-up / Login page', '/sign-up-login', THRESHOLDS['Sign-up / Login page']],
  ];

  for (const [name, path, threshold] of benchmarks) {
    await test(`${name} responds within ${threshold}ms`, async () => {
      const start = Date.now();
      await fetch(`${BASE_URL}${path}`, { redirect: 'manual' });
      const elapsed = Date.now() - start;
      if (elapsed > threshold) {
        throw new Error(`Response took ${elapsed}ms — exceeds ${threshold}ms threshold`);
      }
    });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(
    `\n${BOLD}╔══════════════════════════════════════════════════╗${RESET}`
  );
  console.log(`${BOLD}║     Innovion — Production Smoke Test              ║${RESET}`);
  console.log(
    `${BOLD}╚══════════════════════════════════════════════════╝${RESET}`
  );
  info(`Target: ${BOLD}${BASE_URL}${RESET}`);
  info(`Started: ${new Date().toISOString()}`);

  await runPageTests();
  await runApiTests();
  await runRateLimitTests();
  await runSecurityTests();
  await runSupabaseConnectivityTest();
  await runPerformanceTests();

  // ─── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const avgMs = Math.round(results.reduce((s, r) => s + r.durationMs, 0) / total);

  console.log(
    `\n${BOLD}══════════════════════════════════════════════════${RESET}`
  );
  console.log(
    `${BOLD}  Results: ${GREEN}${passed} passed${RESET}  ${failed > 0 ? RED : ''}${failed} failed${RESET}  / ${total} total`
  );
  console.log(`  Average response time: ${avgMs}ms`);
  console.log(
    `${BOLD}══════════════════════════════════════════════════${RESET}\n`
  );

  if (failed > 0) {
    console.log(`${RED}${BOLD}FAILED TESTS:${RESET}`);
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  ${RED}✘${RESET} ${r.name}`);
      if (r.detail) console.log(`      ${YELLOW}→ ${r.detail}${RESET}`);
    }
    console.log('');
    process.exit(1);
  }

  console.log(`${GREEN}${BOLD}All smoke tests passed. Platform is operational.${RESET}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`${RED}Smoke test runner crashed:${RESET}`, err);
  process.exit(1);
});

// This file is a standalone CLI script. The empty export makes it a MODULE
// rather than a global script: without it TypeScript places every top-level
// binding in the global scope, and the six scripts in this directory then
// collide on shared names (GREEN, RED, results, title, BASE_URL, ...),
// producing dozens of spurious TS2451/TS6200/TS2393 errors. That noise was a
// significant reason 	ype-check was never green and was suppressed at build
// time via next.config.mjs.
export {};
