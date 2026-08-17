'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface KPI {
  label: string;
  value: string;
  change: string;
  up: boolean;
  icon: React.ElementType;
  color: string;
}

interface MonthlyJobData {
  month: string;
  completed: number;
  scheduled: number;
  cancelled: number;
}

interface ComplianceRate {
  month: string;
  rate: number;
}

interface ServiceBreakdownItem {
  name: string;
  value: number;
  color: string;
}

const SERVICE_COLORS = [
  '#2563EB',
  '#10B981',
  '#8B5CF6',
  '#F59E0B',
  '#EF4444',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#94A3B8',
];

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="card-elevated p-3 text-xs shadow-lg">
        <p className="font-700 text-foreground mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-600">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Skeleton loader component
function SkeletonCard() {
  return (
    <div className="card-elevated p-4 animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="w-7 h-7 rounded-lg bg-secondary" />
        <div className="w-10 h-4 rounded bg-secondary" />
      </div>
      <div className="w-16 h-6 rounded bg-secondary mb-1" />
      <div className="w-24 h-3 rounded bg-secondary" />
    </div>
  );
}

export default function ReportsPage() {
  const { companyId } = useAuth();
  const [period, setPeriod] = useState('6m');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [jobsData, setJobsData] = useState<MonthlyJobData[]>([]);
  const [complianceData, setComplianceData] = useState<ComplianceRate[]>([]);
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdownItem[]>([]);

  useEffect(() => {
    loadReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, period]);

  const loadReportData = async () => {
    setLoading(true);
    const supabase = createClient();

    const monthsBack = period === '1m' ? 1 : period === '3m' ? 3 : period === '1y' ? 12 : 6;
    const now = new Date();

    // Jobs data by month
    const monthlyJobs: MonthlyJobData[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];

      let q = supabase
        .from('jobs')
        .select('job_status')
        .gte('scheduled_date', start)
        .lte('scheduled_date', end);
      if (companyId) q = q.eq('company_id', companyId);
      const { data: jobRows } = await q;

      const completed = jobRows?.filter((j) => j.job_status === 'completed').length || 0;
      const cancelled = jobRows?.filter((j) => j.job_status === 'cancelled').length || 0;
      const total = jobRows?.length || 0;

      monthlyJobs.push({ month: MONTHS[d.getMonth()], completed, scheduled: total, cancelled });
    }
    setJobsData(monthlyJobs);

    // Service breakdown from real job types
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
      .toISOString()
      .split('T')[0];
    let typeQuery = supabase.from('jobs').select('type').gte('scheduled_date', periodStart);
    if (companyId) typeQuery = typeQuery.eq('company_id', companyId);
    const { data: typeRows } = await typeQuery;

    if (typeRows && typeRows.length > 0) {
      const typeCounts: Record<string, number> = {};
      typeRows.forEach((r) => {
        const t = r.type || 'Other';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });
      const total = typeRows.length;
      const breakdown = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count], idx) => ({
          name,
          value: Math.round((count / total) * 100),
          color: SERVICE_COLORS[idx % SERVICE_COLORS.length],
        }));
      // Ensure values sum to 100
      const sum = breakdown.reduce((s, b) => s + b.value, 0);
      if (breakdown.length > 0 && sum < 100) {
        breakdown[breakdown.length - 1].value += 100 - sum;
      }
      setServiceBreakdown(breakdown);
    } else {
      // No data yet — show empty state
      setServiceBreakdown([]);
    }

    // Compliance data
    const compMonths: ComplianceRate[] = [];
    for (let i = Math.min(monthsBack, 6) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      let q = supabase.from('compliance_items').select('comp_status');
      if (companyId) q = q.eq('company_id', companyId);
      const { data: compRows } = await q;
      const total = compRows?.length || 0;
      const compliant = compRows?.filter((c) => c.comp_status === 'compliant').length || 0;
      const rate = total > 0 ? Math.round((compliant / total) * 100) : 95;
      compMonths.push({ month: MONTHS[d.getMonth()], rate });
    }
    setComplianceData(compMonths);

    // Contractor count
    let cq = supabase.from('contractors').select('id', { count: 'exact', head: true });
    if (companyId) cq = cq.eq('company_id', companyId);
    const { count: cCount } = await cq;

    // KPIs
    const lastMonth = monthlyJobs[monthlyJobs.length - 1] || {
      completed: 0,
      scheduled: 0,
      cancelled: 0,
      month: '',
    };
    const completionRate =
      lastMonth.scheduled > 0
        ? ((lastMonth.completed / lastMonth.scheduled) * 100).toFixed(1)
        : '—';
    const lastCompRate = compMonths[compMonths.length - 1]?.rate || 95;

    setKpis([
      {
        label: 'Jobs Completed',
        value: String(lastMonth.completed || 0),
        change: '+live',
        up: true,
        icon: Briefcase,
        color: '#2563EB',
      },
      {
        label: 'Active Contractors',
        value: String(cCount || 0),
        change: 'live',
        up: true,
        icon: Users,
        color: '#8B5CF6',
      },
      {
        label: 'Completion Rate',
        value: `${completionRate}%`,
        change: 'live',
        up: true,
        icon: CheckCircle2,
        color: '#10B981',
      },
      {
        label: 'Compliance Score',
        value: `${lastCompRate}%`,
        change: 'live',
        up: lastCompRate >= 90,
        icon: AlertTriangle,
        color: '#F97316',
      },
      {
        label: 'Jobs Scheduled',
        value: String(lastMonth.scheduled || 0),
        change: 'live',
        up: true,
        icon: Clock,
        color: '#F59E0B',
      },
      {
        label: 'Jobs Cancelled',
        value: String(lastMonth.cancelled || 0),
        change: 'live',
        up: false,
        icon: DollarSign,
        color: '#EF4444',
      },
    ]);

    setLoading(false);
  };

  const exportCSV = () => {
    const headers = [
      'Month',
      'Completed Jobs',
      'Scheduled Jobs',
      'Cancelled Jobs',
      'Compliance Rate',
    ];
    const rows = jobsData.map((j, i) => [
      j.month,
      j.completed,
      j.scheduled,
      j.cancelled,
      complianceData[i]?.rate ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `innovion-report-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Innovion Report — ${period}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; color: #111; }
    h1 { color: #2563EB; } h2 { color: #374151; font-size: 16px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 12px; }
    td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
    .kpi { background: #f9fafb; border-radius: 8px; padding: 16px; }
    .kpi-value { font-size: 24px; font-weight: bold; color: #2563EB; }
    .kpi-label { font-size: 12px; color: #6B7280; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>Innovion Operations Report</h1>
  <p>Period: ${period.toUpperCase()} · Generated: ${new Date().toLocaleDateString('en-AU')}</p>
  <div class="kpi-grid">
    ${kpis.map((k) => `<div class="kpi"><div class="kpi-value">${k.value}</div><div class="kpi-label">${k.label}</div></div>`).join('')}
  </div>
  <h2>Monthly Jobs Overview</h2>
  <table>
    <thead><tr><th>Month</th><th>Completed</th><th>Scheduled</th><th>Cancelled</th></tr></thead>
    <tbody>${jobsData.map((j) => `<tr><td>${j.month}</td><td>${j.completed}</td><td>${j.scheduled}</td><td>${j.cancelled}</td></tr>`).join('')}</tbody>
  </table>
  <h2>Compliance Rate</h2>
  <table>
    <thead><tr><th>Month</th><th>Compliance Rate</th></tr></thead>
    <tbody>${complianceData.map((c) => `<tr><td>${c.month}</td><td>${c.rate}%</td></tr>`).join('')}</tbody>
  </table>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) w.print();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout currentPath="/reports">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header-title">Reports</h1>
            <p className="page-header-subtitle">
              Live operational dashboards and performance metrics
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="period-selector">
              {['1m', '3m', '6m', '1y'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`period-btn ${period === p ? 'active' : ''}`}
                  aria-pressed={period === p}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={exportCSV}
              className="btn-secondary text-sm py-2 px-3"
              aria-label="Export CSV"
            >
              <Download size={14} />
              CSV
            </button>
            <button
              onClick={exportPDF}
              className="btn-primary text-sm py-2 px-3"
              aria-label="Export PDF"
            >
              <FileText size={14} />
              PDF
            </button>
          </div>
        </div>

        {loading ? (
          <>
            {/* KPI skeletons */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            {/* Chart skeletons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[0, 1].map((i) => (
                <div key={i} className="card-elevated p-5 animate-pulse">
                  <div className="w-40 h-4 rounded bg-secondary mb-4" />
                  <div className="h-[220px] rounded-lg bg-secondary" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="card-elevated p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${kpi.color}18` }}>
                      <kpi.icon size={14} style={{ color: kpi.color }} />
                    </div>
                    <span
                      className={`text-xs font-600 flex items-center gap-0.5 ${kpi.up ? 'text-success' : 'text-danger'}`}
                    >
                      {kpi.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {kpi.change}
                    </span>
                  </div>
                  <p className="text-lg font-700 text-foreground font-tabular">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card-elevated p-5">
                <h3 className="text-sm font-700 text-foreground mb-4">Jobs Overview (Live)</h3>
                {jobsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={jobsData} barGap={4}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="completed"
                        name="Completed"
                        fill="#2563EB"
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        dataKey="scheduled"
                        name="Scheduled"
                        fill="#93C5FD"
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        dataKey="cancelled"
                        name="Cancelled"
                        fill="#FCA5A5"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      No job data yet. Create jobs to see trends.
                    </p>
                  </div>
                )}
              </div>

              <div className="card-elevated p-5">
                <h3 className="text-sm font-700 text-foreground mb-4">
                  Compliance Rate Trend (Live)
                </h3>
                {complianceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={complianceData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[70, 100]}
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        name="Compliance %"
                        stroke="#8B5CF6"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#8B5CF6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No compliance data yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Service breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="card-elevated p-5">
                <h3 className="text-sm font-700 text-foreground mb-4">Service Breakdown (Live)</h3>
                {serviceBreakdown.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={serviceBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {serviceBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value}%`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">
                      {serviceBreakdown.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-muted-foreground">{item.name}</span>
                          </div>
                          <span className="font-600 text-foreground">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[200px] flex items-center justify-center flex-col gap-2">
                    <Briefcase size={32} className="text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground text-center">
                      No job data yet.
                      <br />
                      Create jobs to see service breakdown.
                    </p>
                  </div>
                )}
              </div>

              {/* Contractor performance placeholder */}
              <div className="card-elevated p-5 lg:col-span-2">
                <h3 className="text-sm font-700 text-foreground mb-4">Period Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      label: 'Total Jobs This Period',
                      value: jobsData.reduce((s, m) => s + m.scheduled, 0),
                    },
                    { label: 'Completed', value: jobsData.reduce((s, m) => s + m.completed, 0) },
                    { label: 'Cancelled', value: jobsData.reduce((s, m) => s + m.cancelled, 0) },
                    {
                      label: 'Completion Rate',
                      value: (() => {
                        const total = jobsData.reduce((s, m) => s + m.scheduled, 0);
                        const done = jobsData.reduce((s, m) => s + m.completed, 0);
                        return total > 0 ? `${((done / total) * 100).toFixed(1)}%` : '—';
                      })(),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-4 rounded-xl"
                      style={{ backgroundColor: 'var(--secondary)' }}
                    >
                      <p className="text-2xl font-700 text-foreground font-tabular">{item.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
