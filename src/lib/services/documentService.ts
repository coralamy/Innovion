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
    id: row.id,
    name: row.name,
    category: row.category,
    fileType: row.file_type,
    fileSize: row.file_size,
    uploadedBy: row.uploaded_by,
    uploadDate: row.upload_date,
    accessLevel: row.access_level,
    tags: row.tags,
    fileUrl: row.file_url,
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
    const name = filename.slice(0, lastDot).replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = filename.slice(lastDot + 1).replace(/[^a-zA-Z0-9]/g, '');
    return `${name}.${ext}`;
  }
  return filename.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Build a tenant-scoped storage path.
 *
 * Format: `{companyId}/{userId}/{sanitisedFilename}`
 *
 * ---------------------------------------------------------------------------
 * A/B/D INTEGRATION: the second segment matters.
 *
 * This previously produced `{companyId}/{filename}`. Tenant isolation is
 * enforced on the FIRST segment, so that was sufficient for the Platform alone
 * and remains so.
 *
 * It is not sufficient once the Workforce app shares the bucket. Team B's
 * migration 20260817000003 installs a RESTRICTIVE policy that confines a
 * workforce-only user to their own files:
 *
 *     workforce_documents_own_files_only  RESTRICTIVE FOR SELECT
 *       USING ( bucket_id <> 'documents'
 *               OR NOT public.is_workforce_only_user()
 *               OR (storage.foldername(name))[2] = auth.uid()::text   -- current
 *               OR (storage.foldername(name))[1] = auth.uid()::text ) -- historic
 *
 * A restrictive policy ANDs with everything else, so an object written at
 * `{companyId}/{filename}` has no second segment to match and is unreadable by
 * the very worker who uploaded it. The Platform would list the document (the
 * `documents` row is visible to them) and the download would fail.
 *
 * Writing `{companyId}/{userId}/{filename}` satisfies both controls at once:
 * segment 1 is still the tenant, so Team A's `innovion_storage_tenant_ok()` and
 * the tenant-folder predicate are unaffected; segment 2 is the uploader, so
 * Team B's worker predicate matches.
 *
 * RESIDUAL, AND DELIBERATE: a workforce-only user still cannot read documents
 * uploaded by someone else, including Platform staff. That is Team B's control,
 * not an accident of this change, and it is theirs to relax. Platform staff are
 * not workforce-only and continue to see everything in their tenant.
 *
 * EXISTING OBJECTS: objects already written as `{companyId}/{filename}` remain
 * readable — `documents_select_policy` accepts the tenant folder — so nothing
 * is orphaned by this change.
 * ---------------------------------------------------------------------------
 */
export function buildStoragePath(companyId: string, userId: string, filename: string): string {
  const safe = sanitiseFilename(filename);
  return `${companyId}/${userId}/${safe}`;
}

export const documentService = {
  async getAll(companyId?: string | null): Promise<DocumentRecord[]> {
    const supabase = createClient();
    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    const { data, error } = await query;
    if (error) {
      logger.error('documentService', 'Failed to fetch documents', {
        companyId,
        error: error.message,
      });
      return [];
    }
    return (data as DocumentRow[]).map(rowToDocument);
  },

  async create(
    doc: Omit<DocumentRecord, 'id'>,
    companyId?: string | null
  ): Promise<DocumentRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('documents')
      .insert({
        name: doc.name,
        category: doc.category,
        file_type: doc.fileType,
        file_size: doc.fileSize,
        uploaded_by: doc.uploadedBy,
        upload_date: doc.uploadDate,
        access_level: doc.accessLevel,
        tags: doc.tags,
        file_url: doc.fileUrl,
        company_id: companyId ?? doc.companyId ?? null,
      })
      .select()
      .single();
    if (error) {
      logger.error('documentService', 'Failed to create document', {
        name: doc.name,
        error: error.message,
      });
      return null;
    }
    return rowToDocument(data as DocumentRow);
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      logger.error('documentService', 'Failed to delete document', { id, error: error.message });
      return false;
    }
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

    // The storage path's first segment IS the tenant boundary: migration
    // 20260817005000 makes storage RLS require that it equal one of the
    // caller's authoritative companies. A missing or malformed companyId must
    // therefore be refused here rather than producing an object at a path no
    // policy will ever match.
    if (!companyId || !/^[0-9a-fA-F-]{36}$/.test(companyId)) {
      logger.error('documentService', 'Refusing upload without a valid tenant', { companyId });
      return null;
    }

    // The SECOND segment must be the uploader — see buildStoragePath. Without a
    // session there is no uploader, and an object written without one is
    // unreadable to a workforce user under Team B's restrictive policy.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      logger.error('documentService', 'Refusing upload without an authenticated user', {
        companyId,
      });
      return null;
    }

    const storagePath = buildStoragePath(companyId, user.id, file.name);

    // Validate MIME type server-side before upload
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      logger.warn('documentService', 'Rejected file upload — disallowed MIME type', {
        mimeType: file.type,
        filename: file.name,
      });
      return null;
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, { upsert: false });

    if (error) {
      logger.error('documentService', 'Failed to upload file', {
        storagePath,
        error: error.message,
      });
      return null;
    }

    // DEFECT REMEDIATED: this returned `getPublicUrl(...)`. The `documents`
    // bucket is created with `public: false` (and migration 20260817005000
    // enforces that it stays private), so a public URL for it resolves to an
    // authorisation error — every stored document's `file_url` was a link that
    // could never load. Worse, had the bucket ever been switched to public to
    // "fix" that, every tenant's documents would have become world-readable by
    // URL, outside RLS entirely.
    //
    // A signed URL is the correct mechanism: it is time-limited and is only
    // issued to a caller that storage RLS has already authorised.
    return { path: data.path, url: await this.getSignedUrl(data.path, bucket) };
  },

  /**
   * Issue a short-lived signed URL for a stored object.
   *
   * The path is NOT trusted from the caller alone — Supabase Storage evaluates
   * the same RLS policies for signing as for reading, so a caller who is not a
   * member of the owning tenant cannot obtain a signature.
   */
  async getSignedUrl(
    path: string,
    bucket: string = 'documents',
    expiresInSeconds = 300
  ): Promise<string> {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      logger.error('documentService', 'Failed to sign document URL', {
        path,
        error: error?.message,
      });
      return '';
    }
    return data.signedUrl;
  },
};
