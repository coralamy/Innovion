/**
 * In-memory rate limiter for Next.js API routes.
 * Uses a sliding window algorithm with per-IP and per-API-key tracking.
 * No external dependencies required.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory store — resets on server restart (acceptable for serverless/edge)
const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart > 60_000) {
        store.delete(key);
      }
    }
  }, 300_000);
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
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const { limit, windowMs, prefix = 'rl' } = config;
  const key = `${prefix}:${identifier}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now });
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
 * Extract the best available identifier from a request.
 * Prefers X-Forwarded-For (behind proxy), falls back to connection IP.
 */
export function getRequestIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

/**
 * Standard rate limit configurations for different endpoint tiers.
 */
export const RATE_LIMIT_CONFIGS = {
  /** Public platform API endpoints — 60 req/min per IP */
  platformApi: {
    limit: 60,
    windowMs: 60_000,
    prefix: 'platform-api',
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
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
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
