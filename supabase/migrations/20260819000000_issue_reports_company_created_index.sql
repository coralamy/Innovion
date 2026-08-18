-- ============================================================================
-- Innovion Team A — restore idx_issue_reports_company_created
-- Timestamp: 20260819000000
-- ----------------------------------------------------------------------------
-- The third and final artefact of the same partial application.
--
-- Team B's 20260727000006 was recorded as applied but landed partially against
-- public.issue_reports. Three things were missing as a result:
--
--   1. the company_id column                    -> repaired by 20260816130000
--   2. issue_reports_company_isolation          -> repaired by 20260816130000
--   3. idx_issue_reports_company_created        -> this migration
--
-- The third was found by an as-deployed/clean-chain schema equivalence test
-- written after the deployment. The gap scan run before the repair compared
-- tables, columns, functions and enum values — but not indexes — so it did not
-- surface. Equivalence is now asserted across indexes and triggers too.
--
-- ── Why the chain will never create it ─────────────────────────────────────
--
-- The index belongs to Team B's 20260731000001_documents_bucket_and_cleanup,
-- which creates it only when the column exists:
--
--     IF EXISTS (SELECT 1 FROM information_schema.columns
--                WHERE table_name = 'issue_reports' AND column_name = 'company_id')
--     THEN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_issue_reports_company_created ...'
--
-- That guard is correct and is precisely what 20260817000003 lacked: it degraded
-- gracefully instead of aborting the deployment. But 20260731000001 is recorded
-- as applied, so it will not run again, and the index would stay absent forever.
--
-- ── Impact ─────────────────────────────────────────────────────────────────
--
-- Performance only, and none of it is a security property. Listing issue reports
-- for a tenant, newest first — the ordinary Workforce query — falls back to a
-- sequential scan. Immaterial at the four rows production holds today; it
-- matters once reports accumulate.
--
-- Definition copied verbatim from Team B 20260731000001.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.issue_reports') IS NULL THEN
    RAISE NOTICE 'public.issue_reports absent (Team B not deployed); index not applicable.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'issue_reports' AND column_name = 'company_id'
  ) THEN
    RAISE EXCEPTION
      'issue_reports.company_id is absent, so 20260816130000 did not take. Investigate before proceeding.';
  END IF;

  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_issue_reports_company_created '
       || 'ON public.issue_reports(company_id, created_at DESC)';
END $$;

-- ── Guard ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.issue_reports') IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'idx_issue_reports_company_created'
  ) THEN
    RAISE EXCEPTION 'idx_issue_reports_company_created was not created.';
  END IF;
END $$;
