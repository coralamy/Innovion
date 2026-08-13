'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { Building2, Plus, Search, MoreHorizontal, MapPin, Phone, Mail, Briefcase, DollarSign, Star, Edit2, Trash2, Eye, TrendingUp, Calendar, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { clientService, ClientRecord } from '@/lib/services/clientService';
import { useRBAC } from '@/contexts/RBACContext';
import { useAuth } from '@/contexts/AuthContext';

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'var(--success-bg)', text: 'var(--success)', label: 'Active' },
  inactive: { bg: 'var(--secondary)', text: 'var(--muted-foreground)', label: 'Inactive' },
  'at-risk': { bg: 'var(--danger-bg)', text: 'var(--danger)', label: 'At Risk' },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={12} fill={s <= rating ? '#F59E0B' : 'none'} stroke={s <= rating ? '#F59E0B' : '#CBD5E1'} />
      ))}
    </div>
  );
}

const PAGE_SIZE = 15;

export default function ClientsPage() {
  const { hasPermission } = useRBAC();
  const { companyId } = useAuth();
  const canManage = hasPermission('canManageJobs');

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [newClient, setNewClient] = useState({ name: '', contactName: '', contactRole: '', industry: '', location: '', phone: '', email: '' });

  useEffect(() => {
    clientService.getAll(companyId).then((data) => { setClients(data); setLoading(false); });
  }, [companyId]);

  const filtered = clients.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.contactName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreate = async () => {
    if (!newClient.name.trim()) return;
    setSaving(true);
    const created = await clientService.create({ ...newClient, activeContracts: 0, totalJobs: 0, monthlyValue: '$0', totalRevenue: '$0', status: 'active', rating: 4, since: new Date().getFullYear().toString(), nextService: 'TBD', logo: newClient.name.slice(0, 2).toUpperCase() });
    if (created) { setClients((prev) => [created, ...prev]); setShowNewForm(false); setNewClient({ name: '', contactName: '', contactRole: '', industry: '', location: '', phone: '', email: '' }); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await clientService.delete(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (selectedClient?.id === id) setSelectedClient(null);
    setOpenMenu(null);
  };

  const totalMonthlyRevenue = clients.reduce((sum, c) => {
    const val = parseFloat(c.monthlyValue.replace(/[^0-9.]/g, '')) || 0;
    return sum + val;
  }, 0);

  return (
    <AppLayout currentPath="/clients">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-700 text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage client accounts, contracts, and service history</p>
          </div>
          {canManage && (
            <button onClick={() => setShowNewForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: 'var(--accent)' }}>
              <Plus size={16} />New Client
            </button>
          )}
        </div>

        {canManage && showNewForm && (
          <div className="card-elevated p-5 space-y-4 animate-slide-up">
            <h3 className="text-sm font-700 text-foreground">New Client</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Company Name', placeholder: 'Acme Corp' },
                { key: 'contactName', label: 'Contact Name', placeholder: 'Jane Smith' },
                { key: 'contactRole', label: 'Contact Role', placeholder: 'Facilities Manager' },
                { key: 'industry', label: 'Industry', placeholder: 'Retail' },
                { key: 'location', label: 'Location', placeholder: 'Sydney, NSW' },
                { key: 'phone', label: 'Phone', placeholder: '+61 2 9000 0000' },
                { key: 'email', label: 'Email', placeholder: 'contact@company.com' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-600 text-muted-foreground mb-1">{f.label}</label>
                  <input suppressHydrationWarning type="text" placeholder={f.placeholder} value={(newClient as Record<string, string>)[f.key]} onChange={(e) => setNewClient((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30" style={{ borderColor: 'var(--border)' }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-600 text-white disabled:opacity-60" style={{ backgroundColor: 'var(--accent)' }}>{saving ? 'Saving...' : 'Create Client'}</button>
              <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-lg text-sm font-600 border" style={{ borderColor: 'var(--border)' }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Clients', value: loading ? '—' : clients.length, icon: Building2, color: 'var(--accent)' },
            { label: 'Active Contracts', value: loading ? '—' : clients.reduce((a, c) => a + c.activeContracts, 0), icon: FileText, color: 'var(--success)' },
            { label: 'Monthly Revenue', value: loading ? '—' : `$${totalMonthlyRevenue.toLocaleString()}`, icon: DollarSign, color: '#8B5CF6' },
            { label: 'Active Clients', value: loading ? '—' : clients.filter((c) => c.status === 'active').length, icon: Star, color: 'var(--warning)' },
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <div className="filter-bar">
              <div className="flex-1 min-w-[180px] relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input suppressHydrationWarning type="text" placeholder="Search clients..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input-field input-field-search" />
              </div>
              <select suppressHydrationWarning value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="select-field">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="at-risk">At Risk</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {loading ? (
              <div className="card-elevated">
                <div className="empty-state"><Building2 size={36} className="empty-state-icon animate-pulse" /><p className="empty-state-desc">Loading clients...</p></div>
              </div>
            ) : (
              <div className="space-y-3">
                {paginated.map((client) => {
                  const sc = statusConfig[client.status];
                  const isSelected = selectedClient?.id === client.id;
                  return (
                    <div key={client.id} onClick={() => setSelectedClient(isSelected ? null : client)} className={`list-item-card${isSelected ? ' selected' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-700 text-white flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }}>{client.logo}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-700 text-foreground">{client.name}</p>
                              <span className="status-badge text-xs" style={{ backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{client.contactName} · {client.contactRole}</p>
                            <div className="flex items-center gap-1 mt-1"><MapPin size={11} className="text-muted-foreground" /><span className="text-xs text-muted-foreground">{client.location}</span></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-700 text-foreground font-tabular">{client.monthlyValue}<span className="text-xs font-400 text-muted-foreground">/mo</span></p>
                            <p className="text-xs text-muted-foreground">{client.activeContracts} contracts</p>
                          </div>
                          <StarRating rating={client.rating} />
                          {canManage && (
                            <div className="relative">
                              <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === client.id ? null : client.id); }} className="btn-ghost p-1.5"><MoreHorizontal size={16} /></button>
                              {openMenu === client.id && (
                                <div className="absolute right-0 top-8 z-20 w-40 card-elevated rounded-lg shadow-lg overflow-hidden animate-slide-up">
                                  {[{ icon: Eye, label: 'View' }, { icon: Edit2, label: 'Edit' }, { icon: Trash2, label: 'Remove' }].map((a) => (
                                    <button key={a.label} onClick={(e) => { e.stopPropagation(); if (a.label === 'Remove') handleDelete(client.id); else setOpenMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left" style={{ color: a.label === 'Remove' ? 'var(--danger)' : 'var(--foreground)' }}><a.icon size={14} />{a.label}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 pt-3 flex items-center gap-4 text-xs text-muted-foreground" style={{ borderTop: '1px solid var(--border)' }}>
                        <span className="flex items-center gap-1"><Briefcase size={11} />{client.totalJobs} total jobs</span>
                        <span className="flex items-center gap-1"><Calendar size={11} />Next: {client.nextService}</span>
                        <span className="flex items-center gap-1 ml-auto"><TrendingUp size={11} />{client.totalRevenue} lifetime</span>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <div className="card-elevated">
                    <div className="empty-state"><Building2 size={36} className="empty-state-icon" /><p className="empty-state-title">No clients found</p><p className="empty-state-desc">Try adjusting your filters</p></div>
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
            )}
          </div>

          <div className="xl:col-span-1">
            {selectedClient ? (
              <div className="card-elevated p-5 space-y-5 sticky top-6 animate-slide-up">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-700 text-white" style={{ backgroundColor: 'var(--primary)' }}>{selectedClient.logo}</div>
                  <div><h3 className="font-700 text-foreground">{selectedClient.name}</h3><p className="text-xs text-muted-foreground">{selectedClient.industry}</p></div>
                </div>
                <div className="space-y-3">
                  {[{ icon: Phone, label: selectedClient.phone }, { icon: Mail, label: selectedClient.email }, { icon: MapPin, label: selectedClient.location }].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-sm"><item.icon size={14} className="text-muted-foreground flex-shrink-0" /><span className="text-foreground">{item.label}</span></div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: 'Monthly Value', value: selectedClient.monthlyValue }, { label: 'Total Revenue', value: selectedClient.totalRevenue }, { label: 'Active Contracts', value: selectedClient.activeContracts }, { label: 'Total Jobs', value: selectedClient.totalJobs }].map((m) => (
                    <div key={m.label} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}><p className="text-base font-700 text-foreground font-tabular">{m.value}</p><p className="text-xs text-muted-foreground mt-0.5">{m.label}</p></div>
                  ))}
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--info-bg)' }}>
                  <p className="text-xs font-600" style={{ color: 'var(--info)' }}>Next Service</p>
                  <p className="text-sm font-600 text-foreground mt-1">{selectedClient.nextService}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 py-2">View Jobs</button>
                  {canManage && <button className="btn-secondary flex-1 py-2">Edit Client</button>}
                </div>
              </div>
            ) : (
              <div className="card-elevated">
                <div className="empty-state"><Building2 size={36} className="empty-state-icon" /><p className="empty-state-desc">Select a client to view details</p></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
