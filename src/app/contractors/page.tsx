'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { UserCheck, Plus, Search, MoreHorizontal, MapPin, Phone, Mail, Star, Briefcase, AlertCircle, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { contractorService, Contractor } from '@/lib/services/contractorService';
import { useRBAC } from '@/contexts/RBACContext';
import { useAuth } from '@/contexts/AuthContext';

const availabilityConfig: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  available: { bg: 'var(--success-bg)', text: 'var(--success)', label: 'Available', dot: 'var(--success)' },
  'on-job': { bg: 'var(--info-bg)', text: 'var(--info)', label: 'On Job', dot: 'var(--info)' },
  unavailable: { bg: 'var(--secondary)', text: 'var(--muted-foreground)', label: 'Unavailable', dot: 'var(--muted-foreground)' },
  leave: { bg: 'var(--warning-bg)', text: 'var(--warning)', label: 'On Leave', dot: 'var(--warning)' },
};

const complianceConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  compliant: { icon: CheckCircle2, color: 'var(--success)', label: 'Compliant' },
  expiring: { icon: AlertCircle, color: 'var(--warning)', label: 'Expiring Soon' },
  expired: { icon: XCircle, color: 'var(--danger)', label: 'Expired' },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={11} fill={s <= Math.round(rating) ? '#F59E0B' : 'none'} stroke={s <= Math.round(rating) ? '#F59E0B' : '#CBD5E1'} />
      ))}
      <span className="ml-1 text-xs font-600 text-muted-foreground">{rating}</span>
    </div>
  );
}

const PAGE_SIZE = 15;

export default function ContractorsPage() {
  const { hasPermission } = useRBAC();
  const { companyId } = useAuth();
  const canManage = hasPermission('canManageJobs');

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterAvail, setFilterAvail] = useState('all');
  const [filterCompliance, setFilterCompliance] = useState('all');
  const [selected, setSelected] = useState<Contractor | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadContractors();
  }, [companyId]);

  const loadContractors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contractorService.getAll(companyId);
      setContractors(data);
    } catch {
      setError('Failed to load contractors. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = contractors.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.role.toLowerCase().includes(search.toLowerCase());
    const matchAvail = filterAvail === 'all' || c.availability === filterAvail;
    const matchComp = filterCompliance === 'all' || c.complianceStatus === filterCompliance;
    return matchSearch && matchAvail && matchComp;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: contractors.length,
    available: contractors.filter((c) => c.availability === 'available').length,
    onJob: contractors.filter((c) => c.availability === 'on-job').length,
    complianceIssues: contractors.filter((c) => c.complianceStatus !== 'compliant').length,
  };

  return (
    <AppLayout currentPath="/contractors">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-700 text-foreground">Contractors</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage workforce, availability, and compliance</p>
          </div>
          {canManage && (
            <button className="btn-primary">
              <Plus size={16} />Add Contractor
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Contractors', value: stats.total, icon: UserCheck, color: 'var(--accent)' },
            { label: 'Available Now', value: stats.available, icon: CheckCircle2, color: 'var(--success)' },
            { label: 'On Job', value: stats.onJob, icon: Briefcase, color: 'var(--info)' },
            { label: 'Compliance Issues', value: stats.complianceIssues, icon: AlertCircle, color: stats.complianceIssues > 0 ? 'var(--danger)' : 'var(--success)' },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-card-icon" style={{ backgroundColor: `${s.color}18` }}><s.icon size={18} style={{ color: s.color }} /></div>
              <div><p className="stat-card-value">{s.value}</p><p className="stat-card-label">{s.label}</p></div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input suppressHydrationWarning type="text" placeholder="Search contractors..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input-field input-field-search" />
          </div>
          <select suppressHydrationWarning value={filterAvail} onChange={(e) => { setFilterAvail(e.target.value); setPage(1); }} className="select-field">
            <option value="all">All Availability</option>
            <option value="available">Available</option>
            <option value="on-job">On Job</option>
            <option value="unavailable">Unavailable</option>
            <option value="leave">On Leave</option>
          </select>
          <select suppressHydrationWarning value={filterCompliance} onChange={(e) => { setFilterCompliance(e.target.value); setPage(1); }} className="select-field">
            <option value="all">All Compliance</option>
            <option value="compliant">Compliant</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} contractors</span>
        </div>

        {error && <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</div>}

        {loading ? (
          <div className="card-elevated">
            <div className="empty-state"><UserCheck size={40} className="empty-state-icon animate-pulse" /><p className="empty-state-desc">Loading contractors...</p></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-3">
              {paginated.map((c) => {
                const ac = availabilityConfig[c.availability] || availabilityConfig['unavailable'];
                const cc = complianceConfig[c.complianceStatus] || complianceConfig['compliant'];
                const CompIcon = cc.icon;
                const isSelected = selected?.id === c.id;
                return (
                  <div key={c.id} onClick={() => setSelected(isSelected ? null : c)} className={`list-item-card${isSelected ? ' selected' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-700 text-white flex-shrink-0" style={{ backgroundColor: c.color || 'var(--accent)' }}>{c.initials}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-700 text-foreground">{c.name}</p>
                            <span className="status-badge" style={{ backgroundColor: ac.bg, color: ac.text }}>
                              <span className="w-1.5 h-1.5 rounded-full inline-block mr-1" style={{ backgroundColor: ac.dot }} />{ac.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{c.role} · {c.location}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <StarRating rating={c.rating} />
                            <div className="flex items-center gap-1 text-xs" style={{ color: cc.color }}>
                              <CompIcon size={11} />{cc.label}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-700 text-foreground font-tabular">{c.jobsCompleted}</p>
                          <p className="text-xs text-muted-foreground">jobs done</p>
                        </div>
                        {canManage && (
                          <button className="btn-ghost p-1.5" onClick={(e) => e.stopPropagation()}><MoreHorizontal size={16} /></button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && !loading && (
                <div className="card-elevated">
                  <div className="empty-state"><UserCheck size={36} className="empty-state-icon" /><p className="empty-state-title">No contractors found</p><p className="empty-state-desc">Try adjusting your filters</p></div>
                </div>
              )}
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="card-elevated flex items-center justify-between px-4 py-3">
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

            <div className="xl:col-span-1">
              {selected ? (
                <div className="card-elevated p-5 space-y-4 sticky top-6 animate-slide-up">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-700 text-white" style={{ backgroundColor: selected.color || 'var(--accent)' }}>{selected.initials}</div>
                    <div><h3 className="font-700 text-foreground">{selected.name}</h3><p className="text-xs text-muted-foreground">{selected.role}</p></div>
                  </div>
                  <div className="space-y-2">
                    {[{ icon: Phone, label: selected.phone }, { icon: Mail, label: selected.email }, { icon: MapPin, label: selected.location }].map((item) => (
                      <div key={item.label} className="flex items-center gap-2 text-sm"><item.icon size={13} className="text-muted-foreground flex-shrink-0" /><span className="text-foreground text-xs">{item.label}</span></div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ label: 'Jobs Done', value: selected.jobsCompleted }, { label: 'Rating', value: selected.rating }, { label: 'Hourly Rate', value: selected.hourlyRate }, { label: 'ABN', value: selected.abn }].map((m) => (
                      <div key={m.label} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}><p className="text-base font-700 text-foreground font-tabular">{m.value}</p><p className="text-xs text-muted-foreground">{m.label}</p></div>
                    ))}
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button className="flex-1 py-2 rounded-lg text-sm font-600 text-white" style={{ backgroundColor: 'var(--accent)' }}>Assign Job</button>
                      <button className="flex-1 py-2 rounded-lg text-sm font-600 border" style={{ borderColor: 'var(--border)' }}>Edit</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card-elevated p-8 text-center"><UserCheck size={36} className="mx-auto text-muted-foreground mb-3 opacity-30" /><p className="text-sm text-muted-foreground">Select a contractor to view details</p></div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
