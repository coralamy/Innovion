'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { AlertTriangle, Plus, Search, CheckCircle2, Clock, XCircle, MapPin, User, Calendar, ChevronRight, AlertCircle, Zap, Upload, X, Image as ImageIcon, Loader2, ChevronLeft } from 'lucide-react';
import { incidentService, IncidentRecord } from '@/lib/services/incidentService';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { createClient } from '@/lib/supabase/client';
import { logActivity } from '@/lib/activityLogger';
import { emailService } from '@/lib/emailService';

const severityConfig: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  critical: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444', label: 'Critical', dot: '#EF4444' },
  high: { bg: 'rgba(249,115,22,0.15)', text: '#F97316', label: 'High', dot: '#F97316' },
  medium: { bg: 'var(--warning-bg)', text: 'var(--warning)', label: 'Medium', dot: 'var(--warning)' },
  low: { bg: 'var(--secondary)', text: 'var(--muted-foreground)', label: 'Low', dot: 'var(--muted-foreground)' },
};

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  open: { bg: 'var(--danger-bg)', text: 'var(--danger)', label: 'Open', icon: AlertCircle },
  investigating: { bg: 'var(--warning-bg)', text: 'var(--warning)', label: 'Investigating', icon: Clock },
  resolved: { bg: 'var(--success-bg)', text: 'var(--success)', label: 'Resolved', icon: CheckCircle2 },
  closed: { bg: 'var(--secondary)', text: 'var(--muted-foreground)', label: 'Closed', icon: XCircle },
};

const typeLabels: Record<string, string> = {
  injury: 'Injury', 'near-miss': 'Near Miss', property: 'Property', environmental: 'Environmental', security: 'Security',
};

interface ExtendedIncident extends IncidentRecord {
  photoUrls?: string[];
}

export default function IncidentsPage() {
  const { user, companyId } = useAuth();
  const { hasPermission } = useRBAC();
  const canManage = hasPermission('canManageJobs');
  const [incidents, setIncidents] = useState<ExtendedIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [selected, setSelected] = useState<ExtendedIncident | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
  const [newInc, setNewInc] = useState({
    title: '', description: '', site: '', reportedBy: '',
    assignedTo: '', severity: 'medium' as IncidentRecord['severity'],
    type: 'near-miss' as IncidentRecord['type'],
  });

  useEffect(() => {
    loadIncidents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadIncidents = async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase.from('incidents').select('*').order('created_at', { ascending: false });
    if (companyId) query = query.eq('company_id', companyId);
    const { data } = await query;
    setIncidents((data || []).map((row: any) => ({
      id: row.id, title: row.title, description: row.description, severity: row.severity,
      status: row.inc_status, type: row.inc_type, site: row.site, reportedBy: row.reported_by,
      reportedDate: row.reported_date, resolvedDate: row.resolved_date,
      assignedTo: row.assigned_to, actions: row.actions || [],
      companyId: row.company_id, photoUrls: row.photo_urls || [],
    })));
    setLoading(false);
  };

  const filtered = incidents.filter((i) => {
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase()) || i.site.toLowerCase().includes(search.toLowerCase()) || i.reportedBy.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || i.status === filterStatus;
    const matchSev = filterSeverity === 'all' || i.severity === filterSeverity;
    return matchSearch && matchStatus && matchSev;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    open: incidents.filter((i) => i.status === 'open').length,
    investigating: incidents.filter((i) => i.status === 'investigating').length,
    critical: incidents.filter((i) => i.severity === 'critical').length,
    resolved: incidents.filter((i) => i.status === 'resolved' || i.status === 'closed').length,
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPhotoFiles((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoPreviewUrls((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (idx: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadPhotos = async (incidentId: string): Promise<string[]> => {
    if (photoFiles.length === 0) return [];
    const supabase = createClient();
    const urls: string[] = [];
    for (const file of photoFiles) {
      const ext = file.name.split('.').pop();
      const path = `incidents/${incidentId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        if (urlData?.publicUrl) urls.push(urlData.publicUrl);
      }
    }
    return urls;
  };

  const handleCreate = async () => {
    if (!newInc.title.trim()) return;
    setSaving(true);
    setUploadingPhoto(true);
    try {
      const today = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
      const created = await incidentService.create({
        ...newInc, status: 'open', reportedDate: today, resolvedDate: null, actions: [], companyId,
      }, companyId);

      if (created) {
        // Upload photos
        const photoUrls = await uploadPhotos(created.id);
        if (photoUrls.length > 0) {
          const supabase = createClient();
          await supabase.from('incidents').update({ photo_urls: photoUrls }).eq('id', created.id);
        }

        const extCreated: ExtendedIncident = { ...created, photoUrls };
        setIncidents((prev) => [extCreated, ...prev]);

        // Log activity
        if (user) {
          await logActivity({
            userId: user.id, companyId, action: 'incident_reported',
            entityType: 'incident', entityId: created.id,
            description: `Incident reported: ${created.title}`,
            metadata: { severity: created.severity, site: created.site },
          });
        }

        // Send manager notification email
        if (user?.email && (newInc.severity === 'critical' || newInc.severity === 'high')) {
          emailService.sendJobAssignment(
            user.email,
            user.user_metadata?.full_name || 'Manager',
            `INCIDENT ALERT: ${newInc.title}`,
            newInc.site,
            today,
            `Severity: ${newInc.severity.toUpperCase()} · Type: ${typeLabels[newInc.type]} · Reported by: ${newInc.reportedBy}`
          ).catch(() => {/* silent */});
        }

        setShowNewForm(false);
        setNewInc({ title: '', description: '', site: '', reportedBy: '', assignedTo: '', severity: 'medium', type: 'near-miss' });
        setPhotoFiles([]);
        setPhotoPreviewUrls([]);
      }
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: IncidentRecord['status']) => {
    await incidentService.updateStatus(id, status);
    setIncidents((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : null);
    if (user) {
      await logActivity({
        userId: user.id, companyId, action: 'incident_reported',
        entityType: 'incident', entityId: id,
        description: `Incident status updated to ${status}`,
      });
    }
  };

  return (
    <AppLayout currentPath="/incidents">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header-title">Incidents</h1>
            <p className="page-header-subtitle">Log, track, and resolve workplace incidents and near-misses</p>
          </div>
          {canManage && (
            <button onClick={() => setShowNewForm(true)} className="btn-primary" aria-label="Report new incident">
              <Plus size={15} />Report Incident
            </button>
          )}
        </div>

        {canManage && showNewForm && (
          <div className="card-elevated p-5 space-y-4 animate-slide-up">
            <h3 className="text-sm font-700 text-foreground">Report New Incident</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'title', label: 'Title', placeholder: 'Slip and Fall — Wet Floor' },
                { key: 'site', label: 'Site', placeholder: 'Westfield Shopping Centre' },
                { key: 'reportedBy', label: 'Reported By', placeholder: 'Your Name' },
                { key: 'assignedTo', label: 'Assigned To', placeholder: 'Supervisor Name' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-600 text-muted-foreground mb-1">{f.label}</label>
                  <input suppressHydrationWarning type="text" placeholder={f.placeholder} value={(newInc as Record<string, string>)[f.key]} onChange={(e) => setNewInc((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30" style={{ borderColor: 'var(--border)' }} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1">Severity</label>
                <select suppressHydrationWarning value={newInc.severity} onChange={(e) => setNewInc((p) => ({ ...p, severity: e.target.value as IncidentRecord['severity'] }))} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1">Type</label>
                <select suppressHydrationWarning value={newInc.type} onChange={(e) => setNewInc((p) => ({ ...p, type: e.target.value as IncidentRecord['type'] }))} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }}>
                  {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-600 text-muted-foreground mb-1">Description</label>
                <textarea suppressHydrationWarning placeholder="Describe what happened..." value={newInc.description} onChange={(e) => setNewInc((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" style={{ borderColor: 'var(--border)' }} />
              </div>
              {/* Photo upload */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-600 text-muted-foreground mb-1">Photos (optional)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {photoPreviewUrls.map((url, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(idx)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-danger text-white flex items-center justify-center">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <label className="w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors" style={{ borderColor: 'var(--border)' }}>
                    <ImageIcon size={16} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-0.5">Add</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-600 text-white disabled:opacity-60 flex items-center gap-2" style={{ backgroundColor: 'var(--accent)' }}>
                {saving ? <><Loader2 size={14} className="animate-spin" />{uploadingPhoto ? 'Uploading…' : 'Saving…'}</> : 'Report Incident'}
              </button>
              <button onClick={() => { setShowNewForm(false); setPhotoFiles([]); setPhotoPreviewUrls([]); }} className="px-4 py-2 rounded-lg text-sm font-600 border" style={{ borderColor: 'var(--border)' }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Open Incidents', value: loading ? '—' : stats.open, color: 'var(--danger)', icon: AlertCircle },
            { label: 'Investigating', value: loading ? '—' : stats.investigating, color: 'var(--warning)', icon: Clock },
            { label: 'Critical Severity', value: loading ? '—' : stats.critical, color: '#EF4444', icon: Zap },
            { label: 'Resolved / Closed', value: loading ? '—' : stats.resolved, color: 'var(--success)', icon: CheckCircle2 },
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
                <input suppressHydrationWarning type="text" placeholder="Search incidents, sites..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30" style={{ borderColor: 'var(--border)' }} />
              </div>
              <select suppressHydrationWarning value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }}>
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select suppressHydrationWarning value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }}>
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="card-elevated p-4">
                    <div className="flex items-start gap-3">
                      <div className="skeleton w-9 h-9 rounded-lg flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="skeleton h-3.5 w-48" />
                          <div className="skeleton h-5 w-16 rounded-full" />
                          <div className="skeleton h-5 w-20 rounded-full" />
                        </div>
                        <div className="skeleton h-3 w-full mb-1.5" />
                        <div className="skeleton h-3 w-3/4 mb-2" />
                        <div className="flex gap-3">
                          <div className="skeleton h-3 w-24" />
                          <div className="skeleton h-3 w-20" />
                          <div className="skeleton h-3 w-20" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {paginated.map((incident) => {
                  const sc = severityConfig[incident.severity];
                  const stc = statusConfig[incident.status];
                  const StatusIcon = stc.icon;
                  const isSelected = selected?.id === incident.id;
                  return (
                    <div key={incident.id} onClick={() => setSelected(isSelected ? null : incident)} className="card-elevated p-4 cursor-pointer transition-all hover:shadow-md" style={{ borderLeft: `3px solid ${isSelected ? 'var(--accent)' : sc.dot}` }}>
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg flex-shrink-0 mt-0.5" style={{ backgroundColor: sc.bg }}><AlertTriangle size={14} style={{ color: sc.text }} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-700 text-foreground">{incident.title}</p>
                            <span className="status-badge" style={{ backgroundColor: sc.bg, color: sc.text }}><span className="w-1.5 h-1.5 rounded-full mr-1 inline-block" style={{ backgroundColor: sc.dot }} />{sc.label}</span>
                            <span className="status-badge flex items-center gap-1" style={{ backgroundColor: stc.bg, color: stc.text }}><StatusIcon size={10} />{stc.label}</span>
                            {incident.photoUrls && incident.photoUrls.length > 0 && (
                              <span className="status-badge flex items-center gap-1" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)' }}>
                                <ImageIcon size={10} />{incident.photoUrls.length} photo{incident.photoUrls.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{incident.description}</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={10} />{incident.site}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><User size={10} />{incident.reportedBy}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar size={10} />{incident.reportedDate}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded font-500" style={{ backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)' }}>{typeLabels[incident.type]}</span>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  );
                })}
                {paginated.length === 0 && (
                  <div className="empty-state">
                    <AlertTriangle size={40} className="empty-state-icon" />
                    <p className="empty-state-title">No incidents found</p>
                    <p className="empty-state-desc">
                      {search || filterStatus !== 'all' || filterSeverity !== 'all' ?'Try adjusting your search or filter criteria' :'No incidents have been reported yet'}
                    </p>
                    {canManage && !search && filterStatus === 'all' && filterSeverity === 'all' && (
                      <div className="empty-state-action">
                        <button onClick={() => setShowNewForm(true)} className="btn-primary">
                          <Plus size={15} />Report First Incident
                        </button>
                      </div>
                    )}
                  </div>
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
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="status-badge" style={{ backgroundColor: severityConfig[selected.severity].bg, color: severityConfig[selected.severity].text }}>{severityConfig[selected.severity].label} Severity</span>
                    <span className="status-badge" style={{ backgroundColor: statusConfig[selected.status].bg, color: statusConfig[selected.status].text }}>{statusConfig[selected.status].label}</span>
                  </div>
                  <h3 className="font-700 text-foreground">{selected.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{typeLabels[selected.type]}</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
                <div className="space-y-2 text-sm">
                  {[{ label: 'Site', value: selected.site }, { label: 'Reported by', value: selected.reportedBy }, { label: 'Date reported', value: selected.reportedDate }, { label: 'Assigned to', value: selected.assignedTo }, { label: 'Resolved', value: selected.resolvedDate ?? 'Pending' }].map((row) => (
                    <div key={row.label} className="flex justify-between"><span className="text-muted-foreground">{row.label}</span><span className="font-500 text-foreground text-right max-w-[60%]">{row.value}</span></div>
                  ))}
                </div>
                {/* Photos */}
                {selected.photoUrls && selected.photoUrls.length > 0 && (
                  <div>
                    <p className="text-xs font-600 uppercase tracking-wide text-muted-foreground mb-2" style={{ fontSize: '10px' }}>Photos</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.photoUrls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border block" style={{ borderColor: 'var(--border)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Incident photo ${idx + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {selected.actions.length > 0 && (
                  <div>
                    <p className="text-xs font-600 uppercase tracking-wide text-muted-foreground mb-2" style={{ fontSize: '10px' }}>Actions Taken</p>
                    <div className="space-y-1.5">
                      {selected.actions.map((action, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs"><CheckCircle2 size={12} className="text-success flex-shrink-0 mt-0.5" /><span className="text-foreground">{action}</span></div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {selected.status === 'open' && <button onClick={() => handleUpdateStatus(selected.id, 'investigating')} className="flex-1 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90" style={{ backgroundColor: 'var(--warning)' }}>Investigate</button>}
                  {selected.status === 'investigating' && <button onClick={() => handleUpdateStatus(selected.id, 'resolved')} className="flex-1 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90" style={{ backgroundColor: 'var(--success)' }}>Resolve</button>}
                  {(selected.status === 'resolved') && <button onClick={() => handleUpdateStatus(selected.id, 'closed')} className="flex-1 py-2 rounded-lg text-sm font-600 transition-all hover:bg-secondary" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}>Close</button>}
                </div>
              </div>
            ) : (
              <div className="card-elevated p-8 text-center"><AlertTriangle size={36} className="mx-auto text-muted-foreground mb-3 opacity-30" /><p className="text-sm text-muted-foreground">Select an incident to view details</p></div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
