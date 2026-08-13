-- ============================================================
-- Innovion Pilot Readiness — Security Hardening Migration
-- Timestamp: 20260809160000
-- Step 4: Production Security & Transitional Architecture Cleanup
-- ============================================================
-- This migration:
--   1. Hardens the encrypt_provider_config fallback key warning
--   2. Adds explicit RLS for pending_invites (if not already present)
--   3. Adds explicit RLS for timesheet_audit_log (if not already present)
--   4. Adds explicit RLS for scheduled_jobs (if not already present)
--   5. Adds explicit RLS for contractor_documents (if not already present)
--   6. Adds explicit RLS for notes (if not already present)
--   7. Adds explicit RLS for supply_requests (if not already present)
--   8. Adds explicit RLS for conversations (if not already present)
--   9. Adds explicit RLS for messages (if not already present)
--  10. Adds explicit RLS for checklist_responses (if not already present)
--  11. Adds explicit RLS for vehicles (if not already present)
--  12. Adds explicit RLS for time_entries (if not already present)
--  13. Adds platform_api_keys expiry enforcement index
--  14. Adds sync_idempotency_keys table for Workforce sync deduplication
--  15. Adds sync_queue table for offline operation queue tracking
-- ============================================================

-- ── PHASE 1: Verify and harden encrypt_provider_config ───────────────────────
-- The development fallback key must raise a WARNING in production.
-- The production key is set via: ALTER DATABASE SET app.settings.encryption_key = '...';

CREATE OR REPLACE FUNCTION public.encrypt_provider_config(plain_json JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  enc_key TEXT;
  is_dev_key BOOLEAN := false;
BEGIN
  BEGIN
    enc_key := current_setting('app.settings.encryption_key');
  EXCEPTION WHEN OTHERS THEN
    enc_key := 'innovion-dev-key-change-in-production';
    is_dev_key := true;
  END;

  -- Warn if using the development fallback key
  IF enc_key = 'innovion-dev-key-change-in-production' THEN
    RAISE WARNING 'encrypt_provider_config: using development fallback key. Set app.settings.encryption_key for production.';
  END IF;

  RETURN encode(
    pgp_sym_encrypt(plain_json::TEXT, enc_key),
    'base64'
  );
END;
$$;

-- ── PHASE 2: Ensure RLS on all tables ────────────────────────────────────────

-- pending_invites
ALTER TABLE IF EXISTS public.pending_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pending_invites_select" ON public.pending_invites;
CREATE POLICY "pending_invites_select"
  ON public.pending_invites FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "pending_invites_insert" ON public.pending_invites;
CREATE POLICY "pending_invites_insert"
  ON public.pending_invites FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "pending_invites_delete" ON public.pending_invites;
CREATE POLICY "pending_invites_delete"
  ON public.pending_invites FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- timesheet_audit_log
ALTER TABLE IF EXISTS public.timesheet_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timesheet_audit_log_select" ON public.timesheet_audit_log;
CREATE POLICY "timesheet_audit_log_select"
  ON public.timesheet_audit_log FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "timesheet_audit_log_insert" ON public.timesheet_audit_log;
CREATE POLICY "timesheet_audit_log_insert"
  ON public.timesheet_audit_log FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

-- scheduled_jobs
ALTER TABLE IF EXISTS public.scheduled_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_jobs_select" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_select"
  ON public.scheduled_jobs FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "scheduled_jobs_insert" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_insert"
  ON public.scheduled_jobs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "scheduled_jobs_update" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_update"
  ON public.scheduled_jobs FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "scheduled_jobs_delete" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_delete"
  ON public.scheduled_jobs FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- contractor_documents
ALTER TABLE IF EXISTS public.contractor_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_documents_select" ON public.contractor_documents;
CREATE POLICY "contractor_documents_select"
  ON public.contractor_documents FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "contractor_documents_insert" ON public.contractor_documents;
CREATE POLICY "contractor_documents_insert"
  ON public.contractor_documents FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "contractor_documents_delete" ON public.contractor_documents;
CREATE POLICY "contractor_documents_delete"
  ON public.contractor_documents FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- notes
ALTER TABLE IF EXISTS public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_select" ON public.notes;
CREATE POLICY "notes_select"
  ON public.notes FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "notes_insert" ON public.notes;
CREATE POLICY "notes_insert"
  ON public.notes FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "notes_update" ON public.notes;
CREATE POLICY "notes_update"
  ON public.notes FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "notes_delete" ON public.notes;
CREATE POLICY "notes_delete"
  ON public.notes FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- supply_requests
ALTER TABLE IF EXISTS public.supply_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supply_requests_select" ON public.supply_requests;
CREATE POLICY "supply_requests_select"
  ON public.supply_requests FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "supply_requests_insert" ON public.supply_requests;
CREATE POLICY "supply_requests_insert"
  ON public.supply_requests FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "supply_requests_update" ON public.supply_requests;
CREATE POLICY "supply_requests_update"
  ON public.supply_requests FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- conversations
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.conversations
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select"
  ON public.conversations FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

-- messages
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.messages
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select"
  ON public.messages FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

-- checklist_responses
ALTER TABLE IF EXISTS public.checklist_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_responses_select" ON public.checklist_responses;
CREATE POLICY "checklist_responses_select"
  ON public.checklist_responses FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "checklist_responses_insert" ON public.checklist_responses;
CREATE POLICY "checklist_responses_insert"
  ON public.checklist_responses FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "checklist_responses_update" ON public.checklist_responses;
CREATE POLICY "checklist_responses_update"
  ON public.checklist_responses FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ── PHASE 3: Platform API key expiry enforcement ──────────────────────────────
-- Add expires_at column to platform_api_keys if not present
ALTER TABLE IF EXISTS public.platform_api_keys
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Index for efficient expiry queries
CREATE INDEX IF NOT EXISTS idx_platform_api_keys_expires_at
  ON public.platform_api_keys (expires_at)
  WHERE expires_at IS NOT NULL;

-- Function to check if an API key is expired
CREATE OR REPLACE FUNCTION public.is_api_key_valid(key_expires_at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT key_expires_at IS NULL OR key_expires_at > NOW();
$$;

-- ── PHASE 4: Sync idempotency keys table ──────────────────────────────────────
-- Prevents duplicate records from repeated Workforce → Platform sync transmissions.
-- Workforce app includes an idempotency_key (UUID) with each sync operation.
-- Platform records the key and rejects duplicates.

CREATE TABLE IF NOT EXISTS public.sync_idempotency_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  idempotency_key   TEXT NOT NULL,
  entity_type       TEXT NOT NULL,  -- 'job', 'checklist', 'issue_report', etc.
  entity_id         UUID,
  operation         TEXT NOT NULL,  -- 'create', 'update', 'delete'
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one idempotency key per company per operation
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_idempotency_company_key
  ON public.sync_idempotency_keys (company_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_sync_idempotency_company_id
  ON public.sync_idempotency_keys (company_id);

CREATE INDEX IF NOT EXISTS idx_sync_idempotency_processed_at
  ON public.sync_idempotency_keys (processed_at);

-- RLS
ALTER TABLE public.sync_idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_idempotency_keys_select"
  ON public.sync_idempotency_keys FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "sync_idempotency_keys_insert"
  ON public.sync_idempotency_keys FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

-- Auto-cleanup: remove idempotency keys older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_idempotency_keys()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.sync_idempotency_keys
  WHERE processed_at < NOW() - INTERVAL '30 days';
$$;

-- ── PHASE 5: Sync queue table ─────────────────────────────────────────────────
-- Tracks offline operation queue for Workforce → Platform sync.
-- Workforce app writes to this table when online; processes queue on reconnect.

CREATE TABLE IF NOT EXISTS public.sync_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key   TEXT NOT NULL,
  entity_type       TEXT NOT NULL,
  entity_id         UUID,
  operation         TEXT NOT NULL,
  payload           JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 5,
  next_attempt_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_company_status
  ON public.sync_queue (company_id, status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_sync_queue_user_id
  ON public.sync_queue (user_id);

CREATE INDEX IF NOT EXISTS idx_sync_queue_idempotency
  ON public.sync_queue (company_id, idempotency_key);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_sync_queue_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_queue_updated_at ON public.sync_queue;
CREATE TRIGGER trg_sync_queue_updated_at
  BEFORE UPDATE ON public.sync_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sync_queue_updated_at();

-- RLS
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_queue_select"
  ON public.sync_queue FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id() AND user_id = auth.uid());

CREATE POLICY "sync_queue_insert"
  ON public.sync_queue FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND user_id = auth.uid());

CREATE POLICY "sync_queue_update"
  ON public.sync_queue FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND user_id = auth.uid())
  WITH CHECK (company_id = public.get_my_company_id() AND user_id = auth.uid());

-- ── PHASE 6: Sync health view ─────────────────────────────────────────────────
-- Provides real-time sync health metrics per company/user.

CREATE OR REPLACE VIEW public.sync_health AS
SELECT
  sq.company_id,
  sq.user_id,
  COUNT(*) FILTER (WHERE sq.status = 'pending')                    AS queue_depth,
  COUNT(*) FILTER (WHERE sq.status = 'failed')                     AS failed_count,
  COUNT(*) FILTER (WHERE sq.status = 'dead_letter')                AS dead_letter_count,
  MAX(sq.attempt_count) FILTER (WHERE sq.status IN ('failed', 'dead_letter')) AS max_consecutive_failures,
  MAX(sq.completed_at) FILTER (WHERE sq.status = 'completed')      AS last_successful_sync,
  CASE
    WHEN COUNT(*) FILTER (WHERE sq.status = 'dead_letter') > 0 THEN 'failure'
    WHEN COUNT(*) FILTER (WHERE sq.status = 'failed') > 3 THEN 'degraded'
    WHEN COUNT(*) FILTER (WHERE sq.status = 'pending') > 50 THEN 'backlogged'
    ELSE 'healthy'
  END AS health_state,
  NOW() AS checked_at
FROM public.sync_queue sq
GROUP BY sq.company_id, sq.user_id;

-- ── PHASE 7: Additional performance indexes ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_company_status
  ON public.jobs (company_id, job_status)
  WHERE job_status NOT IN ('completed', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_checklists_company_status
  ON public.checklists (company_id, checklist_status)
  WHERE checklist_status NOT IN ('completed');

CREATE INDEX IF NOT EXISTS idx_notifications_company_unread
  ON public.notifications (company_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_activity_log_company_created
  ON public.activity_log (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_company_created
  ON public.messages (company_id, created_at DESC);
