'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  Clock,
  Play,
  Square,
  Coffee,
  Briefcase,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Timer,
  TrendingUp,
  Plus,
  Loader2,
} from 'lucide-react';
import { timeEntryService, TimeEntry } from '@/lib/services/timeEntryService';
import { contractorService, Contractor } from '@/lib/services/contractorService';
import { jobService, Job } from '@/lib/services/jobService';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';

interface ActiveSession {
  contractorId: string;
  contractorName: string;
  initials: string;
  color: string;
  job: string;
  site: string;
  clockInTime: Date | null;
  breakStartTime: Date | null;
  totalBreakMs: number;
  status: 'idle' | 'clocked-in' | 'on-break';
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function TimeTrackingPage() {
  const { companyId } = useAuth();
  const { hasPermission } = useRBAC();
  const canManage = hasPermission('canManageJobs');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ActiveSession>({
    contractorId: '',
    contractorName: '',
    initials: '',
    color: '#2563EB',
    job: '',
    site: '',
    clockInTime: null,
    breakStartTime: null,
    totalBreakMs: 0,
    status: 'idle',
  });
  const [elapsed, setElapsed] = useState(0);
  const [breakElapsed, setBreakElapsed] = useState(0);
  const [filterDate, setFilterDate] = useState('all');
  const [now, setNow] = useState<Date | null>(null);
  const [todayLabel, setTodayLabel] = useState('');

  useEffect(() => {
    setNow(new Date());
    setTodayLabel(new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadAll = async () => {
    setDataLoading(true);
    setLoading(true);
    setError(null);
    try {
      const [contractorData, jobData, entryData] = await Promise.all([
        contractorService.getAll(companyId),
        jobService.getAll(companyId),
        timeEntryService.getAll(companyId),
      ]);
      setContractors(contractorData);
      setJobs(jobData);
      setEntries(entryData);

      // Set defaults from real data
      if (contractorData.length > 0) {
        const first = contractorData[0];
        const firstJob = jobData[0];
        setSession((s) => ({
          ...s,
          contractorId: first.id,
          contractorName: first.name,
          initials: first.initials,
          color: first.color,
          job: firstJob ? firstJob.title : '',
          site: firstJob ? firstJob.site : '',
        }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data. Please check your connection and try again.');
    } finally {
      setLoading(false);
      setDataLoading(false);
    }
  };

  const tick = useCallback(() => {
    if (session.status === 'clocked-in' && session.clockInTime) {
      const totalMs = Date.now() - session.clockInTime.getTime() - session.totalBreakMs;
      setElapsed(totalMs);
    }
    if (session.status === 'on-break' && session.breakStartTime) {
      setBreakElapsed(Date.now() - session.breakStartTime.getTime());
    }
  }, [session]);

  useEffect(() => {
    if (session.status === 'idle') return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.status, tick]);

  const handleContractorChange = (id: string) => {
    const c = contractors.find((x) => x.id === id);
    if (!c) return;
    setSession((s) => ({ ...s, contractorId: id, contractorName: c.name, initials: c.initials, color: c.color }));
  };

  const handleJobChange = (title: string) => {
    const j = jobs.find((x) => x.title === title);
    setSession((s) => ({ ...s, job: title, site: j?.site ?? '' }));
  };

  const handleClockIn = () => {
    const t = new Date();
    setSession((s) => ({ ...s, clockInTime: t, status: 'clocked-in', totalBreakMs: 0, breakStartTime: null }));
    setElapsed(0);
    setBreakElapsed(0);
  };

  const handleStartBreak = () => {
    const t = new Date();
    setSession((s) => ({ ...s, breakStartTime: t, status: 'on-break' }));
    setBreakElapsed(0);
  };

  const handleEndBreak = () => {
    const addedBreak = session.breakStartTime ? Date.now() - session.breakStartTime.getTime() : 0;
    setSession((s) => ({ ...s, status: 'clocked-in', breakStartTime: null, totalBreakMs: s.totalBreakMs + addedBreak }));
    setBreakElapsed(0);
  };

  const handleClockOut = async () => {
    if (!session.clockInTime) return;
    const clockOut = new Date();
    const totalBreak = session.status === 'on-break' && session.breakStartTime
      ? session.totalBreakMs + (Date.now() - session.breakStartTime.getTime())
      : session.totalBreakMs;
    const workMs = clockOut.getTime() - session.clockInTime.getTime() - totalBreak;
    const totalHours = Math.round((workMs / 3600000) * 100) / 100;
    const breakMinutes = Math.round(totalBreak / 60000);

    const newEntry: Omit<TimeEntry, 'id'> = {
      date: 'Today',
      contractor: session.contractorName,
      initials: session.initials,
      color: session.color,
      job: session.job,
      site: session.site,
      clockIn: formatTime(session.clockInTime),
      clockOut: formatTime(clockOut),
      breakMinutes,
      totalHours,
      status: 'completed',
    };

    setSaving(true);
    try {
      const saved = await timeEntryService.create(newEntry);
      if (saved) {
        setEntries((prev) => [saved, ...prev]);
      } else {
        setEntries((prev) => [{ ...newEntry, id: `te${Date.now()}` }, ...prev]);
      }
    } catch {
      setEntries((prev) => [{ ...newEntry, id: `te${Date.now()}` }, ...prev]);
    } finally {
      setSaving(false);
    }

    setSession((s) => ({ ...s, status: 'idle', clockInTime: null, breakStartTime: null, totalBreakMs: 0 }));
    setElapsed(0);
    setBreakElapsed(0);
  };

  const todayEntries = entries.filter((e) => e.date === 'Today');
  const todayHours = todayEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);
  const activeCount = session.status !== 'idle' ? 1 : 0;
  const avgHours = todayEntries.length > 0 ? (todayHours / todayEntries.length).toFixed(1) : '0.0';

  const filteredEntries = filterDate === 'all' ? entries : entries.filter((e) => e.date === filterDate);

  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const paginatedEntries = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusColor = session.status === 'clocked-in' ? 'var(--success)' : session.status === 'on-break' ? 'var(--warning)' : 'var(--muted-foreground)';
  const statusLabel = session.status === 'clocked-in' ? 'Clocked In' : session.status === 'on-break' ? 'On Break' : 'Not Clocked In';

  return (
    <AppLayout currentPath="/time-tracking">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header-title">Time Tracking</h1>
            <p className="page-header-subtitle">{todayLabel}</p>
          </div>
          {canManage && (
            <button
              suppressHydrationWarning
              className="btn-primary"
              aria-label="Add manual time entry"
            >
              <Plus size={15} />
              Manual Entry
            </button>
          )}
        </div>

        {error && (
          <div className="alert-error">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-600">Failed to load data</p>
              <p className="text-sm opacity-80 mt-0.5">{error}</p>
            </div>
            <button
              onClick={loadAll}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-600 bg-danger/10 hover:bg-danger/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Hours Logged Today', value: todayHours.toFixed(1) + 'h', icon: Clock, color: 'var(--accent)' },
            { label: 'Active Now', value: activeCount, icon: Play, color: 'var(--success)' },
            { label: 'Entries Today', value: todayEntries.length + (activeCount > 0 ? 1 : 0), icon: Calendar, color: 'var(--info)' },
            { label: 'Avg Hours / Entry', value: avgHours + 'h', icon: TrendingUp, color: 'var(--warning)' },
          ].map((s) => (
            <div key={s.label} className="card-elevated p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${s.color}18` }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-700 text-foreground font-tabular">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Clock-in panel */}
          <div className="xl:col-span-2 space-y-4">
            <div className="card-elevated p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-700 text-foreground">Clock In / Out</h2>
                <span
                  className="status-badge"
                  style={{
                    backgroundColor: session.status === 'clocked-in' ? 'var(--success-bg)' : session.status === 'on-break' ? 'var(--warning-bg)' : 'var(--secondary)',
                    color: statusColor,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block" style={{ backgroundColor: statusColor }} />
                  {statusLabel}
                </span>
              </div>

              {dataLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-accent" />
                </div>
              ) : (
                <>
                  {/* Contractor selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide" style={{ fontSize: '10px' }}>Contractor</label>
                    <div className="relative">
                      <select
                        suppressHydrationWarning
                        value={session.contractorId}
                        onChange={(e) => handleContractorChange(e.target.value)}
                        disabled={session.status !== 'idle'}
                        className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 appearance-none pr-8 disabled:opacity-60"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {contractors.length === 0 ? (
                          <option value="">No contractors found</option>
                        ) : (
                          contractors.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))
                        )}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  {/* Job selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide" style={{ fontSize: '10px' }}>Job / Task</label>
                    <div className="relative">
                      <select
                        suppressHydrationWarning
                        value={session.job}
                        onChange={(e) => handleJobChange(e.target.value)}
                        disabled={session.status !== 'idle'}
                        className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 appearance-none pr-8 disabled:opacity-60"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {jobs.length === 0 ? (
                          <option value="">No jobs found</option>
                        ) : (
                          jobs.map((j) => (
                            <option key={j.id} value={j.title}>{j.title}</option>
                          ))
                        )}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                    {session.site && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Briefcase size={11} />
                        {session.site}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Live timer */}
              <div
                className="rounded-xl p-5 text-center"
                style={{ backgroundColor: session.status !== 'idle' ? `${statusColor}12` : 'var(--secondary)' }}
              >
                <p className="text-xs font-600 uppercase tracking-widest text-muted-foreground mb-2" style={{ fontSize: '10px' }}>
                  {session.status === 'on-break' ? 'Break Duration' : 'Work Duration'}
                </p>
                <p
                  className="text-4xl font-700 font-tabular tracking-tight"
                  style={{ color: session.status !== 'idle' ? statusColor : 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {session.status === 'on-break' ? formatDuration(breakElapsed) : formatDuration(elapsed)}
                </p>
                {session.status === 'clocked-in' && session.totalBreakMs > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Break taken: {Math.round(session.totalBreakMs / 60000)} min
                  </p>
                )}
                {session.status !== 'idle' && session.clockInTime && now && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Clocked in at {formatTime(session.clockInTime)}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                {session.status === 'idle' && (
                  <button
                    onClick={handleClockIn}
                    disabled={!session.contractorId || !session.job}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-700 text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--success)' }}
                  >
                    <Play size={16} fill="white" />
                    Clock In
                  </button>
                )}
                {session.status === 'clocked-in' && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleStartBreak}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-700 transition-all hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}
                    >
                      <Coffee size={15} />
                      Start Break
                    </button>
                    <button
                      onClick={handleClockOut}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-700 text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                      style={{ backgroundColor: 'var(--danger)' }}
                    >
                      <Square size={14} fill="white" />
                      {saving ? 'Saving...' : 'Clock Out'}
                    </button>
                  </div>
                )}
                {session.status === 'on-break' && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleEndBreak}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-700 transition-all hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}
                    >
                      <Play size={15} fill="currentColor" />
                      End Break
                    </button>
                    <button
                      onClick={handleClockOut}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-700 text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                      style={{ backgroundColor: 'var(--danger)' }}
                    >
                      <Square size={14} fill="white" />
                      {saving ? 'Saving...' : 'Clock Out'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Today's job summary */}
            <div className="card-elevated p-4 space-y-3">
              <h3 className="text-sm font-700 text-foreground flex items-center gap-2">
                <Timer size={15} style={{ color: 'var(--accent)' }} />
                Today&apos;s Summary
              </h3>
              {loading ? (
                <p className="text-xs text-muted-foreground py-3 text-center">Loading...</p>
              ) : todayEntries.length === 0 && session.status === 'idle' ? (
                <p className="text-xs text-muted-foreground py-3 text-center">No entries logged today</p>
              ) : (
                <div className="space-y-2">
                  {todayEntries.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 text-white flex-shrink-0" style={{ backgroundColor: e.color }}>
                        {e.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-600 text-foreground truncate">{e.contractor}</p>
                        <p className="text-xs text-muted-foreground truncate">{e.clockIn} – {e.clockOut}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-700 text-foreground font-tabular">{e.totalHours}h</p>
                        {e.breakMinutes > 0 && <p className="text-xs text-muted-foreground">{e.breakMinutes}m break</p>}
                      </div>
                    </div>
                  ))}
                  {session.status !== 'idle' && (
                    <div className="flex items-center gap-2 py-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 text-white flex-shrink-0" style={{ backgroundColor: session.color }}>
                        {session.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-600 text-foreground truncate">{session.contractorName}</p>
                        <p className="text-xs" style={{ color: statusColor }}>{statusLabel}</p>
                      </div>
                      <p className="text-sm font-700 font-tabular" style={{ color: statusColor }}>{formatDuration(elapsed)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Daily timesheet */}
          <div className="xl:col-span-3">
            <div className="card-elevated overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3" style={{ borderColor: 'var(--border)' }}>
                <h2 className="text-base font-700 text-foreground">Daily Timesheets</h2>
                <div className="flex items-center gap-2">
                  <select
                    suppressHydrationWarning
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="text-sm px-3 py-1.5 rounded-lg border bg-background focus:outline-none"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <option value="all">All Days</option>
                    <option value="Today">Today</option>
                    <option value="Yesterday">Yesterday</option>
                  </select>
                </div>
              </div>

              {/* Table header */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-600 uppercase tracking-wide text-muted-foreground" style={{ backgroundColor: 'var(--secondary)', fontSize: '10px' }}>
                <div className="col-span-3">Contractor</div>
                <div className="col-span-3">Job</div>
                <div className="col-span-2 text-center">Clock In</div>
                <div className="col-span-2 text-center">Clock Out</div>
                <div className="col-span-1 text-center">Break</div>
                <div className="col-span-1 text-right">Total</div>
              </div>

              {loading ? (
                <div className="py-16 text-center">
                  <Clock size={36} className="mx-auto text-muted-foreground mb-3 opacity-30 animate-pulse" />
                  <p className="text-sm text-muted-foreground">Loading timesheets...</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {paginatedEntries.map((entry) => (
                    <div key={entry.id} className="px-4 py-3 hover:bg-secondary/40 transition-colors">
                      {/* Mobile layout */}
                      <div className="md:hidden space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 text-white" style={{ backgroundColor: entry.color }}>
                              {entry.initials}
                            </div>
                            <div>
                              <p className="text-sm font-600 text-foreground">{entry.contractor}</p>
                              <p className="text-xs text-muted-foreground">{entry.date}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-700 text-foreground font-tabular">{entry.totalHours}h</p>
                            <StatusChip status={entry.status} />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{entry.job}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>In: <span className="text-foreground font-600">{entry.clockIn}</span></span>
                          <span>Out: <span className="text-foreground font-600">{entry.clockOut ?? '—'}</span></span>
                          <span>Break: <span className="text-foreground font-600">{entry.breakMinutes}m</span></span>
                        </div>
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3 flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 text-white flex-shrink-0" style={{ backgroundColor: entry.color }}>
                            {entry.initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-600 text-foreground truncate">{entry.contractor}</p>
                            <p className="text-xs text-muted-foreground">{entry.date}</p>
                          </div>
                        </div>
                        <div className="col-span-3 min-w-0">
                          <p className="text-sm text-foreground truncate">{entry.job}</p>
                          <p className="text-xs text-muted-foreground truncate">{entry.site}</p>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-sm font-600 text-foreground font-tabular">{entry.clockIn}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-sm font-600 text-foreground font-tabular">{entry.clockOut ?? '—'}</span>
                        </div>
                        <div className="col-span-1 text-center">
                          <span className="text-sm text-muted-foreground font-tabular">{entry.breakMinutes}m</span>
                        </div>
                        <div className="col-span-1 text-right">
                          <span className="text-sm font-700 text-foreground font-tabular">{entry.totalHours}h</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredEntries.length === 0 && (
                    <div className="py-16 text-center">
                      <Clock size={36} className="mx-auto text-muted-foreground mb-3 opacity-30" />
                      <p className="text-sm text-muted-foreground">No timesheet entries found</p>
                    </div>
                  )}
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-xs text-muted-foreground">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredEntries.length)} of {filteredEntries.length}</p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><polyline points="15 18 9 12 15 6" /></svg>
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
                          <React.Fragment key={p}>
                            {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                            <button onClick={() => setPage(p)} className="w-7 h-7 rounded-md text-xs font-600 transition-colors" style={{ backgroundColor: p === page ? 'var(--accent)' : 'transparent', color: p === page ? 'white' : 'var(--foreground)' }}>{p}</button>
                          </React.Fragment>
                        ))}
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer totals */}
              {filteredEntries.length > 0 && (
                <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--secondary)' }}>
                  <p className="text-xs text-muted-foreground">{filteredEntries.length} entries</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">Total break: <span className="font-600 text-foreground">{filteredEntries.reduce((s, e) => s + e.breakMinutes, 0)}m</span></span>
                    <span className="text-muted-foreground">Total hours: <span className="text-base font-700 text-foreground font-tabular">{filteredEntries.reduce((s, e) => s + (e.totalHours ?? 0), 0).toFixed(1)}h</span></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatusChip({ status }: { status: TimeEntry['status'] }) {
  if (status === 'completed') return (
    <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--success)' }}>
      <CheckCircle2 size={11} /> Done
    </span>
  );
  if (status === 'on-break') return (
    <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--warning)' }}>
      <AlertCircle size={11} /> Break
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--success)' }}>
      <Play size={11} /> Active
    </span>
  );
}
