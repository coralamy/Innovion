'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { employeeService, EmployeeRecord } from '@/lib/services/employeeService';
import { contractorService, Contractor } from '@/lib/services/contractorService';
import { createClient } from '@/lib/supabase/client';
import { Users, UserCheck, Search, RefreshCw, ChevronLeft, ChevronRight, MoreHorizontal, MapPin, Phone, Mail, Star, Briefcase, Clock, CheckCircle2, AlertCircle, XCircle, Calendar, Eye, Edit2, UserPlus, X,  } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


// ── Types ─────────────────────────────────────────────────────────────────────

type WorkerType = 'employee' | 'contractor';

interface RosterEntry {
  id: string;
  name: string;
  role: string;
  department: string;
  type: WorkerType;
  status: string;
  employmentType?: string;
  location: string;
  phone: string;
  email: string;
  hoursThisWeek: number;
  jobsCompleted: number;
  rating: number;
  initials: string;
  color: string;
  skills: string[];
  complianceStatus?: string;
  startDate?: string;
  hourlyRate?: string;
  abn?: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active:      { bg: 'var(--success-bg)',  text: 'var(--success)',          dot: 'var(--success)',          label: 'Active' },
  'on-leave':  { bg: 'var(--warning-bg)',  text: 'var(--warning)',          dot: 'var(--warning)',          label: 'On Leave' },
  terminated:  { bg: 'var(--danger-bg)',   text: 'var(--danger)',           dot: 'var(--danger)',           label: 'Terminated' },
  available:   { bg: 'var(--success-bg)',  text: 'var(--success)',          dot: 'var(--success)',          label: 'Available' },
  'on-job':    { bg: 'var(--info-bg)',     text: 'var(--info)',             dot: 'var(--info)',             label: 'On Job' },
  unavailable: { bg: 'var(--secondary)',   text: 'var(--muted-foreground)', dot: 'var(--muted-foreground)', label: 'Unavailable' },
  leave:       { bg: 'var(--warning-bg)',  text: 'var(--warning)',          dot: 'var(--warning)',          label: 'On Leave' },
};

const complianceConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  compliant: { icon: CheckCircle2, color: 'var(--success)', label: 'Compliant' },
  expiring:  { icon: AlertCircle,  color: 'var(--warning)', label: 'Expiring' },
  expired:   { icon: XCircle,      color: 'var(--danger)',  label: 'Expired' },
};

const PAGE_SIZE = 20;

// ── Sub-components ────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={10}
          fill={s <= Math.round(rating) ? '#F59E0B' : 'none'}
          stroke={s <= Math.round(rating) ? '#F59E0B' : '#CBD5E1'}
        />
      ))}
      <span className="ml-1 text-[11px] font-600 text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

function KPICard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: string | number; sub: string; color: string;
}) {
  return (
    <div className="card-elevated p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
        <Icon size={17} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-800 font-tabular text-foreground leading-none">{value}</p>
        <p className="text-[11px] font-600 uppercase tracking-wider mt-1 text-muted-foreground">{label}</p>
        <p className="text-[11px] mt-0.5 text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function WorkerDetailPanel({ worker, onClose, canManage }: {
  worker: RosterEntry; onClose: () => void; canManage: boolean;
}) {
  const sc = statusConfig[worker.status] || statusConfig['unavailable'];
  const cc = worker.complianceStatus ? (complianceConfig[worker.complianceStatus] || complianceConfig['compliant']) : null;
  const CompIcon = cc?.icon;

  return (
    <div className="card-elevated p-5 space-y-4 sticky top-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-700 text-white flex-shrink-0"
            style={{ backgroundColor: worker.color }}
          >
            {worker.initials}
          </div>
          <div>
            <h3 className="font-700 text-foreground">{worker.name}</h3>
            <p className="text-xs text-muted-foreground">{worker.role}</p>
            <span
              className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-600"
              style={{ backgroundColor: sc.bg, color: sc.text }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
              {sc.label}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-600 capitalize"
          style={{
            backgroundColor: worker.type === 'employee' ? 'rgba(37,99,235,0.1)' : 'rgba(139,92,246,0.1)',
            color: worker.type === 'employee' ? '#2563EB' : '#8B5CF6',
          }}
        >
          {worker.type}
        </span>
        {worker.employmentType && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-600 capitalize" style={{ backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
            {worker.employmentType}
          </span>
        )}
        {cc && CompIcon && (
          <span className="flex items-center gap-1 text-[10px] font-600" style={{ color: cc.color }}>
            <CompIcon size={11} />{cc.label}
          </span>
        )}
      </div>

      {/* Contact */}
      <div className="space-y-2">
        {[
          { icon: Phone, label: worker.phone },
          { icon: Mail, label: worker.email },
          { icon: MapPin, label: worker.location },
        ].filter((i) => i.label).map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <item.icon size={12} className="text-muted-foreground flex-shrink-0" />
            <span className="text-foreground truncate">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Hours/Week', value: `${worker.hoursThisWeek}h` },
          { label: 'Jobs Done', value: worker.jobsCompleted },
          ...(worker.hourlyRate ? [{ label: 'Hourly Rate', value: worker.hourlyRate }] : []),
          ...(worker.abn ? [{ label: 'ABN', value: worker.abn }] : []),
          ...(worker.startDate ? [{ label: 'Start Date', value: worker.startDate }] : []),
          ...(worker.department ? [{ label: 'Department', value: worker.department }] : []),
        ].map((m) => (
          <div key={m.label} className="p-2.5 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
            <p className="text-sm font-700 text-foreground font-tabular">{m.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Rating */}
      <div>
        <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-1.5">Performance Rating</p>
        <StarRating rating={worker.rating} />
      </div>

      {/* Skills */}
      {worker.skills.length > 0 && (
        <div>
          <p className="text-[10px] font-600 uppercase tracking-wider text-muted-foreground mb-1.5">Skills</p>
          <div className="flex flex-wrap gap-1">
            {worker.skills.map((s) => (
              <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-500" style={{ backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {canManage && (
        <div className="flex gap-2 pt-1">
          <button className="flex-1 py-2 rounded-lg text-xs font-600 text-white transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
            Assign Job
          </button>
          <button className="flex-1 py-2 rounded-lg text-xs font-600 border transition-colors hover:bg-secondary" style={{ borderColor: 'var(--border)' }}>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkforceRosterPage() {
  const { companyId } = useAuth();
  const { hasPermission } = useRBAC();
  const canManage = hasPermission('canManageUsers');

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RosterEntry | null>(null);
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'employee' | 'contractor'>('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'hours' | 'rating' | 'jobs'>('name');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [emps, cons] = await Promise.all([
        employeeService.getAll(companyId),
        contractorService.getAll(companyId),
      ]);
      setEmployees(emps);
      setContractors(cons);
    } catch {
      setError('Failed to load workforce roster. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();

    // Real-time subscription for employee/contractor changes
    const supabase = createClient();
    const channel = supabase
      .channel('roster-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees', ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}) }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contractors', ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}) }, () => load(true))
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Merge into unified roster
  const roster: RosterEntry[] = useMemo(() => {
    const empEntries: RosterEntry[] = employees.map((e) => ({
      id: `emp-${e.id}`,
      name: e.name,
      role: e.role,
      department: e.department,
      type: 'employee' as WorkerType,
      status: e.status,
      employmentType: e.employmentType,
      location: e.location,
      phone: e.phone,
      email: e.email,
      hoursThisWeek: e.hoursThisWeek,
      jobsCompleted: e.jobsCompleted,
      rating: e.rating,
      initials: e.initials,
      color: e.color,
      skills: e.skills,
      startDate: e.startDate,
    }));

    const conEntries: RosterEntry[] = contractors.map((c) => ({
      id: `con-${c.id}`,
      name: c.name,
      role: c.role,
      department: 'Contractors',
      type: 'contractor' as WorkerType,
      status: c.availability,
      location: c.location,
      phone: c.phone,
      email: c.email,
      hoursThisWeek: c.hoursThisWeek ?? 0,
      jobsCompleted: c.jobsCompleted,
      rating: c.rating,
      initials: c.initials,
      color: c.color || 'var(--accent)',
      skills: c.skills ?? [],
      complianceStatus: c.complianceStatus,
      hourlyRate: c.hourlyRate?.toString(),
      abn: c.abn,
    }));

    return [...empEntries, ...conEntries];
  }, [employees, contractors]);

  const departments = useMemo(() => Array.from(new Set(roster.map((r) => r.department))).sort(), [roster]);

  const filtered = useMemo(() => {
    let list = roster;
    if (filterType !== 'all') list = list.filter((r) => r.type === filterType);
    if (filterStatus !== 'all') list = list.filter((r) => r.status === filterStatus);
    if (filterDept !== 'all') list = list.filter((r) => r.department === filterDept);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'hours') return b.hoursThisWeek - a.hoursThisWeek;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'jobs') return b.jobsCompleted - a.jobsCompleted;
      return a.name.localeCompare(b.name);
    });
  }, [roster, filterType, filterStatus, filterDept, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const kpis = useMemo(() => ({
    total: roster.length,
    employees: employees.length,
    contractors: contractors.length,
    active: roster.filter((r) => r.status === 'active' || r.status === 'available' || r.status === 'on-job').length,
    onLeave: roster.filter((r) => r.status === 'on-leave' || r.status === 'leave').length,
    complianceIssues: contractors.filter((c) => c.complianceStatus !== 'compliant').length,
  }), [roster, employees, contractors]);

  const allStatuses = useMemo(() => {
    const s = new Set(roster.map((r) => r.status));
    return Array.from(s);
  }, [roster]);

  return (
    <AppLayout currentPath="/workforce-roster">
      <div className="space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[1.375rem] font-800 tracking-tight text-foreground" style={{ letterSpacing: '-0.02em' }}>
              Workforce Roster
            </h1>
            <p className="text-[13px] mt-1 text-muted-foreground">
              Unified view of all employees and contractors
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-600"
              style={{ backgroundColor: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.15)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)' }} />
              Live
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="btn-secondary"
              aria-label="Refresh roster"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            {canManage && (
              <button className="btn-primary">
                <UserPlus size={14} />Add Worker
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert-error" role="alert">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span className="flex-1 text-sm">{error}</span>
            <button onClick={() => load()} className="text-xs font-600 underline underline-offset-2">Retry</button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <KPICard icon={Users}        label="Total Workforce" value={kpis.total}            sub="employees + contractors" color="var(--accent)" />
          <KPICard icon={Users}        label="Employees"       value={kpis.employees}        sub="direct staff"           color="#2563EB" />
          <KPICard icon={UserCheck}    label="Contractors"     value={kpis.contractors}      sub="external workforce"     color="#8B5CF6" />
          <KPICard icon={CheckCircle2} label="Active Now"      value={kpis.active}           sub="working or available"   color="var(--success)" />
          <KPICard icon={Clock}        label="On Leave"        value={kpis.onLeave}          sub="currently absent"       color="var(--warning)" />
          <KPICard icon={AlertCircle}  label="Compliance"      value={kpis.complianceIssues} sub="issues to resolve"      color={kpis.complianceIssues > 0 ? 'var(--danger)' : 'var(--success)'} />
        </div>

        {/* Filters */}
        <div className="filter-bar flex-wrap gap-2">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              suppressHydrationWarning
              type="text"
              placeholder="Search name, role, location…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field input-field-search"
            />
          </div>

          {/* Type toggle */}
          <div className="period-selector">
            {(['all', 'employee', 'contractor'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setFilterType(t); setPage(1); }}
                className={`period-btn capitalize ${filterType === t ? 'active' : ''}`}
              >
                {t === 'all' ? 'All' : t === 'employee' ? 'Employees' : 'Contractors'}
              </button>
            ))}
          </div>

          {/* Status */}
          <select
            suppressHydrationWarning
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="select-field"
          >
            <option value="all">All Status</option>
            {allStatuses.map((s) => (
              <option key={s} value={s}>{statusConfig[s]?.label || s}</option>
            ))}
          </select>

          {/* Department */}
          <select
            suppressHydrationWarning
            value={filterDept}
            onChange={(e) => { setFilterDept(e.target.value); setPage(1); }}
            className="select-field"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Sort */}
          <select
            suppressHydrationWarning
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="select-field"
          >
            <option value="name">Sort: Name</option>
            <option value="hours">Sort: Hours</option>
            <option value="rating">Sort: Rating</option>
            <option value="jobs">Sort: Jobs Done</option>
          </select>

          <span className="text-xs text-muted-foreground ml-auto self-center">{filtered.length} workers</span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="card-elevated">
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-secondary flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="w-40 h-3.5 rounded bg-secondary" />
                    <div className="w-24 h-3 rounded bg-secondary" />
                  </div>
                  <div className="w-16 h-5 rounded-full bg-secondary" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* List */}
            <div className="xl:col-span-2 space-y-2">
              {paginated.length === 0 ? (
                <div className="card-elevated py-16 text-center">
                  <Users size={40} className="mx-auto text-muted-foreground mb-3 opacity-30" />
                  <p className="text-sm font-600 text-foreground">No workers found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                paginated.map((worker) => {
                  const sc = statusConfig[worker.status] || statusConfig['unavailable'];
                  const isSelected = selected?.id === worker.id;
                  return (
                    <div
                      key={worker.id}
                      onClick={() => setSelected(isSelected ? null : worker)}
                      className={`list-item-card cursor-pointer${isSelected ? ' selected' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Avatar */}
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-700 text-white flex-shrink-0"
                            style={{ backgroundColor: worker.color }}
                          >
                            {worker.initials}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-700 text-foreground">{worker.name}</p>
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-600"
                                style={{ backgroundColor: sc.bg, color: sc.text }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                                {sc.label}
                              </span>
                              <span
                                className="px-1.5 py-0.5 rounded-full text-[10px] font-600 capitalize"
                                style={{
                                  backgroundColor: worker.type === 'employee' ? 'rgba(37,99,235,0.1)' : 'rgba(139,92,246,0.1)',
                                  color: worker.type === 'employee' ? '#2563EB' : '#8B5CF6',
                                }}
                              >
                                {worker.type}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {worker.role}
                              {worker.department && ` · ${worker.department}`}
                            </p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <StarRating rating={worker.rating} />
                              {worker.location && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <MapPin size={10} />{worker.location}
                                </span>
                              )}
                              {worker.complianceStatus && worker.complianceStatus !== 'compliant' && (() => {
                                const cc = complianceConfig[worker.complianceStatus];
                                const CIcon = cc?.icon;
                                return CIcon ? (
                                  <span className="flex items-center gap-1 text-[11px] font-600" style={{ color: cc.color }}>
                                    <CIcon size={10} />{cc.label}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Right stats */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-700 text-foreground font-tabular">{worker.hoursThisWeek}h</p>
                            <p className="text-[10px] text-muted-foreground">this week</p>
                          </div>
                          <div className="text-right hidden md:block">
                            <p className="text-sm font-700 text-foreground font-tabular">{worker.jobsCompleted}</p>
                            <p className="text-[10px] text-muted-foreground">jobs done</p>
                          </div>
                          {canManage && (
                            <div className="relative">
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === worker.id ? null : worker.id); }}
                                className="btn-ghost p-1.5"
                                aria-label="Actions"
                              >
                                <MoreHorizontal size={15} />
                              </button>
                              {openMenu === worker.id && (
                                <div className="absolute right-0 top-8 z-20 w-40 card-elevated rounded-lg shadow-lg overflow-hidden animate-slide-up">
                                  {[
                                    { icon: Eye, label: 'View Details' },
                                    { icon: Edit2, label: 'Edit' },
                                    { icon: Briefcase, label: 'Assign Job' },
                                    { icon: Calendar, label: 'Schedule' },
                                  ].map((a) => (
                                    <button
                                      key={a.label}
                                      onClick={(e) => { e.stopPropagation(); setSelected(worker); setOpenMenu(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary transition-colors text-left"
                                      style={{ color: 'var(--foreground)' }}
                                    >
                                      <a.icon size={13} className="text-muted-foreground" />{a.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="card-elevated flex items-center justify-between px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft size={15} className="text-muted-foreground" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .map((p, idx, arr) => (
                        <React.Fragment key={p}>
                          {idx > 0 && arr[idx - 1] !== p - 1 && (
                            <span className="text-xs text-muted-foreground px-1">…</span>
                          )}
                          <button
                            onClick={() => setPage(p)}
                            className="w-7 h-7 rounded-md text-xs font-600 transition-colors"
                            style={{
                              backgroundColor: p === page ? 'var(--accent)' : 'transparent',
                              color: p === page ? 'white' : 'var(--foreground)',
                            }}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      ))}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight size={15} className="text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Detail panel */}
            <div className="xl:col-span-1">
              {selected ? (
                <WorkerDetailPanel worker={selected} onClose={() => setSelected(null)} canManage={canManage} />
              ) : (
                <div className="card-elevated p-8 text-center">
                  <Users size={36} className="mx-auto text-muted-foreground mb-3 opacity-30" />
                  <p className="text-sm font-600 text-foreground">Select a worker</p>
                  <p className="text-xs text-muted-foreground mt-1">Click any row to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
