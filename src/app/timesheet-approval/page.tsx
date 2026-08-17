'use client';

import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { useLocalisation } from '@/contexts/LocalisationContext';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Download,
  Search,
  Loader2,
  Send,
  Lock,
  X,
} from 'lucide-react';
import Icon from '@/components/ui/AppIcon';

type ApprovalStatus = 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'correction_required';

interface TimesheetEntry {
  id: string;
  date: string;
  contractor: string;
  initials: string;
  color: string;
  job: string;
  site: string;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  totalHours: number | null;
  status: string;
  approvalStatus: ApprovalStatus;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  correctionNotes?: string;
  isLocked: boolean;
  hourlyRate: number;
  companyId?: string;
}

interface AuditEntry {
  id: string;
  action: string;
  performedBy: string;
  oldStatus?: string;
  newStatus?: string;
  notes?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  in_progress: { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: Clock },
  submitted: { label: 'Submitted', color: '#2563EB', bg: 'rgba(37,99,235,0.1)', icon: Send },
  approved: { label: 'Approved', color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: XCircle },
  correction_required: {
    label: 'Correction Required',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.1)',
    icon: AlertTriangle,
  },
};

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.in_progress;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

interface ActionModalProps {
  entry: TimesheetEntry;
  action: 'approve' | 'reject' | 'correction' | 'reopen';
  onClose: () => void;
  onConfirm: (notes: string) => void;
}

function ActionModal({ entry, action, onClose, onConfirm }: ActionModalProps) {
  const [notes, setNotes] = useState('');
  const titles = {
    approve: 'Approve Timesheet',
    reject: 'Reject Timesheet',
    correction: 'Request Correction',
    reopen: 'Reopen Approved Entry',
  };
  const descriptions = {
    approve: 'This will lock the timesheet and generate a draft contractor invoice.',
    reject: 'Please provide a reason for rejection.',
    correction: 'Describe what needs to be corrected.',
    reopen: 'Admin action: This will unlock the entry and log the change in the audit trail.',
  };
  const required = action !== 'approve';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="card-elevated w-full max-w-md p-6 rounded-2xl animate-slide-up space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-700 text-foreground">{titles[action]}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{descriptions[action]}</p>
        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--secondary)' }}>
          <p className="font-600 text-foreground">{entry.contractor}</p>
          <p className="text-muted-foreground">
            {entry.job} · {entry.date} · {entry.totalHours?.toFixed(2)}h
          </p>
        </div>
        <div>
          <label className="block text-xs font-600 text-muted-foreground mb-1.5">
            Notes {required ? <span style={{ color: 'var(--danger)' }}>*</span> : '(optional)'}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={action === 'approve' ? 'Optional approval notes...' : 'Required...'}
            className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            style={{ borderColor: 'var(--border)' }}
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-600 border transition-colors hover:bg-secondary"
            style={{ borderColor: 'var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => (!required || notes.trim()) && onConfirm(notes.trim())}
            disabled={required && !notes.trim()}
            className="flex-1 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 disabled:opacity-40"
            style={{
              backgroundColor:
                action === 'approve'
                  ? 'var(--success)'
                  : action === 'reject'
                    ? 'var(--danger)'
                    : 'var(--accent)',
            }}
          >
            {action === 'approve'
              ? 'Approve'
              : action === 'reject'
                ? 'Reject'
                : action === 'correction'
                  ? 'Send Back'
                  : 'Reopen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditLogPanel({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('timesheet_audit_log')
        .select('*')
        .eq('time_entry_id', entryId)
        .order('created_at', { ascending: false });
      setLogs(
        (data || []).map((r: any) => ({
          id: r.id,
          action: r.action,
          performedBy: r.performed_by,
          oldStatus: r.old_status,
          newStatus: r.new_status,
          notes: r.notes,
          createdAt: r.created_at,
        }))
      );
      setLoading(false);
    };
    fetchLogs();
  }, [entryId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="card-elevated w-full max-w-lg rounded-2xl overflow-hidden animate-slide-up">
        <div
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h3 className="text-base font-700 text-foreground">Audit Log</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 max-h-96 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No audit history yet.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-3">
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground">{log.action}</p>
                  <p className="text-xs text-muted-foreground">by {log.performedBy}</p>
                  {log.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">
                      &ldquo;{log.notes}&rdquo;
                    </p>
                  )}
                  {log.oldStatus && log.newStatus && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {log.oldStatus} → {log.newStatus}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(log.createdAt).toLocaleString('en-AU', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function TimesheetApprovalPage() {
  const { companyId, user } = useAuth();
  const { role, hasPermission } = useRBAC();
  const { calculateTax } = useLocalisation();
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<TimesheetEntry | null>(null);
  const [actionModal, setActionModal] = useState<{
    entry: TimesheetEntry;
    action: 'approve' | 'reject' | 'correction' | 'reopen';
  } | null>(null);
  const [auditEntry, setAuditEntry] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const canApprove = role === 'admin' || role === 'manager';
  const isAdmin = role === 'admin';

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadEntries = async () => {
    setLoading(true);
    const supabase = createClient();
    let q = supabase.from('time_entries').select('*').order('created_at', { ascending: false });
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setEntries(
      (data || []).map((r: any) => ({
        id: r.id,
        date: r.entry_date,
        contractor: r.contractor,
        initials: r.initials,
        color: r.color,
        job: r.job,
        site: r.site,
        clockIn: r.clock_in,
        clockOut: r.clock_out,
        breakMinutes: r.break_minutes,
        totalHours: r.total_hours,
        status: r.entry_status,
        approvalStatus: (r.approval_status || 'in_progress') as ApprovalStatus,
        submittedAt: r.submitted_at,
        approvedAt: r.approved_at,
        approvedBy: r.approved_by,
        rejectionReason: r.rejection_reason,
        correctionNotes: r.correction_notes,
        isLocked: r.is_locked || false,
        hourlyRate: r.hourly_rate || 0,
        companyId: r.company_id,
      }))
    );
    setLoading(false);
  };

  const logAudit = async (
    entryId: string,
    action: string,
    oldStatus: string,
    newStatus: string,
    notes: string
  ) => {
    const supabase = createClient();
    await supabase.from('timesheet_audit_log').insert({
      time_entry_id: entryId,
      action,
      performed_by: user?.user_metadata?.full_name || user?.email || 'Unknown',
      performer_id: user?.id,
      old_status: oldStatus,
      new_status: newStatus,
      notes,
      company_id: companyId,
    });
  };

  const handleAction = async (notes: string) => {
    if (!actionModal) return;
    const { entry, action } = actionModal;
    const supabase = createClient();
    const now = new Date().toISOString();
    const userName = user?.user_metadata?.full_name || user?.email || 'Unknown';

    let updates: any = {};
    let newStatus: ApprovalStatus = entry.approvalStatus;
    let auditAction = '';

    if (action === 'approve') {
      newStatus = 'approved';
      updates = {
        approval_status: 'approved',
        approved_at: now,
        approved_by: userName,
        approver_id: user?.id,
        is_locked: true,
      };
      auditAction = 'Timesheet Approved';
    } else if (action === 'reject') {
      newStatus = 'rejected';
      updates = { approval_status: 'rejected', rejection_reason: notes };
      auditAction = 'Timesheet Rejected';
    } else if (action === 'correction') {
      newStatus = 'correction_required';
      updates = { approval_status: 'correction_required', correction_notes: notes };
      auditAction = 'Correction Requested';
    } else if (action === 'reopen') {
      newStatus = 'in_progress';
      updates = {
        approval_status: 'in_progress',
        is_locked: false,
        approved_at: null,
        approved_by: null,
      };
      auditAction = 'Entry Reopened by Admin';
    }

    await supabase.from('time_entries').update(updates).eq('id', entry.id);
    await logAudit(entry.id, auditAction, entry.approvalStatus, newStatus, notes);

    // Auto-generate draft invoice on approval
    if (action === 'approve') {
      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
      const hours = entry.totalHours || 0;

      // DEFECT REMEDIATED: the rate came solely from `time_entries.hourly_rate`,
      // a column nothing in the product ever populated, so `rate` was always 0
      // and every auto-generated contractor invoice was raised at $0.00/hr with
      // a $0.00 total. The contractor's agreed rate (added in migration
      // 20260817011000) is now used when the time entry carries none, and the
      // contractor's business identifier is carried onto the invoice — an
      // Australian tax invoice is not valid without it.
      let rate = entry.hourlyRate || 0;
      let contractorAbn: string | null = null;
      let contractorId: string | null = null;

      const { data: contractorRow } = await supabase
        .from('contractors')
        .select('id, hourly_rate, abn')
        .eq('name', entry.contractor)
        .eq('company_id', companyId ?? '')
        .maybeSingle();

      if (contractorRow) {
        contractorId = contractorRow.id ?? null;
        contractorAbn = contractorRow.abn ?? null;
        if (!rate && contractorRow.hourly_rate) rate = Number(contractorRow.hourly_rate);
      }

      const subtotal = hours * rate;
      // DEFECT REMEDIATED: GST was hard-coded at 10%, which is correct only for
      // Australia. The platform already resolves the tenant's tax rule through
      // the localisation layer (NZ 15%, US sales tax, …); `calculateTax` is
      // that authority.
      const { taxAmount, total } = calculateTax(subtotal);

      const { error: invoiceError } = await supabase.from('contractor_invoices').insert({
        invoice_number: invoiceNumber,
        time_entry_id: entry.id,
        contractor_id: contractorId,
        contractor_name: entry.contractor,
        contractor_abn: contractorAbn,
        company_id: companyId,
        job: entry.job,
        site: entry.site,
        work_date: entry.date,
        hours_worked: hours,
        hourly_rate: rate,
        subtotal,
        gst: taxAmount,
        total,
        inv_status: 'draft',
      });

      if (invoiceError) {
        logger.error('timesheet-approval', 'Failed to create draft contractor invoice', {
          entryId: entry.id,
          companyId,
          error: invoiceError.message,
        });
      }

      // Persist the resolved rate back onto the time entry so the approved
      // timesheet is a durable record of what was charged.
      if (rate && !entry.hourlyRate) {
        await supabase.from('time_entries').update({ hourly_rate: rate }).eq('id', entry.id);
      }
    }

    setActionModal(null);
    loadEntries();
  };

  const handleSubmit = async (entry: TimesheetEntry) => {
    const supabase = createClient();
    await supabase
      .from('time_entries')
      .update({ approval_status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', entry.id);
    await logAudit(entry.id, 'Timesheet Submitted', entry.approvalStatus, 'submitted', '');
    loadEntries();
  };

  const exportCSV = () => {
    const approved = entries.filter((e) => e.approvalStatus === 'approved');
    const headers = [
      'Date',
      'Contractor',
      'Job',
      'Site',
      'Clock In',
      'Clock Out',
      'Break (min)',
      'Total Hours',
      'Hourly Rate',
      'Amount',
      'Approved By',
      'Approved At',
    ];
    const rows = approved.map((e) => [
      e.date,
      e.contractor,
      e.job,
      e.site,
      e.clockIn,
      e.clockOut || '',
      e.breakMinutes,
      e.totalHours?.toFixed(2) || '0',
      e.hourlyRate,
      ((e.totalHours || 0) * e.hourlyRate).toFixed(2),
      e.approvedBy || '',
      e.approvedAt ? new Date(e.approvedAt).toLocaleDateString('en-AU') : '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `approved-timesheets-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = entries.filter((e) => {
    const matchSearch =
      !search ||
      e.contractor.toLowerCase().includes(search.toLowerCase()) ||
      e.job.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.approvalStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const stats = {
    submitted: entries.filter((e) => e.approvalStatus === 'submitted').length,
    approved: entries.filter((e) => e.approvalStatus === 'approved').length,
    pending: entries.filter((e) => e.approvalStatus === 'in_progress').length,
    correction: entries.filter((e) => e.approvalStatus === 'correction_required').length,
  };

  return (
    <AppLayout currentPath="/timesheet-approval">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header-title">Timesheet Approval</h1>
            <p className="page-header-subtitle">Review, approve and manage contractor timesheets</p>
          </div>
          <button
            onClick={exportCSV}
            className="btn-secondary"
            aria-label="Export approved timesheets as CSV"
          >
            <Download size={15} />
            Export Approved CSV
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Awaiting Approval', value: stats.submitted, color: '#2563EB', icon: Send },
            { label: 'Approved', value: stats.approved, color: '#10B981', icon: CheckCircle2 },
            { label: 'In Progress', value: stats.pending, color: '#F59E0B', icon: Clock },
            {
              label: 'Correction Required',
              value: stats.correction,
              color: '#8B5CF6',
              icon: AlertTriangle,
            },
          ].map((s) => (
            <div key={s.label} className="card-elevated p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${s.color}18` }}>
                  <s.icon size={14} style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-2xl font-700 text-foreground font-tabular">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search contractor or job..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none"
            style={{ borderColor: 'var(--border)' }}
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="card-elevated overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No timesheet entries found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    {['Contractor', 'Job / Site', 'Date', 'Hours', 'Status', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-600 text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b hover:bg-secondary/30 transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 text-white flex-shrink-0"
                            style={{ backgroundColor: entry.color }}
                          >
                            {entry.initials}
                          </div>
                          <div>
                            <p className="font-600 text-foreground text-xs">{entry.contractor}</p>
                            {entry.isLocked && (
                              <span
                                className="inline-flex items-center gap-0.5 text-xs"
                                style={{ color: 'var(--muted-foreground)' }}
                              >
                                <Lock size={10} /> Locked
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-600 text-foreground">{entry.job}</p>
                        <p className="text-xs text-muted-foreground">{entry.site}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{entry.date}</td>
                      <td className="px-4 py-3 text-xs font-600 text-foreground font-tabular">
                        {entry.totalHours?.toFixed(2) || '—'}h
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={entry.approvalStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Submit (contractor/supervisor) */}
                          {entry.approvalStatus === 'in_progress' && !entry.isLocked && (
                            <button
                              onClick={() => handleSubmit(entry)}
                              className="px-2 py-1 rounded text-xs font-600 transition-colors hover:opacity-80"
                              style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: '#2563EB' }}
                            >
                              Submit
                            </button>
                          )}
                          {/* Approve/Reject (manager/admin) */}
                          {canApprove && entry.approvalStatus === 'submitted' && (
                            <>
                              <button
                                onClick={() => setActionModal({ entry, action: 'approve' })}
                                className="px-2 py-1 rounded text-xs font-600 transition-colors hover:opacity-80"
                                style={{
                                  backgroundColor: 'rgba(16,185,129,0.1)',
                                  color: '#10B981',
                                }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setActionModal({ entry, action: 'reject' })}
                                className="px-2 py-1 rounded text-xs font-600 transition-colors hover:opacity-80"
                                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => setActionModal({ entry, action: 'correction' })}
                                className="px-2 py-1 rounded text-xs font-600 transition-colors hover:opacity-80"
                                style={{
                                  backgroundColor: 'rgba(139,92,246,0.1)',
                                  color: '#8B5CF6',
                                }}
                              >
                                Correct
                              </button>
                            </>
                          )}
                          {/* Reopen (admin only) */}
                          {isAdmin && entry.isLocked && (
                            <button
                              onClick={() => setActionModal({ entry, action: 'reopen' })}
                              className="px-2 py-1 rounded text-xs font-600 transition-colors hover:opacity-80"
                              style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}
                            >
                              Reopen
                            </button>
                          )}
                          {/* Audit log */}
                          <button
                            onClick={() => setAuditEntry(entry.id)}
                            className="p-1.5 rounded hover:bg-secondary transition-colors"
                            title="Audit Log"
                          >
                            <FileText size={13} className="text-muted-foreground" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded text-xs font-600 border disabled:opacity-40 hover:bg-secondary transition-colors"
                style={{ borderColor: 'var(--border)' }}
              >
                Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="px-3 py-1.5 rounded text-xs font-600 border transition-colors"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: p === page ? 'var(--accent)' : 'transparent',
                      color: p === page ? 'white' : 'var(--foreground)',
                    }}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded text-xs font-600 border disabled:opacity-40 hover:bg-secondary transition-colors"
                style={{ borderColor: 'var(--border)' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {actionModal && (
        <ActionModal
          entry={actionModal.entry}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onConfirm={handleAction}
        />
      )}
      {auditEntry && <AuditLogPanel entryId={auditEntry} onClose={() => setAuditEntry(null)} />}
    </AppLayout>
  );
}
