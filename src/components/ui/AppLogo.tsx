'use client';

import React, { memo, useMemo } from 'react';
import AppImage from './AppImage';
import { BRAND_ASSETS, BRAND_COLORS, BRAND_IDENTITY } from '@/lib/brand';

interface AppLogoProps {
  variant?: 'full' | 'icon' | 'wordmark';
  size?: number;
  className?: string;
  onClick?: () => void;
  /** Set true when rendered on a dark/navy background */
  darkBg?: boolean;
  showWordmark?: boolean;
}

/**
 * AppLogo — Innovion master brand lockup.
 * Uses Logo A (innovion_logo_A) as the canonical web platform identity.
 * References the central brand asset library (src/lib/brand.ts).
 * Never import image paths directly in other components — use this component.
 */
const AppLogo = memo(function AppLogo({
  variant = 'full',
  size = 64,
  className = '',
  onClick,
  darkBg = false,
  showWordmark = false,
}: AppLogoProps) {
  const containerClassName = useMemo(() => {
    const classes = ['flex items-center'];
    if (onClick) classes.push('cursor-pointer hover:opacity-80 transition-opacity');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [onClick, className]);

  // Logo A is a full-colour image on white/transparent background.
  // On dark backgrounds use screen blend to preserve logo colours;
  // on light backgrounds render normally.
  const blendStyle: React.CSSProperties = darkBg ? { mixBlendMode: 'screen' } : {};

  const wordmarkColor = darkBg ? '#FFFFFF' : BRAND_COLORS.primary;

  // 'wordmark' variant — text-only fallback
  if (variant === 'wordmark') {
    return (
      <span
        className={`font-800 tracking-tight leading-none select-none ${className}`}
        style={{
          fontSize: size,
          color: wordmarkColor,
          letterSpacing: '-0.02em',
          fontFamily: 'var(--font-sans)',
        }}
        onClick={onClick}
      >
        {BRAND_IDENTITY.name}
      </span>
    );
  }

  // 'icon' variant — small square crop showing just the shield portion
  if (variant === 'icon') {
    return (
      <div
        className={containerClassName}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        style={{ width: size, height: size, overflow: 'hidden' }}
      >
        <AppImage
          src={BRAND_ASSETS.logoIcon}
          alt={`${BRAND_IDENTITY.name} logo`}
          width={size}
          height={size}
          className="object-contain flex-shrink-0"
          priority={true}
          style={blendStyle}
        />
      </div>
    );
  }

  // 'full' variant — Logo A full lockup (shield + INNOVION wordmark + tagline embedded in image)
  // Width is proportionally wider than height to preserve the horizontal lockup aspect ratio
  const logoHeight = size;
  const logoWidth = Math.round(size * 3.2); // Logo A is approximately 3.2:1 aspect ratio

  return (
    <div className={containerClassName} onClick={onClick} role={onClick ? 'button' : undefined}>
      <AppImage
        src={BRAND_ASSETS.logoFull}
        alt={`${BRAND_IDENTITY.name} — ${BRAND_IDENTITY.tagline}`}
        width={logoWidth}
        height={logoHeight}
        className="object-contain flex-shrink-0"
        priority={true}
        style={blendStyle}
      />
    </div>
  );
});

export default AppLogo;
