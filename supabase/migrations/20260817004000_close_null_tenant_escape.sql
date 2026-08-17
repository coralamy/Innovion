-- ============================================================================
-- Innovion Team A — Close the NULL-tenant escape hatch
-- Timestamp: 20260817004000
-- ----------------------------------------------------------------------------
-- DEFECT REMEDIATED (P0 — unauthenticated read AND write across 13 core tables):
--
--   Thirteen tables carried a legacy permissive policy of the form
--
--     CREATE POLICY "company_access_<t>" ON public.<t>
--       FOR ALL TO public
--       USING      ((company_id IS NULL) OR (company_id = get_user_company_id()))
--       WITH CHECK ((company_id IS NULL) OR (company_id = get_user_company_id()));
--
--   Two independent faults compound here:
--
--   (1) `TO public` includes the `anon` role. PostgREST runs unauthenticated
--       requests as `anon`, so the policy was evaluated for callers with no
--       session at all.
--
--   (2) The `company_id IS NULL` disjunct is unconditionally TRUE for any row
--       whose tenant is unset, in BOTH the USING and the WITH CHECK clause.
--
--   Because PostgreSQL OR-combines permissive policies, this granted every
--   caller — including an entirely unauthenticated one — SELECT, INSERT,
--   UPDATE and DELETE on every row with a NULL company_id, and the right to
--   CREATE such rows at will. `company_id` is nullable on all thirteen tables,
--   so nothing prevented it.
--
--   Empirically demonstrated against this schema before this migration
--   (supabase/tests/security-suite.mjs, section D/E):
--     anon SELECT documents                      : 6 rows returned
--     anon INSERT jobs      (company_id NULL)    : ROW CREATED
--     anon INSERT clients   (company_id NULL)    : ROW CREATED
--     anon INSERT documents (company_id NULL)    : ROW CREATED
--     anon INSERT incidents (company_id NULL)    : ROW CREATED
--     anon INSERT employees (company_id NULL)    : ROW CREATED
--     foreign-tenant viewer reads NULL-tenant jobs/documents : rows returned
--     tenant member UPDATE ... SET company_id = NULL         : 1 row
--       (i.e. a member could deliberately orphan their own tenant's rows to
--        publish them to every other tenant and to the public internet)
--
--   These policies are pure legacy duplication: each of the thirteen tables
--   already carries a complete, correctly-scoped `<t>_select/_insert/_update/
--   _delete` policy set restricted `TO authenticated` and keyed on the
--   authoritative `get_my_company_id()`. Dropping the `company_access_*`
--   policies therefore removes access without removing any legitimate access.
--
-- ALSO: `company_localisation` was granted `TO public` for the same reason.
--   Its predicates happen to evaluate to no rows for `anon` (auth.uid() is
--   NULL), so it was not exploitable — but a tenant-scoped policy must never
--   be offered to the anonymous role in the first place. Re-created
--   `TO authenticated`.
-- ============================================================================

-- ── PHASE 1: Drop the thirteen NULL-tenant / public-role policies ───────────
DROP POLICY IF EXISTS "company_access_checklists"       ON public.checklists;
DROP POLICY IF EXISTS "company_access_clients"          ON public.clients;
DROP POLICY IF EXISTS "company_access_compliance_items" ON public.compliance_items;
DROP POLICY IF EXISTS "company_access_contractors"      ON public.contractors;
DROP POLICY IF EXISTS "company_access_documents"        ON public.documents;
DROP POLICY IF EXISTS "company_access_employees"        ON public.employees;
DROP POLICY IF EXISTS "company_access_incidents"        ON public.incidents;
DROP POLICY IF EXISTS "company_access_inventory"        ON public.inventory;
DROP POLICY IF EXISTS "company_access_jobs"             ON public.jobs;
DROP POLICY IF EXISTS "company_access_notifications"    ON public.notifications;
DROP POLICY IF EXISTS "company_access_sites"            ON public.sites;
DROP POLICY IF EXISTS "company_access_time_entries"     ON public.time_entries;
DROP POLICY IF EXISTS "company_access_vehicles"         ON public.vehicles;

-- ── PHASE 2: company_localisation — authenticated only ─────────────────────
DROP POLICY IF EXISTS "company_localisation_select" ON public.company_localisation;
DROP POLICY IF EXISTS "company_localisation_upsert" ON public.company_localisation;

CREATE POLICY "company_localisation_select"
  ON public.company_localisation FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.innovion_auth_company_ids()));

CREATE POLICY "company_localisation_upsert"
  ON public.company_localisation FOR ALL TO authenticated
  USING      (public.innovion_auth_has_role(company_id, ARRAY['admin','manager']))
  WITH CHECK (public.innovion_auth_has_role(company_id, ARRAY['admin','manager']));

-- ── PHASE 3: Structural hardening — a tenant row must name its tenant ───────
-- Applied opportunistically. Where legacy orphan rows still exist the column
-- is left nullable and the operator is told exactly what to backfill; the
-- security hole is closed regardless, because after PHASE 1 no remaining
-- policy admits a NULL company_id.
DO $$
DECLARE
  t         text;
  orphans   bigint;
  remaining text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'checklists','clients','compliance_items','contractors','documents',
    'employees','incidents','inventory','jobs','notifications','sites',
    'time_entries','vehicles'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id IS NULL', t) INTO orphans;
    IF orphans = 0 THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET NOT NULL', t);
    ELSE
      remaining := remaining || format('%s=%s ', t, orphans);
    END IF;
  END LOOP;

  IF remaining <> '' THEN
    RAISE WARNING
      'Tenant-less rows remain and must be backfilled or removed before company_id can be made NOT NULL: %',
      remaining;
  END IF;
END $$;

-- ── PHASE 4: Regression guards ─────────────────────────────────────────────
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (COALESCE(qual,'') || COALESCE(with_check,'')) LIKE '%company_id IS NULL%'
    -- DELIBERATE EXCEPTION, reviewed and retained:
    --   checklist_templates.checklist_templates_select reads
    --     (company_id IS NULL OR company_id = get_my_company_id())
    --   Here `company_id IS NULL` denotes a SYSTEM-PROVIDED GLOBAL TEMPLATE,
    --   which every tenant is intended to be able to start from. It is not an
    --   escape hatch, because:
    --     * the disjunct appears in a SELECT policy only — never WITH CHECK;
    --     * checklist_templates_insert/update/delete all require
    --       company_id = get_my_company_id(), so no caller can create, alter or
    --       remove a global template; and
    --     * the policy is granted TO authenticated, never to anon.
    --   The rows are curated seed content, not tenant data.
    AND NOT (tablename = 'checklist_templates' AND cmd = 'SELECT');

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'NULL-tenant escape hatch reintroduced in policy/policies: %', bad;
  END IF;

  SELECT string_agg(tablename || '.' || policyname, ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
    AND COALESCE(qual, with_check, '') LIKE '%company_id%';

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant-scoped policy granted to the anonymous role: %', bad;
  END IF;
END $$;
