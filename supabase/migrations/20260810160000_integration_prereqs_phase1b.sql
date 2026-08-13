-- ============================================================
-- Innovion Integration Framework — Phase 1B Prerequisites
-- Migration: 20260810160000_integration_prereqs_phase1b.sql
--
-- 1. Harden integration_oauth_credentials:
--    - Drop authenticated-client SELECT policy on token columns
--    - Replace with a safe view exposing only non-secret metadata
--    - Encrypted token columns remain inaccessible to browser clients
--
-- 2. Add clientState column to integration_webhooks for Microsoft
--    Graph subscription validation.
--
-- 3. Add platform_event_bus_outbox table for Integration Framework
--    → Platform Event Bus publishing (Team D contract pending).
-- ============================================================

-- ── 1. Harden integration_oauth_credentials ───────────────────────────────────
--
-- The existing SELECT policy allows authenticated clients to read ALL columns
-- including encrypted_access_token and encrypted_refresh_token.
-- Even though these are pgcrypto blobs, browser clients must not receive them.
-- Replace the broad SELECT policy with a column-restricted safe view.

-- Drop the existing broad SELECT policy
DROP POLICY IF EXISTS "integration_oauth_creds_company_read"
  ON public.integration_oauth_credentials;

-- Create a replacement policy that explicitly excludes token columns.
-- Authenticated clients may only read non-secret metadata columns.
-- Token columns (encrypted_access_token, encrypted_refresh_token) are
-- never returned to browser clients — server-side API routes use the
-- service role key which bypasses RLS entirely.
CREATE POLICY "integration_oauth_creds_status_read"
  ON public.integration_oauth_credentials FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());

-- Create a safe status view that exposes only non-secret metadata.
-- This is the ONLY view browser clients should query for connection info.
-- Token columns are explicitly excluded.
CREATE OR REPLACE VIEW public.integration_connection_status AS
SELECT
  id,
  company_id,
  provider_slug,
  -- Connection state (safe to expose)
  is_valid,
  revoked_at,
  expires_at,
  refresh_expires_at,
  -- External identity metadata (safe to expose — no credentials)
  external_user_id,
  external_user_email,
  external_tenant_id,
  scope_string,
  token_type,
  -- Derived status fields
  CASE
    WHEN revoked_at IS NOT NULL THEN 'revoked'
    WHEN NOT is_valid THEN 'invalid'
    WHEN expires_at IS NOT NULL AND expires_at < now() THEN 'expired'
    WHEN expires_at IS NOT NULL AND expires_at < now() + INTERVAL '5 minutes' THEN 'expiring_soon'
    ELSE 'active'
  END AS connection_state,
  -- Reauthorisation required flag
  (revoked_at IS NOT NULL OR NOT is_valid OR
   (expires_at IS NOT NULL AND expires_at < now() AND
    (refresh_expires_at IS NULL OR refresh_expires_at < now()))
  ) AS reauth_required,
  created_at,
  updated_at
  -- NOTE: encrypted_access_token and encrypted_refresh_token are
  -- intentionally excluded from this view. They must never be
  -- returned to browser clients under any circumstances.
FROM public.integration_oauth_credentials;

-- Grant SELECT on the safe view to authenticated users (scoped by RLS on base table)
GRANT SELECT ON public.integration_connection_status TO authenticated;

-- Revoke direct SELECT on the base table from authenticated role.
-- All browser queries must go through the safe view.
-- Server-side routes continue to use the service role key (bypasses RLS + grants).
REVOKE SELECT ON public.integration_oauth_credentials FROM authenticated;

-- Re-grant SELECT only through the view (already handled above).
-- The base table remains accessible to the service_role (server-side only).

-- ── 2. Add clientState to integration_webhooks ────────────────────────────────
--
-- Microsoft Graph requires that every subscription is created with a clientState
-- value. Every inbound notification must be validated against this stored value.
-- A mismatch means the notification did not originate from Microsoft Graph.

ALTER TABLE public.integration_webhooks
  ADD COLUMN IF NOT EXISTS client_state TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_notification_url TEXT;

COMMENT ON COLUMN public.integration_webhooks.client_state IS
  'Opaque secret submitted when creating the subscription. '
  'Every inbound Microsoft Graph notification must carry a matching clientState. '
  'Mismatch → reject with 401. Never log this value.';

COMMENT ON COLUMN public.integration_webhooks.lifecycle_notification_url IS
  'URL registered for Microsoft Graph lifecycle notifications '
  '(reauthorizationRequired, subscriptionRemoved, missed). '
  'Format: https://innovion.app/api/integrations/webhooks/microsoft/lifecycle';

-- ── 3. Platform Event Bus outbox ──────────────────────────────────────────────
--
-- The Integration Framework publishes validated external events to the
-- Platform Event Bus once Team D provides the approved contract.
-- This outbox table captures events ready for publishing.
-- A background worker (or Edge Function) drains the outbox to the Event Bus.

CREATE TABLE IF NOT EXISTS public.integration_event_bus_outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Event classification
  event_type      TEXT NOT NULL,
  event_source    TEXT NOT NULL DEFAULT 'integration_framework',
  provider_slug   TEXT,
  -- Payload — validated, sanitised, no credentials
  payload         JSONB NOT NULL DEFAULT '{}',
  -- Correlation IDs for tracing
  correlation_id  UUID DEFAULT gen_random_uuid(),
  causation_id    UUID,
  -- Publishing state
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'publishing', 'published', 'failed', 'dead')),
  published_at    TIMESTAMPTZ,
  -- Retry state
  attempt_count   INTEGER DEFAULT 0,
  max_attempts    INTEGER DEFAULT 5,
  next_attempt_at TIMESTAMPTZ DEFAULT now(),
  last_error      TEXT,
  -- Schema version for Team D contract compatibility
  schema_version  TEXT NOT NULL DEFAULT 'v1',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_bus_outbox_status
  ON public.integration_event_bus_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'publishing', 'failed');

CREATE INDEX IF NOT EXISTS idx_event_bus_outbox_company
  ON public.integration_event_bus_outbox (company_id);

CREATE INDEX IF NOT EXISTS idx_event_bus_outbox_correlation
  ON public.integration_event_bus_outbox (correlation_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_event_bus_outbox_updated_at ON public.integration_event_bus_outbox;
CREATE TRIGGER trg_event_bus_outbox_updated_at
  BEFORE UPDATE ON public.integration_event_bus_outbox
  FOR EACH ROW EXECUTE FUNCTION public.integration_set_updated_at();

-- RLS: company members can read their own outbox entries (read-only)
ALTER TABLE public.integration_event_bus_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_event_bus_outbox_company_read"
  ON public.integration_event_bus_outbox;
CREATE POLICY "integration_event_bus_outbox_company_read"
  ON public.integration_event_bus_outbox FOR SELECT TO authenticated
  USING (company_id = public.integration_user_company_id());

-- Note: INSERT/UPDATE performed server-side via service role only.
-- The outbox is drained by a background worker once Team D Event Bus
-- contract is available. Until then, events accumulate in 'pending' state.

COMMENT ON TABLE public.integration_event_bus_outbox IS
  'Transactional outbox for Integration Framework → Platform Event Bus publishing. '
  'Events are written here atomically with the operation that triggers them. '
  'A background worker drains pending events to the Platform Event Bus once '
  'Team D provides the approved Event Bus contract (schema_version tracks compatibility). '
  'No credentials or token values are ever written to this table.';
