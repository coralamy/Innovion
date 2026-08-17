'use client';
import React, { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { employeeService, EmployeeRecord } from '@/lib/services/employeeService';
import { contractorService, Contractor } from '@/lib/services/contractorService';

import {
  Users,
  UserCheck,
  Clock,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  Filter,
  BarChart2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import Icon from '@/components/ui/AppIcon';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkforceEntry {
  id: string;
  name: string;
  role: string;
  type: 'employee' | 'contractor';
  status: string;
  hoursThisWeek: number;
  hoursCapacity: number;
  jobsCompleted: number;
  department?: string;
  utilization: number;
}

interface DeptCapacity {
  department: string;
  allocated: number;
  capacity: number;
  headcount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function utilizationColor(pct: number): string {
  if (pct >= 90) return 'var(--danger)';
  if (pct >= 75) return 'var(--warning)';
  if (pct >= 40) return 'var(--success)';
  return 'var(--muted-foreground)';
}

function utilizationBg(pct: number): string {
  if (pct >= 90) return 'rgba(239,68,68,0.08)';
  if (pct >= 75) return 'rgba(245,158,11,0.08)';
  if (pct >= 40) return 'rgba(16,185,129,0.08)';
  return 'rgba(100,116,139,0.06)';
}

function utilizationLabel(pct: number): string {
  if (pct >= 90) return 'Over capacity';
  if (pct >= 75) return 'High load';
  if (pct >= 40) return 'Active';
  return 'Under-utilised';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPICard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="card-elevated p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon size={17} style={{ color }} />
        </div>
      </div>
      <div>
        <p className="font-tabular font-800 text-[1.75rem] leading-none tracking-tight text-foreground">
          {value}
        </p>
        <p className="text-[11px] font-600 uppercase tracking-wider mt-1.5 text-muted-foreground">
          {label}
        </p>
        <p className="text-[12px] mt-1 text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function CapacityBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--secondary)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, backgroundColor: utilizationColor(pct) }}
        />
      </div>
      <span
        className="text-xs font-600 font-tabular w-10 text-right flex-shrink-0"
        style={{ color: utilizationColor(pct) }}
      >
        {pct}%
      </span>
    </div>
  );
}

const CustomBarTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-card-md text-sm">
        <p className="font-600 text-foreground mb-2">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-600 text-foreground">{p.value}h</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkforceCapacityPage() {
  const { companyId } = useAuth();
  const [workforce, setWorkforce] = useState<WorkforceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'employee' | 'contractor'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'utilization' | 'hours' | 'name'>('utilization');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [employees, contractors] = await Promise.all([
          employeeService.getAll(companyId),
          contractorService.getAll(companyId),
        ]);

        const empEntries: WorkforceEntry[] = employees.map((e: EmployeeRecord) => {
          const capacity =
            e.employmentType === 'full-time' ? 40 : e.employmentType === 'part-time' ? 20 : 15;
          const hours = e.hoursThisWeek ?? 0;
          return {
            id: e.id,
            name: e.name,
            role: e.role,
            type: 'employee',
            status: e.status,
            hoursThisWeek: hours,
            hoursCapacity: capacity,
            jobsCompleted: e.jobsCompleted ?? 0,
            department: e.department,
            utilization: capacity > 0 ? Math.round((hours / capacity) * 100) : 0,
          };
        });

        const conEntries: WorkforceEntry[] = contractors.map((c: Contractor) => {
          const hours = c.hoursThisWeek ?? 0;
          const capacity = 40;
          return {
            id: c.id,
            name: c.name,
            role: c.role,
            type: 'contractor',
            status: c.availability,
            hoursThisWeek: hours,
            hoursCapacity: capacity,
            jobsCompleted: c.jobsCompleted ?? 0,
            utilization: Math.round((hours / capacity) * 100),
          };
        });

        setWorkforce([...empEntries, ...conEntries]);
      } catch {
        setWorkforce([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = workforce;
    if (filterType !== 'all') list = list.filter((w) => w.type === filterType);
    if (filterStatus !== 'all') list = list.filter((w) => w.status === filterStatus);
    return [...list].sort((a, b) => {
      if (sortBy === 'utilization') return b.utilization - a.utilization;
      if (sortBy === 'hours') return b.hoursThisWeek - a.hoursThisWeek;
      return a.name.localeCompare(b.name);
    });
  }, [workforce, filterType, filterStatus, sortBy]);

  const kpis = useMemo(() => {
    const active = workforce.filter(
      (w) => w.status === 'active' || w.status === 'available' || w.status === 'on-job'
    );
    const totalHours = workforce.reduce((s, w) => s + w.hoursThisWeek, 0);
    const totalCapacity = workforce.reduce((s, w) => s + w.hoursCapacity, 0);
    const overloaded = workforce.filter((w) => w.utilization >= 90).length;
    const avgUtil =
      workforce.length > 0
        ? Math.round(workforce.reduce((s, w) => s + w.utilization, 0) / workforce.length)
        : 0;
    return { active: active.length, totalHours, totalCapacity, overloaded, avgUtil };
  }, [workforce]);

  const deptData: DeptCapacity[] = useMemo(() => {
    const map: Record<string, { allocated: number; capacity: number; headcount: number }> = {};
    workforce.forEach((w) => {
      const dept = w.department || (w.type === 'contractor' ? 'Contractors' : 'General');
      if (!map[dept]) map[dept] = { allocated: 0, capacity: 0, headcount: 0 };
      map[dept].allocated += w.hoursThisWeek;
      map[dept].capacity += w.hoursCapacity;
      map[dept].headcount++;
    });
    return Object.entries(map)
      .map(([department, v]) => ({ department, ...v }))
      .sort((a, b) => b.allocated - a.allocated);
  }, [workforce]);

  const allStatuses = useMemo(() => {
    const s = new Set(workforce.map((w) => w.status));
    return Array.from(s);
  }, [workforce]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout currentPath="/workforce-capacity">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-[1.375rem] font-800 tracking-tight text-foreground"
              style={{ letterSpacing: '-0.02em' }}
            >
              Workforce Capacity
            </h1>
            <p className="text-[13px] mt-1 text-muted-foreground">
              Real-time utilisation across employees and contractors
            </p>
          </div>
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-600"
            style={{
              backgroundColor: 'rgba(16,185,129,0.08)',
              color: '#059669',
              border: '1px solid rgba(16,185,129,0.15)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Live
          </div>
        </div>

        {/* KPI row */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-elevated p-5 animate-pulse space-y-3">
                <div className="w-9 h-9 rounded-xl bg-secondary" />
                <div className="w-16 h-7 rounded bg-secondary" />
                <div className="w-24 h-3 rounded bg-secondary" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              icon={Users}
              label="Total Workforce"
              value={String(workforce.length)}
              sub={`${kpis.active} active now`}
              color="#2563EB"
            />
            <KPICard
              icon={Clock}
              label="Hours This Week"
              value={`${kpis.totalHours}h`}
              sub={`of ${kpis.totalCapacity}h capacity`}
              color="#10B981"
            />
            <KPICard
              icon={TrendingUp}
              label="Avg Utilisation"
              value={`${kpis.avgUtil}%`}
              sub="across all workforce"
              color="#F59E0B"
            />
            <KPICard
              icon={AlertTriangle}
              label="Over Capacity"
              value={String(kpis.overloaded)}
              sub="members at ≥90%"
              color="#EF4444"
            />
          </div>
        )}

        {/* Department capacity chart */}
        {!loading && deptData.length > 0 && (
          <div className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={16} className="text-muted-foreground" />
              <h2 className="text-base font-600 text-foreground">Capacity by Department</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deptData} barGap={4} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="department"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontWeight: 500 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  width={32}
                  unit="h"
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar
                  dataKey="capacity"
                  name="Capacity"
                  fill="var(--secondary)"
                  radius={[3, 3, 0, 0]}
                >
                  {deptData.map((_, idx) => (
                    <Cell key={`cap-${idx}`} fill="rgba(100,116,139,0.15)" />
                  ))}
                </Bar>
                <Bar dataKey="allocated" name="Allocated" radius={[3, 3, 0, 0]}>
                  {deptData.map((entry, idx) => {
                    const pct = entry.capacity > 0 ? (entry.allocated / entry.capacity) * 100 : 0;
                    return <Cell key={`alloc-${idx}`} fill={utilizationColor(pct)} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter size={13} />
            <span className="font-500">Filter:</span>
          </div>
          {/* Type filter */}
          <div
            className="flex rounded-lg overflow-hidden border"
            style={{ borderColor: 'var(--border)' }}
          >
            {(['all', 'employee', 'contractor'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className="px-3 py-1.5 text-xs font-600 transition-colors capitalize"
                style={{
                  backgroundColor: filterType === t ? 'var(--accent)' : 'var(--card)',
                  color: filterType === t ? 'white' : 'var(--muted-foreground)',
                }}
              >
                {t === 'all' ? 'All' : t === 'employee' ? 'Employees' : 'Contractors'}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs font-600 rounded-lg border bg-card focus:outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <option value="all">All Statuses</option>
              {allStatuses.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>
          {/* Sort */}
          <div className="relative ml-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs font-600 rounded-lg border bg-card focus:outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <option value="utilization">Sort: Utilisation</option>
              <option value="hours">Sort: Hours</option>
              <option value="name">Sort: Name</option>
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>
        </div>

        {/* Workforce table */}
        <div className="card-elevated overflow-hidden">
          {/* Table header */}
          <div
            className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground"
            style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}
          >
            <div className="col-span-3">Name / Role</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Hours</div>
            <div className="col-span-3">Utilisation</div>
          </div>

          {loading ? (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-secondary flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 rounded bg-secondary" />
                    <div className="h-2.5 w-20 rounded bg-secondary" />
                  </div>
                  <div className="hidden md:block w-24 h-2 rounded bg-secondary" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                <Users size={20} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-600 text-foreground">No workforce members found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.map((w) => (
                <div
                  key={w.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-5 py-4 items-center transition-colors hover:bg-secondary/30"
                >
                  {/* Name */}
                  <div className="md:col-span-3 flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-700 flex-shrink-0"
                      style={{
                        backgroundColor: w.type === 'employee' ? 'var(--accent)' : 'var(--success)',
                      }}
                    >
                      {w.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-600 text-foreground truncate">{w.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{w.role}</p>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="md:col-span-2">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-600"
                      style={{
                        backgroundColor:
                          w.type === 'employee' ? 'rgba(37,99,235,0.08)' : 'rgba(16,185,129,0.08)',
                        color: w.type === 'employee' ? '#2563EB' : '#059669',
                      }}
                    >
                      {w.type === 'employee' ? <Users size={10} /> : <UserCheck size={10} />}
                      {w.type === 'employee' ? 'Employee' : 'Contractor'}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="md:col-span-2">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-600 capitalize"
                      style={{
                        backgroundColor: utilizationBg(w.utilization),
                        color: utilizationColor(w.utilization),
                      }}
                    >
                      {w.status.replace('-', ' ')}
                    </span>
                  </div>

                  {/* Hours */}
                  <div className="md:col-span-2">
                    <p className="text-sm font-600 text-foreground font-tabular">
                      {w.hoursThisWeek}h
                      <span className="text-xs font-400 text-muted-foreground">
                        {' '}
                        / {w.hoursCapacity}h
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">{w.jobsCompleted} jobs done</p>
                  </div>

                  {/* Utilisation bar */}
                  <div className="md:col-span-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[11px] font-500 text-muted-foreground">
                        {utilizationLabel(w.utilization)}
                      </span>
                    </div>
                    <CapacityBar pct={w.utilization} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer summary */}
          {!loading && filtered.length > 0 && (
            <div
              className="px-5 py-3 flex items-center justify-between text-xs text-muted-foreground"
              style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}
            >
              <span>
                {filtered.length} of {workforce.length} members shown
              </span>
              <span>
                Total: {filtered.reduce((s, w) => s + w.hoursThisWeek, 0)}h allocated /{' '}
                {filtered.reduce((s, w) => s + w.hoursCapacity, 0)}h capacity
              </span>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
