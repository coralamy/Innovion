'use client';
import React from 'react';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PermissionDeniedProps {
  action?: string;
  onBack?: () => void;
  inline?: boolean;
}

export default function PermissionDenied({ action, onBack, inline = false }: PermissionDeniedProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    router.back();
  };

  if (inline) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
        style={{ backgroundColor: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--warning)' }}
        role="alert"
      >
        <ShieldOff size={16} className="flex-shrink-0" />
        <span className="font-500">
          {action
            ? `You don't have permission to ${action}.`
            : "You don't have permission to perform this action."}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4" role="alert">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
        style={{ backgroundColor: 'var(--warning-bg)' }}
      >
        <ShieldOff size={28} style={{ color: 'var(--warning)' }} />
      </div>
      <h2 className="text-lg font-700 text-foreground mb-2">Access Restricted</h2>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
        {action
          ? `You don't have permission to ${action}. Contact your administrator to request access.`
          : "You don't have permission to view this content. Contact your administrator to request access."}
      </p>
      <button
        onClick={handleBack}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 transition-all hover:opacity-80"
        style={{ backgroundColor: 'var(--secondary)', color: 'var(--foreground)' }}
      >
        <ArrowLeft size={14} />
        Go Back
      </button>
    </div>
  );
}
