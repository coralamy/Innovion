-- ============================================================================
-- Innovion Team A — Branding storage for the Platform Configuration Service
-- Timestamp: 20260817010000
-- ----------------------------------------------------------------------------
-- DEFECT REMEDIATED (functional — the branding domain of the published
-- Platform Configuration contract had no storage behind it):
--
--   `platformConfigurationService.getBranding()` and `getOrganisationConfig()`
--   both query
--     companies.primary_colour, secondary_colour, logo_url, favicon_url,
--     custom_domain, show_powered_by
--   None of those columns exist on public.companies. PostgREST answers such a
--   request with an error, and the service destructures only `data` — so the
--   error was discarded, `data` was null, and `getBranding()` returned null for
--   every organisation that has ever existed. `configVersion` 3.0.0 publishes
--   `branding` as a core domain to Workforce, the Partner Portal, the Customer
--   Portal and the public API, so the contract was being advertised and never
--   fulfilled.
--
--   Two remediations were possible: delete the branding domain from the
--   published contract, or give it storage. The contract is consumed by other
--   Innovion clients, so the columns are added rather than the contract broken.
--
--   `logo_url` is NOT added: `companies.logo` already exists and serves that
--   purpose. The query is corrected to use it instead of adding a duplicate.
--
-- Colour values are constrained to hex so a malformed value cannot be injected
-- into a client's stylesheet.
-- ============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS primary_colour   text,
  ADD COLUMN IF NOT EXISTS secondary_colour text,
  ADD COLUMN IF NOT EXISTS favicon_url      text,
  ADD COLUMN IF NOT EXISTS custom_domain    text,
  ADD COLUMN IF NOT EXISTS show_powered_by  boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.companies.primary_colour IS
  'Tenant brand primary colour as #RRGGBB. Consumed by every Innovion client through the Platform Configuration Service.';
COMMENT ON COLUMN public.companies.show_powered_by IS
  'Whether client applications display "Powered by Innovion" for this tenant.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_primary_colour_hex'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_primary_colour_hex
      CHECK (primary_colour IS NULL OR primary_colour ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_secondary_colour_hex'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_secondary_colour_hex
      CHECK (secondary_colour IS NULL OR secondary_colour ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  -- A custom domain must be a bare hostname: no scheme, no path, no port.
  -- It is interpolated into client configuration, so it must not be able to
  -- carry a URL to somewhere else.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_custom_domain_hostname'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_custom_domain_hostname
      CHECK (
        custom_domain IS NULL
        OR custom_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
      );
  END IF;
END $$;

-- ── Guard ───────────────────────────────────────────────────────────────────
DO $$
DECLARE missing text := '';
        c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['primary_colour','secondary_colour','favicon_url','custom_domain','show_powered_by'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='companies' AND column_name=c
    ) THEN
      missing := missing || c || ' ';
    END IF;
  END LOOP;

  IF missing <> '' THEN
    RAISE EXCEPTION 'Branding columns missing after migration: %', missing;
  END IF;
END $$;
