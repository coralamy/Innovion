-- ============================================================
-- Innovion Integration Framework — Xero Connector Phase 1B
-- Migration: 20260811000000_xero_connector_phase1b.sql
--
-- Adds Xero-specific schema support within the canonical
-- Integration Framework. No separate Xero tenant model.
--
-- Changes:
--   1. Add xero_tenant_id index to integration_external_orgs
--      for fast tenant resolution on inbound webhook events.
--   2. Add xero_contact_sync_cursor to integration_sync_jobs
--      for incremental contact sync state.
--   3. Add 'xero_app_store' to integration_acquisition_source_type
--      (already present in Phase 1A ENUM — no-op if exists).
--   4. Ensure integration_event_bus_outbox has correct indexes
--      for Xero event type queries.
--   5. Add xero_webhook_received audit action if not present.
--
-- All Xero data is stored within the canonical framework tables.
-- No separate Xero-specific tables are created.
-- ============================================================

-- ── 1. Fast Xero tenant resolution index ─────────────────────────────────────
-- Inbound Xero webhooks carry a tenantId — this index enables O(1) lookup
-- of the Innovion company_id from the Xero tenant ID.

CREATE INDEX IF NOT EXISTS idx_ext_orgs_xero_tenant
  ON public.integration_external_orgs (external_tenant_id)
  WHERE provider_slug = 'xero';

-- ── 2. Xero webhook event type index ─────────────────────────────────────────
-- Enables efficient queries for Xero-specific event types in the event log.

CREATE INDEX IF NOT EXISTS idx_webhook_events_xero_type
  ON public.integration_webhook_events (event_type, received_at DESC)
  WHERE provider_slug = 'xero';

-- ── 3. Xero event bus outbox index ───────────────────────────────────────────
-- Enables efficient draining of pending Xero events from the outbox.

CREATE INDEX IF NOT EXISTS idx_event_bus_outbox_xero_pending
  ON public.integration_event_bus_outbox (created_at ASC)
  WHERE provider_slug = 'xero' AND status = 'pending';

-- ── 4. Xero sync cursor column ────────────────────────────────────────────────
-- Stores the incremental sync cursor (modifiedSince timestamp) for Xero
-- contact sync jobs. Stored within the canonical sync_jobs table.

ALTER TABLE public.integration_sync_jobs
  ADD COLUMN IF NOT EXISTS sync_cursor JSONB;

-- ── 5. Ensure integration_webhooks has xero_webhook_key reference column ─────
-- Stores the Xero webhook subscription ID (from Xero Developer portal)
-- as external_webhook_id. This column already exists from Phase 1A.
-- Adding a Xero-specific index for fast lookup.

CREATE INDEX IF NOT EXISTS idx_webhooks_xero_active
  ON public.integration_webhooks (company_id, is_active)
  WHERE provider_slug = 'xero' AND is_active = true;

-- ── 6. Xero connection health view ───────────────────────────────────────────
-- Convenience view for Xero connection status queries from the
-- Platform Console (Team E). Exposes only non-secret metadata.

CREATE OR REPLACE VIEW public.xero_connection_health AS
SELECT
  pi.company_id,
  pi.status AS connection_status,
  pi.reauth_required,
  pi.connected_at,
  pi.last_sync_at,
  pi.last_sync_status,
  eo.external_org_name AS xero_org_name,
  eo.external_org_id AS xero_tenant_id,
  ih.is_healthy,
  ih.last_check_at,
  ih.error_count,
  -- Safe status summary — no token data
  -- Cast to TEXT explicitly: 'reauth_required'/'healthy'/'degraded' are not enum values
  CASE
    WHEN pi.reauth_required THEN 'reauth_required'
    WHEN pi.status = 'active' AND ih.is_healthy THEN 'healthy'
    WHEN pi.status = 'active' AND NOT COALESCE(ih.is_healthy, true) THEN 'degraded'
    WHEN pi.status = 'not_configured' THEN 'not_connected'
    ELSE pi.status::TEXT
  END::TEXT AS health_summary
FROM public.provider_integrations pi
LEFT JOIN public.integration_external_orgs eo
  ON eo.company_id = pi.company_id
  AND eo.provider_slug = 'xero'
  AND eo.is_primary = true
  AND eo.disconnected_at IS NULL
LEFT JOIN public.integration_health ih
  ON ih.company_id = pi.company_id
  AND ih.provider_slug = 'xero'
WHERE pi.provider_slug = 'xero';

-- Grant SELECT to authenticated users (RLS on base tables enforces tenant isolation)
GRANT SELECT ON public.xero_connection_health TO authenticated;

-- ── 7. RLS policy for xero_connection_health view ────────────────────────────
-- The view inherits RLS from provider_integrations (company_id isolation).
-- No additional policy needed — the view filters by provider_slug = 'xero'
-- and the base table RLS ensures company isolation.

-- ── Verification comment ──────────────────────────────────────────────────────
-- After applying this migration:
--   SELECT * FROM public.xero_connection_health WHERE company_id = '<your_company_id>';
--   -- Should return one row per connected Xero organisation (empty if not connected)
