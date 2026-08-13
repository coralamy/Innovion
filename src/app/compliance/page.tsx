'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { ShieldCheck, Plus, Search, AlertTriangle, CheckCircle2, XCircle, Clock, FileText, RefreshCw, Download, Calendar, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { complianceService, ComplianceRecord } from '@/lib/services/complianceService';
import { emailService } from '@/lib/emailService';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { logActivity } from '@/lib/activityLogger';

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: React.ElementType; dot: string }> = {
  compliant: { bg: 'var(--success-bg)', text: 'var(--success)', label: 'Compliant', icon: CheckCircle2, dot: 'var(--success)' },
  expiring: { bg: 'var(--warning-bg)', text: 'var(--warning)', label: 'Expiring Soon', icon: Clock, dot: 'var(--warning)' },
  expired: { bg: 'var(--danger-bg)', text: 'var(--danger)', label: 'Expired', icon: XCircle, dot: 'var(--danger)' },
  pending: { bg: 'rgba(139,92,246,0.1)', text: '#8B5CF6', label: 'Pending', icon: RefreshCw, dot: '#8B5CF6' },
};

const categoryLabels: Record<string, string> = {
  license: 'License', insurance: 'Insurance', certification: 'Certification', whs: 'WHS', induction: 'Induction',
};

const PAGE_SIZE = 15;

export default function CompliancePage() {
  const { user, companyId } = useAuth();
  const { hasPermission } = useRBAC();
  const canManage = hasPermission('canManageCompliance');

  const [items, setItems] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [newItem, setNewItem] = useState({ title: '', assignedTo: '', issuedBy: '', expiryDate: '', documentRef: '' });

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const data = await complianceService.getAll(companyId);
        setItems(data);
        if (data.length > 0 && user?.email) {
          const alertItems = data.filter((i) => i.status === 'expiring' || i.status === 'expired');
          if (alertItems.length > 0) {
            const emailItems = alertItems.map((i) => ({ title: i.title, assignedTo: i.assignedTo, expiryDate: i.expiryDate || 'N/A', status: i.status }));
            emailService.sendComplianceAlert(user.email, user.user_metadata?.full_name || 'Manager', emailItems).catch(() => {});
          }
        }
      } catch {
        setError('Failed to load compliance data. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user]);

  const filtered = items.filter((item) => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) || item.assignedTo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchCat = filterCategory === 'all' || item.category === filterCategory;
    return matchSearch && matchStatus && matchCat;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    compliant: items.filter((i) => i.status === 'compliant').length,
    expiring: items.filter((i) => i.status === 'expiring').length,
    expired: items.filter((i) => i.status === 'expired').length,
    pending: items.filter((i) => i.status === 'pending').length,
  };

  const handleCreate = async () => {
    if (!newItem.title.trim()) return;
    setSaving(true);
    const created = await complianceService.create({
      ...newItem, category: 'certification', assignedType: 'employee',
      status: 'compliant', daysUntilExpiry: 365, lastReviewed: new Date().toLocaleDateString('en-AU'),
    }, companyId);
    if (created) {
      setItems((prev) => [created, ...prev]);
      setShowNewForm(false);
      setNewItem({ title: '', assignedTo: '', issuedBy: '', expiryDate: '', documentRef: '' });
      if (user) {
        await logActivity({
          userId: user.id, companyId, action: 'compliance_alert',
          entityType: 'compliance_item', entityId: created.id,
          description: `Compliance item added: ${created.title}`,
          metadata: { category: created.category, assignedTo: created.assignedTo },
        });
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await complianceService.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (user) {
      await logActivity({
        userId: user.id, companyId, action: 'compliance_alert',
        entityType: 'compliance_item', entityId: id,
        description: 'Compliance item deleted',
      });
    }
  };

  return (
    <AppLayout currentPath="/compliance">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-700 text-foreground">Compliance</h1>
            <p className="text-sm text-muted-foreground mt-1">Track licenses, certifications, insurance, and WHS requirements</p>
          </div>
          {canManage && (
            <button onClick={() => setShowNewForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: 'var(--accent)' }}>
              <Plus size={16} />Add Item
            </button>
          )}
        </div>

        {error && (
          <div className="alert-error" role="alert">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-600">{error}</p>
            </div>
            <button onClick={() => { setError(null); setLoading(true); complianceService.getAll(companyId).then((data) => { setItems(data); setLoading(false); }).catch(() => { setError('Failed to load compliance data.'); setLoading(false); }); }} className="text-xs font-600 underline underline-offset-2 flex-shrink-0">Retry</button>
          </div>
        )}

        {canManage && showNewForm && (
          <div className="card-elevated p-5 space-y-4 animate-slide-up">
            <h3 className="text-sm font-700 text-foreground">New Compliance Item</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'title', label: 'Title', placeholder: 'Working at Heights Certificate' },
                { key: 'assignedTo', label: 'Assigned To', placeholder: 'John Smith' },
                { key: 'issuedBy', label: 'Issued By', placeholder: 'SafeWork NSW' },
                { key: 'expiryDate', label: 'Expiry Date', placeholder: '01 Jan 2027' },
                { key: 'documentRef', label: 'Document Ref', placeholder: 'WAH-2025-JS' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-600 text-muted-foreground mb-1">{f.label}</label>
                  <input suppressHydrationWarning type="text" placeholder={f.placeholder} value={(newItem as Record<string, string>)[f.key]} onChange={(e) => setNewItem((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30" style={{ borderColor: 'var(--border)' }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-600 text-white disabled:opacity-60" style={{ backgroundColor: 'var(--accent)' }}>{saving ? 'Saving...' : 'Add Item'}</button>
              <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-lg text-sm font-600 border" style={{ borderColor: 'var(--border)' }}>Cancel</button>
            </div>
          </div>
        )}

        {!loading && (stats.expired > 0 || stats.expiring > 0) && (
          <div className="rounded-xl p-4 flex items-start gap-3 border" style={{ backgroundColor: 'var(--danger-bg)', borderColor: 'rgba(239,68,68,0.3)' }}>
            <AlertTriangle size={18} className="text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-700 text-danger">Compliance Action Required</p>
              <p className="text-sm text-danger/80 mt-0.5">
                {stats.expired > 0 && `${stats.expired} item${stats.expired > 1 ? 's' : ''} expired`}
                {stats.expired > 0 && stats.expiring > 0 && ' · '}
                {stats.expiring > 0 && `${stats.expiring} item${stats.expiring > 1 ? 's' : ''} expiring within 30 days`}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Compliant', value: loading ? '—' : stats.compliant, color: 'var(--success)', icon: CheckCircle2 },
            { label: 'Expiring Soon', value: loading ? '—' : stats.expiring, color: 'var(--warning)', icon: Clock },
            { label: 'Expired', value: loading ? '—' : stats.expired, color: 'var(--danger)', icon: XCircle },
            { label: 'Pending Review', value: loading ? '—' : stats.pending, color: '#8B5CF6', icon: RefreshCw },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-card-icon" style={{ backgroundColor: `${s.color}18` }}><s.icon size={18} style={{ color: s.color }} /></div>
              <div><p className="stat-card-value">{s.value}</p><p className="stat-card-label">{s.label}</p></div>
            </div>
          ))}
        </div>

        <div className="filter-bar">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input suppressHydrationWarning type="text" placeholder="Search compliance items..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input-field input-field-search" />
          </div>
          <select suppressHydrationWarning value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="select-field">
            <option value="all">All Status</option>
            <option value="compliant">Compliant</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired</option>
            <option value="pending">Pending</option>
          </select>
          <select suppressHydrationWarning value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }} className="select-field">
            <option value="all">All Categories</option>
            <option value="license">License</option>
            <option value="insurance">Insurance</option>
            <option value="certification">Certification</option>
            <option value="whs">WHS</option>
            <option value="induction">Induction</option>
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} items</span>
        </div>

        <div className="card-elevated overflow-hidden">
          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}>
                    {['Item', 'Category', 'Assigned To', 'Issued By', 'Expiry Date', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-600 uppercase tracking-wide text-muted-foreground whitespace-nowrap" style={{ fontSize: '11px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="skeleton w-4 h-4 rounded flex-shrink-0" />
                          <div>
                            <div className="skeleton h-3.5 w-40 mb-1.5" />
                            <div className="skeleton h-2.5 w-24" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><div className="skeleton h-5 w-20 rounded-full" /></td>
                      <td className="px-4 py-3.5">
                        <div className="skeleton h-3.5 w-28 mb-1.5" />
                        <div className="skeleton h-2.5 w-16" />
                      </td>
                      <td className="px-4 py-3.5"><div className="skeleton h-3.5 w-24" /></td>
                      <td className="px-4 py-3.5">
                        <div className="skeleton h-3.5 w-20 mb-1.5" />
                        <div className="skeleton h-2.5 w-16" />
                      </td>
                      <td className="px-4 py-3.5"><div className="skeleton h-5 w-24 rounded-full" /></td>
                      <td className="px-4 py-3.5"><div className="skeleton h-6 w-12 rounded-md" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}>
                    {['Item', 'Category', 'Assigned To', 'Issued By', 'Expiry Date', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-600 uppercase tracking-wide text-muted-foreground whitespace-nowrap" style={{ fontSize: '11px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item, idx) => {
                    const sc = statusConfig[item.status];
                    const StatusIcon = sc.icon;
                    return (
                      <tr key={item.id} className="transition-colors hover:bg-secondary/50" style={{ borderBottom: idx < paginated.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                            <div><p className="text-sm font-600 text-foreground">{item.title}</p><p className="text-xs text-muted-foreground">{item.documentRef}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full font-500" style={{ backgroundColor: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>{categoryLabels[item.category]}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-sm"><User size={12} className="text-muted-foreground" /><span>{item.assignedTo}</span></div>
                          <p className="text-xs text-muted-foreground capitalize mt-0.5">{item.assignedType}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{item.issuedBy}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-sm"><Calendar size={12} className="text-muted-foreground" /><span className={item.daysUntilExpiry < 0 ? 'text-danger font-600' : item.daysUntilExpiry < 30 ? 'text-warning font-600' : 'text-foreground'}>{item.expiryDate}</span></div>
                          {item.daysUntilExpiry < 30 && item.daysUntilExpiry >= 0 && <p className="text-xs text-warning mt-0.5">{item.daysUntilExpiry} days left</p>}
                          {item.daysUntilExpiry < 0 && <p className="text-xs text-danger mt-0.5">{Math.abs(item.daysUntilExpiry)} days overdue</p>}
                        </td>
                        <td className="px-4 py-3"><span className="status-badge flex items-center gap-1 w-fit" style={{ backgroundColor: sc.bg, color: sc.text }}><StatusIcon size={11} />{sc.label}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button className="p-1.5 rounded hover:bg-secondary transition-colors" title="Download"><Download size={13} className="text-muted-foreground" /></button>
                            {canManage && <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-secondary transition-colors" title="Delete"><XCircle size={13} className="text-muted-foreground" /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length === 0 && !loading && (
            <div className="empty-state">
              <ShieldCheck size={40} className="empty-state-icon" />
              <p className="empty-state-title">No compliance items found</p>
              <p className="empty-state-desc">
                {search || filterStatus !== 'all' || filterCategory !== 'all' ?'Try adjusting your search or filter criteria' :'Add your first compliance item to start tracking licenses, certifications, and insurance'}
              </p>
              {canManage && !search && filterStatus === 'all' && filterCategory === 'all' && (
                <div className="empty-state-action">
                  <button onClick={() => setShowNewForm(true)} className="btn-primary">
                    <Plus size={15} />Add First Item
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs text-muted-foreground">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="pagination-btn"><ChevronLeft size={16} /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
                  <React.Fragment key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                    <button onClick={() => setPage(p)} className={`pagination-btn${p === page ? ' active' : ''}`}>{p}</button>
                  </React.Fragment>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="pagination-btn"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
