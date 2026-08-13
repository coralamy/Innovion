'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { Building2, Plus, Search, Filter, MoreHorizontal, MapPin, Briefcase, TrendingUp, CheckCircle2, Edit2, Trash2, Eye, Lock } from 'lucide-react';
import { companyService, CompanyRecord } from '@/lib/services/companyService';
import { useRBAC } from '@/contexts/RBACContext';

const typeColors: Record<string, { bg: string; text: string }> = {
  client: { bg: 'rgba(37,99,235,0.1)', text: '#2563EB' },
  contractor: { bg: 'rgba(16,185,129,0.1)', text: '#10B981' },
  partner: { bg: 'rgba(245,158,11,0.1)', text: '#F59E0B' },
};

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: { bg: 'var(--success-bg)', text: 'var(--success)', dot: 'var(--success)', label: 'Active' },
  inactive: { bg: 'var(--secondary)', text: 'var(--muted-foreground)', dot: 'var(--muted-foreground)', label: 'Inactive' },
  pending: { bg: 'var(--warning-bg)', text: 'var(--warning)', dot: 'var(--warning)', label: 'Pending' },
};

export default function CompaniesPage() {
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', industry: '', location: '', phone: '', email: '' });

  const canAccess = !rbacLoading && hasPermission('canManageCompany');

  useEffect(() => {
    if (!canAccess) return;
    companyService.getAll().then((data) => { setCompanies(data); setLoading(false); });
  }, [canAccess]);

  // RBAC guard — rendered after hooks
  if (!rbacLoading && !hasPermission('canManageCompany')) {
    return (
      <AppLayout currentPath="/companies">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Lock size={48} className="text-muted-foreground mb-4 opacity-40" />
          <h2 className="text-xl font-700 text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">You don't have permission to manage companies. Contact your administrator.</p>
        </div>
      </AppLayout>
    );
  }

  const filtered = companies.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.industry.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || c.type === filterType;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const stats = {
    total: companies.length,
    active: companies.filter((c) => c.status === 'active').length,
    clients: companies.filter((c) => c.type === 'client').length,
    totalRevenue: companies.reduce((sum, c) => {
      const val = parseFloat(c.revenue.replace(/[^0-9.]/g, '')) || 0;
      return sum + val;
    }, 0),
  };

  const handleCreate = async () => {
    if (!newCompany.name.trim()) return;
    setSaving(true);
    const created = await companyService.create({ ...newCompany, type: 'client', contacts: 0, activeJobs: 0, revenue: '$0', status: 'active', since: new Date().getFullYear().toString(), logo: newCompany.name.slice(0, 2).toUpperCase() });
    if (created) { setCompanies((prev) => [created, ...prev]); setShowNewForm(false); setNewCompany({ name: '', industry: '', location: '', phone: '', email: '' }); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await companyService.delete(id);
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    setOpenMenu(null);
  };

  return (
    <AppLayout currentPath="/companies">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header-title">Companies</h1>
            <p className="page-header-subtitle">Manage clients, contractors, and partner organisations</p>
          </div>
          <button onClick={() => setShowNewForm(true)} className="btn-primary" aria-label="Add company">
            <Plus size={15} />Add Company
          </button>
        </div>

        {showNewForm && (
          <div className="card-elevated p-5 space-y-4 animate-slide-up">
            <h3 className="text-sm font-700 text-foreground">New Company</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Company Name', placeholder: 'Acme Corp' },
                { key: 'industry', label: 'Industry', placeholder: 'Retail' },
                { key: 'location', label: 'Location', placeholder: 'Sydney, NSW' },
                { key: 'phone', label: 'Phone', placeholder: '+61 2 9000 0000' },
                { key: 'email', label: 'Email', placeholder: 'contact@company.com' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="section-label">{f.label}</label>
                  <input suppressHydrationWarning type="text" placeholder={f.placeholder} value={(newCompany as Record<string, string>)[f.key]} onChange={(e) => setNewCompany((p) => ({ ...p, [f.key]: e.target.value }))} className="input-field" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Saving...' : 'Add Company'}</button>
              <button onClick={() => setShowNewForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Companies', value: loading ? '—' : stats.total, icon: Building2, color: 'var(--accent)' },
            { label: 'Active', value: loading ? '—' : stats.active, icon: CheckCircle2, color: 'var(--success)' },
            { label: 'Client Accounts', value: loading ? '—' : stats.clients, icon: Briefcase, color: '#8B5CF6' },
            { label: 'Total Revenue', value: loading ? '—' : `$${stats.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'var(--warning)' },
          ].map((s) => (
            <div key={s.label} className="card-elevated p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${s.color}18` }}><s.icon size={18} style={{ color: s.color }} /></div>
              <div><p className="text-xl font-700 text-foreground font-tabular">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </div>
          ))}
        </div>

        <div className="card-elevated p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input suppressHydrationWarning type="text" placeholder="Search companies..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30" style={{ borderColor: 'var(--border)' }} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <select suppressHydrationWarning value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }}>
              <option value="all">All Types</option>
              <option value="client">Clients</option>
              <option value="contractor">Contractors</option>
              <option value="partner">Partners</option>
            </select>
            <select suppressHydrationWarning value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {companies.length} companies</span>
        </div>

        <div className="card-elevated overflow-hidden">
          {loading ? (
            <div className="py-16 text-center"><p className="text-sm text-muted-foreground">Loading companies...</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}>
                    {['Company', 'Type', 'Industry', 'Location', 'Active Jobs', 'Revenue', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-600 uppercase tracking-wide text-muted-foreground" style={{ fontSize: '11px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((company, idx) => {
                    const sc = statusConfig[company.status];
                    const tc = typeColors[company.type];
                    return (
                      <tr key={company.id} className="transition-colors hover:bg-secondary/50 cursor-pointer" style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-700 text-white flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }}>{company.logo}</div>
                            <div><p className="text-sm font-600 text-foreground">{company.name}</p><p className="text-xs text-muted-foreground">{company.email}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="status-badge capitalize" style={{ backgroundColor: tc.bg, color: tc.text }}>{company.type}</span></td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{company.industry}</td>
                        <td className="px-4 py-3"><div className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin size={12} />{company.location}</div></td>
                        <td className="px-4 py-3 text-sm font-600 text-foreground font-tabular">{company.activeJobs}</td>
                        <td className="px-4 py-3 text-sm font-600 text-foreground font-tabular">{company.revenue}</td>
                        <td className="px-4 py-3"><span className="status-badge" style={{ backgroundColor: sc.bg, color: sc.text }}><span className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block" style={{ backgroundColor: sc.dot }} />{sc.label}</span></td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === company.id ? null : company.id); }} className="p-1.5 rounded-md hover:bg-secondary transition-colors"><MoreHorizontal size={16} className="text-muted-foreground" /></button>
                            {openMenu === company.id && (
                              <div className="absolute right-0 top-8 z-20 w-40 card-elevated rounded-lg shadow-lg overflow-hidden animate-slide-up">
                                {[{ icon: Eye, label: 'View Details' }, { icon: Edit2, label: 'Edit' }, { icon: Trash2, label: 'Delete' }].map((action) => (
                                  <button key={action.label} onClick={() => { if (action.label === 'Delete') handleDelete(company.id); else setOpenMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left" style={{ color: action.label === 'Delete' ? 'var(--danger)' : 'var(--foreground)' }}><action.icon size={14} />{action.label}</button>
                                ))}
                              </div>
                            )}
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
            <div className="py-16 text-center"><Building2 size={40} className="mx-auto text-muted-foreground mb-3 opacity-40" /><p className="text-sm text-muted-foreground">No companies match your filters</p></div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
