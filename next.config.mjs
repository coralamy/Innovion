import { imageHosts } from './image-hosts.config.mjs';

/**
 * Security response headers.
 *
 * Previously absent entirely. Applied to every route.
 *
 * Content-Security-Policy notes:
 *   'unsafe-inline' is required for style-src because the application styles
 *   extensively with inline `style={{ ... }}` attributes, and Next.js injects
 *   inline <style> for critical CSS. 'unsafe-eval' is NOT granted.
 *   script-src keeps 'unsafe-inline' only because Next.js App Router emits
 *   inline bootstrap scripts; tightening it further requires the nonce-based
 *   CSP integration and is recorded as follow-up work, not silently claimed.
 */
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : '';
  } catch {
    return '';
  }
})();

const connectSrc = ["'self'", supabaseOrigin, supabaseOrigin.replace(/^https:/, 'wss:')]
  .filter(Boolean)
  .join(' ');

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Source maps were published to the browser in production, exposing the full
  // unminified application source to anyone loading the site.
  productionBrowserSourceMaps: false,

  // Do not advertise the framework version to attackers.
  poweredByHeader: false,

  distDir: process.env.DIST_DIR || '.next',

  // A stray lockfile in the parent directory made Next.js infer the wrong
  // workspace root, which mis-scopes output file tracing for deployment.
  outputFileTracingRoot: import.meta.dirname,

  // `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` were both
  // true, so production builds shipped with every type error and lint error
  // suppressed. Both are now enforced: a broken build must fail, not deploy.
  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
    qualities: [75, 85, 100],
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
