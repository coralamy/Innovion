-- ============================================================
-- Innovion Platform API Layer
-- Single source of truth for business rules, multi-tenancy,
-- localisation, country config, and partner/licensing.
-- Workforce and other client apps consume these APIs.
-- ============================================================

-- ─── API Key Management ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_api_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  key_hash         TEXT NOT NULL UNIQUE,          -- SHA-256 hash of the raw key
  key_prefix       TEXT NOT NULL,                 -- First 8 chars for display (e.g. "wf_live_")
  label            TEXT NOT NULL,                 -- Human-readable label
  scopes           TEXT[] NOT NULL DEFAULT '{}',  -- e.g. ['localisation:read','rules:read']
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at     TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_api_keys_company_id ON public.platform_api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_platform_api_keys_key_hash   ON public.platform_api_keys(key_hash);

ALTER TABLE public.platform_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_members_manage_api_keys" ON public.platform_api_keys;
CREATE POLICY "company_members_manage_api_keys"
  ON public.platform_api_keys
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- ─── Platform API Request Log ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_api_request_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id   UUID REFERENCES public.platform_api_keys(id) ON DELETE SET NULL,
  company_id   UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  endpoint     TEXT NOT NULL,
  method       TEXT NOT NULL DEFAULT 'GET',
  status_code  INT,
  ip_address   TEXT,
  user_agent   TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_request_log_api_key_id ON public.platform_api_request_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_request_log_company_id ON public.platform_api_request_log(company_id);
CREATE INDEX IF NOT EXISTS idx_api_request_log_requested_at ON public.platform_api_request_log(requested_at DESC);

ALTER TABLE public.platform_api_request_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_members_view_api_logs" ON public.platform_api_request_log;
CREATE POLICY "company_members_view_api_logs"
  ON public.platform_api_request_log
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- ─── Helper: update updated_at ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_api_keys_updated_at ON public.platform_api_keys;
CREATE TRIGGER trg_platform_api_keys_updated_at
  BEFORE UPDATE ON public.platform_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
