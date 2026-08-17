'use client';
import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DayData {
  day: string;
  scheduled: number;
  completed: number;
  issues: number;
}

interface WeeklyJobsChartProps {
  /** Pre-fetched data from /api/dashboard/summary — avoids a separate Supabase query */
  data?: DayData[];
  weekLabel?: string;
  loading?: boolean;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-card-md text-sm">
        <p className="font-600 text-foreground mb-2">{label}</p>
        {payload.map((entry) => (
          <div key={`tooltip-${entry.name}`} className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-600 text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function WeeklyJobsChart({ data, weekLabel, loading }: WeeklyJobsChartProps) {
  return (
    <div className="card-elevated p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-600 text-foreground">Weekly Job Completion</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? 'Loading…' : `Scheduled vs completed — ${weekLabel ?? ''}`}
          </p>
        </div>
        <span
          className="status-badge"
          style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)' }}
        >
          This Week
        </span>
      </div>
      {loading ? (
        <div className="h-[220px] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data ?? []} barGap={2} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--muted-foreground)', fontWeight: 500 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              width={28}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
              formatter={(value) => (
                <span style={{ color: 'var(--muted-foreground)', fontWeight: 500 }}>{value}</span>
              )}
            />
            <Bar
              dataKey="scheduled"
              name="Scheduled"
              fill="var(--accent)"
              radius={[3, 3, 0, 0]}
              opacity={0.4}
            />
            <Bar dataKey="completed" name="Completed" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="issues" name="Issues" fill="var(--danger)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
