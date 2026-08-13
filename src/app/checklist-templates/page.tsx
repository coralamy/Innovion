'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { createClient } from '@/lib/supabase/client';
import { ClipboardList, Plus, Search, Trash2, Edit2, X, Check, Loader2, Copy } from 'lucide-react';

interface TemplateTask {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  notes: string;
  photos: string[];
}

interface TemplateSection {
  id: string;
  title: string;
  tasks: TemplateTask[];
}

interface ChecklistTemplate {
  id: string;
  name: string;
  description: string;
  templateType: string;
  sections: TemplateSection[];
  isActive: boolean;
  companyId?: string;
  createdBy: string;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'daily-job': { label: 'Daily Job', color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  'site-inspection': { label: 'Site Inspection', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  safety: { label: 'Safety', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

function genId() { return `id_${Math.random().toString(36).slice(2, 9)}`; }

interface TemplateEditorProps {
  template?: ChecklistTemplate;
  onSave: (t: Omit<ChecklistTemplate, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

function TemplateEditor({ template, onSave, onClose }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [templateType, setTemplateType] = useState(template?.templateType || 'daily-job');
  const [sections, setSections] = useState<TemplateSection[]>(template?.sections || [
    { id: genId(), title: 'Section 1', tasks: [{ id: genId(), label: '', completed: false, required: true, notes: '', photos: [] }] }
  ]);
  const [saving, setSaving] = useState(false);

  const addSection = () => {
    setSections((s) => [...s, { id: genId(), title: `Section ${s.length + 1}`, tasks: [{ id: genId(), label: '', completed: false, required: true, notes: '', photos: [] }] }]);
  };

  const removeSection = (sId: string) => setSections((s) => s.filter((x) => x.id !== sId));

  const updateSectionTitle = (sId: string, title: string) => {
    setSections((s) => s.map((x) => x.id === sId ? { ...x, title } : x));
  };

  const addTask = (sId: string) => {
    setSections((s) => s.map((x) => x.id === sId ? { ...x, tasks: [...x.tasks, { id: genId(), label: '', completed: false, required: true, notes: '', photos: [] }] } : x));
  };

  const removeTask = (sId: string, tId: string) => {
    setSections((s) => s.map((x) => x.id === sId ? { ...x, tasks: x.tasks.filter((t) => t.id !== tId) } : x));
  };

  const updateTask = (sId: string, tId: string, field: keyof TemplateTask, value: any) => {
    setSections((s) => s.map((x) => x.id === sId ? { ...x, tasks: x.tasks.map((t) => t.id === tId ? { ...t, [field]: value } : t) } : x));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    setSaving(true);
    onSave({ name: name.trim(), description, templateType, sections, isActive: true, createdBy: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="card-elevated w-full max-w-2xl rounded-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-base font-700 text-foreground">{template ? 'Edit Template' : 'New Checklist Template'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary"><X size={16} className="text-muted-foreground" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-600 text-muted-foreground mb-1.5">Template Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Daily Clean"
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30" style={{ borderColor: 'var(--border)' }} />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5">Type</label>
              <select value={templateType} onChange={(e) => setTemplateType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5">Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description"
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }} />
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-3">
            {sections.map((section, si) => (
              <div key={section.id} className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <input type="text" value={section.title} onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                    className="flex-1 px-2 py-1.5 text-sm font-600 rounded border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }} />
                  <button onClick={() => removeSection(section.id)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-danger transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="space-y-2">
                  {section.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={task.required} onChange={(e) => updateTask(section.id, task.id, 'required', e.target.checked)}
                        className="rounded flex-shrink-0" title="Required" />
                      <input type="text" value={task.label} onChange={(e) => updateTask(section.id, task.id, 'label', e.target.value)}
                        placeholder="Task description..." className="flex-1 px-2 py-1.5 text-sm rounded border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }} />
                      <button onClick={() => removeTask(section.id, task.id)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-danger transition-colors flex-shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addTask(section.id)} className="text-xs font-600 transition-colors hover:opacity-80 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                    <Plus size={12} /> Add Task
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addSection} className="w-full py-2 rounded-lg text-sm font-600 border-2 border-dashed transition-colors hover:border-accent" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              + Add Section
            </button>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-600 border transition-colors hover:bg-secondary" style={{ borderColor: 'var(--border)' }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="flex-1 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--accent)' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {template ? 'Update Template' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChecklistTemplatesPage() {
  const { user, companyId } = useAuth();
  const { hasPermission } = useRBAC();
  const canManage = hasPermission('canManageJobs');
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | undefined>();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    loadTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadTemplates = async () => {
    setLoading(true);
    const supabase = createClient();
    let q = supabase.from('checklist_templates').select('*').order('created_at', { ascending: false });
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setTemplates((data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      templateType: r.template_type,
      sections: r.sections || [],
      isActive: r.is_active,
      companyId: r.company_id,
      createdBy: r.created_by,
      createdAt: r.created_at,
    })));
    setLoading(false);
  };

  const handleSave = async (data: Omit<ChecklistTemplate, 'id' | 'createdAt'>) => {
    const supabase = createClient();
    const payload = {
      name: data.name,
      description: data.description,
      template_type: data.templateType,
      sections: data.sections,
      is_active: data.isActive,
      company_id: companyId,
      created_by: user?.user_metadata?.full_name || user?.email || '',
    };

    if (editingTemplate) {
      await supabase.from('checklist_templates').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingTemplate.id);
    } else {
      await supabase.from('checklist_templates').insert(payload);
    }

    setShowEditor(false);
    setEditingTemplate(undefined);
    loadTemplates();
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('checklist_templates').delete().eq('id', id);
    loadTemplates();
  };

  const handleDuplicate = async (template: ChecklistTemplate) => {
    const supabase = createClient();
    await supabase.from('checklist_templates').insert({
      name: `${template.name} (Copy)`,
      description: template.description,
      template_type: template.templateType,
      sections: template.sections,
      is_active: true,
      company_id: companyId,
      created_by: user?.user_metadata?.full_name || user?.email || '',
    });
    loadTemplates();
  };

  const filtered = templates.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppLayout currentPath="/checklist-templates">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header-title">Checklist Templates</h1>
            <p className="page-header-subtitle">Reusable templates for checklists and inspections</p>
          </div>
          {canManage && (
            <button
              onClick={() => { setEditingTemplate(undefined); setShowEditor(true); }}
              className="btn-primary"
              aria-label="Create new checklist template"
            >
              <Plus size={15} /> New Template
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input type="text" placeholder="Search templates..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field input-field-search" aria-label="Search templates" />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No templates yet.{canManage ? ' Create your first template.' : ''}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginated.map((template) => {
                const tc = TYPE_CONFIG[template.templateType] || TYPE_CONFIG['daily-job'];
                const taskCount = template.sections.reduce((s, sec) => s + sec.tasks.length, 0);
                return (
                  <div key={template.id} className="card-elevated p-5 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                        <h3 className="text-sm font-700 text-foreground mt-2 truncate">{template.name}</h3>
                        {template.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{template.sections.length} sections</span>
                      <span>·</span>
                      <span>{taskCount} tasks</span>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                        <button onClick={() => { setEditingTemplate(template); setShowEditor(true); }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-600 transition-colors hover:bg-secondary">
                          <Edit2 size={11} /> Edit
                        </button>
                        <button onClick={() => handleDuplicate(template)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-600 transition-colors hover:bg-secondary">
                          <Copy size={11} /> Duplicate
                        </button>
                        <button onClick={() => handleDelete(template.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-600 transition-colors hover:bg-secondary ml-auto" style={{ color: 'var(--danger)' }}>
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
          </>
        )}
      </div>

      {canManage && showEditor && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSave}
          onClose={() => { setShowEditor(false); setEditingTemplate(undefined); }}
        />
      )}
    </AppLayout>
  );
}
