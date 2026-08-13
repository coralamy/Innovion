'use client';
import React from 'react';
import { Briefcase, CheckCircle2, Clock, DollarSign, AlertCircle, Timer, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface DashboardStats {
  todayJobs: number;
  unassignedJobs: number;
  completedJobs: number;
  totalJobs: number;
  activeContractors: number;
  openIncidents: number;
  expiredCompliance: number;
  expiringCompliance: number;
  weeklyRevenue?: number;
}

type TrendType = 'positive' | 'negative' | 'warning' | 'neutral';

const trendConfig: Record<TrendType, {
  iconBg: string;
  iconColor: string;
  valuColor: string;
  badgeBg: string;
  badgeText: string;
  accentBar: string;
}> = {
  positive: {
    iconBg: 'rgba(16,185,129,0.1)',
    iconColor: '#10B981',
    valuColor: '#0F172A',
    badgeBg: '#ECFDF5',
    badgeText: '#059669',
    accentBar: 'linear-gradient(90deg, #10B981, #34D399)',
  },
  negative: {
    iconBg: 'rgba(239,68,68,0.1)',
    iconColor: '#EF4444',
    valuColor: '#0F172A',
    badgeBg: '#FEF2F2',
    badgeText: '#DC2626',
    accentBar: 'linear-gradient(90deg, #EF4444, #F87171)',
  },
  warning: {
    iconBg: 'rgba(245,158,11,0.1)',
    iconColor: '#F59E0B',
    valuColor: '#0F172A',
    badgeBg: '#FFFBEB',
    badgeText: '#D97706',
    accentBar: 'linear-gradient(90deg, #F59E0B, #FCD34D)',
  },
  neutral: {
    iconBg: 'rgba(37,99,235,0.1)',
    iconColor: '#2563EB',
    valuColor: '#0F172A',
    badgeBg: '#EFF6FF',
    badgeText: '#2563EB',
    accentBar: 'linear-gradient(90deg, #2563EB, #60A5FA)',
  },
};

function MetricSkeleton() {
  return (
    <div className="card-elevated p-5 flex flex-col gap-3 animate-pulse relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-secondary rounded-t-xl" />
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl bg-secondary" />
        <div className="w-16 h-5 rounded-full bg-secondary" />
      </div>
      <div className="space-y-2">
        <div className="w-20 h-8 rounded-lg bg-secondary" />
        <div className="w-28 h-3 rounded bg-secondary" />
        <div className="w-20 h-2.5 rounded bg-secondary" />
      </div>
    </div>
  );
}

interface MetricCardProps {
  id: string;
  label: string;
  value: string;
  subtext: string;
  icon: React.ElementType;
  trend: TrendType;
  trendValue: string;
  trendIcon?: 'up' | 'down' | 'flat';
  index: number;
}

function MetricCard({ label, value, subtext, icon: Icon, trend, trendValue, trendIcon, index }: MetricCardProps) {
  const cfg = trendConfig[trend];
  const staggerClass = `stagger-${Math.min(index + 1, 6)}`;

  return (
    <div
      className={`card-premium relative overflow-hidden flex flex-col gap-3 p-5 animate-slide-up ${staggerClass}`}
      style={{ opacity: 0, animationFillMode: 'forwards' }}
    >
      <div className="metric-accent-bar" style={{ background: cfg.accentBar }} />
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.iconBg }}>
          <Icon size={17} style={{ color: cfg.iconColor }} />
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-600 px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeText }}>
          {trendIcon === 'up' && <TrendingUp size={10} />}
          {trendIcon === 'down' && <TrendingDown size={10} />}
          {trendIcon === 'flat' && <Minus size={10} />}
          {trendValue}
        </span>
      </div>
      <div>
        <p className="font-tabular font-800 leading-none tracking-tight" style={{ fontSize: '1.875rem', color: cfg.valuColor }}>
          {value}
        </p>
        <p className="text-[11px] font-600 uppercase tracking-wider mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </p>
        <p className="text-[12px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {subtext}
        </p>
      </div>
    </div>
  );
}

interface DashboardMetricsProps {
  /** Pre-fetched stats from /api/dashboard/summary */
  stats?: DashboardStats | null;
  loading?: boolean;
  error?: boolean;
}

export default function DashboardMetrics({ stats, loading, error }: DashboardMetricsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <MetricSkeleton key={i} />)}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card-elevated p-6 text-center">
        <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={20} style={{ color: 'var(--warning)' }} />
        </div>
        <p className="text-sm font-600 text-foreground">Unable to load metrics</p>
        <p className="text-xs text-muted-foreground mt-1">Dashboard data could not be retrieved. Please refresh the page.</p>
      </div>
    );
  }

  const completionRate = stats.totalJobs > 0 ? Math.round((stats.completedJobs / stats.totalJobs) * 100) : 0;
  const complianceIssues = stats.expiredCompliance + stats.expiringCompliance;

  const metrics: Omit<MetricCardProps, 'index'>[] = [
    {
      id: 'metric-today-jobs',
      label: "Today's Jobs",
      value: String(stats.todayJobs),
      subtext: stats.totalJobs === 0
        ? 'No jobs created yet — add your first job to get started'
        : `${stats.unassignedJobs} unassigned · ${stats.completedJobs} done`,
      icon: Briefcase,
      trend: 'neutral',
      trendValue: stats.totalJobs === 0 ? 'Ready' : `${stats.totalJobs} total`,
      trendIcon: 'flat',
    },
    {
      id: 'metric-completed',
      label: 'Completion Rate',
      value: stats.totalJobs === 0 ? '—' : `${completionRate}%`,
      subtext: stats.totalJobs === 0
        ? 'Completion rate will appear once jobs are created'
        : `${stats.completedJobs} of ${stats.totalJobs} jobs complete`,
      icon: CheckCircle2,
      trend: stats.totalJobs === 0 ? 'neutral' : completionRate >= 80 ? 'positive' : completionRate >= 50 ? 'warning' : 'negative',
      trendValue: stats.totalJobs === 0 ? 'No data' : completionRate >= 80 ? 'On track' : 'Needs attention',
      trendIcon: stats.totalJobs === 0 ? 'flat' : completionRate >= 80 ? 'up' : 'down',
    },
    {
      id: 'metric-contractors',
      label: 'Active Contractors',
      value: String(stats.activeContractors),
      subtext: stats.activeContractors > 0 ? 'Available or on-job' : 'No contractors currently active',
      icon: Clock,
      trend: stats.activeContractors > 0 ? 'positive' : 'neutral',
      trendValue: 'Live',
      trendIcon: 'flat',
    },
    {
      id: 'metric-revenue',
      label: 'Revenue This Week',
      value: stats.weeklyRevenue != null && stats.weeklyRevenue > 0
        ? `$${stats.weeklyRevenue.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
        : '$0',
      subtext: stats.weeklyRevenue != null && stats.weeklyRevenue > 0
        ? 'From submitted & paid invoices' : 'No invoices submitted this week',
      icon: DollarSign,
      trend: stats.weeklyRevenue != null && stats.weeklyRevenue > 0 ? 'positive' : 'neutral',
      trendValue: stats.weeklyRevenue != null && stats.weeklyRevenue > 0 ? 'Live' : 'Pending',
      trendIcon: stats.weeklyRevenue != null && stats.weeklyRevenue > 0 ? 'up' : 'flat',
    },
    {
      id: 'metric-incidents',
      label: 'Open Incidents',
      value: String(stats.openIncidents),
      subtext: stats.openIncidents > 0 ? 'Action required' : 'No open incidents',
      icon: Timer,
      trend: stats.openIncidents > 0 ? 'warning' : 'positive',
      trendValue: stats.openIncidents > 0 ? 'Review needed' : 'Clear',
      trendIcon: stats.openIncidents > 0 ? 'down' : 'up',
    },
    {
      id: 'metric-compliance',
      label: 'Compliance Issues',
      value: String(complianceIssues),
      subtext: complianceIssues === 0
        ? 'All compliance items are current'
        : `${stats.expiredCompliance} expired · ${stats.expiringCompliance} expiring`,
      icon: AlertCircle,
      trend: stats.expiredCompliance > 0 ? 'negative' : stats.expiringCompliance > 0 ? 'warning' : 'positive',
      trendValue: stats.expiredCompliance > 0 ? 'Urgent' : stats.expiringCompliance > 0 ? 'Monitor' : 'Compliant',
      trendIcon: stats.expiredCompliance > 0 ? 'down' : stats.expiringCompliance > 0 ? 'flat' : 'up',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
      {metrics.map((metric, i) => (
        <MetricCard key={metric.id} {...metric} index={i} />
      ))}
    </div>
  );
}