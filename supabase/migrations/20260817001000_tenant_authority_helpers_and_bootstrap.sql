-- ============================================================================
-- Innovion Team A — Tenant Authority: Helper Functions + Onboarding Bootstrap
-- Timestamp: 20260817001000
-- Companion to 20260817000000_tenant_authority_remediation.sql
-- ----------------------------------------------------------------------------
-- DEFECT 1 REMEDIATED (P0, cross-tenant, 80 policies):
--   public.get_my_company_id() resolved tenant identity from
--   auth.jwt() -> 'user_metadata' ->> 'company_id' — client-writable — BEFORE
--   consulting any authoritative source. 80 RLS policies across 20+ tables
--   depend on this function, so the tenant boundary for effectively the whole
--   schema was settable by the client. A policy-text scan does NOT reveal this,
--   because the metadata reference is inside the function body.
--
--   Remediation keeps the single-value signature (so all 80 policies remain
--   valid) but makes metadata a SELECTOR, never an AUTHORITY: a requested
--   company_id is honoured only when public.user_roles proves membership.
--
-- DEFECT 2 REMEDIATED (P0, onboarding deadlock):
--   user_roles_insert required is_company_admin(), which requires a user_roles
--   row — which onboarding was trying to create. A brand-new user could create
--   their company but NOT their own admin role row. The onboarding handler
--   swallows the error, so tenants were created with NO authoritative role row
--   and the application silently fell back to client-writable metadata.
--   Verified empirically before this migration:
--     STEP1 companies INSERT : PASS
--     STEP2 user_roles INSERT: FAIL (violates RLS policy for table "user_roles")
--
--   Remediation adds a narrowly-scoped bootstrap path: a user may create their
--   OWN admin row for a company they OWN. Ownership is authoritative because
--   companies_insert already forces owner_id = auth.uid().
--
-- DEFECT 3 REMEDIATED (hardening):
--   SECURITY DEFINER functions without a pinned search_path are vulnerable to
--   search-path hijacking. Pinned on every function this migration redefines.
-- ============================================================================

-- ── PHASE 1: Authoritative get_my_company_id() ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    -- (a) Requested active company from metadata, honoured ONLY when
    --     authoritative public.user_roles membership proves it.
    (SELECT ur.company_id
       FROM public.user_roles ur
      WHERE ur.user_id    = auth.uid()
        AND ur.company_id = NULLIF(auth.jwt() -> 'user_metadata' ->> 'company_id', '')::uuid
      LIMIT 1),

    -- (b) Otherwise the user's first authoritative membership (deterministic).
    (SELECT ur.company_id
       FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.company_id IS NOT NULL
      ORDER BY ur.created_at, ur.company_id
      LIMIT 1),

    -- (c) Onboarding bootstrap only: a company this user demonstrably owns.
    --     NOTE: the previous implementation selected companies.company_id
    --     (a nullable self-reference) rather than companies.id, so this
    --     fallback always returned NULL. Corrected to companies.id.
    (SELECT c.id
       FROM public.companies c
      WHERE c.owner_id = auth.uid()
      ORDER BY c.created_at, c.id
      LIMIT 1)
  );
$$;

COMMENT ON FUNCTION public.get_my_company_id() IS
  'Authoritative active tenant for the current user. user_metadata may SELECT among authorised tenants but is never itself authority.';

-- ── PHASE 2: Pin search_path on the remaining authority helpers ─────────────
CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id    = auth.uid()
       AND company_id = public.get_my_company_id()
       AND role       = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin_or_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id    = auth.uid()
       AND company_id = public.get_my_company_id()
       AND role       IN ('admin','manager')
  );
$$;

-- ── PHASE 3: Onboarding bootstrap for user_roles ────────────────────────────
-- Preserves the admin-only rule for all ordinary grants, and adds exactly one
-- additional path: self-grant of 'admin' on a company you own.
--
-- IMPORTANT: both existence checks MUST live in SECURITY DEFINER functions.
-- An inline `EXISTS (SELECT ... FROM public.user_roles ...)` inside a policy ON
-- public.user_roles re-enters that same policy and raises
--   "infinite recursion detected in policy for relation user_roles".
-- This was observed and corrected during verification of this migration.

CREATE OR REPLACE FUNCTION public.innovion_owns_company(target_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
     WHERE c.id = target_company AND c.owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.innovion_has_any_role_in(target_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid() AND ur.company_id = target_company
  );
$$;

REVOKE ALL ON FUNCTION public.innovion_owns_company(uuid)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.innovion_has_any_role_in(uuid)  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.innovion_owns_company(uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.innovion_has_any_role_in(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    -- (a) normal path: an existing tenant admin grants a role in their tenant
    ((company_id = public.get_my_company_id()) AND public.is_company_admin())

    -- (b) bootstrap path: the company OWNER claims their own admin role,
    --     and only their own, and only while they hold no role there yet.
    OR (
          user_id = auth.uid()
      AND role    = 'admin'
      AND public.innovion_owns_company(company_id)
      AND NOT public.innovion_has_any_role_in(company_id)
    )
  );

-- ── PHASE 4: Regression guard ───────────────────────────────────────────────
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.proname, ', ')
    INTO bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('get_my_company_id','get_user_company_id','integration_user_company_id')
    AND pg_get_functiondef(p.oid) LIKE '%user_metadata%'
    AND pg_get_functiondef(p.oid) NOT LIKE '%user_roles%';

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant authority regression: % resolve(s) tenant identity from client-writable metadata without authoritative validation', bad;
  END IF;
END $$;
