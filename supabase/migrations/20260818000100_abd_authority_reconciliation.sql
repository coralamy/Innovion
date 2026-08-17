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
DO $$
BEGIN
  IF to_regprocedure('public.is_platform_admin()') IS NOT NULL THEN
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
  ELSE
    RAISE NOTICE 'Team D identity model absent; platform_operators remains the sole registry.';
  END IF;
END $$;

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
DO $$
DECLARE
  t text;
  denied text[] := ARRAY[
    'clients', 'employees', 'inventory', 'vehicles', 'compliance_items',
    'contractor_invoices', 'settings', 'subscriptions', 'platform_api_keys',
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
