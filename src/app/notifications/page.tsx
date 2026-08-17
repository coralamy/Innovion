'use client';
import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  Briefcase,
  ShieldCheck,
  Users,
  Settings,
} from 'lucide-react';
import { notificationService, NotificationRecord } from '@/lib/services/notificationService';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Where a notification's call-to-action should lead.
 *
 * The action button previously rendered `{actionLabel} →` with no handler, so
 * "View Compliance", "View Incident", "View Job", "View Inventory" and "View
 * Reports" all did nothing. Each category has an existing page; the label was
 * describing a destination the control never went to.
 */
function notificationTarget(category: NotificationRecord['category']): string {
  switch (category) {
    case 'compliance':
      return '/compliance';
    case 'incidents':
      return '/incidents';
    case 'jobs':
      return '/jobs';
    case 'workforce':
      return '/workforce-roster';
    case 'system':
    default:
      return '/dashboard';
  }
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  alert: { icon: AlertTriangle, color: 'var(--danger)', bg: 'var(--danger-bg)' },
  success: { icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-bg)' },
  info: { icon: Info, color: 'var(--info)', bg: 'var(--info-bg)' },
  warning: { icon: AlertTriangle, color: 'var(--warning)', bg: 'var(--warning-bg)' },
};

const categoryConfig: Record<string, { icon: React.ElementType; label: string }> = {
  compliance: { icon: ShieldCheck, label: 'Compliance' },
  jobs: { icon: Briefcase, label: 'Jobs' },
  workforce: { icon: Users, label: 'Workforce' },
  system: { icon: Settings, label: 'System' },
  incidents: { icon: AlertTriangle, label: 'Incidents' },
};

export default function NotificationsPage() {
  const { companyId } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterRead, setFilterRead] = useState('all');
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  useEffect(() => {
    notificationService.getAll(companyId).then((data) => {
      setNotifications(data);
      setLoading(false);
    });

    // Real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}),
        },
        (payload) => {
          const row = payload.new as any;
          const newNotif: NotificationRecord = {
            id: row.id,
            title: row.title,
            message: row.message,
            type: row.notif_type,
            category: row.category,
            timestamp: row.timestamp_label || 'Just now',
            read: row.is_read,
            actionLabel: row.action_label ?? undefined,
            companyId: row.company_id,
            // Required by NotificationRecord; omitted here, so a realtime
            // notification arrived without a priority or a creation time and
            // any consumer sorting or filtering on them saw `undefined`.
            priority: row.priority ?? 'normal',
            sourceModule: row.source_module ?? null,
            expiresAt: row.expires_at ?? null,
            createdAt: row.created_at ?? new Date().toISOString(),
          };
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}),
        },
        (payload) => {
          const row = payload.new as any;
          setNotifications((prev) =>
            prev.map((n) => (n.id === row.id ? { ...n, read: row.is_read } : n))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const row = payload.old as any;
          setNotifications((prev) => prev.filter((n) => n.id !== row.id));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filtered = notifications.filter((n) => {
    const matchCat = filterCategory === 'all' || n.category === filterCategory;
    const matchRead =
      filterRead === 'all' ||
      (filterRead === 'unread' && !n.read) ||
      (filterRead === 'read' && n.read);
    return matchCat && matchRead;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    await notificationService.markAllRead(companyId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await notificationService.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const deleteNotification = async (id: string) => {
    await notificationService.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <AppLayout currentPath="/notifications">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-header-title">Notifications</h1>
              {unreadCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-700 text-white"
                  style={{ backgroundColor: 'var(--danger)' }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="page-header-subtitle">
              Stay updated on compliance alerts, job updates, and system events
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="btn-secondary"
              aria-label="Mark all notifications as read"
            >
              <CheckCheck size={15} />
              Mark all read
            </button>
          )}
        </div>

        <div className="filter-bar">
          <div className="period-selector">
            {['all', 'unread', 'read'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterRead(f)}
                className={`period-btn capitalize ${filterRead === f ? 'active' : ''}`}
                aria-pressed={filterRead === f}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            suppressHydrationWarning
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="select-field"
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {Object.entries(categoryConfig).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} notifications
          </span>
          <span
            className="flex items-center gap-1.5 text-xs font-500"
            style={{ color: 'var(--success)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--success)' }}
            />
            Live
          </span>
        </div>

        <div className="card-elevated overflow-hidden">
          {loading ? (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4 px-5 py-4 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-secondary mt-2 flex-shrink-0" />
                  <div className="w-9 h-9 rounded-lg bg-secondary flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="w-48 h-4 rounded bg-secondary" />
                    <div className="w-32 h-3 rounded bg-secondary" />
                    <div className="w-full h-3 rounded bg-secondary" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Bell size={40} className="mx-auto text-muted-foreground mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">No notifications to show</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.map((notif) => {
                const tc = typeConfig[notif.type] || typeConfig['info'];
                const cc = categoryConfig[notif.category] || categoryConfig['system'];
                const TypeIcon = tc.icon;
                const CatIcon = cc.icon;
                return (
                  <div
                    key={notif.id}
                    className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
                    style={{ backgroundColor: !notif.read ? 'rgba(37,99,235,0.03)' : undefined }}
                  >
                    <div className="flex-shrink-0 mt-1.5">
                      {!notif.read ? (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: 'var(--accent)' }}
                        />
                      ) : (
                        <div className="w-2 h-2" />
                      )}
                    </div>
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: tc.bg }}
                    >
                      <TypeIcon size={16} style={{ color: tc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p
                            className={`text-sm ${!notif.read ? 'font-700 text-foreground' : 'font-600 text-foreground'}`}
                          >
                            {notif.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CatIcon size={10} />
                              {cc.label}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock size={10} />
                              {notif.timestamp}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {notif.message}
                      </p>
                      {notif.actionLabel && (
                        <Link
                          href={notificationTarget(notif.category)}
                          className="mt-2 inline-block text-xs font-600 text-accent hover:underline"
                        >
                          {notif.actionLabel} &rarr;
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notif.read && (
                        <button
                          onClick={() => markRead(notif.id)}
                          className="p-1.5 rounded hover:bg-secondary transition-colors"
                          title="Mark as read"
                        >
                          <CheckCheck size={14} className="text-muted-foreground" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="p-1.5 rounded hover:bg-secondary transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} className="text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
