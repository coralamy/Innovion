'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface ReadOnlyGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ReadOnlyGuard({ children, fallback }: ReadOnlyGuardProps) {
  const { isReadOnly, readOnlyMessage } = useSubscription();

  if (isReadOnly) {
    return (
      fallback ?? (
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 cursor-not-allowed opacity-60"
          style={{ backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)' }}
          title={readOnlyMessage}
        >
          <Lock size={14} />
          Read Only
        </div>
      )
    );
  }

  return <>{children}</>;
}

interface ReadOnlyBannerProps {
  className?: string;
}

export function ReadOnlyBanner({ className }: ReadOnlyBannerProps) {
  const { isReadOnly, readOnlyMessage, status } = useSubscription();

  if (!isReadOnly) return null;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-500 ${className ?? ''}`}
      style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}
    >
      <Lock size={16} />
      <span>
        <strong>Account {status === 'read_only' ? 'Read-Only' : status}:</strong> {readOnlyMessage}{' '}
        <a href="/billing" className="underline font-600 hover:opacity-80">
          Manage Subscription
        </a>
      </span>
    </div>
  );
}
