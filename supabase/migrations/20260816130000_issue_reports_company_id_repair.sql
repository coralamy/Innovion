-- ============================================================================
-- Innovion Team A — repair public.issue_reports.company_id
-- Timestamp: 20260816130000
-- ----------------------------------------------------------------------------
-- WHY THIS EXISTS
--
-- The production deployment of 2026-08-18 failed part-way. Team B's
-- 20260817000003_isolation_policy_consolidation aborted at statement 97:
--
--     ERROR: column "company_id" does not exist (SQLSTATE 42703)
--
-- It adds an idempotency_key to four tables and indexes (company_id,
-- idempotency_key) on each. Three of the four had company_id. public.issue_reports
-- did not.
--
-- Team B's 20260727000006_company_id_rls_enforcement is what should have added
-- it, and production records that migration as applied — its function
-- get_my_company_id() is present. But the ALTER TABLE for this one table did
-- not take. The migration was applied by hand, before the project had a
-- migration ledger, and it landed partially.
--
-- A read-only diff of production against a locally-built replica of the exact
-- 35 migrations the ledger records found this to be the ONLY gap: 0 missing
-- tables, 0 missing enum values, and one missing column. Of the 21 remaining
-- migrations only 20260817000003 references it.
--
-- ── Why Team A owns a repair to a Team B table ─────────────────────────────
--
-- Because the alternative is worse. The correct long-term fix is Team B
-- guarding on the column rather than the table, and that has been reported to
-- them. But Team A must not modify Team B source, and production is presently
-- stopped mid-deployment with the security remediation half-applied. This
-- migration restores the column Team B's own migration intended to create,
-- using Team B's own definition, and changes nothing else.
--
-- Stamped 20260816130000: after Team A's 20260816120000 and before Team B's
-- 20260817000003. There is no integer between 20260817000002 and ...0003, so an
-- adjacent slot was not available. `db push --include-all` applies it in version
-- order ahead of the migration it unblocks.
--
-- ── Team B may be absent ───────────────────────────────────────────────────
--
-- public.issue_reports is a Team B table. Team A must remain deployable on its
-- own, so everything below is guarded on the table existing. Without that guard
-- this migration fails in an A-only chain — which is exactly what the security
-- and replay suites caught before it reached production a second time.
--
-- ── The backfill, and its limits ───────────────────────────────────────────
--
-- Existing rows need a tenant. Two sources, in order of authority:
--
--   1. issue_reports.job_id -> jobs.company_id. The report belongs to whatever
--      tenant owns the job. This is derived, not assumed.
--   2. If that leaves rows unresolved AND exactly one company exists, they
--      belong to it. With one tenant there is no other answer, and no way to
--      assign them wrongly.
--
-- If rows remain unresolved after both, this migration RAISES rather than
-- guessing or leaving them NULL. Assigning a hazard report to the wrong tenant
-- is worse than stopping.
--
-- Measured on production before writing this: issue_reports holds 4 rows,
-- public.jobs holds 0, and public.companies holds 1.
-- ============================================================================

DO $$
DECLARE
  from_jobs   bigint := 0;
  from_sole   bigint := 0;
  unresolved  bigint;
  n_companies bigint;
  sole        uuid;
BEGIN
  IF to_regclass('public.issue_reports') IS NULL THEN
    RAISE NOTICE 'public.issue_reports absent (Team B not deployed); repair not applicable.';
    RETURN;
  END IF;

  -- ── The column ────────────────────────────────────────────────────────────
  ALTER TABLE public.issue_reports ADD COLUMN IF NOT EXISTS company_id uuid;

  -- 1. Derive from the owning job where one is recorded.
  IF to_regclass('public.jobs') IS NOT NULL THEN
    UPDATE public.issue_reports ir
       SET company_id = j.company_id
      FROM public.jobs j
     WHERE ir.company_id IS NULL
       AND ir.job_id = j.id
       AND j.company_id IS NOT NULL;
    GET DIAGNOSTICS from_jobs = ROW_COUNT;
  END IF;

  -- 2. Sole-tenant fallback.
  SELECT count(*) INTO n_companies FROM public.companies;
  IF n_companies = 1 THEN
    SELECT id INTO sole FROM public.companies;
    UPDATE public.issue_reports SET company_id = sole WHERE company_id IS NULL;
    GET DIAGNOSTICS from_sole = ROW_COUNT;
  END IF;

  SELECT count(*) INTO unresolved FROM public.issue_reports WHERE company_id IS NULL;

  RAISE NOTICE
    'issue_reports.company_id backfill: % from owning job, % from sole tenant, % unresolved (companies=%).',
    from_jobs, from_sole, unresolved, n_companies;

  IF unresolved > 0 THEN
    RAISE EXCEPTION
      'issue_reports has % row(s) with no resolvable tenant and % company/companies exist. '
      'Assigning a hazard report to the wrong tenant is worse than stopping: resolve these rows explicitly, then re-run.',
      unresolved, n_companies
      USING ERRCODE = 'raise_exception';
  END IF;

  -- ── Index, matching what 20260727000006 creates for its other tables ─────
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_issue_reports_company_id ON public.issue_reports(company_id)';

  -- ── The isolation policy, verbatim from Team B 20260727000006 lines 139-144 ─
  EXECUTE 'DROP POLICY IF EXISTS "issue_reports_company_isolation" ON public.issue_reports';
  EXECUTE 'CREATE POLICY "issue_reports_company_isolation" ON public.issue_reports '
       || 'FOR ALL TO authenticated '
       || 'USING (company_id = public.get_my_company_id()) '
       || 'WITH CHECK (company_id = public.get_my_company_id())';
END $$;

DO $$ BEGIN
  IF to_regclass('public.issue_reports') IS NOT NULL THEN
    EXECUTE 'COMMENT ON COLUMN public.issue_reports.company_id IS ''Owning tenant. Added by Team A 20260816130000 to repair a partial hand-application of Team B 20260727000006, which blocked 20260817000003 in the 2026-08-18 deployment.''';
  END IF;
END $$;

-- ── Guard ───────────────────────────────────────────────────────────────────
-- The migration this exists to unblock indexes (company_id, idempotency_key).
-- If the column is absent or still NULL anywhere, that migration fails again.
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.issue_reports') IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='issue_reports' AND column_name='company_id'
  ) THEN
    RAISE EXCEPTION 'issue_reports.company_id was not created.';
  END IF;

  SELECT count(*) INTO n FROM public.issue_reports WHERE company_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'issue_reports still has % row(s) with a NULL company_id.', n;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='issue_reports'
       AND policyname='issue_reports_company_isolation'
  ) THEN
    RAISE EXCEPTION 'issue_reports_company_isolation was not created; the table would be left without tenant isolation.';
  END IF;
END $$;
