-- ============================================================
-- Innovion: Documents Storage Bucket
-- Creates the 'documents' bucket for PDF and image uploads
-- ============================================================

-- 1. Create the documents storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50 MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS Policies for the documents bucket

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "documents_insert_policy" ON storage.objects;
CREATE POLICY "documents_insert_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to read/download files
DROP POLICY IF EXISTS "documents_select_policy" ON storage.objects;
CREATE POLICY "documents_select_policy"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow authenticated users to update their own files
DROP POLICY IF EXISTS "documents_update_policy" ON storage.objects;
CREATE POLICY "documents_update_policy"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to delete files
DROP POLICY IF EXISTS "documents_delete_policy" ON storage.objects;
CREATE POLICY "documents_delete_policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
