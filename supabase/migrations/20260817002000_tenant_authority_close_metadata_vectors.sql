-- ============================================================================
-- Innovion Team A — Close remaining client-writable tenant-authority vectors
-- Timestamp: 20260817002000
-- Third in the tenant-authority remediation series.
-- ----------------------------------------------------------------------------
-- DEFECT REMEDIATED (P0, cross-tenant data exposure — SEPARATE VECTOR):
--   public.get_user_company_id() resolved tenant identity from
--     auth.users.raw_user_meta_data ->> 'company_id'
--   which is written directly by the end user via
--     supabase.auth.updateUser({ data: { company_id: ... } }).
--
--   This vector survived the first two remediation migrations because it is
--   spelled `raw_user_meta_data` (the auth.users column) rather than
--   `user_metadata` (the JWT claim). Text scans for 'user_metadata' — over
--   policy expressions AND over function bodies — do not match it.
--
--   ~24 permissive `company_access_*` and `integration_*_company_read`
--   policies depend on this function. Because PostgreSQL OR-combines
--   permissive policies, these granted an independent cross-tenant read path
--   even after get_my_company_id() had been made authoritative.
--
--   Empirically demonstrated before this migration, as a Tenant B 'viewer'
--   who rewrote only their own raw_user_meta_data:
--     jobs        visible to attacker : 1
--     clients     visible to attacker : 1
--     employees   visible to attacker : 1
--     documents   visible to attacker : 1
--     time_entries visible            : 1
--
-- Also hardens integration_user_company_id(): pinned search_path and
-- deterministic tenant selection.
-- ============================================================================

-- ── PHASE 1: Authoritative get_user_company_id() ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- Delegates to the single authoritative resolver. Retained as a distinct
  -- function only so the ~24 dependent policies remain valid without edit.
  SELECT public.get_my_company_id();
$$;

COMMENT ON FUNCTION public.get_user_company_id() IS
  'Authoritative active tenant. Previously read auth.users.raw_user_meta_data (client-writable) — remediated 20260817002000.';

-- ── PHASE 2: Harden integration_user_company_id() ───────────────────────────
CREATE OR REPLACE FUNCTION public.integration_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.get_my_company_id();
$$;

-- ── PHASE 3: Regression guard covering BOTH spellings ───────────────────────
-- Catches client-writable tenant authority in policy expressions and in the
-- body of any function reachable from a policy.
DO $$
DECLARE bad_policies text; bad_functions text;
BEGIN
  SELECT string_agg(tablename || '.' || policyname, ', ')
    INTO bad_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (COALESCE(qual,'') || COALESCE(with_check,'')) ~ '(user_metadata|raw_user_meta_data)';

  IF bad_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant authority regression in policies: %', bad_policies;
  END IF;

  /*
   * A/B/D INTEGRATION CORRECTION.
   *
   * The original test was "mentions metadata AND does not mention user_roles".
   * That is too crude once other teams' functions share the schema, and it
   * produced a false positive that aborted this migration in the integrated
   * chain:
   *
   *   Team D's public.handle_platform_new_user() reads
   *     NEW.raw_user_meta_data->>'full_name'
   *     NEW.raw_user_meta_data->>'avatar_url'
   *   and hard-codes 'end_user' for the role and a fixed root tenant. It reads
   *   metadata for DISPLAY DATA ONLY and takes no authority from it — which is
   *   exactly the distinction 20260817001000 documents as acceptable.
   *
   * The test is now what it should always have been: flag a function only when
   * it reads an AUTHORITY key out of client-writable metadata, and does not
   * validate that read against an authoritative membership table.
   *
   * Authority keys: company_id, tenant_id, role (incl. platform_role),
   * is_admin/admin. Display keys such as full_name and avatar_url are not
   * authority and never were.
   *
   * Authoritative tables: public.user_roles (Team A), public.contractors
   * (Team B — a contractor's company_id is a platform-managed column, guarded
   * by contractors_protect_authority_columns), and Team D's
   * identity_tenant_memberships / identity_user_profiles.
   */
  SELECT string_agg(p.proname, ', ')
    INTO bad_functions
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    -- prokind 'f' only: pg_get_functiondef() raises on aggregates ('a'),
    -- window functions ('w') and procedures ('p').
    AND p.prokind = 'f'
    AND pg_get_functiondef(p.oid) ~
        '(user_metadata|raw_user_meta_data|raw_app_meta_data)[^;]{0,80}(company_id|tenant_id|platform_role|''role''|>>\s*''role''|is_admin)'
    AND pg_get_functiondef(p.oid) !~
        '(user_roles|identity_tenant_memberships|identity_user_profiles|public\.contractors)';

  IF bad_functions IS NOT NULL THEN
    RAISE EXCEPTION
      'Tenant authority regression: function(s) % resolve tenant identity from client-writable metadata without authoritative validation',
      bad_functions;
  END IF;
END $$;
