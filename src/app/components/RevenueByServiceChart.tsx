'use client';
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface ServiceData {
  name: string;
  value: number;
}

interface RevenueByServiceChartProps {
  /** Pre-fetched data from /api/dashboard/summary */
  data?: ServiceData[];
  loading?: boolean;
}

const SERVICE_COLORS: Record<string, string> = {
  'Commercial Cleaning': 'var(--accent)',
  'Maintenance': 'var(--success)',
  'Inspections': 'var(--warning)',
  'Emergency': 'var(--danger)',
  'Other': 'var(--info)',
};
const FALLBACK_COLORS = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--danger)', 'var(--info)'];

const CustomTooltip = ({ active, payload, total }: { active?: boolean; payload?: Array<{ name: string; value: number }>; total: number }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-card-md text-sm">
        <p className="font-600 text-foreground">{item.name}</p>
        <p className="text-muted-foreground mt-1">
          <span className="font-700 text-foreground">{item.value} jobs</span>
          {' '}· {pct}%
        </p>
      </div>
    );
  }
  return null;
};

export default function RevenueByServiceChart({ data = [], loading }: RevenueByServiceChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const enriched = data.map((d, idx) => ({
    ...d,
    color: SERVICE_COLORS[d.name] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
  }));

  return (
    <div className="card-elevated p-5 h-full">
      <div className="mb-4">
        <h3 className="text-base font-600 text-foreground">Jobs by Service Type</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {loading ? 'Loading…' : `All time · ${total} total jobs`}
        </p>
      </div>
      {loading ? (
        <div className="h-[180px] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : enriched.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No job data yet</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={enriched} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
                {enriched.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip total={total} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {enriched.map((item, idx) => (
              <div key={`legend-${idx}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground truncate">{item.name}</span>
                </div>
                <span className="font-600 text-foreground font-tabular">{item.value} jobs</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}