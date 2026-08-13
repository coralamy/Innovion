'use client';
import React from 'react';
import dynamic from 'next/dynamic';

const WeeklyJobsChart = dynamic(() => import('./WeeklyJobsChart'), { ssr: false });
const RevenueByServiceChart = dynamic(() => import('./RevenueByServiceChart'), { ssr: false });

interface ServiceData { name: string; value: number; }
interface DayData { day: string; scheduled: number; completed: number; issues: number; }

interface DashboardChartsProps {
  weeklyJobsData?: DayData[];
  weekLabel?: string;
  serviceTypeData?: ServiceData[];
  loading?: boolean;
}

export default function DashboardCharts({ weeklyJobsData, weekLabel, serviceTypeData, loading }: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3">
        <WeeklyJobsChart data={weeklyJobsData} weekLabel={weekLabel} loading={loading} />
      </div>
      <div className="lg:col-span-2">
        <RevenueByServiceChart data={serviceTypeData} loading={loading} />
      </div>
    </div>
  );
}