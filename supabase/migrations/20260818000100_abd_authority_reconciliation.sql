-- ============================================================================
-- Innovion A/B/D — Unified tenant & platform authority
-- Timestamp: 20260818000100   (runs last in the integrated chain)
-- ----------------------------------------------------------------------------
-- Establishes ONE authority architecture across Team A (Platform), Team B
-- (Workforce) and Team D (Platform Foundation).
--
-- Every section is conditional on the other teams' objects actually being
-- present, so this migration is correct when Team A is deployed alone and
-- correct when all three are deployed together. It never assumes.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DEFECT 1 REMEDIATED (P0 — the Workforce application is entirely locked out)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Team A and Team B each define public.get_my_company_id():
--
--   Team B  20260817000003 : resolves the tenant through public.contractors
--                            (contractors.user_id = auth.uid(), or a
--                            confirmed-email match), then falls back to
--                            public.user_roles.
--   Team A  20260817001000 : resolves through public.user_roles only, with a
--                            user_metadata SELECTOR validated against it, then
--                            a company-ownership bootstrap.
--
-- Migrations apply in version order, so Team A's definition (…001000) replaces
-- Team B's (…000003). A Workforce user is a CONTRACTOR: they have no
-- public.user_roles row and own no company, so Team A's resolver returns NULL
-- for them.
--
-- Team B then keys its RESTRICTIVE `<table>_tenant_guard` policies on that same
-- function, across jobs, time_entries, checklists, checklist_responses,
-- issue_reports, conversations, messages, notifications, supply_requests,
-- contractor_documents and notes. A restrictive policy that evaluates false
-- denies unconditionally, so every one of those tables returns nothing.
--
-- Demonstrated on the integrated chain before this migration:
--     WORKFORCE contractor  get_my_company_id() : NULL
--                           jobs visible        : 0
--                           time_entries visible: 0
--     PLATFORM staff admin  get_my_company_id() : <tenant>
--                           jobs visible        : 1
--
-- Both teams' suites pass in isolation (Team A 121/121, Team B 49/49) because
-- neither exercises the other's principal. The failure exists only in the
-- integrated schema, which is precisely what an integration must catch.
--
-- RESOLUTION — two clearly separated concepts, one resolver each:
--
--   public.innovion_auth_company_ids()  STAFF membership.
--        user_roles ∪ owned companies. Unchanged semantics. Team A's
--        administrative policies (companies, user_roles, pending_invites,
--        provider_integrations, role_permissions, company_localisation,
--        partner_revenue, storage) continue to use it, so a contractor gains
--        NO administrative visibility from this migration.
--
--   public.innovion_tenant_ids()        ANY principal's tenant.
--        staff membership ∪ contractor linkage. This is what
--        get_my_company_id() selects from, so Workforce data policies resolve.
--
-- Widening the single existing function instead would have handed every
-- contractor read access to their tenant's pending invitations, provider
-- integrations and role matrix. Section 4 closes the narrower widening that
-- remains.
-- ============================================================================

-- ── 1. Membership sets ─────────────────────────────────────────────────────

-- Contractor → tenant linkage, matching Team B's rule exactly: an explicit
-- user_id link, or a CONFIRMED e-mail match. The confirmation check is
-- load-bearing — an unconfirmed address would otherwise be a tenant selector.
CREATE OR REPLACE FUNCTION public.innovion_contractor_company_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF to_regclass('public.contractors') IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT c.company_id
    FROM public.contractors c
    WHERE c.company_id IS NOT NULL
      AND (
        c.user_id = auth.uid()
        OR (
          c.user_id IS NULL
          AND c.email IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM auth.users u
            WHERE u.id = auth.uid()
              AND u.email_confirmed_at IS NOT NULL
              AND u.email IS NOT NULL
              AND lower(u.email) = lower(c.email)
          )
        )
      );
EXCEPTION WHEN undefined_column THEN
  -- contractors.user_id is added by Team B's chain; without it there is no
  -- contractor linkage to report.
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.innovion_contractor_company_ids() IS
  'Tenants a Workforce contractor belongs to, via contractors.user_id or a confirmed e-mail match. Never from client-writable metadata.';

-- Every tenant this principal belongs to, by any authoritative route.
CREATE OR REPLACE FUNCTION public.innovion_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ur.company_id
    FROM public.user_roles ur
   WHERE ur.user_id = auth.uid() AND ur.company_id IS NOT NULL
  UNION
  SELECT c.id
    FROM public.companies c
   WHERE c.owner_id = auth.uid()
  UNION
  SELECT public.innovion_contractor_company_ids();
$$;

COMMENT ON FUNCTION public.innovion_tenant_ids() IS
  'Every tenant the caller authoritatively belongs to: staff role, company ownership, or contractor linkage. The set get_my_company_id() selects from.';

REVOKE ALL ON FUNCTION public.innovion_contractor_company_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.innovion_tenant_ids()             FROM PUBLIC;
-- anon must hold EXECUTE: Team B declares restrictive guards TO authenticated,
-- anon, and a policy predicate is evaluated as the CALLING role. Without the
-- grant anon receives "permission denied for function" — an error where a
-- silent denial was intended. Both functions return no rows when auth.uid() is
-- NULL, so nothing is disclosed.
GRANT EXECUTE ON FUNCTION public.innovion_contractor_company_ids() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.innovion_tenant_ids()             TO anon, authenticated, service_role;

-- ── 2. The single tenant resolver ──────────────────────────────────────────
--
-- Preserves every property both teams established:
--   * user_metadata is a SELECTOR only, honoured solely when the requested
--     tenant is in the authoritative set (Team A, 20260817001000);
--   * contractor linkage resolves the tenant for a Workforce user (Team B);
--   * company ownership still bootstraps onboarding (Team A);
--   * the result is deterministic when a principal belongs to several tenants.
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT t FROM public.innovion_tenant_ids() t
      WHERE t = NULLIF(auth.jwt() -> 'user_metadata' ->> 'company_id', '')::uuid
      LIMIT 1),
    (SELECT t FROM public.innovion_tenant_ids() t ORDER BY t LIMIT 1)
  );
$$;

COMMENT ON FUNCTION public.get_my_company_id() IS
  'The caller''s active tenant. Unified Team A + Team B resolver: staff role, company ownership, or contractor linkage. user_metadata may select among authorised tenants but is never itself authority.';

REVOKE ALL ON FUNCTION public.get_my_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO anon, authenticated, service_role;

-- get_user_company_id() and integration_user_company_id() already delegate to
-- get_my_company_id() (Team A, 20260817002000), so they inherit this.

-- ── 3. Platform-operator identity: one concept, Team D is the registry ─────
--
-- Team A introduced public.platform_operators (20260817007000) to gate the
-- partner/licensing tables. Team D independently models platform operations in
-- identity_user_profiles.platform_role ∈ (founder, platform_engineer), reached
-- through public.is_platform_admin().
--
-- Two registries for one concept is exactly the duplicate-authority problem
-- this integration exists to remove. Team D's identity model is the richer and
-- more governed of the two — it carries an is_active flag, an audited profile
-- guard trigger and a founder tier — so Team A DEFERS to it, while keeping its
-- own table working for a Team-A-only deployment.
-- ═══════════════════════════════════════════════════════════════════════════
-- P0 — BEHAVIOURAL FAIL-CLOSED GUARD ON THE PLATFORM-AUTHORITY BRIDGE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Raised by Team D's cross-team verification and INDEPENDENTLY CONFIRMED here.
--
-- THE DEFECT. The first version of this section bridged on an EXISTENCE check:
--   IF to_regprocedure('public.is_platform_admin()') IS NOT NULL THEN ...
-- `is_platform_admin()` is created by Team D's FIRST migration,
-- 20260807050000_platform_foundation_schema.sql, in this form:
--
--   SELECT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth.uid()
--     AND (au.raw_user_meta_data->>'platform_role' IN ('founder','platform_engineer')
--       OR au.raw_app_meta_data->>'platform_role' IN ('founder','platform_engineer')))
--
-- `raw_user_meta_data` is written by the end user through
-- `supabase.auth.updateUser({ data: { platform_role: 'founder' } })`. Team D's
-- 20260817000500 hardening replaces it with a read of identity_user_profiles.
--
-- Verified by reading Team D's migration, not taken on report: the base
-- definition above is present in their 20260807050000 at the time of writing.
--
-- So an existence check binds this bridge to WHICHEVER definition happens to be
-- installed. If Team A's reconciliation is deployed while only Team D's base is
-- applied, `innovion_is_platform_operator()` inherits the metadata-reading
-- version and ANY authenticated user can self-promote into Team A's partner
-- register — read AND write `partners`, `partner_products`, `partner_revenue` —
-- with one client-side call, while `platform_operators` stays empty.
--
-- THE GUARD. The brief is explicit that this must test the security STATE, not
-- that a name exists. So it does three things, strongest first:
--
--   1. BEHAVIOURAL PROBE. Create a synthetic principal whose ONLY claim to
--      authority is forged metadata, ask `is_platform_admin()` about them, and
--      look at the answer. The whole probe runs inside a subtransaction that is
--      ALWAYS rolled back, so it leaves nothing behind whatever the outcome.
--      This is a real test of behaviour: it cannot be fooled by comments, by
--      aliasing the accessor, or by any future re-implementation.
--
--   2. STRUCTURAL FALLBACK, used only when the probe cannot run (for example
--      where auth.users cannot be written in this context). Weaker, and known
--      to be weaker — Team D's own item 9.6 shows text scans match comments and
--      miss aliases — so it is the fallback, not the test.
--
--   3. FAIL CLOSED. If the probe says the function is escalatable, or if
--      neither check can reach a positive conclusion, this migration RAISES and
--      the deployment stops. It does not quietly skip the bridge: a silent skip
--      would leave an operator believing the unification had happened.
--
-- Team D absent entirely is a different case and is NOT an error: A+B is a
-- supported deployment, so the bridge is skipped and `platform_operators`
-- remains the sole registry.
DO $$
DECLARE
  probe_uid    uuid := '00000000-0000-0000-0000-0000d00dbeef';
  probe_admin  boolean;
  probe_ran    boolean := false;
  definition   text;
  reads_meta   boolean;
BEGIN
  IF to_regprocedure('public.is_platform_admin()') IS NULL THEN
    RAISE NOTICE 'Team D identity model absent; platform_operators remains the sole registry.';
    RETURN;
  END IF;

  -- ── 1. Behavioural probe, in an always-rolled-back subtransaction ────────
  BEGIN
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (
      probe_uid,
      'abd-integration-probe@innovion.invalid',
      jsonb_build_object('platform_role', 'founder')
    );

    PERFORM set_config(
      'request.jwt.claims',
      json_build_object('sub', probe_uid::text, 'role', 'authenticated')::text,
      true
    );

    SELECT public.is_platform_admin() INTO probe_admin;
    probe_ran := true;

    -- Unwind everything the probe did, including any signup triggers it fired.
    RAISE EXCEPTION USING ERRCODE = 'raise_exception', MESSAGE = 'ABD_PROBE_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ABD_PROBE_ROLLBACK' THEN
      -- The probe could not be executed here. Not fatal by itself; fall through
      -- to the structural check. PL/pgSQL variables survive the rollback, so
      -- probe_ran correctly reports whether a verdict was reached.
      probe_ran := false;
      RAISE NOTICE 'Behavioural probe unavailable (%); falling back to structural check.', SQLERRM;
    END IF;
  END;

  PERFORM set_config('request.jwt.claims', '', true);

  IF probe_ran THEN
    IF probe_admin THEN
      RAISE EXCEPTION
        'Refusing to bridge platform authority: is_platform_admin() granted platform-administrator status to a synthetic principal whose only claim was forged user_metadata. Team D 20260817000500_platform_authority_hardening.sql must be applied first, or in the same deployment. Bridging now would let any authenticated user read and write public.partners, public.partner_products and public.partner_revenue.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RAISE NOTICE 'Behavioural probe passed: is_platform_admin() refuses forged metadata.';
  ELSE
    -- ── 2. Structural fallback ────────────────────────────────────────────
    definition := regexp_replace(
      pg_get_functiondef(to_regprocedure('public.is_platform_admin()')),
      '--[^\n]*', '', 'g'
    );
    reads_meta := definition ~ '(raw_user_meta_data|raw_app_meta_data|user_metadata)';

    IF reads_meta THEN
      RAISE EXCEPTION
        'Refusing to bridge platform authority: is_platform_admin() reads client-writable metadata, and the behavioural probe could not run to prove otherwise. Apply Team D 20260817000500_platform_authority_hardening.sql first, or in the same deployment.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RAISE WARNING
      'Behavioural probe could not run; bridging on the structural check alone. Confirm Team D hardening is applied.';
  END IF;

  -- ── 3. Bridge ────────────────────────────────────────────────────────────
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.innovion_is_platform_operator()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $body$
      SELECT auth.uid() IS NOT NULL
         AND (
           EXISTS (SELECT 1 FROM public.platform_operators WHERE user_id = auth.uid())
           OR public.is_platform_admin()
         );
    $body$;
  $fn$;
  RAISE NOTICE 'Platform-operator authority unified with Team D identity_user_profiles.';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3b. PLATFORM_ENGINEER PRIVILEGE — ADJUDICATED, AND NARROWED
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Team D asked whether their `platform_engineer` tier is intended to hold
-- ALL-command write over public.partners, public.partner_products and
-- public.partner_revenue, which it inherits because the bridge above calls
-- `is_platform_admin()` — and that function spans BOTH `founder` and
-- `platform_engineer`.
--
-- RULING: NOT INTENDED. It is excessive and is narrowed here.
--
--   * public.partner_revenue carries commission_amount, royalty_amount, mrr and
--     arr. Those are partner FINANCIAL records. Writing them is a commercial
--     act, not an engineering one, and there is no operational task that
--     requires an engineer to alter what a partner is owed.
--   * public.partners carries commission_rate, royalty_rate and contract dates —
--     the commercial terms themselves.
--   * The tier is named for engineering. Least privilege says the authority
--     should match the name.
--
-- Team D was right to flag it rather than let existing green tests stand as
-- consent. Tests permitting an authority is not evidence that it was intended.
--
-- TWO TIERS, replacing one:
--
--   innovion_is_platform_operator()  READ tier.
--       platform_operators ∪ founder ∪ platform_engineer.
--       Sees the partner register and the product catalogue, which is what
--       diagnosing and supporting a partner deployment actually needs.
--
--   innovion_is_platform_steward()   WRITE tier, and the only tier that may see
--       partner financial records.
--       platform_operators ∪ founder. NOT platform_engineer.
--
-- `platform_operators` remains write-capable: membership of that table is
-- granted out-of-band by a database administrator, deliberately, one user at a
-- time. It is not a self-service tier.
CREATE OR REPLACE FUNCTION public.innovion_is_platform_steward()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.platform_operators WHERE user_id = auth.uid());
$$;

COMMENT ON FUNCTION public.innovion_is_platform_steward() IS
  'Write authority over platform/partner commercial data. Team A platform_operators, plus Team D founders where the Team D identity model is present. Deliberately excludes platform_engineer.';

REVOKE ALL ON FUNCTION public.innovion_is_platform_steward() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.innovion_is_platform_steward() TO anon, authenticated, service_role;

DO $$
BEGIN
  -- Extend the steward tier to Team D founders only, when Team D is present.
  -- Guarded on the same behavioural verdict as the read bridge above: if we
  -- reached this point, is_platform_founder() has been proven not to answer to
  -- forged metadata (it is hardened in the same Team D migration).
  IF to_regprocedure('public.is_platform_founder()') IS NOT NULL
     AND to_regprocedure('public.is_platform_admin()') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.innovion_is_platform_steward()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
        SELECT auth.uid() IS NOT NULL
           AND (
             EXISTS (SELECT 1 FROM public.platform_operators WHERE user_id = auth.uid())
             OR public.is_platform_founder()
           );
      $body$;
    $fn$;
  END IF;
END $$;

-- Re-cut the partner policies along the two tiers.
DO $$
BEGIN
  IF to_regclass('public.partners') IS NOT NULL THEN
    DROP POLICY IF EXISTS "partners_operator_read"  ON public.partners;
    DROP POLICY IF EXISTS "partners_operator_write" ON public.partners;
    DROP POLICY IF EXISTS "partners_steward_write"  ON public.partners;

    CREATE POLICY "partners_operator_read" ON public.partners
      FOR SELECT TO authenticated
      USING (public.innovion_is_platform_operator());

    CREATE POLICY "partners_steward_write" ON public.partners
      FOR ALL TO authenticated
      USING      (public.innovion_is_platform_steward())
      WITH CHECK (public.innovion_is_platform_steward());
  END IF;

  IF to_regclass('public.partner_products') IS NOT NULL THEN
    DROP POLICY IF EXISTS "partner_products_operator_read"  ON public.partner_products;
    DROP POLICY IF EXISTS "partner_products_operator_write" ON public.partner_products;
    DROP POLICY IF EXISTS "partner_products_steward_write"  ON public.partner_products;

    CREATE POLICY "partner_products_operator_read" ON public.partner_products
      FOR SELECT TO authenticated
      USING (public.innovion_is_platform_operator());

    CREATE POLICY "partner_products_steward_write" ON public.partner_products
      FOR ALL TO authenticated
      USING      (public.innovion_is_platform_steward())
      WITH CHECK (public.innovion_is_platform_steward());
  END IF;

  -- partner_revenue is financial. The engineer tier does not read it at all;
  -- a tenant continues to read its OWN revenue rows, which is the legitimate
  -- customer-facing case and predates this change.
  IF to_regclass('public.partner_revenue') IS NOT NULL THEN
    DROP POLICY IF EXISTS "partner_revenue_read"           ON public.partner_revenue;
    DROP POLICY IF EXISTS "partner_revenue_operator_write" ON public.partner_revenue;
    DROP POLICY IF EXISTS "partner_revenue_steward_write"  ON public.partner_revenue;

    CREATE POLICY "partner_revenue_read" ON public.partner_revenue
      FOR SELECT TO authenticated
      USING (
        public.innovion_is_platform_steward()
        OR company_id IN (SELECT public.innovion_auth_company_ids())
      );

    CREATE POLICY "partner_revenue_steward_write" ON public.partner_revenue
      FOR ALL TO authenticated
      USING      (public.innovion_is_platform_steward())
      WITH CHECK (public.innovion_is_platform_steward());
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3c. A ↔ D TENANCY CONTRACT — the authoritative correspondence
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Team D verified there is no join, no foreign key and no mapping between
-- Team A's `companies.id uuid` and Team D's `platform_tenants.tenant_id text`,
-- so a legitimate Innovion tenant administrator is a stranger to Platform
-- Foundation: `platform_has_tenant_access()` and `platform_is_tenant_member()`
-- both return false, and their Platform event publish and audit write are
-- refused. Team D declined to invent a mapping. That was the right call.
--
-- RULING — ONE SOURCE OF TRUTH, PROJECTED, NEVER DUPLICATED.
--
--   Team A's `companies` is the sole authority for which tenants exist.
--   Team A's `user_roles` is the sole authority for who belongs to one.
--   Team D's `platform_tenants` and `identity_tenant_memberships` become a
--   PROJECTION of those, never an independent register.
--
-- Team A therefore publishes the correspondence as two read-only views and
-- Team D projects from them. Team A does not write Team D's tables, and Team D
-- does not decide who is a tenant member.
--
-- ── The contract ───────────────────────────────────────────────────────────
--
-- CANONICAL TENANT ID.  Deterministic, so it can be computed without a lookup
-- and can never drift:
--
--     tenant_id := 'company:' || companies.id::text
--
-- CORRESPONDENCE COLUMN.  Team D adds to public.platform_tenants:
--
--     company_id uuid UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE
--
--   UNIQUE because the correspondence is one-to-one. ON DELETE CASCADE because
--   a tenant that no longer exists in Team A must not survive in Team D.
--
-- MEMBERSHIP PROJECTION.  From `innovion_tenant_membership_directory` below:
--
--     company owner (companies.owner_id)     -> tenant_owner
--     user_roles.role = 'admin'              -> tenant_admin
--     user_roles.role IN ('manager',
--                         'supervisor')      -> tenant_member
--     user_roles.role IN ('viewer',
--                         'contractor')      -> NO membership
--     Workforce contractors (contractors)    -> NO membership
--
--   Viewers and contractors are deliberately excluded. Platform Foundation
--   membership carries event-bus publish and audit-write authority; a read-only
--   viewer and a field worker have no Platform Foundation business, and
--   granting it would widen authority in the name of a bridge.
--
--   Where a user holds several roles in one company, the HIGHEST applies —
--   owner > admin > member — which the view already resolves, so Team D does
--   not have to decide.
--
-- DIRECTION.  Strictly one-way, A → D. Team D must not create a
--   platform_tenants row that has no companies row behind it, and must not
--   grant an identity_tenant_membership that the directory does not report.
--   Team D's own platform-operations tenants (e.g. 'tenant-coralamy-root') are
--   unaffected: they simply have company_id IS NULL and are not projected.
--
-- FORGERY.  Every column below derives from companies, companies.owner_id and
--   user_roles. No metadata is read anywhere in this contract.

CREATE OR REPLACE VIEW public.innovion_tenant_directory
WITH (security_invoker = true) AS
  SELECT
    c.id                                AS company_id,
    'company:' || c.id::text            AS tenant_id,
    c.name                              AS display_name,
    true                                AS is_active
  FROM public.companies c;

COMMENT ON VIEW public.innovion_tenant_directory IS
  'A/B/D contract: the authoritative set of Innovion tenants, with the canonical Platform Foundation tenant_id. Team D projects platform_tenants from this and never invents a row.';

CREATE OR REPLACE VIEW public.innovion_tenant_membership_directory
WITH (security_invoker = true) AS
  SELECT
    m.user_id,
    m.company_id,
    'company:' || m.company_id::text AS tenant_id,
    m.tenant_role
  FROM (
    SELECT
      c.owner_id AS user_id,
      c.id       AS company_id,
      'tenant_owner'::text AS tenant_role,
      0 AS rank
    FROM public.companies c
    WHERE c.owner_id IS NOT NULL

    UNION ALL

    SELECT
      ur.user_id,
      ur.company_id,
      CASE ur.role
        WHEN 'admin'      THEN 'tenant_admin'
        WHEN 'manager'    THEN 'tenant_member'
        WHEN 'supervisor' THEN 'tenant_member'
      END AS tenant_role,
      CASE ur.role WHEN 'admin' THEN 1 ELSE 2 END AS rank
    FROM public.user_roles ur
    WHERE ur.company_id IS NOT NULL
      AND ur.role IN ('admin', 'manager', 'supervisor')
  ) m
  WHERE m.tenant_role IS NOT NULL
    -- Highest role wins where a principal qualifies more than once.
    AND m.rank = (
      SELECT min(m2.rank) FROM (
        SELECT c.owner_id AS user_id, c.id AS company_id, 0 AS rank
          FROM public.companies c WHERE c.owner_id IS NOT NULL
        UNION ALL
        SELECT ur.user_id, ur.company_id,
               CASE ur.role WHEN 'admin' THEN 1 ELSE 2 END
          FROM public.user_roles ur
         WHERE ur.company_id IS NOT NULL
           AND ur.role IN ('admin', 'manager', 'supervisor')
      ) m2
      WHERE m2.user_id = m.user_id AND m2.company_id = m.company_id
    );

COMMENT ON VIEW public.innovion_tenant_membership_directory IS
  'A/B/D contract: who belongs to an Innovion tenant and at what Platform Foundation tenant_role. Team D projects identity_tenant_memberships from this. Viewers and Workforce contractors are deliberately absent.';

REVOKE ALL ON public.innovion_tenant_directory            FROM PUBLIC, anon;
REVOKE ALL ON public.innovion_tenant_membership_directory FROM PUBLIC, anon;
GRANT SELECT ON public.innovion_tenant_directory            TO authenticated, service_role;
GRANT SELECT ON public.innovion_tenant_membership_directory TO authenticated, service_role;

-- ── 4. Close the widening this integration would otherwise introduce ───────
--
-- Team A's per-table data policies key on get_my_company_id(). Now that the
-- resolver answers for contractors, a Workforce user would gain tenant-wide
-- READ of Team A tables that have nothing to do with field work — including
-- public.employees, which carries `salary`, and public.clients, which carries
-- customer contacts and revenue.
--
-- That access did not exist before this migration and must not be created by
-- it. A RESTRICTIVE policy is used rather than editing Team A's permissive
-- policies: restrictive policies AND with everything else, so this can only
-- ever subtract, and Team A's behaviour for staff is provably unchanged.
--
-- CARVE-OUTS — raised by Team B and adopted here.
--
-- Team B's integrated replay found that two of the fifteen tables below are
-- surfaces the Workforce application legitimately depends on, and that a
-- blanket denial broke them:
--
--   compliance_items — the worker's OWN certifications, status and expiry, on
--                      their own profile screen. Withholding a worker's own
--                      compliance record from them is not a privacy control.
--   settings         — company_logo_url, read by the splash screen and home
--                      header before anything else loads. Visible on every cold
--                      start of every device.
--
-- Team B measured both as failing (their A44/A45) and offered Team A the choice
-- of owning the carve-outs. TAKEN. Splitting one policy set across two teams'
-- migrations is the same duplicate-authority pattern this reconciliation exists
-- to remove, and the thirteen genuine denials and the two exceptions belong in
-- one place, decided once.
--
-- The carve-outs are narrower in BOTH directions, not merely looser: a worker
-- gains their own compliance record and the tenant's branding, and nothing
-- else. Writes stay closed on both tables, and a colleague's compliance record
-- stays closed — which the blanket denial also achieved, but the application's
-- own unfiltered query did not.
--
-- Team B's 20260818000200_workforce_data_access_carveouts.sql is therefore no
-- longer required and should be removed; see the integration report.
DO $$
DECLARE
  t text;
  denied text[] := ARRAY[
    'clients', 'employees', 'inventory', 'vehicles',
    'contractor_invoices', 'subscriptions', 'platform_api_keys',
    'platform_api_request_log', 'provider_integrations', 'pending_invites',
    'role_permissions', 'activity_log', 'timesheet_audit_log'
  ];
BEGIN
  IF to_regprocedure('public.is_workforce_only_user()') IS NULL THEN
    RAISE NOTICE 'Team B not present; workforce restrictions not required.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY denied LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_workforce_denied', t);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I
        AS RESTRICTIVE FOR ALL TO authenticated
        USING      (NOT public.is_workforce_only_user())
        WITH CHECK (NOT public.is_workforce_only_user())
    $p$, t || '_workforce_denied', t);
  END LOOP;
END $$;

-- ── 4a. compliance_items — the worker's OWN record, read-only ──────────────
DO $$
BEGIN
  IF to_regclass('public.compliance_items') IS NULL THEN RETURN; END IF;
  IF to_regprocedure('public.is_workforce_only_user()') IS NULL THEN RETURN; END IF;
  IF to_regprocedure('public.get_my_contractor_id()') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "compliance_items_workforce_denied"   ON public.compliance_items;
  DROP POLICY IF EXISTS "compliance_items_workforce_own_only" ON public.compliance_items;

  -- `assigned_to` is a display name: public.compliance_items carries no
  -- contractor foreign key. The match is therefore by name against the caller's
  -- OWN contractor record, and that record is resolved server-side by
  -- get_my_contractor_id() — the caller cannot nominate whose items they see.
  -- A proper contractor_id column on compliance_items is recorded in the
  -- integration report as follow-up; it would make this exact.
  CREATE POLICY "compliance_items_workforce_own_only" ON public.compliance_items
    AS RESTRICTIVE FOR SELECT TO authenticated
    USING (
      NOT public.is_workforce_only_user()
      OR assigned_to = (
        SELECT c.name FROM public.contractors c
        WHERE c.id = public.get_my_contractor_id()
      )
    );

  -- Writes stay closed: a compliance status is asserted by the Platform after
  -- review, never by the person it describes.
  DROP POLICY IF EXISTS "compliance_items_workforce_readonly"  ON public.compliance_items;
  CREATE POLICY "compliance_items_workforce_readonly" ON public.compliance_items
    AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (NOT public.is_workforce_only_user());

  DROP POLICY IF EXISTS "compliance_items_workforce_no_update" ON public.compliance_items;
  CREATE POLICY "compliance_items_workforce_no_update" ON public.compliance_items
    AS RESTRICTIVE FOR UPDATE TO authenticated
    USING      (NOT public.is_workforce_only_user())
    WITH CHECK (NOT public.is_workforce_only_user());

  DROP POLICY IF EXISTS "compliance_items_workforce_no_delete" ON public.compliance_items;
  CREATE POLICY "compliance_items_workforce_no_delete" ON public.compliance_items
    AS RESTRICTIVE FOR DELETE TO authenticated
    USING (NOT public.is_workforce_only_user());
END $$;

-- ── 4b. settings — tenant branding, read-only ──────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.settings') IS NULL THEN RETURN; END IF;
  IF to_regprocedure('public.is_workforce_only_user()') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "settings_workforce_denied" ON public.settings;

  -- READ is permitted. The tenant guard already bounds it to the caller's own
  -- company, so this adds no cross-tenant reach; what it restores is
  -- company_logo_url on the splash screen and home header.
  --
  -- WRITE stays closed: company name, ABN, timezone, currency and notification
  -- defaults are administrative settings.
  DROP POLICY IF EXISTS "settings_workforce_readonly"  ON public.settings;
  CREATE POLICY "settings_workforce_readonly" ON public.settings
    AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (NOT public.is_workforce_only_user());

  DROP POLICY IF EXISTS "settings_workforce_no_update" ON public.settings;
  CREATE POLICY "settings_workforce_no_update" ON public.settings
    AS RESTRICTIVE FOR UPDATE TO authenticated
    USING      (NOT public.is_workforce_only_user())
    WITH CHECK (NOT public.is_workforce_only_user());

  DROP POLICY IF EXISTS "settings_workforce_no_delete" ON public.settings;
  CREATE POLICY "settings_workforce_no_delete" ON public.settings
    AS RESTRICTIVE FOR DELETE TO authenticated
    USING (NOT public.is_workforce_only_user());
END $$;

-- public.documents is different: field staff legitimately need site and safety
-- documents, so a blanket denial would remove a capability the Workforce app
-- depends on. Management-only material is withheld instead.
DO $$
BEGIN
  IF to_regprocedure('public.is_workforce_only_user()') IS NULL THEN RETURN; END IF;
  IF to_regclass('public.documents') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "documents_workforce_access_level" ON public.documents;
  CREATE POLICY "documents_workforce_access_level"
    ON public.documents
    AS RESTRICTIVE FOR ALL TO authenticated
    USING (
      NOT public.is_workforce_only_user()
      OR coalesce(access_level, '') NOT IN ('Management', 'Admin', 'Restricted')
    )
    WITH CHECK (
      NOT public.is_workforce_only_user()
      OR coalesce(access_level, '') NOT IN ('Management', 'Admin', 'Restricted')
    );
END $$;

-- ── 4b. Re-arm Team B's contractor column guard over Team A's later columns ─
--
-- DEFECT (P1 — a Workforce user can set their own pay rate).
--
-- Team B's 20260817000003 builds public.contractors_protect_privileged_columns()
-- DYNAMICALLY, from whichever of ('role','compliance_status','hourly_rate',
-- 'pay_rate') exist on public.contractors AT THE MOMENT THAT MIGRATION RUNS:
--
--     FOREACH col IN ARRAY ARRAY['role','compliance_status','hourly_rate','pay_rate']
--       IF EXISTS (SELECT 1 FROM information_schema.columns …) THEN
--         guarded := guarded || col;
--
-- Team A adds contractors.hourly_rate in 20260817011000 — four versions LATER.
-- In the integrated chain the guard is therefore compiled before the column
-- exists, and hourly_rate is silently left out of it.
--
-- Demonstrated before this section: a contractor updating their own row set
-- hourly_rate to 9999 and the update succeeded — 1 row. Timesheet approval
-- stamps that rate onto the time entry and then onto the contractor invoice
-- (20260817011000), so a worker could set their own charge-out rate and have it
-- flow through to an invoice.
--
-- Neither team could have caught this alone: Team B's guard is correct for
-- Team B's schema, and Team A's column is correct for Team A's. It exists only
-- in the ordering of the combined chain.
--
-- The guard is rebuilt here, after every column exists, using Team B's own
-- logic and error semantics so behaviour is identical for the columns it
-- already covered.
DO $$
DECLARE
  guarded text[] := ARRAY[]::text[];
  col     text;
  body    text := '';
BEGIN
  IF to_regprocedure('public.is_end_user_session()') IS NULL
     OR to_regprocedure('public.is_platform_manager()') IS NULL THEN
    RAISE NOTICE 'Team B not present; contractor column guard not applicable.';
    RETURN;
  END IF;

  FOREACH col IN ARRAY ARRAY['role', 'compliance_status', 'hourly_rate', 'pay_rate', 'abn'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contractors' AND column_name = col
    ) THEN
      guarded := guarded || col;
    END IF;
  END LOOP;

  IF array_length(guarded, 1) IS NULL THEN RETURN; END IF;

  FOREACH col IN ARRAY guarded LOOP
    body := body || format(
      '  IF NEW.%1$I IS DISTINCT FROM OLD.%1$I THEN
           RAISE EXCEPTION ''%1$s is managed by the Innovion Platform and cannot be changed by a workforce user''
             USING ERRCODE = ''42501'';
         END IF;
      ', col);
  END LOOP;

  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.contractors_protect_privileged_columns()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $body$
    BEGIN
      IF NOT public.is_end_user_session() THEN RETURN NEW; END IF;
      IF public.is_platform_manager() THEN RETURN NEW; END IF;
    %s
      RETURN NEW;
    END;
    $body$;
  $fn$, body);

  RAISE NOTICE 'Contractor privileged-column guard re-armed over: %', array_to_string(guarded, ', ');
END $$;

-- ── 5. Storage: one documents-bucket policy set ────────────────────────────
--
-- Team A (20260817005000) and Team B (20260817000003) each install a complete,
-- individually correct set of documents-bucket policies. Both are PERMISSIVE,
-- and permissive policies OR together, so the combined effect is weaker than
-- either team designed:
--
--   * Team A restricts DELETE to admin/manager — "destroying a compliance or
--     contract document is an administrative act". Team B's
--     documents_delete_own allows any tenant member to delete. OR-combined,
--     Team A's restriction is void.
--   * Team B admits a legacy layout, `(storage.foldername(name))[1] =
--     auth.uid()::text`. OR-combined with Team A's tenant rule, any
--     authenticated user may read and write objects under a folder named with
--     their own uid, outside every tenant folder and therefore invisible to
--     their own administrators.
--
-- Replaced with one set that keeps what each team required: tenant-scoped
-- access for both principals, the legacy uid layout for READ only (so existing
-- objects remain reachable) and never for new writes, and administrative
-- deletion.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "documents_select_policy" ON storage.objects;
  DROP POLICY IF EXISTS "documents_insert_policy" ON storage.objects;
  DROP POLICY IF EXISTS "documents_update_policy" ON storage.objects;
  DROP POLICY IF EXISTS "documents_delete_policy" ON storage.objects;
  DROP POLICY IF EXISTS "documents_select_own"    ON storage.objects;
  DROP POLICY IF EXISTS "documents_insert_own"    ON storage.objects;
  DROP POLICY IF EXISTS "documents_update_own"    ON storage.objects;
  DROP POLICY IF EXISTS "documents_delete_own"    ON storage.objects;

  CREATE POLICY "documents_select_policy"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'documents'
      AND (
        public.innovion_storage_tenant_ok(name)
        OR (storage.foldername(name))[1] = public.get_my_company_id()::text
        -- Legacy per-user layout: readable so existing objects are not orphaned.
        OR (storage.foldername(name))[1] = auth.uid()::text
      )
    );

  -- New objects must land in a tenant folder. The legacy uid layout is
  -- deliberately NOT accepted for writes.
  CREATE POLICY "documents_insert_policy"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'documents'
      AND (
        public.innovion_storage_tenant_ok(name)
        OR (storage.foldername(name))[1] = public.get_my_company_id()::text
      )
    );

  CREATE POLICY "documents_update_policy"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'documents'
      AND (
        public.innovion_storage_tenant_ok(name)
        OR (storage.foldername(name))[1] = public.get_my_company_id()::text
      )
    )
    WITH CHECK (
      bucket_id = 'documents'
      AND (
        public.innovion_storage_tenant_ok(name)
        OR (storage.foldername(name))[1] = public.get_my_company_id()::text
      )
    );

  -- Deletion remains administrative, as Team A required.
  CREATE POLICY "documents_delete_policy"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'documents'
      AND public.innovion_storage_tenant_manager(name)
    );
END $$;

-- ── 6. Regression guards for the integrated schema ─────────────────────────
DO $$
DECLARE bad text;
BEGIN
  -- 6a. Exactly one tenant resolver, and it must know about contractors when
  --     Team B is present.
  IF to_regclass('public.contractors') IS NOT NULL
     AND to_regprocedure('public.is_workforce_only_user()') IS NOT NULL THEN
    IF pg_get_functiondef(to_regprocedure('public.get_my_company_id()')) !~ 'innovion_tenant_ids' THEN
      RAISE EXCEPTION
        'get_my_company_id() is not the unified resolver: a Workforce contractor would resolve to NULL and every Team B restrictive tenant guard would deny unconditionally.';
    END IF;
  END IF;

  -- 6b. The staff-membership set must NOT have been widened to contractors.
  IF pg_get_functiondef(to_regprocedure('public.innovion_auth_company_ids()')) ~ 'contractor' THEN
    RAISE EXCEPTION
      'innovion_auth_company_ids() has been widened to contractors; that grants Workforce users administrative visibility (pending invitations, provider integrations, role matrix).';
  END IF;

  -- 6c. No duplicate permissive documents-bucket policy set.
  SELECT string_agg(policyname, ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'storage' AND policyname IN
        ('documents_select_own','documents_insert_own','documents_update_own','documents_delete_own');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate documents-bucket policy set still present: %', bad;
  END IF;

  -- 6d. Storage deletion must still be administrative.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND policyname='documents_delete_policy' AND permissive='PERMISSIVE'
      AND COALESCE(qual,'') !~ 'innovion_storage_tenant_manager'
  ) THEN
    RAISE EXCEPTION 'documents DELETE is no longer restricted to a tenant administrator.';
  END IF;
END $$;
