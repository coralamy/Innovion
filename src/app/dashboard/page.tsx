'use client';
import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardMetrics from '../components/DashboardMetrics';
import DashboardCharts from '../components/DashboardCharts';
import ActivityFeed from '../components/ActivityFeed';
import UpcomingJobs from '../components/UpcomingJobs';
import ContractorAvailability from '../components/ContractorAvailability';
import ComplianceAlertBanner from '../components/ComplianceAlertBanner';
import { useAuth } from '@/contexts/AuthContext';
import { settingsService } from '@/lib/services/settingsService';
import { RefreshCw } from 'lucide-react';

interface DashboardData {
  metrics: {
    todayJobs: number;
    unassignedJobs: number;
    completedJobs: number;
    totalJobs: number;
    activeContractors: number;
    openIncidents: number;
    expiredCompliance: number;
    expiringCompliance: number;
    weeklyRevenue: number;
  };
  upcomingJobs: Array<{ id: string; job_number: string; site: string; assigned_to: string; scheduled_time: string; job_status: string }>;
  recentActivity: Array<{ id: string; action: string; entity_type: string; description: string; created_at: string; user_id: string; metadata: unknown }>;
  weeklyJobsData: Array<{ day: string; scheduled: number; completed: number; issues: number }>;
  weekLabel: string;
  serviceTypeData: Array<{ name: string; value: number }>;
  contractorStatus: Array<{ id: string; name: string; initials: string; status: string; utilization: number }>;
}

export default function DashboardPage() {
  const { user, companyId } = useAuth();
  const [companyName, setCompanyName] = useState<string>('');
  const [nameLoaded, setNameLoaded] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    settingsService.get(companyId).then((settings) => {
      setCompanyName(settings?.companyName || user?.user_metadata?.company_name || 'Your Company');
      setNameLoaded(true);
    }).catch(() => {
      setCompanyName(user?.user_metadata?.company_name || 'Your Company');
      setNameLoaded(true);
    });
  }, [companyId, user]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDashboardData(json.data ?? null);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    setLoading(true);
    fetchDashboard().finally(() => setTimeout(() => setRefreshing(false), 600));
  };

  return (
    <AppLayout currentPath="/dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[1.375rem] font-800 tracking-tight" style={{ color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              Operations Dashboard
            </h1>
            <p className="text-[13px] mt-1 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
              {nameLoaded ? (
                <>
                  <span className="font-500" style={{ color: 'var(--foreground)' }}>{companyName}</span>
                  <span className="opacity-40">·</span>
                  <DashboardDate />
                </>
              ) : (
                <span className="inline-block w-48 h-3 rounded-md bg-secondary animate-pulse" />
              )}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-600"
              style={{ backgroundColor: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.15)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Live
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-500 transition-all duration-150 hover:scale-105 active:scale-95"
              style={{ backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
              aria-label="Refresh dashboard"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} style={{ transition: 'transform 300ms ease' }} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Compliance alert banner */}
        <ComplianceAlertBanner />

        {/* KPI metrics — data from single API call */}
        <DashboardMetrics stats={dashboardData?.metrics} loading={loading} error={error} />

        {/* Charts + Activity + Jobs */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <DashboardCharts
              weeklyJobsData={dashboardData?.weeklyJobsData}
              weekLabel={dashboardData?.weekLabel}
              serviceTypeData={dashboardData?.serviceTypeData}
              loading={loading}
            />
          </div>
          <div className="space-y-6">
            <UpcomingJobs />
            <ContractorAvailability
              contractors={dashboardData?.contractorStatus}
              loading={loading}
            />
          </div>
        </div>

        {/* Activity feed full width */}
        <ActivityFeed />
      </div>
    </AppLayout>
  );
}

function DashboardDate() {
  const [dateStr, setDateStr] = useState('');
  useEffect(() => {
    const d = new Date();
    setDateStr(d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  }, []);
  return <span>{dateStr}</span>;
}
