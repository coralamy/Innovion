'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { X, AlertTriangle, CheckCircle2, Info, AlertCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';


// ── Types ─────────────────────────────────────────────────────────────────────

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'success' | 'info' | 'warning';
  category: string;
  actionLabel?: string;
  timestamp: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const typeConfig = {
  alert:   { icon: AlertTriangle,  bg: 'var(--danger-bg)',  border: 'rgba(239,68,68,0.2)',   text: 'var(--danger)',   accent: '#EF4444' },
  success: { icon: CheckCircle2,   bg: 'var(--success-bg)', border: 'rgba(16,185,129,0.2)',  text: 'var(--success)',  accent: '#10B981' },
  info:    { icon: Info,           bg: 'var(--info-bg)',    border: 'rgba(59,130,246,0.2)',  text: 'var(--info)',     accent: '#3B82F6' },
  warning: { icon: AlertCircle,    bg: 'var(--warning-bg)', border: 'rgba(245,158,11,0.2)',  text: 'var(--warning)',  accent: '#F59E0B' },
};

const TOAST_DURATION = 6000; // ms

// ── Toast Item ────────────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: ToastNotification; onDismiss: (id: string) => void }) {
  const cfg = typeConfig[toast.type] || typeConfig['info'];
  const Icon = cfg.icon;
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss
    const d = setTimeout(() => dismiss(), TOAST_DURATION);
    return () => { clearTimeout(t); clearTimeout(d); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-3 p-3.5 rounded-xl shadow-lg max-w-sm w-full transition-all duration-300"
      style={{
        backgroundColor: 'var(--card)',
        border: `1px solid ${cfg.border}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px ${cfg.border}`,
        opacity: visible && !leaving ? 1 : 0,
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(100%)',
        transition: 'opacity 300ms ease, transform 300ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 rounded-b-xl"
        style={{
          backgroundColor: cfg.accent,
          width: '100%',
          animation: `toast-progress ${TOAST_DURATION}ms linear forwards`,
        }}
      />

      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: cfg.bg }}
      >
        <Icon size={15} style={{ color: cfg.text }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-700 text-foreground leading-tight">{toast.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{toast.message}</p>
        {toast.actionLabel && (
          <Link
            href="/notifications"
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-600 hover:underline"
            style={{ color: cfg.accent }}
          >
            {toast.actionLabel} <ExternalLink size={10} />
          </Link>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        className="p-0.5 rounded-md hover:bg-secondary transition-colors flex-shrink-0 mt-0.5"
        aria-label="Dismiss notification"
      >
        <X size={13} className="text-muted-foreground" />
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RealtimeNotificationToasts() {
  const { user, companyId } = useAuth();
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const isFirstLoad = useRef(true);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();

    // Skip initial batch — only show NEW inserts after page load
    const channel = supabase
      .channel('realtime-toasts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}),
        },
        (payload) => {
          // Skip the very first event burst on subscribe
          if (isFirstLoad.current) return;

          const row = payload.new as {
            id: string;
            title: string;
            message: string;
            notif_type: string;
            category: string;
            action_label: string | null;
          };

          const toast: ToastNotification = {
            id: row.id,
            title: row.title,
            message: row.message,
            type: (row.notif_type as ToastNotification['type']) || 'info',
            category: row.category,
            actionLabel: row.action_label ?? undefined,
            timestamp: Date.now(),
          };

          setToasts((prev) => {
            // Max 5 toasts at once
            const next = [toast, ...prev].slice(0, 5);
            return next;
          });
        }
      )
      .subscribe(() => {
        // Mark first load complete after subscribe callback fires
        setTimeout(() => { isFirstLoad.current = false; }, 500);
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, companyId]);

  if (toasts.length === 0) return null;

  return (
    <>
      {/* Keyframe for progress bar */}
      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      {/* Toast stack — bottom-right */}
      <div
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto relative">
            <ToastItem toast={toast} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </>
  );
}
