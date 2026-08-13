-- ============================================================
-- Migration: i18n / Localisation / Partner Architecture
-- Timestamp: 20260728020000
-- ============================================================
-- Implements:
--   1. company_localisation  — per-company l10n settings
--   2. currencies            — supported currency registry
--   3. partner_types         — configurable partner type registry
--   4. partners              — partner organisations
--   5. territories           — country/state/region territories
--   6. territory_assignments — customer → territory mapping
--   7. coralamy_products     — product ecosystem registry
--   8. partner_products      — partner ↔ product authorisations
--   9. partner_revenue       — revenue attribution per subscription
--  10. Alter companies       — add partner_id, country, localisation FKs
-- ============================================================

-- ─── 1. ENUMS ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_type_enum') THEN
    CREATE TYPE public.partner_type_enum AS ENUM (
      'country_licensee',
      'regional_partner',
      'territory_partner',
      'certified_implementation_partner',
      'strategic_partner',
      'direct'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'territory_type_enum') THEN
    CREATE TYPE public.territory_type_enum AS ENUM (
      'country',
      'state',
      'province',
      'region',
      'custom'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'territory_exclusivity_enum') THEN
    CREATE TYPE public.territory_exclusivity_enum AS ENUM (
      'exclusive',
      'non_exclusive'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_status_enum') THEN
    CREATE TYPE public.partner_status_enum AS ENUM (
      'active',
      'inactive',
      'pending',
      'suspended'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'licence_model_enum') THEN
    CREATE TYPE public.licence_model_enum AS ENUM (
      'exclusive_country',
      'exclusive_territory',
      'master_licence',
      'regional_licence',
      'white_label',
      'strategic_partnership',
      'direct'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_ownership_enum') THEN
    CREATE TYPE public.customer_ownership_enum AS ENUM (
      'direct_coralamy',
      'licensed_territory_partner',
      'regional_distributor',
      'strategic_partner'
    );
  END IF;
END $$;

-- ─── 2. CURRENCIES ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.currencies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,          -- ISO 4217 e.g. AUD
  name                  TEXT NOT NULL,
  symbol                TEXT NOT NULL DEFAULT '',
  decimal_precision     INTEGER NOT NULL DEFAULT 2,
  thousands_separator   TEXT NOT NULL DEFAULT ',',
  decimal_separator     TEXT NOT NULL DEFAULT '.',
  symbol_position       TEXT NOT NULL DEFAULT 'before'
                          CHECK (symbol_position IN ('before', 'after')),
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed supported currencies
INSERT INTO public.currencies (code, name, symbol, decimal_precision, thousands_separator, decimal_separator, symbol_position)
VALUES
  ('AUD', 'Australian Dollar',    '$',  2, ',', '.', 'before'),
  ('USD', 'US Dollar',            '$',  2, ',', '.', 'before'),
  ('GBP', 'British Pound',        '£',  2, ',', '.', 'before'),
  ('EUR', 'Euro',                 '€',  2, '.', ',', 'after'),
  ('SGD', 'Singapore Dollar',     'S$', 2, ',', '.', 'before'),
  ('NZD', 'New Zealand Dollar',   '$',  2, ',', '.', 'before'),
  ('CAD', 'Canadian Dollar',      '$',  2, ',', '.', 'before'),
  ('JPY', 'Japanese Yen',         '¥',  0, ',', '.', 'before'),
  ('CNY', 'Chinese Yuan',         '¥',  2, ',', '.', 'before'),
  ('INR', 'Indian Rupee',         '₹',  2, ',', '.', 'before'),
  ('MYR', 'Malaysian Ringgit',    'RM', 2, ',', '.', 'before'),
  ('HKD', 'Hong Kong Dollar',     'HK$',2, ',', '.', 'before'),
  ('AED', 'UAE Dirham',           'د.إ',2, ',', '.', 'after'),
  ('ZAR', 'South African Rand',   'R',  2, ',', '.', 'before')
ON CONFLICT (code) DO NOTHING;

-- ─── 3. COMPANY LOCALISATION ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_localisation (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL UNIQUE,
  country                   TEXT NOT NULL DEFAULT 'AU',
  language                  TEXT NOT NULL DEFAULT 'en-AU',
  currency_code             TEXT NOT NULL DEFAULT 'AUD',
  currency_symbol           TEXT NOT NULL DEFAULT '$',
  currency_decimal_precision INTEGER NOT NULL DEFAULT 2,
  thousands_separator       TEXT NOT NULL DEFAULT ',',
  decimal_separator         TEXT NOT NULL DEFAULT '.',
  currency_symbol_position  TEXT NOT NULL DEFAULT 'before'
                              CHECK (currency_symbol_position IN ('before', 'after')),
  timezone                  TEXT NOT NULL DEFAULT 'Australia/Sydney',
  date_format               TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  time_format               TEXT NOT NULL DEFAULT '12h'
                              CHECK (time_format IN ('12h', '24h')),
  first_day_of_week         INTEGER NOT NULL DEFAULT 1
                              CHECK (first_day_of_week IN (0, 1, 6)),
  measurement_system        TEXT NOT NULL DEFAULT 'metric'
                              CHECK (measurement_system IN ('metric', 'imperial')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. PARTNER TYPES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partner_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key      TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.partner_types (type_key, label, description, sort_order)
VALUES
  ('country_licensee',                 'Country Licensee',                 'Exclusive licence for an entire country',              10),
  ('regional_partner',                 'Regional Partner',                 'Partner covering a defined region',                    20),
  ('territory_partner',                'Territory Partner',                'Partner covering a specific territory',                30),
  ('certified_implementation_partner', 'Certified Implementation Partner', 'Certified to implement and onboard customers',         40),
  ('strategic_partner',                'Strategic Partner',                'High-level strategic alliance partner',                50),
  ('direct',                           'Direct (Coralamy)',                'Directly managed by Coralamy',                        60)
ON CONFLICT (type_key) DO NOTHING;

-- ─── 5. CORALAMY PRODUCTS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coralamy_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key   TEXT NOT NULL UNIQUE,
  product_name  TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.coralamy_products (product_key, product_name, description, sort_order)
VALUES
  ('innovion',      'Innovion',      'Field service management platform',                    10),
  ('ezbillable',    'EzBillable',    'Billing and invoicing platform',                       20),
  ('omniclean_os',  'OmniCleanOS',   'Commercial cleaning operations platform',              30),
  ('future_product','Future Product','Placeholder for future Coralamy products',             99)
ON CONFLICT (product_key) DO NOTHING;

-- ─── 6. TERRITORIES ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.territories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_code    TEXT NOT NULL UNIQUE,
  territory_name    TEXT NOT NULL,
  territory_type    public.territory_type_enum NOT NULL DEFAULT 'country',
  parent_id         UUID REFERENCES public.territories(id) ON DELETE SET NULL,
  country_code      TEXT NOT NULL DEFAULT '',   -- ISO 3166-1 alpha-2
  region_code       TEXT NOT NULL DEFAULT '',   -- state/province code
  exclusivity       public.territory_exclusivity_enum NOT NULL DEFAULT 'non_exclusive',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial territories
INSERT INTO public.territories (territory_code, territory_name, territory_type, country_code, exclusivity)
VALUES
  ('AU',    'Australia',        'country', 'AU', 'non_exclusive'),
  ('AU-NSW','New South Wales',  'state',   'AU', 'non_exclusive'),
  ('AU-VIC','Victoria',         'state',   'AU', 'non_exclusive'),
  ('AU-QLD','Queensland',       'state',   'AU', 'non_exclusive'),
  ('AU-WA', 'Western Australia','state',   'AU', 'non_exclusive'),
  ('AU-SA', 'South Australia',  'state',   'AU', 'non_exclusive'),
  ('AU-TAS','Tasmania',         'state',   'AU', 'non_exclusive'),
  ('AU-ACT','Australian Capital Territory','state','AU','non_exclusive'),
  ('AU-NT', 'Northern Territory','state',  'AU', 'non_exclusive'),
  ('NZ',    'New Zealand',      'country', 'NZ', 'non_exclusive'),
  ('US',    'United States',    'country', 'US', 'non_exclusive'),
  ('GB',    'United Kingdom',   'country', 'GB', 'non_exclusive'),
  ('SG',    'Singapore',        'country', 'SG', 'non_exclusive'),
  ('CA',    'Canada',           'country', 'CA', 'non_exclusive')
ON CONFLICT (territory_code) DO NOTHING;

-- ─── 7. PARTNERS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partners (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_code          TEXT NOT NULL UNIQUE,
  partner_name          TEXT NOT NULL,
  partner_type          public.partner_type_enum NOT NULL DEFAULT 'territory_partner',
  licence_model         public.licence_model_enum NOT NULL DEFAULT 'direct',
  partner_status        public.partner_status_enum NOT NULL DEFAULT 'active',
  territory_id          UUID REFERENCES public.territories(id) ON DELETE SET NULL,
  country_code          TEXT NOT NULL DEFAULT '',
  contact_name          TEXT NOT NULL DEFAULT '',
  contact_email         TEXT NOT NULL DEFAULT '',
  contact_phone         TEXT NOT NULL DEFAULT '',  -- E.164 format
  address_line1         TEXT NOT NULL DEFAULT '',
  address_line2         TEXT NOT NULL DEFAULT '',
  city                  TEXT NOT NULL DEFAULT '',
  state_province        TEXT NOT NULL DEFAULT '',
  postal_code           TEXT NOT NULL DEFAULT '',
  website               TEXT NOT NULL DEFAULT '',
  commission_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,  -- percentage
  royalty_rate          NUMERIC(5,2) NOT NULL DEFAULT 0,  -- percentage
  contract_start_date   DATE,
  contract_end_date     DATE,
  notes                 TEXT NOT NULL DEFAULT '',
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. PARTNER PRODUCTS ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partner_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.coralamy_products(id) ON DELETE CASCADE,
  is_authorised BOOLEAN NOT NULL DEFAULT TRUE,
  authorised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id, product_id)
);

-- ─── 9. ALTER COMPANIES: add partner_id + i18n columns ───────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS partner_id          UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS territory_id        UUID REFERENCES public.territories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country_code        TEXT NOT NULL DEFAULT 'AU',
  ADD COLUMN IF NOT EXISTS customer_ownership  public.customer_ownership_enum NOT NULL DEFAULT 'direct_coralamy',
  ADD COLUMN IF NOT EXISTS business_identifier_type  TEXT NOT NULL DEFAULT 'ABN',
  ADD COLUMN IF NOT EXISTS business_identifier_value TEXT NOT NULL DEFAULT '';

-- Migrate existing ABN data into the new generic business identifier columns
UPDATE public.companies
SET
  business_identifier_type  = 'ABN',
  business_identifier_value = COALESCE(abn, '')
WHERE abn IS NOT NULL AND abn != '';

-- ─── 10. PARTNER REVENUE ATTRIBUTION ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partner_revenue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL,
  subscription_id   UUID,
  product_id        UUID REFERENCES public.coralamy_products(id) ON DELETE SET NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  mrr_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,  -- monthly recurring revenue
  arr_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,  -- annual recurring revenue
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  royalty_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency_code     TEXT NOT NULL DEFAULT 'AUD',
  notes             TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 11. RLS POLICIES ────────────────────────────────────────────────────────

-- company_localisation: company members can read; admins can write
ALTER TABLE public.company_localisation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_localisation_select" ON public.company_localisation;
CREATE POLICY "company_localisation_select" ON public.company_localisation
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "company_localisation_upsert" ON public.company_localisation;
CREATE POLICY "company_localisation_upsert" ON public.company_localisation
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- currencies: public read
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "currencies_select" ON public.currencies;
CREATE POLICY "currencies_select" ON public.currencies
  FOR SELECT USING (TRUE);

-- partner_types: public read
ALTER TABLE public.partner_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_types_select" ON public.partner_types;
CREATE POLICY "partner_types_select" ON public.partner_types
  FOR SELECT USING (TRUE);

-- coralamy_products: public read
ALTER TABLE public.coralamy_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coralamy_products_select" ON public.coralamy_products;
CREATE POLICY "coralamy_products_select" ON public.coralamy_products
  FOR SELECT USING (TRUE);

-- territories: public read
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "territories_select" ON public.territories;
CREATE POLICY "territories_select" ON public.territories
  FOR SELECT USING (TRUE);

-- partners: authenticated read; admin write
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners_select" ON public.partners;
CREATE POLICY "partners_select" ON public.partners
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "partners_admin_write" ON public.partners;
CREATE POLICY "partners_admin_write" ON public.partners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- partner_products: authenticated read; admin write
ALTER TABLE public.partner_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_products_select" ON public.partner_products;
CREATE POLICY "partner_products_select" ON public.partner_products
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "partner_products_admin_write" ON public.partner_products;
CREATE POLICY "partner_products_admin_write" ON public.partner_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- partner_revenue: admin read/write
ALTER TABLE public.partner_revenue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_revenue_admin" ON public.partner_revenue;
CREATE POLICY "partner_revenue_admin" ON public.partner_revenue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─── 12. UPDATED_AT TRIGGERS ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_localisation_updated_at') THEN
    CREATE TRIGGER set_company_localisation_updated_at
      BEFORE UPDATE ON public.company_localisation
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_partners_updated_at') THEN
    CREATE TRIGGER set_partners_updated_at
      BEFORE UPDATE ON public.partners
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_territories_updated_at') THEN
    CREATE TRIGGER set_territories_updated_at
      BEFORE UPDATE ON public.territories
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_partner_revenue_updated_at') THEN
    CREATE TRIGGER set_partner_revenue_updated_at
      BEFORE UPDATE ON public.partner_revenue
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ─── 13. AUTO-CREATE LOCALISATION FOR NEW COMPANIES ──────────────────────────

CREATE OR REPLACE FUNCTION public.create_default_localisation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.company_localisation (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_company_created_localisation') THEN
    CREATE TRIGGER on_company_created_localisation
      AFTER INSERT ON public.companies
      FOR EACH ROW EXECUTE FUNCTION public.create_default_localisation();
  END IF;
END $$;

-- Backfill existing companies
INSERT INTO public.company_localisation (company_id)
SELECT id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;
