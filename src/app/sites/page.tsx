'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { MapPin, Plus, Search, Building2, Briefcase, MoreHorizontal, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { siteService, SiteRecord } from '@/lib/services/siteService';
import { useRBAC } from '@/contexts/RBACContext';
import { useAuth } from '@/contexts/AuthContext';

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'var(--success-bg)', text: 'var(--success)', label: 'Active' },
  inactive: { bg: 'var(--secondary)', text: 'var(--muted-foreground)', label: 'Inactive' },
  'on-hold': { bg: 'var(--warning-bg)', text: 'var(--warning)', label: 'On Hold' },
};

const typeColors: Record<string, string> = {
  Entertainment: '#8B5CF6', Retail: '#2563EB', 'Commercial RE': '#10B981',
  Healthcare: '#EF4444', Technology: '#06B6D4', Industrial: '#F59E0B',
};

export default function SitesPage() {
  const { hasPermission } = useRBAC();
  const { companyId } = useAuth();
  const canManage = hasPermission('canManageJobs');
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selected, setSelected] = useState<SiteRecord | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', client: '', address: '', suburb: '', state: '', type: '', area: '', frequency: '' });
  const [page, setPage] = useState(1);

  useEffect(() => {
    siteService.getAll(companyId).then((data) => { setSites(data); setLoading(false); });
  }, [companyId]);

  const types = [...new Set(sites.map((s) => s.type))];

  const filtered = sites.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.client.toLowerCase().includes(search.toLowerCase()) || s.suburb.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchType = filterType === 'all' || s.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreate = async () => {
    if (!newSite.name.trim()) return;
    setSaving(true);
    const created = await siteService.create({ ...newSite, floors: 1, activeJobs: 0, lastService: 'Never', nextService: 'TBD', status: 'active', assignedTeam: [], accessNotes: '', logo: newSite.name.slice(0, 2).toUpperCase() }, companyId);
    if (created) { setSites((prev) => [created, ...prev]); setShowNewForm(false); setNewSite({ name: '', client: '', address: '', suburb: '', state: '', type: '', area: '', frequency: '' }); }
    setSaving(false);
  };

  return (
    <AppLayout currentPath="/sites">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-700 text-foreground">Sites</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage service locations, access notes, and schedules</p>
          </div>
          <button onClick={() => setShowNewForm(true)} className="btn-primary" style={{ display: canManage ? undefined : 'none' }}>
            <Plus size={16} />Add Site
          </button>
        </div>

        {canManage && showNewForm && (
          <div className="card-elevated p-5 space-y-4 animate-slide-up">
            <h3 className="text-sm font-700 text-foreground">New Site</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Site Name', placeholder: 'Building Level 1' },
                { key: 'client', label: 'Client', placeholder: 'Client Name' },
                { key: 'address', label: 'Address', placeholder: '123 Main St' },
                { key: 'suburb', label: 'Suburb', placeholder: 'Sydney CBD' },
                { key: 'state', label: 'State', placeholder: 'NSW' },
                { key: 'type', label: 'Type', placeholder: 'Commercial RE' },
                { key: 'area', label: 'Area', placeholder: '1,200 m²' },
                { key: 'frequency', label: 'Frequency', placeholder: 'Weekly' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-600 text-muted-foreground mb-1">{f.label}</label>
                  <input suppressHydrationWarning type="text" placeholder={f.placeholder} value={(newSite as Record<string, string>)[f.key]} onChange={(e) => setNewSite((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30" style={{ borderColor: 'var(--border)' }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-600 text-white disabled:opacity-60" style={{ backgroundColor: 'var(--accent)' }}>{saving ? 'Saving...' : 'Create Site'}</button>
              <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-lg text-sm font-600 border" style={{ borderColor: 'var(--border)' }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Sites', value: loading ? '—' : sites.length, icon: MapPin, color: 'var(--accent)' },
            { label: 'Active Sites', value: loading ? '—' : sites.filter((s) => s.status === 'active').length, icon: CheckCircle2, color: 'var(--success)' },
            { label: 'Active Jobs', value: loading ? '—' : sites.reduce((a, s) => a + s.activeJobs, 0), icon: Briefcase, color: 'var(--info)' },
            { label: 'Overdue Services', value: loading ? '—' : sites.filter((s) => s.nextService === 'Overdue').length, icon: AlertCircle, color: 'var(--danger)' },
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
            <input suppressHydrationWarning type="text" placeholder="Search sites, clients, suburbs..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field input-field-search" />
          </div>
          <select suppressHydrationWarning value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select-field">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="inactive">Inactive</option>
          </select>
          <select suppressHydrationWarning value={filterType} onChange={(e) => setFilterType(e.target.value)} className="select-field">
            <option value="all">All Types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-3">
            {loading ? (
              <div className="card-elevated">
                <div className="empty-state"><MapPin size={36} className="empty-state-icon animate-pulse" /><p className="empty-state-desc">Loading sites...</p></div>
              </div>
            ) : paginated.map((site) => {
              const sc = statusConfig[site.status];
              const tc = typeColors[site.type] || 'var(--accent)';
              const isSelected = selected?.id === site.id;
              const isOverdue = site.nextService === 'Overdue';
              return (
                <div key={site.id} onClick={() => setSelected(isSelected ? null : site)} className={`list-item-card${isSelected ? ' selected' : ''}`} style={{ borderLeftColor: isSelected ? 'var(--accent)' : tc }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-700 text-white flex-shrink-0" style={{ backgroundColor: tc }}>{site.logo}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-700 text-foreground">{site.name}</p>
                          <span className="status-badge" style={{ backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-500" style={{ backgroundColor: `${tc}18`, color: tc }}>{site.type}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{site.client}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground"><MapPin size={11} />{site.address}, {site.suburb} {site.state}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">Next service</p>
                        <p className="text-sm font-600" style={{ color: isOverdue ? 'var(--danger)' : 'var(--foreground)' }}>{site.nextService}</p>
                      </div>
                      <button className="p-1.5 rounded-md hover:bg-secondary transition-colors" onClick={(e) => e.stopPropagation()}><MoreHorizontal size={16} className="text-muted-foreground" /></button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 flex items-center gap-4 text-xs text-muted-foreground" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="flex items-center gap-1"><Building2 size={11} />{site.area} · {site.floors} floor{site.floors > 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1"><Briefcase size={11} />{site.activeJobs} active jobs</span>
                    <span className="flex items-center gap-1"><Calendar size={11} />{site.frequency}</span>
                    <div className="flex items-center gap-1 ml-auto">
                      {site.assignedTeam.map((initials) => (
                        <div key={initials} className="w-5 h-5 rounded-full flex items-center justify-center text-white font-700" style={{ backgroundColor: 'var(--primary)', fontSize: '9px' }}>{initials}</div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && !loading && (
              <div className="card-elevated">
                <div className="empty-state"><MapPin size={36} className="empty-state-icon" /><p className="empty-state-title">No sites found</p><p className="empty-state-desc">Try adjusting your filters</p></div>
              </div>
            )}
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="card-elevated flex items-center justify-between px-4 py-3">
                <p className="text-xs text-muted-foreground">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="pagination-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                      <button onClick={() => setPage(p)} className={`pagination-btn${p === page ? ' active' : ''}`}>{p}</button>
                    </React.Fragment>
                  ))}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="pagination-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-1">
            {selected ? (
              <div className="card-elevated p-5 space-y-4 sticky top-6 animate-slide-up">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-700 text-white" style={{ backgroundColor: typeColors[selected.type] || 'var(--accent)' }}>{selected.logo}</div>
                  <div><h3 className="font-700 text-foreground text-sm leading-tight">{selected.name}</h3><p className="text-xs text-muted-foreground">{selected.client}</p></div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2"><MapPin size={13} className="text-muted-foreground mt-0.5 flex-shrink-0" /><span>{selected.address}, {selected.suburb} {selected.state}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: 'Area', value: selected.area }, { label: 'Floors', value: selected.floors }, { label: 'Active Jobs', value: selected.activeJobs }, { label: 'Frequency', value: selected.frequency }].map((m) => (
                    <div key={m.label} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}><p className="text-base font-700 text-foreground font-tabular">{m.value}</p><p className="text-xs text-muted-foreground">{m.label}</p></div>
                  ))}
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--warning-bg)' }}>
                  <p className="text-xs font-600 mb-1" style={{ color: 'var(--warning)' }}>Access Notes</p>
                  <p className="text-xs text-foreground leading-relaxed">{selected.accessNotes || 'No access notes'}</p>
                </div>
                {selected.assignedTeam.length > 0 && (
                  <div>
                    <p className="text-xs font-600 uppercase tracking-wide text-muted-foreground mb-2" style={{ fontSize: '10px' }}>Assigned Team</p>
                    <div className="flex items-center gap-2">
                      {selected.assignedTeam.map((initials) => (
                        <div key={initials} className="w-8 h-8 rounded-full flex items-center justify-center text-white font-700 text-xs" style={{ backgroundColor: 'var(--primary)' }}>{initials}</div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="flex-1 py-2 rounded-lg text-sm font-600 text-white" style={{ backgroundColor: 'var(--accent)' }}>View Jobs</button>
                  {canManage && <button className="flex-1 py-2 rounded-lg text-sm font-600 border" style={{ borderColor: 'var(--border)' }}>Edit Site</button>}
                </div>
              </div>
            ) : (
              <div className="card-elevated p-8 text-center"><MapPin size={36} className="mx-auto text-muted-foreground mb-3 opacity-30" /><p className="text-sm text-muted-foreground">Select a site to view details</p></div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
