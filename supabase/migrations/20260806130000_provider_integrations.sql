-- ============================================================
-- Migration: Provider Integrations
-- Priority 4 — Integration Settings for future Provider Services
-- (GoDaddy, Microsoft, Google, Stripe, Cloudflare, and others)
-- Timestamp: 20260806130000
-- ============================================================

-- ── ENUM: Integration status ──────────────────────────────────────────────────
DROP TYPE IF EXISTS public.provider_integration_status CASCADE;
CREATE TYPE public.provider_integration_status AS ENUM (
  'not_configured',
  'configured',
  'active',
  'error',
  'disabled'
);

-- ── ENUM: Provider category ───────────────────────────────────────────────────
DROP TYPE IF EXISTS public.provider_category CASCADE;
CREATE TYPE public.provider_category AS ENUM (
  'domain',
  'identity',
  'payments',
  'cdn_security',
  'communications',
  'storage',
  'analytics',
  'other'
);

-- ── TABLE: provider_integrations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.provider_integrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_slug     TEXT NOT NULL,
  provider_name     TEXT NOT NULL,
  category          public.provider_category NOT NULL DEFAULT 'other',
  status            public.provider_integration_status NOT NULL DEFAULT 'not_configured',
  -- Encrypted config stored as JSONB (keys, tokens, endpoints — never plaintext secrets in SELECT)
  config_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Human-readable metadata (non-sensitive)
  display_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled        BOOLEAN NOT NULL DEFAULT false,
  last_tested_at    TIMESTAMPTZ,
  last_error        TEXT,
  created_by        UUID,
  updated_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: one integration record per provider per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_integrations_company_provider
  ON public.provider_integrations (company_id, provider_slug);

CREATE INDEX IF NOT EXISTS idx_provider_integrations_company_id
  ON public.provider_integrations (company_id);

CREATE INDEX IF NOT EXISTS idx_provider_integrations_status
  ON public.provider_integrations (status);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_provider_integrations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provider_integrations_updated_at ON public.provider_integrations;
CREATE TRIGGER trg_provider_integrations_updated_at
  BEFORE UPDATE ON public.provider_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_provider_integrations_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.provider_integrations ENABLE ROW LEVEL SECURITY;

-- Only authenticated users belonging to the same company may read integrations
DROP POLICY IF EXISTS "provider_integrations_select" ON public.provider_integrations;
CREATE POLICY "provider_integrations_select"
  ON public.provider_integrations
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID
    )
  );

-- Only admins (role stored in user_metadata) may insert
DROP POLICY IF EXISTS "provider_integrations_insert" ON public.provider_integrations;
CREATE POLICY "provider_integrations_insert"
  ON public.provider_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID
    )
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Only admins may update
DROP POLICY IF EXISTS "provider_integrations_update" ON public.provider_integrations;
CREATE POLICY "provider_integrations_update"
  ON public.provider_integrations
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID
    )
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    company_id = (
      (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID
    )
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Only admins may delete
DROP POLICY IF EXISTS "provider_integrations_delete" ON public.provider_integrations;
CREATE POLICY "provider_integrations_delete"
  ON public.provider_integrations
  FOR DELETE
  TO authenticated
  USING (
    company_id = (
      (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID
    )
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
