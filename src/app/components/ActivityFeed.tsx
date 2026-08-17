'use client';
import PlannedAction from '@/components/ui/PlannedAction';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Clock,
  FileText,
  AlertTriangle,
  Camera,
  Building2,
  Loader2,
} from 'lucide-react';
import Icon from '@/components/ui/AppIcon';

interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  description: string;
  created_at: string;
  user_id: string | null;
  metadata?: Record<string, unknown>;
}

const actionConfig: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
  job_completed: { icon: CheckCircle2, bg: 'var(--success-bg)', color: 'var(--success)' },
  job_created: { icon: CheckCircle2, bg: 'var(--info-bg)', color: 'var(--info)' },
  issue_raised: { icon: AlertCircle, bg: 'var(--danger-bg)', color: 'var(--danger)' },
  user_invited: { icon: UserPlus, bg: 'var(--info-bg)', color: 'var(--info)' },
  clock_in: { icon: Clock, bg: 'var(--info-bg)', color: 'var(--accent)' },
  document_uploaded: { icon: FileText, bg: 'var(--muted)', color: 'var(--muted-foreground)' },
  compliance_alert: { icon: AlertTriangle, bg: 'var(--warning-bg)', color: 'var(--warning)' },
  photo_uploaded: { icon: Camera, bg: 'var(--muted)', color: 'var(--muted-foreground)' },
  company_created: { icon: Building2, bg: 'var(--success-bg)', color: 'var(--success)' },
  default: { icon: CheckCircle2, bg: 'var(--secondary)', color: 'var(--muted-foreground)' },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function ActivityFeed() {
  const { companyId } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    // Subscribe to realtime updates
    const supabase = createClient();
    const channel = supabase
      .channel('activity_log_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          setActivities((prev) => [payload.new as ActivityItem, ...prev].slice(0, 16));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadActivities = async () => {
    const supabase = createClient();
    let query = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(16);
    if (companyId) query = query.eq('company_id', companyId);
    else query = query.eq('company_id', '');
    const { data, error } = await query;
    if (!error && data) setActivities(data as ActivityItem[]);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-600 text-foreground">Recent Activity</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-600 text-foreground">Recent Activity</h3>
        </div>
        <div className="py-8 text-center">
          <CheckCircle2 size={32} className="mx-auto text-muted-foreground opacity-30 mb-2" />
          <p className="text-sm text-muted-foreground">
            No activity yet. Actions you take will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-600 text-foreground">Recent Activity</h3>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-500 text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Live
          </span>
          <PlannedAction
            className="text-xs font-600 text-accent"
            title="A full activity history view is not available yet."
          >
            View all
          </PlannedAction>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8">
        {activities.map((item) => {
          const cfg = actionConfig[item.action] || actionConfig['default'];
          const Icon = cfg.icon;
          return (
            <div
              key={item.id}
              className="flex items-start gap-3 py-3 border-b border-border last:border-0"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: cfg.bg }}
              >
                <Icon size={14} style={{ color: cfg.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-600 text-foreground leading-snug capitalize">
                  {item.action.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(item.created_at)}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs font-500 text-foreground capitalize">
                    {item.entity_type}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
