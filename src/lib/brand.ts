/**
 * Coralamy / Innovion Brand Asset Library — Single Source of Truth
 *
 * Platform Identity:
 *   - Coralamy is the parent platform and group company.
 *   - Innovion is the Coralamy product for intelligent micro-business operations.
 *   - All Platform Console screens carry the Coralamy platform identity.
 *   - The Innovion product name is retained for the product-level identity.
 *
 * All brand assets, colour tokens, and typography constants live here.
 * Every component must reference these values — no hard-coded colours or
 * local image paths anywhere in the codebase.
 */

// ── Asset Paths ──────────────────────────────────────────────────────────────
export const BRAND_ASSETS = {
  /** Primary logo — Logo A (shield icon + INNOVION wordmark + tagline) — official web platform identity */
  logoFull: '/assets/images/innovion_logo_A-1786073543900.png',
  /** Shield icon only — use in collapsed sidebar, favicon fallback */
  logoIcon: '/assets/images/Favicon-1786073542962.png',
  /** Wordmark only — use in marketing contexts */
  wordmark: '/assets/images/innovion_logo_A-1786073543900.png',
  /** Favicon — 32×32 PNG */
  favicon: '/assets/images/Favicon-1786073542962.png',
  /** Placeholder / no-image fallback */
  noImage: '/assets/images/no_image.png',
} as const;

// ── Colour Tokens ────────────────────────────────────────────────────────────
export const BRAND_COLORS = {
  // Core palette — Coralamy platform identity
  navy: '#0F1C2E',
  navyMid: '#1E3A5F',
  navyLight: '#2A4A72',
  blue: '#2563EB',
  blueHover: '#1D4ED8',
  blueLight: '#60A5FA',
  bluePale: '#93C5FD',

  // Coralamy coral accent
  coral: '#E8533A',
  coralHover: '#D4432B',
  coralLight: '#F4836E',
  coralPale: '#FBBCB0',

  // Semantic
  primary: '#1E3A5F',
  accent: '#2563EB',
  background: '#F8FAFC',
  foreground: '#0F172A',
  card: '#FFFFFF',
  border: '#E2E8F0',
  muted: '#64748B',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
} as const;

// ── Typography ───────────────────────────────────────────────────────────────
export const BRAND_TYPOGRAPHY = {
  fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
  fontSans: 'var(--font-sans)',
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const;

// ── Platform Identity (Coralamy Group) ───────────────────────────────────────
export const PLATFORM_IDENTITY = {
  /** Parent platform / group company name */
  platformName: 'Coralamy',
  /** Platform tagline */
  platformTagline: 'The Intelligent Business Platform',
  /** Platform URL */
  platformUrl: 'https://coralamy.com',
  /** Copyright line */
  copyright: '© Coralamy Group. All rights reserved.',
} as const;

// ── Product Identity (Innovion — Coralamy product) ───────────────────────────
export const BRAND_IDENTITY = {
  /** Product name */
  name: 'Innovion',
  /** Full qualified name shown in Platform Console breadcrumbs */
  qualifiedName: 'Innovion by Coralamy',
  /** Product tagline */
  tagline: 'intelligent Micro Business Operations Management',
  /** Product description */
  description:
    'Innovion brings customers, jobs, staff, contractors, scheduling, compliance, inventory and reporting together in one intelligent cloud platform for micro businesses.',
  /** Copyright line — references Coralamy Group */
  copyright: '© Coralamy Group. All rights reserved.',
  /** Canonical product URL */
  url: 'https://innovion.app',
} as const;

// ── Gradient Presets ─────────────────────────────────────────────────────────
export const BRAND_GRADIENTS = {
  navy: 'linear-gradient(145deg, #0F1C2E 0%, #1E3A5F 60%, #162D4A 100%)',
  brand: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)',
  hero: 'linear-gradient(160deg, #070F1A 0%, #0F1C2E 40%, #1A2E4A 100%)',
  authPanel: 'linear-gradient(160deg, #060D1A 0%, #0F1C2E 40%, #162D4A 100%)',
  coral: 'linear-gradient(135deg, #E8533A 0%, #D4432B 100%)',
} as const;
