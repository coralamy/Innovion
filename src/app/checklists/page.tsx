'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { ClipboardList, Plus, Search, CheckCircle2, Circle, Camera, PenLine, ChevronDown, ChevronRight, AlertTriangle, Clock, MapPin, X, Check, Loader2 } from 'lucide-react';
import { checklistService, Checklist, ChecklistSection, ChecklistTask } from '@/lib/services/checklistService';
import { createClient } from '@/lib/supabase/client';
import { useRBAC } from '@/contexts/RBACContext';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { Checklist, ChecklistSection, ChecklistTask };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  'daily-job': { label: 'Daily Job', color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  'site-inspection': { label: 'Site Inspection', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  safety: { label: 'Safety', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'var(--muted-foreground)', bg: 'var(--secondary)' },
  'in-progress': { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  completed: { label: 'Completed', color: 'var(--success)', bg: 'var(--success-bg)' },
  flagged: { label: 'Flagged', color: 'var(--danger)', bg: 'var(--danger-bg, rgba(239,68,68,0.1))' },
};

function getProgress(checklist: Checklist): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  checklist.sections?.forEach((sec) => {
    sec.tasks?.forEach((t) => {
      total++;
      if (t.completed) done++;
    });
  });
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// ─── Sign-Off Modal ───────────────────────────────────────────────────────────

function SignOffModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState('');
  const [signed, setSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = 'var(--foreground)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    setSigned(true);
  };

  const stopDraw = () => { drawing.current = false; };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setSigned(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="card-elevated w-full max-w-md p-6 space-y-5 animate-slide-up">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-700 text-foreground">Sign Off Checklist</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div>
          <label className="block text-xs font-600 text-muted-foreground mb-1.5">Authorised by</label>
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30"
            style={{ borderColor: 'var(--border)' }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-600 text-muted-foreground">Signature</label>
            <button onClick={clearCanvas} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
          </div>
          <canvas
            ref={canvasRef}
            width={400}
            height={120}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            className="w-full rounded-lg border cursor-crosshair"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--secondary)', touchAction: 'none' }}
          />
          <p className="text-xs text-muted-foreground mt-1">Draw your signature above</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-600 border transition-colors hover:bg-secondary" style={{ borderColor: 'var(--border)' }}>
            Cancel
          </button>
          <button
            onClick={() => name.trim() && signed && onConfirm(name.trim())}
            disabled={!name.trim() || !signed}
            className="flex-1 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--success)' }}
          >
            <span className="flex items-center justify-center gap-1.5"><Check size={14} /> Confirm Sign-Off</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Photo Attachment (real upload) ──────────────────────────────────────────

function PhotoAttachment({ photos, onAdd, onRemove, uploading }: { photos: string[]; onAdd: (file: File) => void; onRemove: (url: string) => void; uploading: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1.5">
      {photos?.map((p, i) => (
        <div key={i} className="relative w-10 h-10 rounded-lg overflow-hidden border group" style={{ borderColor: 'var(--border)' }}>
          <img src={p} alt={`Task photo ${i + 1}`} className="w-full h-full object-cover" />
          <button
            onClick={() => onRemove(p)}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            <X size={12} className="text-white" />
          </button>
        </div>
      ))}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-10 h-10 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors hover:border-accent disabled:opacity-50"
        style={{ borderColor: 'var(--border)' }}
        title="Add photo"
      >
        {uploading ? <Loader2 size={12} className="animate-spin text-muted-foreground" /> : <Camera size={14} className="text-muted-foreground" />}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAdd(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── Checklist Detail Panel ───────────────────────────────────────────────────

function ChecklistDetail({
  checklist,
  onClose,
  onUpdate,
}: {
  checklist: Checklist;
  onClose: () => void;
  onUpdate: (updated: Checklist) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((checklist.sections || []).map((s) => [s.id, true]))
  );
  const [showSignOff, setShowSignOff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const progress = getProgress(checklist);

  const persistUpdate = async (updated: Checklist) => {
    onUpdate(updated);
    setSaving(true);
    try {
      await checklistService.update(updated.id, {
        status: updated.status,
        sections: updated.sections,
        signedOffBy: updated.signedOffBy,
        signedOffAt: updated.signedOffAt,
        signatureData: updated.signatureData,
      });
    } catch {
      // Silent — optimistic UI already updated; retry on next save
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = (sectionId: string, taskId: string) => {
    const updated: Checklist = {
      ...checklist,
      sections: checklist.sections.map((sec) =>
        sec.id !== sectionId
          ? sec
          : {
              ...sec,
              tasks: sec.tasks.map((t) =>
                t.id !== taskId ? t : { ...t, completed: !t.completed }
              ),
            }
      ),
    };
    const p = getProgress(updated);
    updated.status =
      p.done === 0
        ? 'pending'
        : p.done === p.total
        ? 'completed'
        : 'in-progress';
    persistUpdate(updated);
  };

  const updateNotes = (sectionId: string, taskId: string, notes: string) => {
    const updated = {
      ...checklist,
      sections: checklist.sections.map((sec) =>
        sec.id !== sectionId
          ? sec
          : { ...sec, tasks: sec.tasks.map((t) => (t.id !== taskId ? t : { ...t, notes })) }
      ),
    };
    persistUpdate(updated);
  };

  const handleSignOff = (name: string) => {
    const updated: Checklist = {
      ...checklist,
      signedOffBy: name,
      signedOffAt: new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }),
      signatureData: 'signed',
      status: 'completed',
    };
    persistUpdate(updated);
    setShowSignOff(false);
  };

  const handleAddPhoto = async (sectionId: string, taskId: string, file: File) => {
    setUploadingTask(taskId);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `checklist-photos/${checklist.id}/${sectionId}/${taskId}-${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      const updated = {
        ...checklist,
        sections: checklist.sections.map((sec) =>
          sec.id !== sectionId ? sec : {
            ...sec,
            tasks: sec.tasks.map((t) =>
              t.id !== taskId ? t : { ...t, photos: [...(t.photos || []), photoUrl] }
            ),
          }
        ),
      };
      persistUpdate(updated);
    } catch {
      // Photo upload failed silently — user can retry
    } finally {
      setUploadingTask(null);
    }
  };

  const handleRemovePhoto = (sectionId: string, taskId: string, url: string) => {
    const updated = {
      ...checklist,
      sections: checklist.sections.map((sec) =>
        sec.id !== sectionId ? sec : {
          ...sec,
          tasks: sec.tasks.map((t) =>
            t.id !== taskId ? t : { ...t, photos: (t.photos || []).filter((p) => p !== url) }
          ),
        }
      ),
    };
    persistUpdate(updated);
  };

  const tc = typeConfig[checklist.type];
  const sc = statusConfig[checklist.status];

  return (
    <>
      <div className="card-elevated flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
              </div>
              <h3 className="font-700 text-foreground text-base leading-tight">{checklist.title}</h3>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <MapPin size={11} />{checklist.site}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary transition-colors flex-shrink-0">
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">{progress.done} of {progress.total} tasks complete</span>
              <span className="font-700 text-foreground">{progress.pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--secondary)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress.pct}%`,
                  backgroundColor: progress.pct === 100 ? 'var(--success)' : 'var(--accent)',
                }}
              />
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-white font-700 flex-shrink-0" style={{ backgroundColor: checklist.avatarColor, fontSize: '8px' }}>
                {checklist.initials}
              </div>
              {checklist.assignedTo}
            </span>
            <span className="flex items-center gap-1"><Clock size={11} />{checklist.date}</span>
          </div>
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {checklist.sections?.map((section) => (
            <div key={section.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary"
                style={{ backgroundColor: 'var(--secondary)' }}
              >
                <span className="text-sm font-700 text-foreground">{section.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {section.tasks?.filter((t) => t.completed).length}/{section.tasks?.length}
                  </span>
                  {expanded[section.id] ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                </div>
              </button>

              {expanded[section.id] && (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {section.tasks?.map((task) => (
                    <div key={task.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleTask(section.id, task.id)}
                          className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
                        >
                          {task.completed ? (
                            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                          ) : (
                            <Circle size={18} className="text-muted-foreground" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-500 leading-snug ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {task.label}
                            {task.required && !task.completed && (
                              <span className="ml-1.5 text-xs font-600" style={{ color: 'var(--danger)' }}>*</span>
                            )}
                          </p>
                          <input
                            type="text"
                            placeholder="Add note..."
                            value={task.notes}
                            onChange={(e) => updateNotes(section.id, task.id, e.target.value)}
                            className="mt-1.5 w-full text-xs px-2.5 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-accent/30"
                            style={{ borderColor: 'var(--border)' }}
                          />
                          {task.notes && (
                            <p className="mt-1 text-xs text-muted-foreground italic">{task.notes}</p>
                          )}
                          <PhotoAttachment
                            photos={task.photos}
                            onAdd={(file) => handleAddPhoto(section.id, task.id, file)}
                            onRemove={(url) => handleRemovePhoto(section.id, task.id, url)}
                            uploading={uploadingTask === task.id}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer – Sign-off */}
        <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          {checklist.signedOffBy ? (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--success-bg)' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
              <div>
                <p className="text-sm font-700" style={{ color: 'var(--success)' }}>Signed off by {checklist.signedOffBy}</p>
                <p className="text-xs text-muted-foreground">{checklist.signedOffAt}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSignOff(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-600 text-white transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: progress.pct === 100 ? 'var(--success)' : 'var(--accent)' }}
            >
              <PenLine size={15} />
              {progress.pct === 100 ? 'Sign Off Checklist' : `Sign Off (${progress.pct}% complete)`}
            </button>
          )}
        </div>
      </div>

      {showSignOff && (
        <SignOffModal onClose={() => setShowSignOff(false)} onConfirm={handleSignOff} />
      )}
    </>
  );
}

// ─── New Checklist Modal ──────────────────────────────────────────────────────

function NewChecklistModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Checklist) => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Checklist['type']>('daily-job');
  const [site, setSite] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !site.trim() || !assignedTo.trim()) return;
    const newChecklist: Omit<Checklist, 'id'> = {
      title: title.trim(),
      type,
      site: site.trim(),
      job: '',
      assignedTo: assignedTo.trim(),
      initials: assignedTo.trim().split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      avatarColor: '#2563EB',
      date: 'Today',
      status: 'pending',
      signedOffBy: null,
      signedOffAt: null,
      signatureData: null,
      sections: [
        {
          id: `sec${Date.now()}`,
          title: 'General Tasks',
          tasks: [
            { id: `t${Date.now()}`, label: 'Task 1', completed: false, required: true, notes: '', photos: [] },
          ],
        },
      ],
    };
    setSaving(true);
    try {
      const saved = await checklistService.create(newChecklist);
      if (saved) {
        onCreate(saved);
      } else {
        onCreate({ ...newChecklist, id: `cl${Date.now()}` });
      }
    } catch {
      onCreate({ ...newChecklist, id: `cl${Date.now()}` });
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="card-elevated w-full max-w-md p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-700 text-foreground">New Checklist</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        {[
          { label: 'Checklist Title', value: title, setter: setTitle, placeholder: 'e.g. Daily Cleaning Checklist' },
          { label: 'Site', value: site, setter: setSite, placeholder: 'e.g. Crown Casino – Main Floor' },
          { label: 'Assigned To', value: assignedTo, setter: setAssignedTo, placeholder: 'e.g. Marcus Johnson' },
        ].map(({ label, value, setter, placeholder }) => (
          <div key={label}>
            <label className="block text-xs font-600 text-muted-foreground mb-1.5">{label}</label>
            <input
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-600 text-muted-foreground mb-1.5">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Checklist['type'])}
            className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none"
            style={{ borderColor: 'var(--border)' }}
          >
            <option value="daily-job">Daily Job</option>
            <option value="site-inspection">Site Inspection</option>
            <option value="safety">Safety</option>
          </select>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-600 border hover:bg-secondary transition-colors" style={{ borderColor: 'var(--border)' }}>
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !site.trim() || !assignedTo.trim() || saving}
            className="flex-1 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChecklistsPage() {
  const { companyId } = useAuth();
  const { hasPermission } = useRBAC();
  const canManage = hasPermission('canManageJobs');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selected, setSelected] = useState<Checklist | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    loadChecklists();
  }, [companyId]);

  const loadChecklists = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checklistService.getAll(companyId);
      setChecklists(data);
    } catch {
      setError('Failed to load checklists. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = checklists.filter((c) => {
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.site.toLowerCase().includes(search.toLowerCase()) ||
      c.assignedTo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchType = filterType === 'all' || c.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleUpdate = (updated: Checklist) => {
    setChecklists((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(updated);
  };

  const handleCreate = (c: Checklist) => {
    setChecklists((prev) => [c, ...prev]);
    setSelected(c);
  };

  const stats = [
    { label: 'Total', value: checklists.length, color: 'var(--accent)' },
    { label: 'In Progress', value: checklists.filter((c) => c.status === 'in-progress').length, color: '#F59E0B' },
    { label: 'Completed', value: checklists.filter((c) => c.status === 'completed').length, color: 'var(--success)' },
    { label: 'Flagged', value: checklists.filter((c) => c.status === 'flagged').length, color: 'var(--danger)' },
  ];

  return (
    <AppLayout currentPath="/checklists">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header-title">Checklists & Inspections</h1>
            <p className="page-header-subtitle">Daily job checklists, site inspections, and field compliance forms</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowNew(true)}
              className="btn-primary"
              aria-label="Create new checklist"
            >
              <Plus size={15} />
              New Checklist
            </button>
          )}
        </div>

        {error && (
          <div className="alert-error">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-600">Failed to load checklists</p>
              <p className="text-sm opacity-80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="card-elevated p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${s.color}18` }}>
                <ClipboardList size={18} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-700 text-foreground font-tabular">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card-elevated p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search checklists, sites, assignees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none"
            style={{ borderColor: 'var(--border)' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="flagged">Flagged</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none"
            style={{ borderColor: 'var(--border)' }}
          >
            <option value="all">All Types</option>
            <option value="daily-job">Daily Job</option>
            <option value="site-inspection">Site Inspection</option>
            <option value="safety">Safety</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-elevated p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="skeleton h-5 w-20 rounded-full" />
                      <div className="skeleton h-5 w-20 rounded-full" />
                    </div>
                    <div className="skeleton h-4 w-56 mb-1.5" />
                    <div className="skeleton h-3 w-32" />
                  </div>
                  <div className="skeleton h-8 w-12 rounded-lg" />
                </div>
                <div className="skeleton h-1.5 w-full rounded-full mb-2.5" />
                <div className="flex items-center gap-3">
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* List */}
            <div className={`space-y-3 ${selected ? 'xl:col-span-2' : 'xl:col-span-5'}`}>
              {paginated.map((cl) => {
                const progress = getProgress(cl);
                const tc = typeConfig[cl.type];
                const sc = statusConfig[cl.status];
                const isSelected = selected?.id === cl.id;
                const hasFlagged = cl.status === 'flagged';

                return (
                  <div
                    key={cl.id}
                    onClick={() => setSelected(isSelected ? null : cl)}
                    className="card-elevated p-4 cursor-pointer transition-all hover:shadow-md"
                    style={{ borderLeft: isSelected ? '3px solid var(--accent)' : hasFlagged ? '3px solid var(--danger)' : '3px solid transparent' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                          {hasFlagged && <AlertTriangle size={13} style={{ color: 'var(--danger)' }} />}
                        </div>
                        <p className="text-sm font-700 text-foreground leading-snug">{cl.title}</p>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <MapPin size={11} />{cl.site}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-700 text-foreground font-tabular">{progress.pct}%</p>
                          <p className="text-xs text-muted-foreground">{progress.done}/{progress.total}</p>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--secondary)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress.pct}%`,
                          backgroundColor: progress.pct === 100 ? 'var(--success)' : hasFlagged ? 'var(--danger)' : 'var(--accent)',
                        }}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-white font-700 flex-shrink-0" style={{ backgroundColor: cl.avatarColor, fontSize: '8px' }}>
                          {cl.initials}
                        </div>
                        {cl.assignedTo}
                      </span>
                      <span className="flex items-center gap-1"><Clock size={11} />{cl.date}</span>
                      {cl.signedOffBy && (
                        <span className="flex items-center gap-1 ml-auto" style={{ color: 'var(--success)' }}>
                          <CheckCircle2 size={11} />Signed off
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="empty-state">
                  <ClipboardList size={40} className="empty-state-icon" />
                  <p className="empty-state-title">No checklists found</p>
                  <p className="empty-state-desc">
                    {search || filterStatus !== 'all' || filterType !== 'all' ?'Try adjusting your search or filter criteria' :'Create your first checklist to start tracking field inspections'}
                  </p>
                  {canManage && !search && filterStatus === 'all' && filterType === 'all' && (
                    <div className="empty-state-action">
                      <button onClick={() => setShowNew(true)} className="btn-primary">
                        <Plus size={15} />Create First Checklist
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
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                        <button onClick={() => setPage(p)} className="w-7 h-7 rounded-md text-xs font-600 transition-colors" style={{ backgroundColor: p === page ? 'var(--accent)' : 'transparent', color: p === page ? 'white' : 'var(--foreground)' }}>{p}</button>
                      </React.Fragment>
                    ))}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Detail */}
            {selected && (
              <div className="xl:col-span-3">
                <ChecklistDetail
                  checklist={selected}
                  onClose={() => setSelected(null)}
                  onUpdate={handleUpdate}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {canManage && showNew && (
        <NewChecklistModal onClose={() => setShowNew(false)} onCreate={handleCreate} />
      )}
    </AppLayout>
  );
}
