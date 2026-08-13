'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { Package, Plus, Search, AlertTriangle, MoreHorizontal, Edit2, Trash2, RefreshCw, TrendingDown, ShoppingCart, Warehouse, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { inventoryService, InventoryRecord } from '@/lib/services/inventoryService';
import { useRBAC } from '@/contexts/RBACContext';
import { useAuth } from '@/contexts/AuthContext';

const statusConfig: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  'in-stock': { bg: 'var(--success-bg)', text: 'var(--success)', label: 'In Stock', dot: 'var(--success)' },
  'low-stock': { bg: 'var(--warning-bg)', text: 'var(--warning)', label: 'Low Stock', dot: 'var(--warning)' },
  'out-of-stock': { bg: 'var(--danger-bg)', text: 'var(--danger)', label: 'Out of Stock', dot: 'var(--danger)' },
};

const categoryLabels: Record<string, string> = {
  chemicals: 'Chemicals', equipment: 'Equipment', ppe: 'PPE', consumables: 'Consumables', tools: 'Tools',
};

const categoryColors: Record<string, string> = {
  chemicals: '#EF4444', equipment: '#2563EB', ppe: '#F59E0B', consumables: '#10B981', tools: '#8B5CF6',
};

const PAGE_SIZE = 15;

export default function InventoryPage() {
  const { hasPermission } = useRBAC();
  const { companyId } = useAuth();
  const canManage = hasPermission('canManageInventory');

  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [newItem, setNewItem] = useState({ name: '', sku: '', supplier: '', location: '', unitCost: '', unit: 'units' });

  useEffect(() => {
    inventoryService.getAll(companyId).then((data) => { setInventory(data); setLoading(false); });
  }, [companyId]);

  const filtered = inventory.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase()) || item.supplier.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || item.category === filterCategory;
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    totalItems: inventory.length,
    lowStock: inventory.filter((i) => i.status === 'low-stock').length,
    outOfStock: inventory.filter((i) => i.status === 'out-of-stock').length,
    totalValue: inventory.reduce((sum, i) => {
      const val = parseFloat(i.totalValue.replace(/[^0-9.]/g, '')) || 0;
      return sum + val;
    }, 0),
  };

  const handleCreate = async () => {
    if (!newItem.name.trim() || !newItem.sku.trim()) return;
    setSaving(true);
    const today = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    const created = await inventoryService.create({ ...newItem, category: 'consumables', currentStock: 0, minStock: 10, maxStock: 100, totalValue: '$0', lastRestocked: today, status: 'out-of-stock' }, companyId);
    if (created) { setInventory((prev) => [created, ...prev]); setShowNewForm(false); setNewItem({ name: '', sku: '', supplier: '', location: '', unitCost: '', unit: 'units' }); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await inventoryService.delete(id);
    setInventory((prev) => prev.filter((i) => i.id !== id));
    setOpenMenu(null);
  };

  return (
    <AppLayout currentPath="/inventory">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-700 text-foreground">Inventory</h1>
            <p className="text-sm text-muted-foreground mt-1">Track cleaning supplies, equipment, PPE, and consumables</p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <button className="btn-secondary">
                  <ShoppingCart size={16} />Reorder
                </button>
                <button onClick={() => setShowNewForm(true)} className="btn-primary">
                  <Plus size={16} />Add Item
                </button>
              </>
            )}
          </div>
        </div>

        {canManage && showNewForm && (
          <div className="card-elevated p-5 space-y-4 animate-slide-up">
            <h3 className="text-sm font-700 text-foreground">New Inventory Item</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Item Name', placeholder: 'Floor Cleaner 5L' },
                { key: 'sku', label: 'SKU', placeholder: 'CHEM-003' },
                { key: 'supplier', label: 'Supplier', placeholder: 'CleanChem Australia' },
                { key: 'location', label: 'Location', placeholder: 'Warehouse A' },
                { key: 'unitCost', label: 'Unit Cost', placeholder: '$12.50' },
                { key: 'unit', label: 'Unit', placeholder: 'bottles' },
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

        {!loading && (stats.lowStock > 0 || stats.outOfStock > 0) && (
          <div className="rounded-xl p-4 flex items-start gap-3 border" style={{ backgroundColor: 'var(--warning-bg)', borderColor: 'rgba(245,158,11,0.3)' }}>
            <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-700 text-warning">Stock Alert</p>
              <p className="text-sm text-warning/80 mt-0.5">
                {stats.outOfStock > 0 && `${stats.outOfStock} item${stats.outOfStock > 1 ? 's' : ''} out of stock`}
                {stats.outOfStock > 0 && stats.lowStock > 0 && ' · '}
                {stats.lowStock > 0 && `${stats.lowStock} item${stats.lowStock > 1 ? 's' : ''} below minimum stock level`}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Items', value: loading ? '—' : stats.totalItems, color: 'var(--accent)', icon: Package },
            { label: 'Low Stock', value: loading ? '—' : stats.lowStock, color: 'var(--warning)', icon: TrendingDown },
            { label: 'Out of Stock', value: loading ? '—' : stats.outOfStock, color: 'var(--danger)', icon: AlertTriangle },
            { label: 'Total Value', value: loading ? '—' : `$${stats.totalValue.toLocaleString()}`, color: '#10B981', icon: BarChart3 },
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
            <input suppressHydrationWarning type="text" placeholder="Search items, SKU, supplier..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input-field input-field-search" />
          </div>
          <select suppressHydrationWarning value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }} className="select-field">
            <option value="all">All Categories</option>
            {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select suppressHydrationWarning value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="select-field">
            <option value="all">All Status</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} items</span>
        </div>

        <div className="card-elevated overflow-hidden">
          {loading ? (
            <div className="empty-state"><Package size={40} className="empty-state-icon animate-pulse" /><p className="empty-state-desc">Loading inventory...</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}>
                    {['Item', 'Category', 'Stock Level', 'Unit Cost', 'Total Value', 'Supplier', 'Last Restocked', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-600 uppercase tracking-wide text-muted-foreground whitespace-nowrap" style={{ fontSize: '11px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item, idx) => {
                    const sc = statusConfig[item.status];
                    const stockPct = Math.min(100, (item.currentStock / item.maxStock) * 100);
                    const stockColor = item.status === 'out-of-stock' ? 'var(--danger)' : item.status === 'low-stock' ? 'var(--warning)' : 'var(--success)';
                    return (
                      <tr key={item.id} className="transition-colors hover:bg-secondary/50" style={{ borderBottom: idx < paginated.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${categoryColors[item.category]}18` }}><Package size={14} style={{ color: categoryColors[item.category] }} /></div>
                            <div><p className="text-sm font-600 text-foreground">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full font-500" style={{ backgroundColor: `${categoryColors[item.category]}18`, color: categoryColors[item.category] }}>{categoryLabels[item.category]}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--secondary)' }}><div className="h-full rounded-full transition-all" style={{ width: `${stockPct}%`, backgroundColor: stockColor }} /></div>
                            <span className="text-sm font-600 text-foreground font-tabular">{item.currentStock}</span>
                            <span className="text-xs text-muted-foreground">/ {item.maxStock} {item.unit}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">Min: {item.minStock}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground font-tabular">{item.unitCost}</td>
                        <td className="px-4 py-3 text-sm font-600 text-foreground font-tabular">{item.totalValue}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{item.supplier}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{item.lastRestocked}</td>
                        <td className="px-4 py-3"><span className="status-badge" style={{ backgroundColor: sc.bg, color: sc.text }}><span className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block" style={{ backgroundColor: sc.dot }} />{sc.label}</span></td>
                        <td className="px-4 py-3">
                          {canManage && (
                            <div className="relative">
                              <button onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)} className="p-1.5 rounded-md hover:bg-secondary transition-colors"><MoreHorizontal size={16} className="text-muted-foreground" /></button>
                              {openMenu === item.id && (
                                <div className="absolute right-0 top-8 z-20 w-40 card-elevated rounded-lg shadow-lg overflow-hidden animate-slide-up">
                                  {[{ icon: Edit2, label: 'Edit Item' }, { icon: RefreshCw, label: 'Restock' }, { icon: ShoppingCart, label: 'Order More' }, { icon: Trash2, label: 'Remove' }].map((a) => (
                                    <button key={a.label} onClick={() => { if (a.label === 'Remove') handleDelete(item.id); else setOpenMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left" style={{ color: a.label === 'Remove' ? 'var(--danger)' : 'var(--foreground)' }}><a.icon size={13} />{a.label}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length === 0 && !loading && (
            <div className="empty-state"><Package size={40} className="empty-state-icon" /><p className="empty-state-title">No items found</p><p className="empty-state-desc">Try adjusting your filters</p></div>
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
