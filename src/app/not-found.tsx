'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';

export default function NotFound() {
  const router = useRouter();

  const handleGoBack = () => {
    if (typeof window !== 'undefined') {
      window.history?.back();
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="text-center max-w-md w-full">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <AppLogo variant="full" size={28} darkBg={false} />
        </div>

        {/* 404 display */}
        <div className="relative mb-6">
          <p
            className="text-[8rem] font-800 leading-none select-none"
            style={{ color: 'var(--border)', letterSpacing: '-0.04em' }}
          >
            404
          </p>
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: 'var(--primary)' }}
          >
            <svg
              className="w-16 h-16 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <h2
          className="text-2xl font-700 mb-3"
          style={{ color: 'var(--foreground)', letterSpacing: '-0.02em' }}
        >
          Page Not Found
        </h2>
        <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--muted-foreground)' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleGoBack}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-600 transition-all duration-150 hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: 'var(--secondary)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Go Back
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-600 text-white transition-all duration-150 hover:opacity-90 active:scale-95"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
