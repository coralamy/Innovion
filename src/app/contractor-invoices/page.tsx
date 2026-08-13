'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { FileText, Download, Send, Eye, CheckCircle2, Clock, X, Loader2, Search, DollarSign } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


type InvoiceStatus = 'draft' | 'reviewed' | 'submitted' | 'paid' | 'cancelled';

interface ContractorInvoice {
  id: string;
  invoiceNumber: string;
  timeEntryId: string;
  contractorName: string;
  contractorEmail: string;
  contractorAbn: string;
  companyId: string;
  job: string;
  site: string;
  workDate: string;
  hoursWorked: number;
  hourlyRate: number;
  subtotal: number;
  gst: number;
  total: number;
  status: InvoiceStatus;
  reviewedAt?: string;
  submittedAt?: string;
  submittedBy?: string;
  emailSentAt?: string;
  notes: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: Clock },
  reviewed: { label: 'Reviewed', color: '#2563EB', bg: 'rgba(37,99,235,0.1)', icon: Eye },
  submitted: { label: 'Submitted', color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: Send },
  paid: { label: 'Paid', color: '#10B981', bg: 'rgba(16,185,129,0.15)', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: '#6B7280', bg: 'rgba(107,114,128,0.1)', icon: X },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

interface InvoicePreviewProps {
  invoice: ContractorInvoice;
  companyName: string;
  onClose: () => void;
  onSubmit: (invoice: ContractorInvoice, sendEmail: boolean) => void;
}

function InvoicePreview({ invoice, companyName, onClose, onSubmit }: InvoicePreviewProps) {
  const [submitting, setSubmitting] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  const downloadPDF = () => {
    // Build printable HTML invoice
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Invoice ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #111; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .title { font-size: 28px; font-weight: bold; color: #2563EB; }
    .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .value { font-size: 14px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; color: #666; }
    td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    .totals { margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .total-final { font-size: 16px; font-weight: bold; border-top: 2px solid #111; padding-top: 8px; margin-top: 4px; }
    .notice { background: #fef3c7; border: 1px solid #fcd34d; padding: 12px 16px; border-radius: 6px; font-size: 12px; margin-top: 32px; }
    .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">TAX INVOICE</div>
      <div style="margin-top:8px">
        <div class="label">Invoice Number</div>
        <div class="value">${invoice.invoiceNumber}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div class="label">Date</div>
      <div class="value">${new Date().toLocaleDateString('en-AU')}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px">
    <div>
      <div class="label">From (Contractor)</div>
      <div class="value">${invoice.contractorName}</div>
      ${invoice.contractorAbn ? `<div style="font-size:12px;color:#666">ABN: ${invoice.contractorAbn}</div>` : ''}
      ${invoice.contractorEmail ? `<div style="font-size:12px;color:#666">${invoice.contractorEmail}</div>` : ''}
    </div>
    <div>
      <div class="label">To (Client)</div>
      <div class="value">${companyName}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Date</th>
        <th>Hours</th>
        <th>Rate</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${invoice.job} — ${invoice.site}</td>
        <td>${invoice.workDate}</td>
        <td>${invoice.hoursWorked.toFixed(2)}</td>
        <td>$${invoice.hourlyRate.toFixed(2)}/hr</td>
        <td style="text-align:right">$${invoice.subtotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>$${invoice.subtotal.toFixed(2)}</span></div>
    <div class="total-row"><span>GST (10%)</span><span>$${invoice.gst.toFixed(2)}</span></div>
    <div class="total-row total-final"><span>Total (AUD)</span><span>$${invoice.total.toFixed(2)}</span></div>
  </div>

  <div class="notice">
    <strong>Important:</strong> This is a Tax Invoice issued by ${invoice.contractorName} (the contractor). 
    This is NOT a Recipient Created Tax Invoice (RCTI). The contractor is responsible for issuing this invoice 
    and for their own GST obligations.
  </div>

  <div class="footer">
    Generated by Innovion Workforce Management · ${new Date().toLocaleDateString('en-AU')}
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) w.print();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="card-elevated w-full max-w-2xl rounded-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-base font-700 text-foreground">Tax Invoice Preview</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.invoiceNumber} · Issued by {invoice.contractorName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary"><X size={16} className="text-muted-foreground" /></button>
        </div>

        {/* Invoice body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Notice */}
          <div className="p-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#92400E', border: '1px solid rgba(245,158,11,0.3)' }}>
            <strong>Contractor Tax Invoice:</strong> This invoice is issued by {invoice.contractorName}. It is NOT a Recipient Created Tax Invoice (RCTI). The contractor is responsible for issuing this invoice.
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
              <p className="text-xs font-600 text-muted-foreground mb-2">FROM (Contractor)</p>
              <p className="text-sm font-700 text-foreground">{invoice.contractorName}</p>
              {invoice.contractorAbn && <p className="text-xs text-muted-foreground">ABN: {invoice.contractorAbn}</p>}
              {invoice.contractorEmail && <p className="text-xs text-muted-foreground">{invoice.contractorEmail}</p>}
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
              <p className="text-xs font-600 text-muted-foreground mb-2">TO (Client)</p>
              <p className="text-sm font-700 text-foreground">{companyName}</p>
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--secondary)' }}>
                  {['Description', 'Date', 'Hours', 'Rate', 'Amount'].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-600 text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-3 text-xs">{invoice.job} — {invoice.site}</td>
                  <td className="px-3 py-3 text-xs">{invoice.workDate}</td>
                  <td className="px-3 py-3 text-xs font-tabular">{invoice.hoursWorked.toFixed(2)}</td>
                  <td className="px-3 py-3 text-xs font-tabular">${invoice.hourlyRate.toFixed(2)}/hr</td>
                  <td className="px-3 py-3 text-xs font-tabular font-600">${invoice.subtotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="ml-auto w-64 space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-tabular">${invoice.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST (10%)</span><span className="font-tabular">${invoice.gst.toFixed(2)}</span></div>
            <div className="flex justify-between text-base font-700 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
              <span>Total (AUD)</span><span className="font-tabular">${invoice.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Submit options */}
          {invoice.status === 'draft' && (
            <div className="p-4 rounded-lg border space-y-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-600 text-foreground">Submission Options</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="rounded" />
                <span className="text-sm text-foreground">Email invoice to company on my behalf</span>
              </label>
              {sendEmail && (
                <p className="text-xs text-muted-foreground pl-6">
                  By submitting, you authorise Innovion to send this invoice on your behalf. The email will clearly identify you as the sender and this invoice as your Tax Invoice.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 p-5 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button onClick={downloadPDF} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 border transition-colors hover:bg-secondary" style={{ borderColor: 'var(--border)' }}>
            <Download size={15} />
            Download PDF
          </button>
          {invoice.status === 'draft' && (
            <button
              onClick={() => { setSubmitting(true); onSubmit(invoice, sendEmail); }}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 disabled:opacity-50 ml-auto"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Submit Invoice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContractorInvoicesPage() {
  const { companyId } = useAuth();
  const [invoices, setInvoices] = useState<ContractorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewInvoice, setPreviewInvoice] = useState<ContractorInvoice | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();

    // Load company name
    if (companyId) {
      const { data: co } = await supabase.from('companies').select('name').eq('id', companyId).single();
      if (co) setCompanyName(co.name);
    }

    let q = supabase.from('contractor_invoices').select('*').order('created_at', { ascending: false });
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;

    setInvoices((data || []).map((r: any) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      timeEntryId: r.time_entry_id,
      contractorName: r.contractor_name,
      contractorEmail: r.contractor_email,
      contractorAbn: r.contractor_abn || '',
      companyId: r.company_id,
      job: r.job,
      site: r.site,
      workDate: r.work_date,
      hoursWorked: r.hours_worked,
      hourlyRate: r.hourly_rate,
      subtotal: r.subtotal,
      gst: r.gst,
      total: r.total,
      status: r.inv_status as InvoiceStatus,
      reviewedAt: r.reviewed_at,
      submittedAt: r.submitted_at,
      submittedBy: r.submitted_by,
      emailSentAt: r.email_sent_at,
      notes: r.notes || '',
      createdAt: r.created_at,
    })));
    setLoading(false);
  };

  const handleSubmit = async (invoice: ContractorInvoice, sendEmail: boolean) => {
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase.from('contractor_invoices').update({
      inv_status: 'submitted',
      submitted_at: now,
      submitted_by: invoice.contractorName,
      email_sent_at: sendEmail ? now : null,
    }).eq('id', invoice.id);

    // Log audit
    await supabase.from('invoice_audit_log').insert({
      invoice_id: invoice.id,
      action: sendEmail ? 'Invoice Submitted & Emailed' : 'Invoice Submitted',
      performed_by: invoice.contractorName,
      old_status: 'draft',
      new_status: 'submitted',
      company_id: companyId,
    });

    setPreviewInvoice(null);
    loadData();
  };

  const filtered = invoices.filter((inv) => {
    const matchSearch = !search || inv.contractorName.toLowerCase().includes(search.toLowerCase()) || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const totalValue = invoices.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0);
  const submittedCount = invoices.filter((i) => i.status === 'submitted').length;
  const draftCount = invoices.filter((i) => i.status === 'draft').length;

  return (
    <AppLayout currentPath="/contractor-invoices">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="page-header-title">Contractor Invoices</h1>
          <p className="page-header-subtitle">Tax invoices generated from approved timesheets — issued by contractors</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Draft Invoices', value: draftCount, color: '#F59E0B', icon: Clock },
            { label: 'Submitted', value: submittedCount, color: '#10B981', icon: CheckCircle2 },
            { label: 'Total Value', value: `$${totalValue.toFixed(0)}`, color: '#2563EB', icon: DollarSign },
            { label: 'Total Invoices', value: invoices.length, color: '#8B5CF6', icon: FileText },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-card-icon" style={{ backgroundColor: `${s.color}18` }}>
                <s.icon size={16} style={{ color: s.color }} />
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
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input type="text" placeholder="Search contractor or invoice..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field input-field-search" aria-label="Search invoices" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="select-field" aria-label="Filter by status">
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="card-elevated overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No invoices yet. Approve timesheets to generate draft invoices.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    {['Invoice #', 'Contractor', 'Job / Site', 'Date', 'Hours', 'Total', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-secondary/30 transition-colors" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-3 text-xs font-600 text-foreground font-tabular">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-xs font-600 text-foreground">{inv.contractorName}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-600 text-foreground">{inv.job}</p>
                        <p className="text-xs text-muted-foreground">{inv.site}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{inv.workDate}</td>
                      <td className="px-4 py-3 text-xs font-tabular">{inv.hoursWorked.toFixed(2)}h</td>
                      <td className="px-4 py-3 text-xs font-700 font-tabular text-foreground">${inv.total.toFixed(2)}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3">
                        <button onClick={() => setPreviewInvoice(inv)} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-600 transition-colors hover:opacity-80" style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: '#2563EB' }}>
                          <Eye size={12} />
                          {inv.status === 'draft' ? 'Review & Submit' : 'View'}
                        </button>
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
            <p className="text-xs text-muted-foreground">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded text-xs font-600 border disabled:opacity-40 hover:bg-secondary" style={{ borderColor: 'var(--border)' }}>Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded text-xs font-600 border disabled:opacity-40 hover:bg-secondary" style={{ borderColor: 'var(--border)' }}>Next</button>
            </div>
          </div>
        )}
      </div>

      {previewInvoice && (
        <InvoicePreview
          invoice={previewInvoice}
          companyName={companyName}
          onClose={() => setPreviewInvoice(null)}
          onSubmit={handleSubmit}
        />
      )}
    </AppLayout>
  );
}
