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

  SELECT string_agg(p.proname, ', ')
    INTO bad_functions
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    -- prokind 'f' only: pg_get_functiondef() raises on aggregates ('a'),
    -- window functions ('w') and procedures ('p').
    AND p.prokind = 'f'
    AND pg_get_functiondef(p.oid) ~ '(user_metadata|raw_user_meta_data)'
    -- get_my_company_id legitimately reads metadata as a SELECTOR, but only
    -- ever validated against public.user_roles in the same statement.
    AND pg_get_functiondef(p.oid) NOT LIKE '%user_roles%';

  IF bad_functions IS NOT NULL THEN
    RAISE EXCEPTION
      'Tenant authority regression: function(s) % resolve tenant identity from client-writable metadata without authoritative validation',
      bad_functions;
  END IF;
END $$;
