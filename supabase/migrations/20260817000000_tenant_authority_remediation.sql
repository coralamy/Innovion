-- ============================================================================
-- Innovion Team A — Tenant Authority Remediation
-- Timestamp: 20260817000000
-- ----------------------------------------------------------------------------
-- DEFECT REMEDIATED (P0, cross-tenant data exposure + privilege escalation):
--   13 RLS policies derived tenant identity (company_id) and role authority
--   ('admin') from auth.jwt() -> 'user_metadata'. In Supabase, user_metadata is
--   CLIENT-WRITABLE by the end user via supabase.auth.updateUser({ data: ... }).
--   Any authenticated user could therefore assign themselves an arbitrary
--   company_id and the 'admin' role, and read/modify another tenant's data —
--   including provider_integrations.encrypted_config.
--
-- GOVERNING MODEL RESTORED:
--   auth.uid() -> authoritative public.user_roles membership -> company_id
--                -> tenant-scoped authorisation/RLS
--
--   Client-writable metadata is NEVER used as tenant or RBAC authority.
--
-- NOTE: user_metadata remains acceptable for non-authoritative display data
--       (e.g. full_name). This migration changes authority only.
-- ============================================================================

-- ── PHASE 1: Authoritative helper functions ─────────────────────────────────
-- SECURITY DEFINER is required: these are invoked from a policy ON user_roles
-- itself, and an invoker-rights function would recurse through that policy.
-- Both functions are read-only, parameterised, and pinned to an explicit
-- search_path to prevent search-path hijacking.

CREATE OR REPLACE FUNCTION public.innovion_auth_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ur.company_id
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.company_id IS NOT NULL;
$$;

COMMENT ON FUNCTION public.innovion_auth_company_ids() IS
  'Authoritative tenant membership for the current user, sourced from public.user_roles. Never from client-writable metadata.';

CREATE OR REPLACE FUNCTION public.innovion_auth_has_role(
  target_company uuid,
  allowed_roles  text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id    = auth.uid()
      AND ur.company_id = target_company
      AND ur.role       = ANY (allowed_roles)
  );
$$;

COMMENT ON FUNCTION public.innovion_auth_has_role(uuid, text[]) IS
  'Authoritative RBAC check against public.user_roles for a specific tenant.';

CREATE OR REPLACE FUNCTION public.innovion_auth_is_admin(target_company uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.innovion_auth_has_role(target_company, ARRAY['admin']);
$$;

COMMENT ON FUNCTION public.innovion_auth_is_admin(uuid) IS
  'Authoritative tenant-admin check. Replaces user_metadata->>role = ''admin''.';

REVOKE ALL ON FUNCTION public.innovion_auth_company_ids()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.innovion_auth_has_role(uuid, text[])   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.innovion_auth_is_admin(uuid)           FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.innovion_auth_company_ids()          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.innovion_auth_has_role(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.innovion_auth_is_admin(uuid)         TO authenticated, service_role;

-- ── PHASE 2: user_roles — authority table itself ────────────────────────────
DROP POLICY IF EXISTS "user_roles_read" ON public.user_roles;
CREATE POLICY "user_roles_read"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR company_id IN (SELECT public.innovion_auth_company_ids())
  );

-- ── PHASE 3: companies ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "companies_read" ON public.companies;
CREATE POLICY "companies_read"
  ON public.companies FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT public.innovion_auth_company_ids())
  );

-- ── PHASE 4: pending_invites ────────────────────────────────────────────────
DROP POLICY IF EXISTS "pending_invites_company_read"   ON public.pending_invites;
DROP POLICY IF EXISTS "pending_invites_company_insert" ON public.pending_invites;
DROP POLICY IF EXISTS "pending_invites_company_update" ON public.pending_invites;

CREATE POLICY "pending_invites_company_read"
  ON public.pending_invites FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.innovion_auth_company_ids()));

-- Issuing an invitation is an administrative act: restricted to admin/manager.
CREATE POLICY "pending_invites_company_insert"
  ON public.pending_invites FOR INSERT TO authenticated
  WITH CHECK (public.innovion_auth_has_role(company_id, ARRAY['admin','manager']));

CREATE POLICY "pending_invites_company_update"
  ON public.pending_invites FOR UPDATE TO authenticated
  USING      (public.innovion_auth_has_role(company_id, ARRAY['admin','manager']))
  WITH CHECK (public.innovion_auth_has_role(company_id, ARRAY['admin','manager']));

-- ── PHASE 5: provider_integrations (holds encrypted provider credentials) ───
DROP POLICY IF EXISTS "provider_integrations_select" ON public.provider_integrations;
DROP POLICY IF EXISTS "provider_integrations_insert" ON public.provider_integrations;
DROP POLICY IF EXISTS "provider_integrations_update" ON public.provider_integrations;
DROP POLICY IF EXISTS "provider_integrations_delete" ON public.provider_integrations;

CREATE POLICY "provider_integrations_select"
  ON public.provider_integrations FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.innovion_auth_company_ids()));

CREATE POLICY "provider_integrations_insert"
  ON public.provider_integrations FOR INSERT TO authenticated
  WITH CHECK (public.innovion_auth_is_admin(company_id));

CREATE POLICY "provider_integrations_update"
  ON public.provider_integrations FOR UPDATE TO authenticated
  USING      (public.innovion_auth_is_admin(company_id))
  WITH CHECK (public.innovion_auth_is_admin(company_id));

CREATE POLICY "provider_integrations_delete"
  ON public.provider_integrations FOR DELETE TO authenticated
  USING (public.innovion_auth_is_admin(company_id));

-- ── PHASE 6: role_permissions (RBAC definition table) ───────────────────────
DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_insert" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_update" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_delete" ON public.role_permissions;

CREATE POLICY "role_permissions_select"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.innovion_auth_company_ids()));

CREATE POLICY "role_permissions_insert"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.innovion_auth_is_admin(company_id));

CREATE POLICY "role_permissions_update"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING      (public.innovion_auth_is_admin(company_id))
  WITH CHECK (public.innovion_auth_is_admin(company_id));

CREATE POLICY "role_permissions_delete"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.innovion_auth_is_admin(company_id));

-- ── PHASE 7: Guard — fail loudly if any authority policy regresses ──────────
DO $$
DECLARE offending text;
BEGIN
  SELECT string_agg(tablename || '.' || policyname, ', ')
    INTO offending
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (COALESCE(qual,'') || COALESCE(with_check,'')) LIKE '%user_metadata%';

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION
      'Tenant authority regression: policies still derive authority from client-writable user_metadata: %',
      offending;
  END IF;
END $$;
