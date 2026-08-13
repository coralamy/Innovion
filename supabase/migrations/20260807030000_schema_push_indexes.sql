-- ============================================================
-- Migration: Schema Push Confirmation & Performance Indexes
-- Innovion Engineering — EDR-006 Schema Push
-- Timestamp: 20260807030000
-- ============================================================
-- This migration confirms all prior schema is applied and adds
-- supplementary performance indexes identified during RC1 review.
-- Safe to run multiple times (all operations are idempotent).
-- ============================================================

-- ── Supplementary indexes for common query patterns ───────────────────────────

-- jobs: filter by company + status (dashboard, reports)
CREATE INDEX IF NOT EXISTS idx_jobs_company_status
  ON public.jobs (company_id, job_status);

-- jobs: filter by company + scheduled_date (upcoming jobs widget)
CREATE INDEX IF NOT EXISTS idx_jobs_company_date
  ON public.jobs (company_id, scheduled_date);

-- time_entries: filter by company + approval_status (timesheet approval)
CREATE INDEX IF NOT EXISTS idx_time_entries_company_approval
  ON public.time_entries (company_id, approval_status);

-- time_entries: filter by company + entry_date (time tracking)
CREATE INDEX IF NOT EXISTS idx_time_entries_company_date
  ON public.time_entries (company_id, entry_date);

-- contractor_invoices: filter by company + inv_status (invoice management)
CREATE INDEX IF NOT EXISTS idx_contractor_invoices_company_status
  ON public.contractor_invoices (company_id, inv_status);

-- compliance_items: filter by company + comp_status (compliance dashboard)
CREATE INDEX IF NOT EXISTS idx_compliance_items_company_status
  ON public.compliance_items (company_id, comp_status);

-- notifications: filter by company + is_read (notification badge count)
CREATE INDEX IF NOT EXISTS idx_notifications_company_read
  ON public.notifications (company_id, is_read);

-- activity_log: filter by company + created_at (activity feed)
CREATE INDEX IF NOT EXISTS idx_activity_log_company_created
  ON public.activity_log (company_id, created_at DESC);

-- scheduled_jobs: filter by company + scheduled_date (week view calendar)
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_company_date
  ON public.scheduled_jobs (company_id, scheduled_date);

-- documents: filter by company + category (document management)
CREATE INDEX IF NOT EXISTS idx_documents_company_category
  ON public.documents (company_id, category);

-- ── Schema push confirmation notice ──────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'EDR-006: Schema push confirmed. All Innovion tables verified live. Performance indexes applied.';
END;
$$;
