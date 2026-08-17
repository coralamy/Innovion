-- ============================================================================
-- Innovion Team A — Contractor commercial terms (rates and business identifier)
-- Timestamp: 20260817011000
-- ----------------------------------------------------------------------------
-- DEFECT REMEDIATED (V106 "contractor rates" — material commercial defect):
--
--   The contractor record has no rate and no business identifier:
--     public.contractors has neither `hourly_rate` nor `abn`.
--
--   Three consequences, all live in the product:
--
--   (a) `src/app/contractors/page.tsx` renders an "Hourly Rate" tile and an
--       "ABN" tile bound to `selected.hourlyRate` and `selected.abn`. Neither
--       field exists on the Contractor type, so both tiles rendered blank for
--       every contractor. The same two fields are rendered on the workforce
--       roster.
--
--   (b) Timesheet approval auto-generates a contractor invoice with
--           const rate = entry.hourlyRate || 0;
--       where `entry.hourlyRate` comes from `time_entries.hourly_rate`. Nothing
--       in the product ever populates that column, so it is always NULL and the
--       rate always falls back to 0. Every auto-generated contractor invoice
--       was therefore raised at $0.00/hr, with a $0.00 subtotal, $0.00 tax and
--       a $0.00 total.
--
--   (c) `contractor_invoices.contractor_abn` and `.contractor_id` exist and are
--       rendered on the invoice, but the approval flow never populated either,
--       so invoices carried no ABN — which an Australian tax invoice requires.
--
--   The rate is stored on the contractor, and copied onto the time entry when
--   the entry is created, so that historical timesheets keep the rate that was
--   agreed at the time rather than silently re-pricing when a rate changes.
--
-- The ABN column is deliberately unvalidated beyond a length/charset check:
-- business identifier format varies by country (ABN in AU, NZBN in NZ, EIN in
-- the US), and the authoritative per-country pattern already lives in
-- src/lib/countryConfig.ts.
-- ============================================================================

ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10, 2),
  ADD COLUMN IF NOT EXISTS abn         text;

COMMENT ON COLUMN public.contractors.hourly_rate IS
  'Agreed charge-out rate in the tenant currency. Copied onto time_entries.hourly_rate when a time entry is created, so historical entries retain the rate agreed at the time.';
COMMENT ON COLUMN public.contractors.abn IS
  'Contractor business identifier (ABN in AU, NZBN in NZ, EIN in US). Format is validated per country by the application.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contractors_hourly_rate_non_negative') THEN
    ALTER TABLE public.contractors
      ADD CONSTRAINT contractors_hourly_rate_non_negative
      CHECK (hourly_rate IS NULL OR hourly_rate >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contractors_abn_shape') THEN
    ALTER TABLE public.contractors
      ADD CONSTRAINT contractors_abn_shape
      CHECK (abn IS NULL OR abn ~ '^[A-Za-z0-9 -]{4,32}$');
  END IF;

  -- A time entry's rate must likewise never be negative.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_hourly_rate_non_negative') THEN
    ALTER TABLE public.time_entries
      ADD CONSTRAINT time_entries_hourly_rate_non_negative
      CHECK (hourly_rate IS NULL OR hourly_rate >= 0);
  END IF;
END $$;

-- ── Guard ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='contractors' AND column_name='hourly_rate'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='contractors' AND column_name='abn'
  ) THEN
    RAISE EXCEPTION 'contractors.hourly_rate / contractors.abn missing after migration';
  END IF;
END $$;
