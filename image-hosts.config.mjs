/**
 * Remote image hosts permitted by the Next.js image optimiser.
 *
 * ---------------------------------------------------------------------------
 * DEFECT REMEDIATED (production hygiene / attack surface):
 *   This allowlist was inherited verbatim from the project scaffold and named
 *     images.unsplash.com, images.pexels.com, images.pixabay.com, img.rocket.new
 *   A search of the entire application source found ZERO references to any of
 *   them: no component, page, asset manifest or configuration value loads an
 *   image from any of these hosts. The allowlist was dead configuration.
 *
 *   It was not, however, inert. Every entry authorises `/_next/image` to fetch
 *   an arbitrary URL on that host and pass the response through `sharp`
 *   (libvips) server-side. `sharp` is currently exposed to
 *   GHSA-f88m-g3jw-g9cj (CVE-2026-33327 / 33328 / 35590 / 35591) through the
 *   copy Next.js 15 bundles, which cannot be updated without moving to
 *   Next.js 16. Keeping four third-party hosts on the allowlist — one of them
 *   the scaffolding vendor's own CDN, which has no place in a production
 *   deployment — left a remote-image decode path open for no product benefit.
 *
 *   Emptying the list removes that path entirely. `/_next/image` continues to
 *   serve images from this origin (`/public`), which is all the application
 *   actually uses.
 *
 * To add a host later, add it deliberately and record why.
 * ---------------------------------------------------------------------------
 */

/** @type {Array<{ protocol: 'https', hostname: string }>} */
export const imageHosts = [];
