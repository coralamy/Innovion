-- ============================================================================
-- Innovion Team A — Integration credential authority (OAuth / F-04)
-- Timestamp: 20260817006000
-- ----------------------------------------------------------------------------
-- DEFECT 1 REMEDIATED (P1 — credential row exposed to every tenant member):
--   `integration_oauth_credentials` carried a single policy,
--   `integration_oauth_creds_status_read`, granting row access to EVERY
--   authenticated member of the tenant, including the least-privileged
--   'viewer'. Managing a provider connection is an administrative act;
--   row access is now restricted to admin/manager.
--
-- DEFECT 2 REMEDIATED (P1 — token columns reachable at the privilege layer):
--   20260810160000 revoked table-wide SELECT from `authenticated` and routed
--   browser reads through the `integration_connection_status` view. That view
--   is however NOT security_invoker (see 20260817006500), so it bypassed RLS
--   altogether. Once the view is corrected it needs the invoker to hold SELECT
--   on the base table — which would restore access to the token columns.
--   Resolved with COLUMN-LEVEL grants: `authenticated` may select the status
--   columns and can never select `encrypted_access_token` /
--   `encrypted_refresh_token`, at any privilege level, through any query.
--
-- DEFECT 3 REMEDIATED (P1 — the OAuth connect flow could never succeed):
--   Eleven `integration_*` tables have a SELECT policy and nothing else, so
--   with RLS enabled every write is denied. The OAuth callback route performed
--   all of its writes through the *end user's* session client:
--       integration_oauth_credentials, integration_external_orgs,
--       integration_scopes, integration_acquisition_source,
--       integration_audit_log, provider_integrations
--   and checked none of the returned errors — so it redirected with
--   `?oauth_success=<provider>` having persisted nothing at all.
--
--   The intended architecture is already stated in 20260810160000:
--   "Server-side routes continue to use the service role key." The callback is
--   corrected to do exactly that (see the application changes accompanying this
--   migration), after authenticating the user and verifying tenant-admin
--   authority. NO end-user write path is therefore added here — least
--   privilege is preserved and the credential tables stay service-role-only for
--   writes.
--
--   The audit log additionally must never be rewritten or erased by a tenant,
--   so it deliberately receives no UPDATE or DELETE policy.
-- ============================================================================

-- ── PHASE 1: credential rows — admin/manager only ──────────────────────────
DROP POLICY IF EXISTS "integration_oauth_creds_status_read" ON public.integration_oauth_credentials;
DROP POLICY IF EXISTS "integration_oauth_creds_read"        ON public.integration_oauth_credentials;

CREATE POLICY "integration_oauth_creds_read"
  ON public.integration_oauth_credentials FOR SELECT TO authenticated
  USING (public.innovion_auth_has_role(company_id, ARRAY['admin','manager']));

-- ── PHASE 2: column-level grants — token columns unreachable ───────────────
REVOKE ALL ON public.integration_oauth_credentials FROM authenticated, anon;

GRANT SELECT (
  id, company_id, provider_slug,
  is_valid, revoked_at, expires_at, refresh_expires_at,
  external_user_id, external_user_email, external_tenant_id,
  scope_string, token_type, created_at, updated_at
) ON public.integration_oauth_credentials TO authenticated;

-- ── PHASE 3: audit log — append-only for admins/managers ───────────────────
DROP POLICY IF EXISTS "integration_audit_log_append" ON public.integration_audit_log;
CREATE POLICY "integration_audit_log_append"
  ON public.integration_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.innovion_auth_has_role(company_id, ARRAY['admin','manager']));

-- ── Regression guards ───────────────────────────────────────────────────────
DO $$
DECLARE bad text;
BEGIN
  -- No policy may expose credential rows without an admin/manager check.
  SELECT string_agg(policyname, ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename  = 'integration_oauth_credentials'
    AND COALESCE(qual,'') NOT LIKE '%innovion_auth_has_role%'
    AND COALESCE(qual,'') NOT LIKE '%innovion_auth_is_admin%';

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'integration_oauth_credentials reachable without an admin/manager check: %', bad;
  END IF;

  -- The token columns must not be selectable by any end-user role.
  SELECT string_agg(grantee || ':' || column_name, ', ') INTO bad
  FROM information_schema.column_privileges
  WHERE table_schema = 'public'
    AND table_name   = 'integration_oauth_credentials'
    AND column_name IN ('encrypted_access_token','encrypted_refresh_token')
    AND grantee IN ('anon','authenticated','PUBLIC');

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Encrypted token columns are grantable to an end-user role: %', bad;
  END IF;

  -- No end-user write path to the credential table.
  SELECT string_agg(grantee || ':' || privilege_type, ', ') INTO bad
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name   = 'integration_oauth_credentials'
    AND grantee IN ('anon','authenticated')
    AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE');

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'End-user write privilege on integration_oauth_credentials: %', bad;
  END IF;

  -- The audit log must remain append-only for end users.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='integration_audit_log'
      AND cmd IN ('UPDATE','DELETE','ALL')
  ) THEN
    RAISE EXCEPTION 'integration_audit_log must be append-only for authenticated users.';
  END IF;
END $$;
