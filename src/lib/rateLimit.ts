/**
 * In-memory rate limiter for Next.js API routes.
 * Fixed-window counting with per-identifier tracking. No external dependencies.
 *
 * ---------------------------------------------------------------------------
 * KNOWN LIMITATION — DELIBERATELY NOT CLAIMED AS A COMPLETE CONTROL
 *
 * This limiter is per-process. On a serverless or multi-instance deployment
 * (the platform targets Netlify) each concurrent function instance keeps its
 * own `store`, so the effective limit is `limit × instances`, and a cold start
 * resets it. It raises the cost of abuse; it does not bound it.
 *
 * A durable, shared limiter (Upstash/Redis, or the hosting platform's own edge
 * rate limiting) is required before the platform API can be described as rate
 * limited under load. Recorded in the Team A completion report as outstanding
 * infrastructure work rather than represented here as complete.
 *
 * The comment previously in this file — "resets on server restart (acceptable
 * for serverless/edge)" — inverted the actual property: serverless is precisely
 * where a per-process limiter is least effective.
 * ---------------------------------------------------------------------------
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
  windowMs: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Evict entries whose window has closed.
 *
 * DEFECT REMEDIATED: the sweep compared against a hard-coded 60 000 ms rather
 * than each entry's own window, so any tier configured with a window longer
 * than a minute had live entries evicted mid-window — silently resetting the
 * counter and voiding the limit for that identifier.
 */
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart > entry.windowMs) {
        store.delete(key);
      }
    }
  }, 300_000);
  // Do not hold the event loop open on a short-lived serverless invocation.
  (timer as unknown as { unref?: () => void }).unref?.();
}

export interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Key prefix to namespace different rate limit tiers */
  prefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check and increment rate limit for a given identifier.
 * Returns success=false when the limit is exceeded.
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const { limit, windowMs, prefix = 'rl' } = config;
  const key = `${prefix}:${identifier}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now, windowMs });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetAt: entry.windowStart + windowMs,
    };
  }

  entry.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - entry.count,
    resetAt: entry.windowStart + windowMs,
  };
}

/**
 * Extract the best available network identifier from a request.
 *
 * WARNING — this value is CLIENT-SUPPLIED and therefore forgeable. Neither
 * `x-forwarded-for` nor `x-real-ip` is trustworthy unless a proxy that
 * overwrites (not appends to) them sits in front of every request path.
 *
 * Use it only for coarse, best-effort limiting of UNAUTHENTICATED traffic.
 * Once a caller has been authenticated, limit on their verified identity
 * instead — see `apiKeyRateLimitIdentifier` in `@/lib/platformApiAuth`.
 *
 * The LAST entry of `x-forwarded-for` is preferred over the first: a client may
 * prepend arbitrary values, but entries appended by trusted infrastructure sit
 * at the end. This does not make the value authoritative — it merely makes the
 * cheapest forgery ineffective.
 */
export function getRequestIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

/**
 * Standard rate limit configurations for different endpoint tiers.
 */
export const RATE_LIMIT_CONFIGS = {
  /** Platform API endpoints — 60 req/min per VERIFIED API KEY */
  platformApi: {
    limit: 60,
    windowMs: 60_000,
    prefix: 'platform-api',
  } satisfies RateLimitConfig,

  /**
   * Coarse guard on the unauthenticated path of the platform API, keyed on
   * network identity. Deliberately generous: it exists to blunt credential
   * stuffing against the key endpoint, not to meter legitimate traffic, and the
   * identity it uses is client-supplied and therefore spoofable.
   */
  platformApiUnauthenticated: {
    limit: 300,
    windowMs: 60_000,
    prefix: 'platform-api-unauth',
  } satisfies RateLimitConfig,

  /** Auth endpoints — 10 req/min per IP (brute force protection) */
  auth: {
    limit: 10,
    windowMs: 60_000,
    prefix: 'auth',
  } satisfies RateLimitConfig,

  /** General API routes — 120 req/min per IP */
  general: {
    limit: 120,
    windowMs: 60_000,
    prefix: 'general',
  } satisfies RateLimitConfig,

  /** Dashboard summary endpoint — 30 req/min per IP */
  dashboard: {
    limit: 30,
    windowMs: 60_000,
    prefix: 'dashboard',
  } satisfies RateLimitConfig,
} as const;

/**
 * Build a rate-limit-exceeded Response with standard headers.
 */
export function rateLimitExceededResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please slow down your requests.',
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
      },
    }
  );
}

/**
 * Add rate limit headers to an existing Response.
 */
export function addRateLimitHeaders(response: Response, result: RateLimitResult): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(result.limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
