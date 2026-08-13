'use client';

import React, { Suspense } from 'react';
import AcceptInvitePage from './AcceptInviteContent';

export default function AcceptInvitePageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AcceptInvitePage />
    </Suspense>
  );
}
