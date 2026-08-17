-- ============================================================================
-- Innovion Team A — Storage tenant isolation (documents bucket)
-- Timestamp: 20260817005000
-- ----------------------------------------------------------------------------
-- DEFECT REMEDIATED (P0 — total cross-tenant document breach and destruction):
--
--   The four `documents_*_policy` policies on storage.objects created by
--   20260727030000_documents_storage_bucket.sql tested ONLY the bucket:
--
--     USING      (bucket_id = 'documents')
--     WITH CHECK (bucket_id = 'documents')
--
--   There is no tenant predicate of any kind. Consequently ANY authenticated
--   user of ANY tenant — including a 'viewer' — could
--     • list and download every stored document belonging to every other
--       tenant (contracts, SDS sheets, HR records, incident evidence),
--     • overwrite them,
--     • and DELETE them.
--
--   Empirically demonstrated before this migration
--   (supabase/tests/security-suite.mjs, section F), as a Tenant B viewer:
--     list   Tenant A objects : 1 object visible
--     delete Tenant A objects : 1 object destroyed
--     write  into Tenant A's folder : OBJECT CREATED
--
--   The application already writes tenant-scoped object keys —
--   `documentService.buildStoragePath()` produces `{companyId}/{filename}` —
--   so the path convention needed to enforce isolation was already in place
--   and simply never checked. These policies now enforce it:
--
--     (storage.foldername(name))[1] = <an authoritative tenant of the caller>
--
--   Tenant membership is read from public.user_roles via
--   innovion_auth_company_ids(), never from client-writable metadata.
--
-- Deletion is further restricted to admin/manager: destroying a compliance or
-- contract document is an administrative act, not a viewer capability.
--
-- NOTE ON PRIVILEGES: in a hosted Supabase project storage.objects is owned by
--   the `supabase_storage_admin` role. This migration must therefore be applied
--   with sufficient privilege (the Supabase SQL editor / service role does so).
--   Policy creation is wrapped so that a privilege failure is loud, not silent.
-- ============================================================================

-- Resolve the tenant that owns an object key, and prove the caller belongs to
-- it. SECURITY DEFINER + pinned search_path: invoked from a storage policy.
CREATE OR REPLACE FUNCTION public.innovion_storage_tenant_ok(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    -- First path segment must be a syntactically valid uuid, and must be one
    -- of the caller's authoritative tenants.
    WHEN object_name IS NULL THEN false
    WHEN (storage.foldername(object_name))[1] !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN false
    ELSE ((storage.foldername(object_name))[1])::uuid
           IN (SELECT public.innovion_auth_company_ids())
  END;
$$;

COMMENT ON FUNCTION public.innovion_storage_tenant_ok(text) IS
  'True when the first path segment of a storage object key is a tenant the caller authoritatively belongs to.';

CREATE OR REPLACE FUNCTION public.innovion_storage_tenant_manager(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN object_name IS NULL THEN false
    WHEN (storage.foldername(object_name))[1] !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN false
    ELSE public.innovion_auth_has_role(
           ((storage.foldername(object_name))[1])::uuid,
           ARRAY['admin','manager']
         )
  END;
$$;

REVOKE ALL ON FUNCTION public.innovion_storage_tenant_ok(text)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.innovion_storage_tenant_manager(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.innovion_storage_tenant_ok(text)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.innovion_storage_tenant_manager(text) TO authenticated, service_role;

-- ── Replace the unscoped bucket policies ────────────────────────────────────
DROP POLICY IF EXISTS "documents_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "documents_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete_policy" ON storage.objects;

CREATE POLICY "documents_select_policy"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.innovion_storage_tenant_ok(name));

CREATE POLICY "documents_insert_policy"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.innovion_storage_tenant_ok(name));

CREATE POLICY "documents_update_policy"
  ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'documents' AND public.innovion_storage_tenant_ok(name))
  WITH CHECK (bucket_id = 'documents' AND public.innovion_storage_tenant_ok(name));

-- Destroying a stored document is an administrative act.
CREATE POLICY "documents_delete_policy"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND public.innovion_storage_tenant_manager(name));

-- The bucket must remain private: objects are served through signed URLs.
UPDATE storage.buckets SET public = false WHERE id = 'documents';

-- ── Regression guard ────────────────────────────────────────────────────────
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(policyname, ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND policyname LIKE 'documents_%'
    AND COALESCE(qual, with_check, '') NOT LIKE '%innovion_storage_tenant%';

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Storage policy without a tenant predicate: %', bad;
  END IF;

  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents' AND public) THEN
    RAISE EXCEPTION 'The documents bucket must not be public.';
  END IF;
END $$;
