-- ============================================================
-- Innovion Integration Framework — Phase 1A Foundation
-- Migration: 20260810140000_integration_framework_phase1a.sql
--
-- Creates the provider-neutral integration framework tables:
--   integration_oauth_credentials  — encrypted OAuth tokens per tenant+provider
--   integration_external_orgs      — external org/tenant mapping
--   integration_scopes             — granted OAuth scopes per connection
--   integration_webhooks           — webhook subscription registrations
--   integration_webhook_events     — inbound webhook event log
--   integration_sync_jobs          — sync job tracking
--   integration_sync_errors        — per-job error log
--   integration_audit_log          — immutable audit trail
--   integration_health             — connection health snapshots
--   integration_acquisition_source — marketplace attribution
--
-- Also extends provider_integrations with OAuth/connection fields.
--
-- All tables: tenant-isolated via company_id + RLS.
-- Tokens: never stored in plain text; encrypted_config pattern extended.
-- External URLs: all OAuth callbacks use innovion.app domain.
-- ============================================================

-- ── 1. ENUMs ──────────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.integration_sync_job_status CASCADE;
CREATE TYPE public.integration_sync_job_status AS ENUM (
  'pending', 'running', 'completed', 'failed', 'retrying', 'cancelled'
);

DROP TYPE IF EXISTS public.integration_webhook_event_status CASCADE;
CREATE TYPE public.integration_webhook_event_status AS ENUM (
  'received', 'processing', 'processed', 'failed', 'duplicate', 'skipped'
);

DROP TYPE IF EXISTS public.integration_audit_action CASCADE;
CREATE TYPE public.integration_audit_action AS ENUM (
  'connected', 'disconnected', 'reauthorised', 'token_refreshed',
  'sync_started', 'sync_completed', 'sync_failed',
  'webhook_received', 'webhook_processed', 'webhook_failed',
  'error', 'health_check'
);

DROP TYPE IF EXISTS public.integration_acquisition_source_type CASCADE;
CREATE TYPE public.integration_acquisition_source_type AS ENUM (
  'direct', 'xero_app_store', 'microsoft_marketplace', 'rhixo', 'partner', 'other'
);

-- ── 2. Extend provider_integrations with OAuth/connection fields ──────────────

ALTER TABLE public.provider_integrations
  ADD COLUMN IF NOT EXISTS connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS reauth_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketplace_source TEXT,
  ADD COLUMN IF NOT EXISTS external_org_id TEXT;

-- ── 3. Core framework tables ──────────────────────────────────────────────────

-- OAuth credentials (encrypted tokens — never plain text)
CREATE TABLE IF NOT EXISTS public.integration_oauth_credentials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_slug     TEXT NOT NULL,
  -- Tokens stored as pgcrypto-encrypted blobs — never plain text
  encrypted_access_token  TEXT,
  encrypted_refresh_token TEXT,
  token_type        TEXT DEFAULT 'Bearer',
  expires_at        TIMESTAMPTZ,
  refresh_expires_at TIMESTAMPTZ,
  -- External identity from token claims
  external_user_id  TEXT,
  external_user_email TEXT,
  -- Xero: tenant_id from connections; Microsoft: tid claim
  external_tenant_id TEXT,
  -- Scope string as granted by provider
  scope_string      TEXT,
  is_valid          BOOLEAN DEFAULT true,
  revoked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Unique: one active credential set per company+provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_creds_company_provider
  ON public.integration_oauth_credentials (company_id, provider_slug)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_oauth_creds_company_id
  ON public.integration_oauth_credentials (company_id);

CREATE INDEX IF NOT EXISTS idx_oauth_creds_expires_at
  ON public.integration_oauth_credentials (expires_at)
  WHERE is_valid = true;

-- External organisation mapping (Xero org, Microsoft tenant, etc.)
CREATE TABLE IF NOT EXISTS public.integration_external_orgs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_slug     TEXT NOT NULL,
  -- Provider-assigned identifiers
  external_org_id   TEXT NOT NULL,
  external_org_name TEXT,
  external_tenant_id TEXT,
  -- Provider-specific metadata (JSONB — non-sensitive display data only)
  org_metadata      JSONB DEFAULT '{}',
  -- Connection state
  is_primary        BOOLEAN DEFAULT true,
  connected_at      TIMESTAMPTZ DEFAULT now(),
  disconnected_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_orgs_company_provider_org
  ON public.integration_external_orgs (company_id, provider_slug, external_org_id);

CREATE INDEX IF NOT EXISTS idx_ext_orgs_company_id
  ON public.integration_external_orgs (company_id);

-- Granted OAuth scopes per connection
CREATE TABLE IF NOT EXISTS public.integration_scopes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_slug TEXT NOT NULL,
  scope_name    TEXT NOT NULL,
  granted_at    TIMESTAMPTZ DEFAULT now(),
  revoked_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scopes_company_provider_scope
  ON public.integration_scopes (company_id, provider_slug, scope_name)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scopes_company_id
  ON public.integration_scopes (company_id);

-- Webhook subscription registrations
CREATE TABLE IF NOT EXISTS public.integration_webhooks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_slug       TEXT NOT NULL,
  -- Provider-assigned webhook/subscription ID
  external_webhook_id TEXT,
  -- Endpoint registered with provider (always innovion.app domain)
  endpoint_url        TEXT NOT NULL,
  event_types         TEXT[] DEFAULT '{}',
  is_active           BOOLEAN DEFAULT true,
  -- Signing secret stored encrypted — never plain text
  encrypted_signing_secret TEXT,
  registered_at       TIMESTAMPTZ DEFAULT now(),
  expires_at          TIMESTAMPTZ,
  last_delivery_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_company_provider
  ON public.integration_webhooks (company_id, provider_slug);

-- Inbound webhook event log (idempotency + processing state)
CREATE TABLE IF NOT EXISTS public.integration_webhook_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_slug     TEXT NOT NULL,
  -- Provider-assigned event ID for idempotency
  external_event_id TEXT,
  event_type        TEXT,
  -- Raw payload stored for reprocessing — no credentials in payload
  payload           JSONB DEFAULT '{}',
  status            public.integration_webhook_event_status DEFAULT 'received',
  -- Processing metadata
  received_at       TIMESTAMPTZ DEFAULT now(),
  processed_at      TIMESTAMPTZ,
  retry_count       INTEGER DEFAULT 0,
  last_error        TEXT,
  -- Signature validation result
  signature_valid   BOOLEAN,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Idempotency: prevent duplicate event processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_idempotency
  ON public.integration_webhook_events (provider_slug, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_events_company_provider
  ON public.integration_webhook_events (company_id, provider_slug);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON public.integration_webhook_events (status)
  WHERE status IN ('received', 'processing', 'failed');

-- Sync job tracking
CREATE TABLE IF NOT EXISTS public.integration_sync_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_slug   TEXT NOT NULL,
  sync_type       TEXT NOT NULL, -- 'full', 'incremental', 'webhook_triggered'
  status          public.integration_sync_job_status DEFAULT 'pending',
  -- Cursor/checkpoint for incremental sync resumption
  sync_cursor     JSONB DEFAULT '{}',
  -- Counts
  records_fetched INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed  INTEGER DEFAULT 0,
  -- Timing
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,
  -- Retry state
  retry_count     INTEGER DEFAULT 0,
  max_retries     INTEGER DEFAULT 3,
  next_retry_at   TIMESTAMPTZ,
  -- Idempotency
  idempotency_key TEXT,
  last_error      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_jobs_idempotency
  ON public.integration_sync_jobs (company_id, provider_slug, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sync_jobs_company_provider
  ON public.integration_sync_jobs (company_id, provider_slug);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status
  ON public.integration_sync_jobs (status)
  WHERE status IN ('pending', 'running', 'retrying');

-- Per-job error log
CREATE TABLE IF NOT EXISTS public.integration_sync_errors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id   UUID NOT NULL REFERENCES public.integration_sync_jobs(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_slug TEXT NOT NULL,
  error_code    TEXT,
  error_message TEXT,
  -- Context for debugging — no credentials logged
  context       JSONB DEFAULT '{}',
  is_retryable  BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_errors_job_id
  ON public.integration_sync_errors (sync_job_id);

CREATE INDEX IF NOT EXISTS idx_sync_errors_company_provider
  ON public.integration_sync_errors (company_id, provider_slug);

-- Immutable audit log
CREATE TABLE IF NOT EXISTS public.integration_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_slug TEXT NOT NULL,
  action        public.integration_audit_action NOT NULL,
  performed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Context — no credentials, no tokens
  details       JSONB DEFAULT '{}',
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_company_provider
  ON public.integration_audit_log (company_id, provider_slug);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.integration_audit_log (created_at DESC);

-- Connection health snapshots
CREATE TABLE IF NOT EXISTS public.integration_health (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_slug   TEXT NOT NULL,
  is_healthy      BOOLEAN DEFAULT true,
  last_check_at   TIMESTAMPTZ DEFAULT now(),
  latency_ms      INTEGER,
  error_count     INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_health_company_provider
  ON public.integration_health (company_id, provider_slug);

-- Marketplace acquisition source
CREATE TABLE IF NOT EXISTS public.integration_acquisition_source (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source          public.integration_acquisition_source_type DEFAULT 'direct',
  provider_slug   TEXT,
  -- Marketplace-specific context (offer ID, plan, etc.) — no PII
  marketplace_context JSONB DEFAULT '{}',
  -- Attribution timestamps
  first_seen_at   TIMESTAMPTZ DEFAULT now(),
  activated_at    TIMESTAMPTZ,
  converted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_acquisition_company
  ON public.integration_acquisition_source (company_id);

-- ── 4. updated_at triggers ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.integration_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oauth_creds_updated_at ON public.integration_oauth_credentials;
CREATE TRIGGER trg_oauth_creds_updated_at
  BEFORE UPDATE ON public.integration_oauth_credentials
  FOR EACH ROW EXECUTE FUNCTION public.integration_set_updated_at();

DROP TRIGGER IF EXISTS trg_ext_orgs_updated_at ON public.integration_external_orgs;
CREATE TRIGGER trg_ext_orgs_updated_at
  BEFORE UPDATE ON public.integration_external_orgs
  FOR EACH ROW EXECUTE FUNCTION public.integration_set_updated_at();

DROP TRIGGER IF EXISTS trg_webhooks_updated_at ON public.integration_webhooks;
CREATE TRIGGER trg_webhooks_updated_at
  BEFORE UPDATE ON public.integration_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.integration_set_updated_at();

DROP TRIGGER IF EXISTS trg_sync_jobs_updated_at ON public.integration_sync_jobs;
CREATE TRIGGER trg_sync_jobs_updated_at
  BEFORE UPDATE ON public.integration_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.integration_set_updated_at();

DROP TRIGGER IF EXISTS trg_health_updated_at ON public.integration_health;
CREATE TRIGGER trg_health_updated_at
  BEFORE UPDATE ON public.integration_health
  FOR EACH ROW EXECUTE FUNCTION public.integration_set_updated_at();

-- ── 5. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.integration_oauth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_external_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_acquisition_source ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS policies (company_id isolation) ────────────────────────────────────

-- Helper: check if current user belongs to a company (reuse existing pattern)
CREATE OR REPLACE FUNCTION public.integration_user_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- OAuth credentials: company members can read; service role writes
DROP POLICY IF EXISTS "integration_oauth_creds_company_read" ON public.integration_oauth_credentials;
CREATE POLICY "integration_oauth_creds_company_read"
  ON public.integration_oauth_credentials FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());

-- Note: OAuth credentials are written server-side only (service role bypasses RLS)
-- No INSERT/UPDATE policy for authenticated role — server-side API routes use service role

-- External orgs: company members can read
DROP POLICY IF EXISTS "integration_ext_orgs_company_read" ON public.integration_external_orgs;
CREATE POLICY "integration_ext_orgs_company_read"
  ON public.integration_external_orgs FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());

-- Scopes: company members can read
DROP POLICY IF EXISTS "integration_scopes_company_read" ON public.integration_scopes;
CREATE POLICY "integration_scopes_company_read"
  ON public.integration_scopes FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());

-- Webhooks: company members can read
DROP POLICY IF EXISTS "integration_webhooks_company_read" ON public.integration_webhooks;
CREATE POLICY "integration_webhooks_company_read"
  ON public.integration_webhooks FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());

-- Webhook events: company members can read
DROP POLICY IF EXISTS "integration_webhook_events_company_read" ON public.integration_webhook_events;
CREATE POLICY "integration_webhook_events_company_read"
  ON public.integration_webhook_events FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());

-- Sync jobs: company members can read
DROP POLICY IF EXISTS "integration_sync_jobs_company_read" ON public.integration_sync_jobs;
CREATE POLICY "integration_sync_jobs_company_read"
  ON public.integration_sync_jobs FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());

-- Sync errors: company members can read
DROP POLICY IF EXISTS "integration_sync_errors_company_read" ON public.integration_sync_errors;
CREATE POLICY "integration_sync_errors_company_read"
  ON public.integration_sync_errors FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());

-- Audit log: company members can read (immutable — no write policy for authenticated)
DROP POLICY IF EXISTS "integration_audit_log_company_read" ON public.integration_audit_log;
CREATE POLICY "integration_audit_log_company_read"
  ON public.integration_audit_log FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());

-- Health: company members can read
DROP POLICY IF EXISTS "integration_health_company_read" ON public.integration_health;
CREATE POLICY "integration_health_company_read"
  ON public.integration_health FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());

-- Acquisition source: company members can read
DROP POLICY IF EXISTS "integration_acquisition_company_read" ON public.integration_acquisition_source;
CREATE POLICY "integration_acquisition_company_read"
  ON public.integration_acquisition_source FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());
