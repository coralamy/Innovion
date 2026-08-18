-- ============================================================================
-- Innovion Team A - Purge fictitious tenant-less seed rows
-- Timestamp: 20260817003500
-- ----------------------------------------------------------------------------
-- ORIGINAL PURPOSE. An early migration carried a mock-data block of the form
--   `DO $$ ... EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Mock data insertion
--   skipped' ... $$`
-- which seeded demonstration rows with no tenant. Those rows are invisible to
-- every policy once the null-tenant escape hatch is closed by 20260817004000,
-- so they are unreachable clutter, and this migration removed them.
--
-- ============================================================================
-- REWRITTEN AFTER THE DATA-BEARING REHEARSAL. IT WAS DESTROYING REAL DATA.
-- ============================================================================
--
-- The original predicate for the tenant table was:
--
--     DELETE FROM public.companies WHERE owner_id IS NULL;
--
-- with the reasoning that "a real tenant always has an owner_id". That
-- reasoning is correct and the conclusion drawn from it is still wrong, because
-- public.companies is not only the tenant table. Its company_type enum is
-- (client, contractor, partner) and DEFAULTS TO 'client': the table doubles as
-- the customer directory. A customer record legitimately has no owner_id,
-- because nobody signs in as a customer.
--
-- Measured, on a realistic estate seeded onto a faithful copy of the live
-- baseline - 40 tenants and 120 customer records:
--
--     companies                     160 ->  40   (-120)
--     companies(owner_id IS NULL)   120 ->   0   (-120)
--
-- Every customer record was destroyed. Against production that is unrecoverable
-- commercial data, deleted silently, in the middle of a security deployment.
--
-- ── The distinction that actually matters ──────────────────────────────────
--
-- CHILD TABLES (documents, jobs, clients, ... ) with company_id IS NULL are
--   genuinely unreachable. No policy can return them once the null-tenant escape
--   is closed, and no policy could ever have created them for a real tenant -
--   they were only ever visible through the escape hatch itself, to everyone.
--   These are the mock rows, and removing them is this migration's purpose. The
--   bare schema carries 6 such documents and 1 settings row from the early
--   migrations' own seed blocks.
--
-- public.companies with owner_id IS NULL is a DIFFERENT THING ENTIRELY, and
--   conflating the two is what made the original version destructive. Such a row
--   is a CUSTOMER RECORD. It has no owner because nobody signs in as a customer.
--   It is not unreachable, not invisible, and not rubbish.
--
--   It is also not a security problem: a customer record has no members, so it
--   grants nobody anything, and 20260818000500 already excludes it from the
--   A-to-D tenant directory. There is no reason to delete it and every reason
--   not to.
--
-- So: child tables are purged, public.companies is LEFT ALONE and reported.
-- Nothing in this migration can now destroy commercial data.

DO $$
DECLARE
  t        text;
  n        bigint;
  removed  bigint;
  report   text := '';
  ownerless bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'documents','incidents','inventory','vehicles','notifications',
    'compliance_items','contractors','jobs','time_entries','checklists',
    'clients','employees','sites','settings'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE company_id IS NULL', t);
    GET DIAGNOSTICS removed = ROW_COUNT;
    IF removed > 0 THEN report := report || format('%s=%s ', t, removed); END IF;
  END LOOP;

  IF report = '' THEN
    RAISE NOTICE 'No tenant-less child rows present.';
  ELSE
    RAISE NOTICE 'Purged tenant-less child rows: %', report;
  END IF;

  -- Reported, never deleted. See above.
  SELECT count(*) INTO ownerless FROM public.companies WHERE owner_id IS NULL;
  IF ownerless > 0 THEN
    RAISE WARNING
      'public.companies has % row(s) with no owner_id. These are CUSTOMER RECORDS and are deliberately NOT deleted. '
      'An earlier version of this migration removed them, which destroyed commercial data.',
      ownerless;
  END IF;
END $$;

-- ── Regression guard ────────────────────────────────────────────────────────
-- Child tables only. public.companies is deliberately out of scope: see above.
DO $$
DECLARE t text; n bigint; bad text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'documents','incidents','inventory','vehicles','notifications',
    'compliance_items','contractors','jobs','time_entries','checklists',
    'clients','employees','sites'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id IS NULL', t) INTO n;
    IF n > 0 THEN bad := bad || format('%s=%s ', t, n); END IF;
  END LOOP;

  IF bad <> '' THEN
    RAISE EXCEPTION 'Tenant-less rows still present after purge: %', bad;
  END IF;
END $$;
