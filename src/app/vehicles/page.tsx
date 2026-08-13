'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { Truck, Plus, Search, CheckCircle2, MoreHorizontal, Edit2, Wrench, MapPin, User, Fuel, AlertCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { vehicleService, VehicleRecord } from '@/lib/services/vehicleService';
import { useRBAC } from '@/contexts/RBACContext';
import { useAuth } from '@/contexts/AuthContext';

const statusConfig: Record<string, { bg: string; text: string; label: string; dot: string; icon: React.ElementType }> = {
  active: { bg: 'var(--success-bg)', text: 'var(--success)', label: 'Active', dot: 'var(--success)', icon: CheckCircle2 },
  maintenance: { bg: 'var(--warning-bg)', text: 'var(--warning)', label: 'In Maintenance', dot: 'var(--warning)', icon: Wrench },
  'out-of-service': { bg: 'var(--danger-bg)', text: 'var(--danger)', label: 'Out of Service', dot: 'var(--danger)', icon: XCircle },
};

const typeLabels: Record<string, string> = { van: 'Van', ute: 'Ute', truck: 'Truck', car: 'Car' };
const fuelLabels: Record<string, string> = { petrol: 'Petrol', diesel: 'Diesel', electric: 'Electric' };

const PAGE_SIZE = 15;

export default function VehiclesPage() {
  const { hasPermission } = useRBAC();
  const { companyId } = useAuth();
  const canManage = hasPermission('canManageJobs');

  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selected, setSelected] = useState<VehicleRecord | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [newVehicle, setNewVehicle] = useState({ make: '', model: '', rego: '', assignedTo: '', location: '', odometer: '', regoExpiry: '', insuranceExpiry: '', nextService: '', notes: '' });

  useEffect(() => {
    vehicleService.getAll(companyId).then((data) => { setVehicles(data); setLoading(false); });
  }, [companyId]);

  const filtered = vehicles.filter((v) => {
    const matchSearch = `${v.make} ${v.model}`.toLowerCase().includes(search.toLowerCase()) || v.rego.toLowerCase().includes(search.toLowerCase()) || v.assignedTo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || v.status === filterStatus;
    const matchType = filterType === 'all' || v.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === 'active').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    outOfService: vehicles.filter((v) => v.status === 'out-of-service').length,
  };

  const handleCreate = async () => {
    if (!newVehicle.make.trim() || !newVehicle.rego.trim()) return;
    setSaving(true);
    const created = await vehicleService.create({ ...newVehicle, year: new Date().getFullYear(), type: 'van', status: 'active', fuelType: 'diesel', lastService: 'Never', color: '#2563EB' }, companyId);
    if (created) { setVehicles((prev) => [created, ...prev]); setShowNewForm(false); setNewVehicle({ make: '', model: '', rego: '', assignedTo: '', location: '', odometer: '', regoExpiry: '', insuranceExpiry: '', nextService: '', notes: '' }); }
    setSaving(false);
  };

  const handleUpdateStatus = async (id: string, status: VehicleRecord['status']) => {
    await vehicleService.updateStatus(id, status);
    setVehicles((prev) => prev.map((v) => v.id === id ? { ...v, status } : v));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : null);
    setOpenMenu(null);
  };

  return (
    <AppLayout currentPath="/vehicles">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header-title">Vehicles</h1>
            <p className="page-header-subtitle">Manage fleet, registrations, insurance, and service schedules</p>
          </div>
          {canManage && (
            <button onClick={() => setShowNewForm(true)} className="btn-primary" aria-label="Add vehicle">
              <Plus size={15} />Add Vehicle
            </button>
          )}
        </div>

        {canManage && showNewForm && (
          <div className="card-elevated p-5 space-y-4 animate-slide-up">
            <h3 className="text-sm font-700 text-foreground">Add Vehicle</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'make', label: 'Make', placeholder: 'Toyota' },
                { key: 'model', label: 'Model', placeholder: 'HiAce Van' },
                { key: 'rego', label: 'Registration', placeholder: 'ABC 123' },
                { key: 'assignedTo', label: 'Assigned To', placeholder: 'Driver Name' },
                { key: 'location', label: 'Location', placeholder: 'Sydney, NSW' },
                { key: 'odometer', label: 'Odometer', placeholder: '0 km' },
                { key: 'regoExpiry', label: 'Rego Expiry', placeholder: '31 Dec 2026' },
                { key: 'insuranceExpiry', label: 'Insurance Expiry', placeholder: '01 Jan 2027' },
                { key: 'nextService', label: 'Next Service', placeholder: '10,000 km' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-600 text-muted-foreground mb-1">{f.label}</label>
                  <input suppressHydrationWarning type="text" placeholder={f.placeholder} value={(newVehicle as Record<string, string>)[f.key]} onChange={(e) => setNewVehicle((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30" style={{ borderColor: 'var(--border)' }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-600 text-white disabled:opacity-60" style={{ backgroundColor: 'var(--accent)' }}>{saving ? 'Saving...' : 'Add Vehicle'}</button>
              <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-lg text-sm font-600 border" style={{ borderColor: 'var(--border)' }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Fleet', value: loading ? '—' : stats.total, color: 'var(--accent)', icon: Truck },
            { label: 'Active', value: loading ? '—' : stats.active, color: 'var(--success)', icon: CheckCircle2 },
            { label: 'In Maintenance', value: loading ? '—' : stats.maintenance, color: 'var(--warning)', icon: Wrench },
            { label: 'Out of Service', value: loading ? '—' : stats.outOfService, color: 'var(--danger)', icon: AlertCircle },
          ].map((s) => (
            <div key={s.label} className="card-elevated p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${s.color}18` }}><s.icon size={18} style={{ color: s.color }} /></div>
              <div><p className="text-xl font-700 text-foreground font-tabular">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <div className="card-elevated p-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[180px] relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input suppressHydrationWarning type="text" placeholder="Search vehicles, rego, driver..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30" style={{ borderColor: 'var(--border)' }} />
              </div>
              <select suppressHydrationWarning value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="out-of-service">Out of Service</option>
              </select>
              <select suppressHydrationWarning value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} className="text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }}>
                <option value="all">All Types</option>
                <option value="van">Van</option>
                <option value="ute">Ute</option>
                <option value="truck">Truck</option>
                <option value="car">Car</option>
              </select>
            </div>

            {loading ? (
              <div className="card-elevated py-16 text-center"><p className="text-sm text-muted-foreground">Loading vehicles...</p></div>
            ) : (
              <div className="space-y-3">
                {paginated.map((vehicle) => {
                  const sc = statusConfig[vehicle.status];
                  const StatusIcon = sc.icon;
                  const isSelected = selected?.id === vehicle.id;
                  return (
                    <div key={vehicle.id} onClick={() => setSelected(isSelected ? null : vehicle)} className="card-elevated p-4 cursor-pointer transition-all hover:shadow-md" style={{ borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${vehicle.color}18` }}><Truck size={18} style={{ color: vehicle.color }} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-700 text-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                            <span className="font-mono text-xs px-2 py-0.5 rounded font-600" style={{ backgroundColor: 'var(--secondary)', color: 'var(--foreground)' }}>{vehicle.rego}</span>
                            <span className="status-badge flex items-center gap-1" style={{ backgroundColor: sc.bg, color: sc.text }}><StatusIcon size={10} />{sc.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{typeLabels[vehicle.type]} · {fuelLabels[vehicle.fuelType]}</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><User size={10} />{vehicle.assignedTo}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={10} />{vehicle.location}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Fuel size={10} />{vehicle.odometer}</span>
                          </div>
                        </div>
                        {canManage && (
                          <div className="relative flex-shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === vehicle.id ? null : vehicle.id); }} className="p-1.5 rounded-md hover:bg-secondary transition-colors"><MoreHorizontal size={16} className="text-muted-foreground" /></button>
                            {openMenu === vehicle.id && (
                              <div className="absolute right-0 top-8 z-20 w-44 card-elevated rounded-lg shadow-lg overflow-hidden animate-slide-up">
                                {[{ icon: Edit2, label: 'Edit Vehicle' }, { icon: Wrench, label: 'Set Maintenance' }, { icon: CheckCircle2, label: 'Set Active' }].map((a) => (
                                  <button key={a.label} onClick={(e) => { e.stopPropagation(); if (a.label === 'Set Maintenance') handleUpdateStatus(vehicle.id, 'maintenance'); else if (a.label === 'Set Active') handleUpdateStatus(vehicle.id, 'active'); else setOpenMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left" style={{ color: 'var(--foreground)' }}><a.icon size={13} />{a.label}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="card-elevated py-16 text-center"><Truck size={36} className="mx-auto text-muted-foreground mb-3 opacity-30" /><p className="text-sm text-muted-foreground">No vehicles match your filters</p></div>
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
            )}
          </div>

          <div className="xl:col-span-1">
            {selected ? (
              <div className="card-elevated p-5 space-y-4 sticky top-6 animate-slide-up">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${selected.color}18` }}><Truck size={22} style={{ color: selected.color }} /></div>
                  <div><h3 className="font-700 text-foreground">{selected.year} {selected.make} {selected.model}</h3><p className="text-xs font-mono font-600 text-muted-foreground">{selected.rego}</p></div>
                </div>
                <div className="space-y-2 text-sm">
                  {[{ label: 'Type', value: typeLabels[selected.type] }, { label: 'Fuel', value: fuelLabels[selected.fuelType] }, { label: 'Odometer', value: selected.odometer }, { label: 'Assigned to', value: selected.assignedTo }, { label: 'Location', value: selected.location }].map((row) => (
                    <div key={row.label} className="flex justify-between"><span className="text-muted-foreground">{row.label}</span><span className="font-500 text-foreground">{row.value}</span></div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-600 uppercase tracking-wide text-muted-foreground" style={{ fontSize: '10px' }}>Compliance</p>
                  {[{ label: 'Rego Expiry', value: selected.regoExpiry }, { label: 'Insurance Expiry', value: selected.insuranceExpiry }, { label: 'Last Service', value: selected.lastService }, { label: 'Next Service', value: selected.nextService }].map((row) => (
                    <div key={row.label} className="flex justify-between text-sm"><span className="text-muted-foreground">{row.label}</span><span className="font-500 text-foreground">{row.value}</span></div>
                  ))}
                </div>
                {selected.notes && <div className="p-3 rounded-lg text-xs text-muted-foreground" style={{ backgroundColor: 'var(--secondary)' }}>{selected.notes}</div>}
                {canManage && (
                  <div className="flex gap-2 pt-2">
                    <button className="flex-1 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>Edit</button>
                    <button onClick={() => handleUpdateStatus(selected.id, selected.status === 'active' ? 'maintenance' : 'active')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-600 transition-all hover:bg-secondary" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}><Wrench size={13} />{selected.status === 'active' ? 'Maintenance' : 'Set Active'}</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="card-elevated p-8 text-center"><Truck size={36} className="mx-auto text-muted-foreground mb-3 opacity-30" /><p className="text-sm text-muted-foreground">Select a vehicle to view details</p></div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
