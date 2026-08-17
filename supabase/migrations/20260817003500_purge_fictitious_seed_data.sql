-- ============================================================================
-- Innovion Team A — Purge fictitious tenant-less seed data
-- Timestamp: 20260817003500
-- ----------------------------------------------------------------------------
-- DEFECT REMEDIATED (V106 production-data audit, doc 04):
--   Migration 20260726090000_innovion_extended.sql ends with a large
--   `DO $$ ... EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Mock data insertion
--   failed: %' ... END $$` block that seeds fictitious demonstration records —
--   named individuals ("Sophie Walsh", "Jessica Thompson"), a named real-world
--   venue ("Crown Casino Complex", "Westfield Shopping Centre"), invented ABNs,
--   contact e-mail addresses and phone numbers, incident reports and financial
--   figures — into documents, incidents, inventory, vehicles, companies,
--   notifications, compliance_items and settings.
--
--   Every one of those rows is inserted WITHOUT a company_id. That is what made
--   them globally visible: combined with the `company_id IS NULL` disjunct in
--   the legacy `company_access_*` policies (removed in 20260817004000), they
--   were readable by every tenant and by unauthenticated callers.
--
--   The migration is still in the chain, so a fresh deployment re-seeds them.
--   Verified locally: 6 fictitious `documents` rows and 1 fictitious `settings`
--   row present immediately after a clean migration run.
--
--   The historical migration is deliberately left unedited — it is applied
--   audit evidence. This migration neutralises its effect deterministically,
--   for both existing and freshly-created databases, because migrations run in
--   timestamp order.
--
-- SAFETY:
--   Only rows with NO tenant are removed. After 20260817004000 no policy can
--   create such a row, so this cannot delete legitimate tenant data. Counts are
--   reported so the operation is auditable in the migration log.
--
-- NOT A PRODUCTION OPERATION: authoring this migration is not the same as
--   running it against the live database. Applying it to production remains a
--   Founder-authorised deployment step.
-- ============================================================================

DO $$
DECLARE
  t       text;
  removed bigint;
  report  text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'documents','incidents','inventory','vehicles','notifications',
    'compliance_items','contractors','jobs','time_entries','checklists',
    'clients','employees','sites','settings'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    EXECUTE format('DELETE FROM public.%I WHERE company_id IS NULL', t);
    GET DIAGNOSTICS removed = ROW_COUNT;
    IF removed > 0 THEN
      report := report || format('%s=%s ', t, removed);
    END IF;
  END LOOP;

  -- `companies` is the tenant table itself; fictitious client/partner records
  -- were seeded there with no owner. A real tenant always has an owner_id,
  -- because companies_insert enforces owner_id = auth.uid().
  DELETE FROM public.companies WHERE owner_id IS NULL;
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed > 0 THEN
    report := report || format('companies(ownerless)=%s ', removed);
  END IF;

  IF report = '' THEN
    RAISE NOTICE 'No fictitious tenant-less rows present.';
  ELSE
    RAISE NOTICE 'Purged fictitious tenant-less rows: %', report;
  END IF;
END $$;

-- ── Regression guard ────────────────────────────────────────────────────────
DO $$
DECLARE t text; n bigint; bad text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'documents','incidents','inventory','vehicles','notifications',
    'compliance_items','contractors','jobs','time_entries','checklists',
    'clients','employees','sites'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id IS NULL', t) INTO n;
    IF n > 0 THEN bad := bad || format('%s=%s ', t, n); END IF;
  END LOOP;

  IF bad <> '' THEN
    RAISE EXCEPTION 'Tenant-less rows still present after purge: %', bad;
  END IF;
END $$;
