'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { Users, Plus, Search, MoreHorizontal, MapPin, Phone, Mail, Briefcase, CheckCircle2, Clock, Edit2, Trash2, Eye, Star, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { employeeService, EmployeeRecord } from '@/lib/services/employeeService';
import { useRBAC } from '@/contexts/RBACContext';
import { useAuth } from '@/contexts/AuthContext';

const statusConfig: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  active: { bg: 'var(--success-bg)', text: 'var(--success)', label: 'Active', dot: 'var(--success)' },
  'on-leave': { bg: 'var(--warning-bg)', text: 'var(--warning)', label: 'On Leave', dot: 'var(--warning)' },
  terminated: { bg: 'var(--danger-bg)', text: 'var(--danger)', label: 'Terminated', dot: 'var(--danger)' },
};

const typeConfig: Record<string, { bg: string; text: string }> = {
  'full-time': { bg: 'rgba(37,99,235,0.1)', text: '#2563EB' },
  'part-time': { bg: 'rgba(139,92,246,0.1)', text: '#8B5CF6' },
  casual: { bg: 'var(--secondary)', text: 'var(--muted-foreground)' },
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

export default function EmployeesPage() {
  const { hasPermission } = useRBAC();
  const { companyId } = useAuth();
  const canManage = hasPermission('canManageUsers');

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [selected, setSelected] = useState<EmployeeRecord | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [newEmp, setNewEmp] = useState({ name: '', role: '', department: '', phone: '', email: '', location: '', salary: '' });

  useEffect(() => {
    employeeService.getAll(companyId).then((data) => { setEmployees(data); setLoading(false); }).catch(() => { setError('Failed to load employees. Please try again.'); setLoading(false); });
  }, [companyId]);

  const departments = Array.from(new Set(employees.map((e) => e.department)));

  const filtered = employees.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.role.toLowerCase().includes(search.toLowerCase()) || e.department.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchDept = filterDept === 'all' || e.department === filterDept;
    return matchSearch && matchStatus && matchDept;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: employees.length,
    active: employees.filter((e) => e.status === 'active').length,
    onLeave: employees.filter((e) => e.status === 'on-leave').length,
    fullTime: employees.filter((e) => e.employmentType === 'full-time').length,
  };

  const handleCreate = async () => {
    if (!newEmp.name.trim()) return;
    setSaving(true);
    const initials = newEmp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    const colors = ['#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16', '#F97316'];
    const color = colors[employees.length % colors.length];
    const created = await employeeService.create({ ...newEmp, status: 'active', employmentType: 'full-time', startDate: new Date().getFullYear().toString(), hoursThisWeek: 0, jobsCompleted: 0, rating: 4.5, initials, color, skills: [] });
    if (created) { setEmployees((prev) => [created, ...prev]); setShowNewForm(false); setNewEmp({ name: '', role: '', department: '', phone: '', email: '', location: '', salary: '' }); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await employeeService.delete(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    if (selected?.id === id) setSelected(null);
    setOpenMenu(null);
  };

  return (
    <AppLayout currentPath="/employees">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-700 text-foreground">Employees</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage staff records, roles, and performance</p>
          </div>
          {canManage && (
            <button onClick={() => setShowNewForm(true)} className="btn-primary">
              <Plus size={16} />Add Employee
            </button>
          )}
        </div>

        {error && (
          <div className="alert-error" role="alert">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1"><p className="font-600">{error}</p></div>
            <button onClick={() => { setError(null); setLoading(true); employeeService.getAll(companyId).then((data) => { setEmployees(data); setLoading(false); }).catch(() => { setError('Failed to load employees.'); setLoading(false); }); }} className="text-xs font-600 underline underline-offset-2 flex-shrink-0">Retry</button>
          </div>
        )}

        {canManage && showNewForm && (
          <div className="card-elevated p-5 space-y-4 animate-slide-up">
            <h3 className="text-sm font-700 text-foreground">New Employee</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Full Name', placeholder: 'Jane Smith' },
                { key: 'role', label: 'Role', placeholder: 'Operations Manager' },
                { key: 'department', label: 'Department', placeholder: 'Operations' },
                { key: 'phone', label: 'Phone', placeholder: '+61 4 0000 0000' },
                { key: 'email', label: 'Email', placeholder: 'jane@company.com' },
                { key: 'location', label: 'Location', placeholder: 'Sydney, NSW' },
                { key: 'salary', label: 'Salary', placeholder: '$65,000' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-600 text-muted-foreground mb-1">{f.label}</label>
                  <input suppressHydrationWarning type="text" placeholder={f.placeholder} value={(newEmp as Record<string, string>)[f.key]} onChange={(e) => setNewEmp((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30" style={{ borderColor: 'var(--border)' }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-600 text-white disabled:opacity-60" style={{ backgroundColor: 'var(--accent)' }}>{saving ? 'Saving...' : 'Add Employee'}</button>
              <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-lg text-sm font-600 border" style={{ borderColor: 'var(--border)' }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Staff', value: stats.total, icon: Users, color: 'var(--accent)' },
            { label: 'Active', value: stats.active, icon: CheckCircle2, color: 'var(--success)' },
            { label: 'On Leave', value: stats.onLeave, icon: Clock, color: 'var(--warning)' },
            { label: 'Full-Time', value: stats.fullTime, icon: Briefcase, color: 'var(--info)' },
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
            <input suppressHydrationWarning type="text" placeholder="Search employees..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input-field input-field-search" />
          </div>
          <select suppressHydrationWarning value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="select-field">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on-leave">On Leave</option>
            <option value="terminated">Terminated</option>
          </select>
          <select suppressHydrationWarning value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setPage(1); }} className="select-field">
            <option value="all">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} employees</span>
        </div>

        {loading ? (
          <div className="card-elevated">
            <div className="empty-state"><Users size={40} className="empty-state-icon animate-pulse" /><p className="empty-state-desc">Loading employees...</p></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-3">
              {paginated.map((emp) => {
                const sc = statusConfig[emp.status] || statusConfig['active'];
                const tc = typeConfig[emp.employmentType] || typeConfig['casual'];
                const isSelected = selected?.id === emp.id;
                return (
                  <div key={emp.id} onClick={() => setSelected(isSelected ? null : emp)} className={`list-item-card${isSelected ? ' selected' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-700 text-white flex-shrink-0" style={{ backgroundColor: emp.color }}>{emp.initials}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-700 text-foreground">{emp.name}</p>
                            <span className="status-badge" style={{ backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
                            <span className="status-badge capitalize" style={{ backgroundColor: tc.bg, color: tc.text }}>{emp.employmentType}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{emp.role} · {emp.department}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <StarRating rating={emp.rating} />
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={10} />{emp.location}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-700 text-foreground font-tabular">{emp.hoursThisWeek}h</p>
                          <p className="text-xs text-muted-foreground">this week</p>
                        </div>
                        {canManage && (
                          <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === emp.id ? null : emp.id); }} className="btn-ghost p-1.5"><MoreHorizontal size={16} /></button>
                            {openMenu === emp.id && (
                              <div className="absolute right-0 top-8 z-20 w-40 card-elevated rounded-lg shadow-lg overflow-hidden animate-slide-up">
                                {[{ icon: Eye, label: 'View' }, { icon: Edit2, label: 'Edit' }, { icon: Trash2, label: 'Remove' }].map((a) => (
                                  <button key={a.label} onClick={(e) => { e.stopPropagation(); if (a.label === 'Remove') handleDelete(emp.id); else setOpenMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left" style={{ color: a.label === 'Remove' ? 'var(--danger)' : 'var(--foreground)' }}><a.icon size={14} />{a.label}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && !loading && (
                <div className="card-elevated py-16 text-center"><Users size={36} className="mx-auto text-muted-foreground mb-3 opacity-30" /><p className="text-sm text-muted-foreground">No employees found</p></div>
              )}
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="card-elevated flex items-center justify-between px-4 py-3">
                  <p className="text-xs text-muted-foreground">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors"><ChevronLeft size={16} className="text-muted-foreground" /></button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                        <button onClick={() => setPage(p)} className="w-7 h-7 rounded-md text-xs font-600 transition-colors" style={{ backgroundColor: p === page ? 'var(--accent)' : 'transparent', color: p === page ? 'white' : 'var(--foreground)' }}>{p}</button>
                      </React.Fragment>
                    ))}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors"><ChevronRight size={16} className="text-muted-foreground" /></button>
                  </div>
                </div>
              )}
            </div>

            <div className="xl:col-span-1">
              {selected ? (
                <div className="card-elevated p-5 space-y-4 sticky top-6 animate-slide-up">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-700 text-white" style={{ backgroundColor: selected.color }}>{selected.initials}</div>
                    <div><h3 className="font-700 text-foreground">{selected.name}</h3><p className="text-xs text-muted-foreground">{selected.role}</p></div>
                  </div>
                  <div className="space-y-2">
                    {[{ icon: Phone, label: selected.phone }, { icon: Mail, label: selected.email }, { icon: MapPin, label: selected.location }].map((item) => (
                      <div key={item.label} className="flex items-center gap-2 text-sm"><item.icon size={13} className="text-muted-foreground flex-shrink-0" /><span className="text-foreground text-xs">{item.label}</span></div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ label: 'Jobs Done', value: selected.jobsCompleted }, { label: 'Hours/Week', value: `${selected.hoursThisWeek}h` }, { label: 'Start Date', value: selected.startDate }, { label: 'Salary', value: selected.salary }].map((m) => (
                      <div key={m.label} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}><p className="text-base font-700 text-foreground font-tabular">{m.value}</p><p className="text-xs text-muted-foreground">{m.label}</p></div>
                    ))}
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button className="flex-1 py-2 rounded-lg text-sm font-600 text-white" style={{ backgroundColor: 'var(--accent)' }}>Edit</button>
                      <button onClick={() => handleDelete(selected.id)} className="flex-1 py-2 rounded-lg text-sm font-600 border" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>Remove</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card-elevated p-8 text-center"><Users size={36} className="mx-auto text-muted-foreground mb-3 opacity-30" /><p className="text-sm text-muted-foreground">Select an employee to view details</p></div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
