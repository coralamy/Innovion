'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface DocumentRow {
  id: string;
  name: string;
  category: string;
  file_type: string;
  file_size: string;
  uploaded_by: string;
  upload_date: string;
  access_level: string;
  tags: string[];
  file_url: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  category: string;
  fileType: string;
  fileSize: string;
  uploadedBy: string;
  uploadDate: string;
  accessLevel: string;
  tags: string[];
  fileUrl: string;
  companyId?: string | null;
}

function rowToDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id, name: row.name, category: row.category, fileType: row.file_type,
    fileSize: row.file_size, uploadedBy: row.uploaded_by, uploadDate: row.upload_date,
    accessLevel: row.access_level, tags: row.tags, fileUrl: row.file_url,
    companyId: row.company_id,
  };
}

/**
 * Sanitise a filename to prevent path traversal and unexpected storage paths.
 * Replaces any character that is not alphanumeric, dot, dash, or underscore with '_'.
 */
export function sanitiseFilename(filename: string): string {
  // Preserve the extension
  const lastDot = filename.lastIndexOf('.');
  if (lastDot > 0) {
    const name = filename.slice(0, lastDot).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const ext = filename.slice(lastDot + 1).replace(/[^a-zA-Z0-9]/g, '');
    return `${name}.${ext}`;
  }
  return filename.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

/**
 * Build a company-scoped storage path to enforce tenant isolation.
 * Format: {companyId}/{sanitisedFilename}
 */
export function buildStoragePath(companyId: string, filename: string): string {
  const safe = sanitiseFilename(filename);
  return `${companyId}/${safe}`;
}

export const documentService = {
  async getAll(companyId?: string | null): Promise<DocumentRecord[]> {
    const supabase = createClient();
    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (companyId) { query = query.eq('company_id', companyId); }
    const { data, error } = await query;
    if (error) { logger.error('documentService', 'Failed to fetch documents', { companyId, error: error.message }); return []; }
    return (data as DocumentRow[]).map(rowToDocument);
  },

  async create(doc: Omit<DocumentRecord, 'id'>, companyId?: string | null): Promise<DocumentRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('documents').insert({
      name: doc.name, category: doc.category, file_type: doc.fileType, file_size: doc.fileSize,
      uploaded_by: doc.uploadedBy, upload_date: doc.uploadDate, access_level: doc.accessLevel,
      tags: doc.tags, file_url: doc.fileUrl,
      company_id: companyId ?? doc.companyId ?? null,
    }).select().single();
    if (error) { logger.error('documentService', 'Failed to create document', { name: doc.name, error: error.message }); return null; }
    return rowToDocument(data as DocumentRow);
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) { logger.error('documentService', 'Failed to delete document', { id, error: error.message }); return false; }
    return true;
  },

  /**
   * Upload a file to Supabase Storage with filename sanitisation and
   * company-scoped path enforcement.
   */
  async uploadFile(
    file: File,
    companyId: string,
    bucket: string = 'documents'
  ): Promise<{ path: string; url: string } | null> {
    const supabase = createClient();
    const storagePath = buildStoragePath(companyId, file.name);

    // Validate MIME type server-side before upload
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      logger.warn('documentService', 'Rejected file upload — disallowed MIME type', { mimeType: file.type, filename: file.name });
      return null;
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, { upsert: false });

    if (error) {
      logger.error('documentService', 'Failed to upload file', { storagePath, error: error.message });
      return null;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return { path: data.path, url: urlData.publicUrl };
  },
};
