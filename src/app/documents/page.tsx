'use client';
import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  FileText,
  Search,
  Download,
  Eye,
  Upload,
  FolderOpen,
  File,
  FileImage,
  FileSpreadsheet,
  Lock,
  Globe,
  Calendar,
  User,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { documentService, DocumentRecord } from '@/lib/services/documentService';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { logActivity } from '@/lib/activityLogger';
import { useRBAC } from '@/contexts/RBACContext';

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  PDF: { icon: FileText, color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  DOC: { icon: File, color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  XLS: { icon: FileSpreadsheet, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  IMG: { icon: FileImage, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  Other: { icon: File, color: 'var(--muted-foreground)', bg: 'var(--secondary)' },
};

const accessConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  'All Staff': { icon: Globe, color: 'var(--success)', label: 'All Staff' },
  Management: { icon: Lock, color: 'var(--warning)', label: 'Management' },
  'Field Staff': { icon: Globe, color: 'var(--info)', label: 'Field Staff' },
};

const categoryLabels = ['Safety', 'Site Information', 'HR', 'Contracts', 'Operations', 'General'];

function getFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toUpperCase() || '';
  if (['PDF'].includes(ext)) return 'PDF';
  if (['DOC', 'DOCX'].includes(ext)) return 'DOC';
  if (['XLS', 'XLSX', 'CSV'].includes(ext)) return 'XLS';
  if (['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(ext)) return 'IMG';
  return 'Other';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { user, companyId } = useAuth();
  const { hasPermission } = useRBAC();
  const canManage = hasPermission('canManageDocuments');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState('All Staff');
  const [category, setCategory] = useState('General');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    documentService.getAll(companyId).then((data) => {
      setDocuments(data);
      setLoading(false);
    });
  }, [companyId]);

  const filtered = documents.filter((d) => {
    const matchSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filterCategory === 'all' || d.category === filterCategory;
    return matchSearch && matchCat;
  });

  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const categoryCounts = categoryLabels.reduce(
    (acc, key) => {
      acc[key] = documents.filter((d) => d.category === key).length;
      return acc;
    },
    {} as Record<string, number>
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadProgress(`Uploading ${file.name}…`);

    try {
      const supabase = createClient();
      const filePath = `${companyId || 'shared'}/${Date.now()}_${file.name}`;

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (storageError) throw storageError;

      // Get public URL
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
      const fileUrl = urlData.publicUrl;

      // Save record to DB
      const today = new Date().toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const uploaderName =
        user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown';

      const created = await documentService.create(
        {
          name: file.name,
          category,
          fileType: getFileType(file.name),
          fileSize: formatFileSize(file.size),
          uploadedBy: uploaderName,
          uploadDate: today,
          accessLevel,
          tags: [],
          fileUrl,
        },
        companyId
      );

      if (created) {
        setDocuments((prev) => [created, ...prev]);
        setUploadSuccess(`${file.name} uploaded successfully`);
        setUploadProgress(null);
        // Log activity
        if (user) {
          await logActivity({
            userId: user.id,
            companyId,
            action: 'document_uploaded',
            entityType: 'document',
            entityId: created.id,
            description: `Document uploaded: ${file.name}`,
            metadata: {
              category,
              fileType: getFileType(file.name),
              fileSize: formatFileSize(file.size),
            },
          });
        }
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setUploadProgress(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    await documentService.delete(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (selected?.id === id) setSelected(null);
    if (user) {
      await logActivity({
        userId: user.id,
        companyId,
        action: 'document_deleted',
        entityType: 'document',
        entityId: id,
        description: 'Document deleted',
      });
    }
  };

  const handleDownload = async (doc: DocumentRecord) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, '_blank');
    }
  };

  return (
    <AppLayout currentPath="/documents">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header-title">Documents</h1>
            <p className="page-header-subtitle">
              Centralised document library for policies, contracts, and forms
            </p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                suppressHydrationWarning
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="select-field"
                aria-label="Document category"
              >
                {categoryLabels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                suppressHydrationWarning
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value)}
                className="select-field"
                aria-label="Access level"
              >
                <option value="All Staff">All Staff</option>
                <option value="Management">Management</option>
                <option value="Field Staff">Field Staff</option>
              </select>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-primary disabled:opacity-60"
                aria-label="Upload document"
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {uploading ? 'Uploading…' : 'Upload File'}
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp"
            onChange={handleFileUpload}
          />
        </div>

        {/* Upload status */}
        {uploadProgress && (
          <div
            className="flex items-center gap-3 p-3 rounded-xl border animate-fade-in"
            style={{ backgroundColor: 'var(--info-bg)', borderColor: 'rgba(37,99,235,0.3)' }}
          >
            <Loader2 size={16} className="animate-spin text-accent" />
            <p className="text-sm font-500 text-accent">{uploadProgress}</p>
          </div>
        )}
        {uploadSuccess && (
          <div
            className="flex items-center gap-3 p-3 rounded-xl border animate-fade-in"
            style={{ backgroundColor: 'var(--success-bg)', borderColor: 'rgba(16,185,129,0.3)' }}
          >
            <CheckCircle2 size={16} className="text-success" />
            <p className="text-sm font-500 text-success">{uploadSuccess}</p>
            <button
              onClick={() => setUploadSuccess(null)}
              className="ml-auto text-xs text-muted-foreground"
            >
              ✕
            </button>
          </div>
        )}
        {uploadError && (
          <div
            className="flex items-center gap-3 p-3 rounded-xl border animate-fade-in"
            style={{ backgroundColor: 'var(--danger-bg)', borderColor: 'rgba(239,68,68,0.3)' }}
          >
            <AlertCircle size={16} className="text-danger" />
            <p className="text-sm font-500 text-danger">{uploadError}</p>
            <button
              onClick={() => setUploadError(null)}
              className="ml-auto text-xs text-muted-foreground"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
            style={{
              backgroundColor: filterCategory === 'all' ? 'var(--accent)' : 'var(--secondary)',
              color: filterCategory === 'all' ? 'white' : 'var(--foreground)',
            }}
          >
            All ({documents.length})
          </button>
          {categoryLabels.map((key) => (
            <button
              key={key}
              onClick={() => setFilterCategory(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
              style={{
                backgroundColor: filterCategory === key ? 'var(--accent)' : 'var(--secondary)',
                color: filterCategory === key ? 'white' : 'var(--foreground)',
              }}
            >
              {key} ({categoryCounts[key] || 0})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <div className="card-elevated p-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  suppressHydrationWarning
                  type="text"
                  placeholder="Search documents, tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
              <span className="text-xs text-muted-foreground ml-auto">
                {filtered.length} documents
              </span>
            </div>

            <div className="card-elevated overflow-hidden">
              {loading ? (
                <div className="py-16 text-center">
                  <Loader2 size={24} className="mx-auto animate-spin text-accent mb-2" />
                  <p className="text-sm text-muted-foreground">Loading documents...</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {paginated.map((doc) => {
                    const tc = typeConfig[doc.fileType] || typeConfig['Other'];
                    const ac = accessConfig[doc.accessLevel] || {
                      icon: Globe,
                      color: 'var(--muted-foreground)',
                      label: doc.accessLevel,
                    };
                    const isSelected = selected?.id === doc.id;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelected(isSelected ? null : doc)}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                        style={{ backgroundColor: isSelected ? 'var(--secondary)' : undefined }}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: tc.bg }}
                        >
                          <tc.icon size={18} style={{ color: tc.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-600 text-foreground truncate">{doc.name}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground">{doc.fileSize}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User size={10} />
                              {doc.uploadedBy}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar size={10} />
                              {doc.uploadDate}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className="flex items-center gap-1 text-xs font-500"
                            style={{ color: ac.color }}
                          >
                            <ac.icon size={11} />
                            {ac.label}
                          </span>
                          {canManage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(doc.id);
                              }}
                              className="p-1.5 rounded hover:bg-secondary transition-colors"
                            >
                              <Trash2 size={13} className="text-muted-foreground" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(doc);
                            }}
                            className="p-1.5 rounded hover:bg-secondary transition-colors"
                          >
                            <Download size={13} className="text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="empty-state">
                      <FolderOpen size={40} className="empty-state-icon" />
                      <p className="empty-state-title">No documents found</p>
                      <p className="empty-state-desc">
                        {search || filterCategory !== 'all'
                          ? 'Try adjusting your search or category filter'
                          : 'Upload your first document to get started'}
                      </p>
                      {canManage && !search && filterCategory === 'all' && (
                        <div className="empty-state-action">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="btn-primary"
                          >
                            <Upload size={15} />
                            Upload First Document
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div
                      className="flex items-center justify-between px-4 py-3 border-t"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <p className="text-xs text-muted-foreground">
                        Showing {(page - 1) * PAGE_SIZE + 1}–
                        {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-muted-foreground"
                          >
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                          .map((p, idx, arr) => (
                            <React.Fragment key={p}>
                              {idx > 0 && arr[idx - 1] !== p - 1 && (
                                <span className="text-xs text-muted-foreground px-1">…</span>
                              )}
                              <button
                                onClick={() => setPage(p)}
                                className="w-7 h-7 rounded-md text-xs font-600 transition-colors"
                                style={{
                                  backgroundColor: p === page ? 'var(--accent)' : 'transparent',
                                  color: p === page ? 'white' : 'var(--foreground)',
                                }}
                              >
                                {p}
                              </button>
                            </React.Fragment>
                          ))}
                        <button
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-muted-foreground"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-1">
            {selected ? (
              <div className="card-elevated p-5 space-y-4 sticky top-6 animate-slide-up">
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: (typeConfig[selected.fileType] || typeConfig['Other']).bg,
                    }}
                  >
                    {React.createElement(
                      (typeConfig[selected.fileType] || typeConfig['Other']).icon,
                      {
                        size: 24,
                        style: {
                          color: (typeConfig[selected.fileType] || typeConfig['Other']).color,
                        },
                      }
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-700 text-foreground text-sm leading-tight">
                      {selected.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selected.category} · {selected.fileType}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Size', value: selected.fileSize },
                    { label: 'Uploaded by', value: selected.uploadedBy },
                    { label: 'Upload date', value: selected.uploadDate },
                    { label: 'Access', value: selected.accessLevel },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-500 text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>
                {selected.tags.length > 0 && (
                  <div>
                    <p
                      className="text-xs font-600 uppercase tracking-wide text-muted-foreground mb-2"
                      style={{ fontSize: '10px' }}
                    >
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selected.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full font-500"
                          style={{
                            backgroundColor: 'var(--secondary)',
                            color: 'var(--secondary-foreground)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleDownload(selected)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <Download size={14} />
                    Download
                  </button>
                  <button
                    onClick={() => selected.fileUrl && window.open(selected.fileUrl, '_blank')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-600 transition-all hover:bg-secondary"
                    style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    <Eye size={14} />
                    Preview
                  </button>
                </div>
              </div>
            ) : (
              <div className="card-elevated p-8 text-center">
                <FileText size={36} className="mx-auto text-muted-foreground mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">Select a document to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
