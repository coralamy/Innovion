'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { createClient } from '@/lib/supabase/client';
import {
  RotateCcw,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  Check,
  Loader2,
  Calendar,
  Clock,
  Users,
} from 'lucide-react';

interface RecurringPattern {
  id: string;
  title: string;
  site: string;
  client: string;
  contractorName: string;
  jobType: string;
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  startTime: string;
  durationMinutes: number;
  priority: string;
  instructions: string;
  isActive: boolean;
  nextOccurrence?: string;
  companyId?: string;
  createdAt: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

interface PatternFormProps {
  pattern?: RecurringPattern;
  onSave: (data: Omit<RecurringPattern, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

function PatternForm({ pattern, onSave, onClose }: PatternFormProps) {
  const [title, setTitle] = useState(pattern?.title || '');
  const [site, setSite] = useState(pattern?.site || '');
  const [client, setClient] = useState(pattern?.client || '');
  const [contractorName, setContractorName] = useState(pattern?.contractorName || '');
  const [jobType, setJobType] = useState(pattern?.jobType || 'Regular Clean');
  const [frequency, setFrequency] = useState(pattern?.frequency || 'weekly');
  const [dayOfWeek, setDayOfWeek] = useState<number>(pattern?.dayOfWeek ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(pattern?.dayOfMonth ?? 1);
  const [startTime, setStartTime] = useState(pattern?.startTime || '09:00');
  const [durationMinutes, setDurationMinutes] = useState(pattern?.durationMinutes || 120);
  const [priority, setPriority] = useState(pattern?.priority || 'medium');
  const [instructions, setInstructions] = useState(pattern?.instructions || '');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!title.trim() || !site.trim()) return;
    setSaving(true);
    onSave({
      title,
      site,
      client,
      contractorName,
      jobType,
      frequency,
      dayOfWeek: frequency === 'weekly' || frequency === 'fortnightly' ? dayOfWeek : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      startTime,
      durationMinutes,
      priority,
      instructions,
      isActive: true,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="card-elevated w-full max-w-lg rounded-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
        <div
          className="flex items-center justify-between p-5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <h3 className="text-base font-700 text-foreground">
            {pattern ? 'Edit Recurring Job' : 'New Recurring Job Pattern'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1.5">
              Job Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Office Clean"
              className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5">Site *</label>
              <input
                type="text"
                value={site}
                onChange={(e) => setSite(e.target.value)}
                placeholder="Site name"
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5">Client</label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Client name"
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none"
                style={{ borderColor: 'var(--border)' }}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            {(frequency === 'weekly' || frequency === 'fortnightly') && (
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                  Day of Week
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {frequency === 'monthly' && (
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                  Day of Month
                </label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                Duration (minutes)
              </label>
              <input
                type="number"
                min={30}
                step={30}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1.5">
              Contractor
            </label>
            <input
              type="text"
              value={contractorName}
              onChange={(e) => setContractorName(e.target.value)}
              placeholder="Assigned contractor name"
              className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1.5">
              Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="Special instructions..."
              className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none resize-none"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
        </div>
        <div
          className="flex gap-3 p-5 border-t flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-600 border transition-colors hover:bg-secondary"
            style={{ borderColor: 'var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !site.trim() || saving}
            className="flex-1 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {pattern ? 'Update' : 'Create Pattern'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecurringJobsPage() {
  const { companyId } = useAuth();
  const { hasPermission } = useRBAC();
  const canManage = hasPermission('canManageJobs');
  const [patterns, setPatterns] = useState<RecurringPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPattern, setEditingPattern] = useState<RecurringPattern | undefined>();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    loadPatterns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadPatterns = async () => {
    setLoading(true);
    const supabase = createClient();
    let q = supabase
      .from('recurring_job_patterns')
      .select('*')
      .order('created_at', { ascending: false });
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setPatterns(
      (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        site: r.site,
        client: r.client,
        contractorName: r.contractor_name,
        jobType: r.job_type,
        frequency: r.frequency,
        dayOfWeek: r.day_of_week,
        dayOfMonth: r.day_of_month,
        startTime: r.start_time,
        durationMinutes: r.duration_minutes,
        priority: r.priority,
        instructions: r.instructions,
        isActive: r.is_active,
        nextOccurrence: r.next_occurrence,
        companyId: r.company_id,
        createdAt: r.created_at,
      }))
    );
    setLoading(false);
  };

  const handleSave = async (data: Omit<RecurringPattern, 'id' | 'createdAt'>) => {
    const supabase = createClient();
    const payload = {
      title: data.title,
      site: data.site,
      client: data.client,
      contractor_name: data.contractorName,
      job_type: data.jobType,
      frequency: data.frequency,
      day_of_week: data.dayOfWeek ?? null,
      day_of_month: data.dayOfMonth ?? null,
      start_time: data.startTime,
      duration_minutes: data.durationMinutes,
      priority: data.priority,
      instructions: data.instructions,
      is_active: data.isActive,
      company_id: companyId,
    };
    if (editingPattern) {
      await supabase
        .from('recurring_job_patterns')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingPattern.id);
    } else {
      await supabase.from('recurring_job_patterns').insert(payload);
    }
    setShowForm(false);
    setEditingPattern(undefined);
    loadPatterns();
  };

  const toggleActive = async (pattern: RecurringPattern) => {
    const supabase = createClient();
    await supabase
      .from('recurring_job_patterns')
      .update({ is_active: !pattern.isActive })
      .eq('id', pattern.id);
    loadPatterns();
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('recurring_job_patterns').delete().eq('id', id);
    loadPatterns();
  };

  const filtered = patterns.filter(
    (p) =>
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.site.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const freqLabel = (f: string) => FREQUENCIES.find((x) => x.value === f)?.label || f;

  return (
    <AppLayout currentPath="/recurring-jobs">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header-title">Recurring Jobs</h1>
            <p className="page-header-subtitle">Manage repeating job patterns and schedules</p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setEditingPattern(undefined);
                setShowForm(true);
              }}
              className="btn-primary"
              aria-label="Create new recurring job pattern"
            >
              <Plus size={15} /> New Pattern
            </button>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search patterns..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-field input-field-search"
            aria-label="Search recurring job patterns"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <RotateCcw size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              No recurring patterns yet.{canManage ? ' Create your first pattern.' : ''}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginated.map((pattern) => (
                <div key={pattern.id} className="card-elevated p-5 rounded-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-700 text-foreground">{pattern.title}</h3>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-600"
                          style={{
                            backgroundColor: pattern.isActive
                              ? 'rgba(16,185,129,0.1)'
                              : 'var(--secondary)',
                            color: pattern.isActive ? '#10B981' : 'var(--muted-foreground)',
                          }}
                        >
                          {pattern.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {freqLabel(pattern.frequency)}
                          {pattern.dayOfWeek !== undefined ? ` · ${DAYS[pattern.dayOfWeek]}` : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {pattern.startTime} · {pattern.durationMinutes}min
                        </span>
                        {pattern.contractorName && (
                          <span className="flex items-center gap-1">
                            <Users size={11} />
                            {pattern.contractorName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pattern.site}
                        {pattern.client ? ` · ${pattern.client}` : ''}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => toggleActive(pattern)}
                          className="px-2.5 py-1.5 rounded text-xs font-600 transition-colors hover:bg-secondary"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          {pattern.isActive ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingPattern(pattern);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded hover:bg-secondary transition-colors"
                        >
                          <Edit2 size={13} className="text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(pattern.id)}
                          className="p-1.5 rounded hover:bg-secondary transition-colors"
                        >
                          <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="card-elevated flex items-center justify-between px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}{' '}
                  of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-muted-foreground"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
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
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-muted-foreground"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {canManage && showForm && (
        <PatternForm
          pattern={editingPattern}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditingPattern(undefined);
          }}
        />
      )}
    </AppLayout>
  );
}
