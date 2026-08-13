'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { Briefcase, Plus, Search, MoreHorizontal, MapPin, Clock, Calendar, CheckCircle2, AlertCircle, XCircle, Play, X, Loader2, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { jobService, Job } from '@/lib/services/jobService';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { logActivity } from '@/lib/activityLogger';
import { emailService } from '@/lib/emailService';

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  scheduled: { bg: 'var(--info-bg)', text: 'var(--info)', label: 'Scheduled', icon: Calendar },
  'in-progress': { bg: 'rgba(37,99,235,0.1)', text: '#2563EB', label: 'In Progress', icon: Play },
  completed: { bg: 'var(--success-bg)', text: 'var(--success)', label: 'Completed', icon: CheckCircle2 },
  cancelled: { bg: 'var(--secondary)', text: 'var(--muted-foreground)', label: 'Cancelled', icon: XCircle },
  overdue: { bg: 'var(--danger-bg)', text: 'var(--danger)', label: 'Overdue', icon: AlertCircle },
};

const priorityConfig: Record<string, { bg: string; text: string }> = {
  low: { bg: 'var(--secondary)', text: 'var(--muted-foreground)' },
  medium: { bg: 'rgba(59,130,246,0.1)', text: '#3B82F6' },
  high: { bg: 'var(--warning-bg)', text: 'var(--warning)' },
  urgent: { bg: 'var(--danger-bg)', text: 'var(--danger)' },
};

interface NewJobForm {
  title: string;
  client: string;
  site: string;
  assignedTo: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: string;
  priority: Job['priority'];
  value: string;
  notes: string;
}

const PAGE_SIZE = 15;

export default function JobsPage() {
  const { user, companyId } = useAuth();
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [showNewJob, setShowNewJob] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<NewJobForm>({
    title: '', client: '', site: '', assignedTo: '', scheduledDate: '', scheduledTime: '09:00',
    duration: '2h', priority: 'medium', value: '', notes: '',
  });

  const canManage = hasPermission('canManageJobs');

  useEffect(() => {
    loadJobs();
  }, [companyId]);

  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobService.getAll(companyId);
      setJobs(data);
    } catch {
      setError('Failed to load jobs. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!form.title || !form.client) return;
    setSaving(true);
    try {
      const jobNumber = `JOB-${Date.now().toString().slice(-6)}`;
      const newJob = await jobService.create({
        jobNumber,
        title: form.title,
        client: form.client,
        site: form.site,
        assignedTo: form.assignedTo || 'Unassigned',
        assignedColor: '#2563EB',
        assignedInitials: (form.assignedTo || 'U').slice(0, 2).toUpperCase(),
        type: 'service',
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime,
        duration: form.duration,
        status: 'scheduled',
        priority: form.priority,
        value: form.value ? `$${form.value}` : '$0',
        notes: form.notes,
      }, companyId);

      if (newJob && user) {
        await logActivity({
          userId: user.id,
          companyId,
          action: 'job_created',
          entityType: 'job',
          entityId: newJob.id,
          description: `Job "${form.title}" created for ${form.client}`,
        });
        setJobs((prev) => [newJob, ...prev]);

        if (form.assignedTo && form.assignedTo.includes('@')) {
          emailService.sendJobAssignment(
            form.assignedTo,
            form.assignedTo,
            {
              jobTitle: form.title,
              client: form.client,
              site: form.site,
              scheduledDate: form.scheduledDate,
              scheduledTime: form.scheduledTime,
              notes: form.notes,
            }
          ).catch(() => {});
        }
      }
      setShowNewJob(false);
      setForm({ title: '', client: '', site: '', assignedTo: '', scheduledDate: '', scheduledTime: '09:00', duration: '2h', priority: 'medium', value: '', notes: '' });
    } catch {
      setError('Failed to create job. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (jobId: string, newStatus: Job['status'], jobTitle: string) => {
    if (!canManage) return;
    const updated = await jobService.updateStatus(jobId, newStatus);
    if (updated && user) {
      setJobs((prev) => prev.map((j) => j.id === jobId ? updated : j));
      const action = newStatus === 'completed' ? 'job_completed' : newStatus === 'cancelled' ? 'job_cancelled' : 'job_created';
      await logActivity({
        userId: user.id,
        companyId,
        action,
        entityType: 'job',
        entityId: jobId,
        description: `Job "${jobTitle}" status changed to ${newStatus}`,
      });
    }
  };

  const filtered = jobs.filter((j) => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) || j.client.toLowerCase().includes(search.toLowerCase()) || j.jobNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || j.status === filterStatus;
    const matchPriority = filterPriority === 'all' || j.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: jobs.length,
    inProgress: jobs.filter((j) => j.status === 'in-progress').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    overdue: jobs.filter((j) => j.status === 'overdue').length,
  };

  const boardColumns = ['scheduled', 'in-progress', 'completed', 'overdue'] as const;
  const inputClass = 'w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all placeholder:text-muted-foreground';

  if (!rbacLoading && !hasPermission('canManageJobs') && !hasPermission('canViewReports')) {
    return (
      <AppLayout currentPath="/jobs">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Lock size={48} className="text-muted-foreground mb-4 opacity-40" />
          <h2 className="text-xl font-700 text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">You don&apos;t have permission to view jobs. Contact your administrator.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath="/jobs">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-700 text-foreground">Job Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Track, assign, and manage all service jobs</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
              {(['list', 'board'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="px-3 py-1.5 rounded-md text-sm font-600 transition-all capitalize"
                  style={{
                    backgroundColor: view === v ? 'var(--card)' : 'transparent',
                    color: view === v ? 'var(--foreground)' : 'var(--muted-foreground)',
                    boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
            {canManage && (
              <button onClick={() => setShowNewJob(true)} className="btn-primary">
                <Plus size={16} />
                New Job
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Jobs', value: stats.total, icon: Briefcase, color: 'var(--accent)' },
            { label: 'In Progress', value: stats.inProgress, icon: Play, color: 'var(--info)' },
            { label: 'Completed Today', value: stats.completed, icon: CheckCircle2, color: 'var(--success)' },
            { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: stats.overdue > 0 ? 'var(--danger)' : 'var(--success)' },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-card-icon" style={{ backgroundColor: `${s.color}18` }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <div>
                <p className="stat-card-value">{s.value}</p>
                <p className="stat-card-label">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search jobs, clients, job numbers..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field input-field-search"
            />
          </div>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="select-field">
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }} className="select-field">
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} jobs</span>
        </div>

        {loading ? (
          <div className="card-elevated overflow-hidden">
            {/* Skeleton table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}>
                    {['Job', 'Client / Site', 'Assigned To', 'Scheduled', 'Duration', 'Value', 'Priority', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-600 uppercase tracking-wide text-muted-foreground whitespace-nowrap" style={{ fontSize: '11px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3.5">
                        <div className="skeleton h-3.5 w-36 mb-1.5" />
                        <div className="skeleton h-2.5 w-20" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="skeleton h-3.5 w-28 mb-1.5" />
                        <div className="skeleton h-2.5 w-20" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="skeleton w-7 h-7 rounded-full flex-shrink-0" />
                          <div className="skeleton h-3.5 w-24" />
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="skeleton h-3.5 w-20 mb-1.5" />
                        <div className="skeleton h-2.5 w-12" />
                      </td>
                      <td className="px-4 py-3.5"><div className="skeleton h-3.5 w-10" /></td>
                      <td className="px-4 py-3.5"><div className="skeleton h-3.5 w-14" /></td>
                      <td className="px-4 py-3.5"><div className="skeleton h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-3.5"><div className="skeleton h-6 w-24 rounded-lg" /></td>
                      <td className="px-4 py-3.5"><div className="skeleton h-6 w-6 rounded-md" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            {/* List view */}
            {view === 'list' && (
              <div className="card-elevated overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}>
                        {['Job', 'Client / Site', 'Assigned To', 'Scheduled', 'Duration', 'Value', 'Priority', 'Status', ''].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-600 uppercase tracking-wide text-muted-foreground whitespace-nowrap" style={{ fontSize: '11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((job, idx) => {
                        const sc = statusConfig[job.status];
                        const pc = priorityConfig[job.priority];
                        const StatusIcon = sc.icon;
                        return (
                          <tr key={job.id} className="transition-colors hover:bg-secondary/50 cursor-pointer" style={{ borderBottom: idx < paginated.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td className="px-4 py-3">
                              <p className="text-sm font-600 text-foreground">{job.title}</p>
                              <p className="text-xs text-muted-foreground font-tabular">{job.jobNumber}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-foreground">{job.client}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <MapPin size={10} />{job.site}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 text-white flex-shrink-0" style={{ backgroundColor: job.assignedColor }}>
                                  {job.assignedInitials}
                                </div>
                                <span className="text-sm text-foreground whitespace-nowrap">{job.assignedTo}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-foreground">{job.scheduledDate}</p>
                              <p className="text-xs text-muted-foreground">{job.scheduledTime}</p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock size={12} />{job.duration}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-600 text-foreground font-tabular">{job.value}</td>
                            <td className="px-4 py-3">
                              <span className="status-badge capitalize" style={{ backgroundColor: pc.bg, color: pc.text }}>{job.priority}</span>
                            </td>
                            <td className="px-4 py-3">
                              {canManage ? (
                                <select
                                  value={job.status}
                                  onChange={(e) => handleStatusChange(job.id, e.target.value as Job['status'], job.title)}
                                  className="text-xs font-600 px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/30"
                                  style={{ backgroundColor: sc.bg, color: sc.text }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="scheduled">Scheduled</option>
                                  <option value="in-progress">In Progress</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                  <option value="overdue">Overdue</option>
                                </select>
                              ) : (
                                <span className="text-xs font-600 px-2 py-1 rounded-lg" style={{ backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {canManage && (
                                <button className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                                  <MoreHorizontal size={16} className="text-muted-foreground" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filtered.length === 0 && (
                  <div className="empty-state">
                    <Briefcase size={40} className="empty-state-icon" />
                    <p className="empty-state-title">No jobs match your filters</p>
                    <p className="empty-state-desc">Try adjusting your search or filter criteria</p>
                    {canManage && (
                      <div className="empty-state-action">
                        <button onClick={() => setShowNewJob(true)} className="btn-primary">
                          <Plus size={15} />Create First Job
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs text-muted-foreground">
                      Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors">
                        <ChevronLeft size={16} className="text-muted-foreground" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
                        <React.Fragment key={p}>
                          {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                          <button onClick={() => setPage(p)} className="w-7 h-7 rounded-md text-xs font-600 transition-colors" style={{ backgroundColor: p === page ? 'var(--accent)' : 'transparent', color: p === page ? 'white' : 'var(--foreground)' }}>{p}</button>
                        </React.Fragment>
                      ))}
                      <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors">
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Board view */}
            {view === 'board' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {boardColumns.map((col) => {
                  const colJobs = filtered.filter((j) => j.status === col);
                  const sc = statusConfig[col];
                  const ColIcon = sc.icon;
                  return (
                    <div key={col} className="card-elevated overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', backgroundColor: sc.bg }}>
                        <div className="flex items-center gap-2">
                          <ColIcon size={14} style={{ color: sc.text }} />
                          <span className="text-sm font-600" style={{ color: sc.text }}>{sc.label}</span>
                        </div>
                        <span className="text-xs font-700 px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: sc.text }}>{colJobs.length}</span>
                      </div>
                      <div className="p-3 space-y-3 min-h-[200px]">
                        {colJobs.map((job) => {
                          const pc = priorityConfig[job.priority];
                          return (
                            <div key={job.id} className="p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="text-sm font-600 text-foreground leading-snug">{job.title}</p>
                                <span className="status-badge capitalize flex-shrink-0" style={{ backgroundColor: pc.bg, color: pc.text }}>{job.priority}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{job.client}</p>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: job.assignedColor, fontSize: '9px', fontWeight: 700 }}>
                                    {job.assignedInitials}
                                  </div>
                                  <span className="text-xs text-muted-foreground truncate max-w-[80px]">{job.assignedTo}</span>
                                </div>
                                <span className="text-xs font-600 text-foreground font-tabular">{job.value}</span>
                              </div>
                            </div>
                          );
                        })}
                        {colJobs.length === 0 && (
                          <div className="py-8 text-center">
                            <p className="text-xs text-muted-foreground">No jobs</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* New Job Modal */}
      {showNewJob && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNewJob(false)} />
          <div className="relative w-full max-w-lg card-elevated p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-700 text-foreground">New Job</h2>
              <button onClick={() => setShowNewJob(false)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Job Title *</label>
                <input type="text" className={inputClass} placeholder="e.g. Office Deep Clean" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Client *</label>
                  <input type="text" className={inputClass} placeholder="Client name" value={form.client} onChange={(e) => setForm((p) => ({ ...p, client: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Site</label>
                  <input type="text" className={inputClass} placeholder="Site / location" value={form.site} onChange={(e) => setForm((p) => ({ ...p, site: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Assigned To</label>
                <input type="text" className={inputClass} placeholder="Team member name" value={form.assignedTo} onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Date</label>
                  <input type="date" className={inputClass} value={form.scheduledDate} onChange={(e) => setForm((p) => ({ ...p, scheduledDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Time</label>
                  <input type="time" className={inputClass} value={form.scheduledTime} onChange={(e) => setForm((p) => ({ ...p, scheduledTime: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Duration</label>
                  <input type="text" className={inputClass} placeholder="e.g. 2h" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Value ($)</label>
                  <input type="number" className={inputClass} placeholder="0.00" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Priority</label>
                <select className={inputClass} value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as Job['priority'] }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-600 text-foreground mb-1.5">Notes</label>
                <textarea className={inputClass} rows={3} placeholder="Additional notes..." value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewJob(false)} className="flex-1 py-2.5 rounded-lg text-sm font-600 border transition-all hover:bg-secondary" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                Cancel
              </button>
              <button
                onClick={handleCreateJob}
                disabled={!form.title || !form.client || saving}
                className="flex-1 py-2.5 rounded-lg text-sm font-700 text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
