-- ============================================================
-- Innovion Production Hardening Migration
-- Timestamp: 20260731070000
-- Phase 1: Critical RLS fixes + privilege escalation prevention
-- Phase 2: Mock data removal + data integrity
-- Phase 3: Performance composite indexes
-- ============================================================

-- ============================================================
-- PHASE 1A: CRITICAL — Fix settings table RLS (was TO public)
-- ============================================================

-- Drop the misconfigured policy that uses TO public
DROP POLICY IF EXISTS "company_access_settings" ON public.settings;
DROP POLICY IF EXISTS "settings_select" ON public.settings;
DROP POLICY IF EXISTS "settings_insert" ON public.settings;
DROP POLICY IF EXISTS "settings_update" ON public.settings;
DROP POLICY IF EXISTS "settings_delete" ON public.settings;

-- Ensure RLS is enabled
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Recreate with TO authenticated only (no IS NULL escape, no public access)
CREATE POLICY "settings_select"
  ON public.settings
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "settings_insert"
  ON public.settings
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "settings_update"
  ON public.settings
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "settings_delete"
  ON public.settings
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ============================================================
-- PHASE 1B: HIGH — Fix notifications INSERT (allowed NULL company_id)
-- ============================================================

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert"
  ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

-- Fix notifications UPDATE and DELETE to remove IS NULL escape
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update"
  ON public.notifications
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete"
  ON public.notifications
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- Fix notifications SELECT to remove IS NULL escape
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select"
  ON public.notifications
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- ============================================================
-- PHASE 1C: HIGH — Fix activity_log INSERT (no company_id check)
-- ============================================================

DROP POLICY IF EXISTS "activity_log_insert" ON public.activity_log;
CREATE POLICY "activity_log_insert"
  ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.get_my_company_id()
  );

-- Fix activity_log SELECT to remove IS NULL escape
DROP POLICY IF EXISTS "activity_log_read" ON public.activity_log;
CREATE POLICY "activity_log_read"
  ON public.activity_log
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- ============================================================
-- PHASE 1D: HIGH — Privilege escalation: admin-only user_roles write
-- ============================================================

-- Helper function: check if current user is admin in their company
CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND company_id = public.get_my_company_id()
      AND role = 'admin'
  );
$$;

-- Drop the overly permissive write policy
DROP POLICY IF EXISTS "user_roles_write" ON public.user_roles;

-- Separate write policies: only admins can INSERT/UPDATE/DELETE roles
CREATE POLICY "user_roles_insert"
  ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.is_company_admin()
  );

CREATE POLICY "user_roles_update"
  ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND public.is_company_admin()
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.is_company_admin()
  );

CREATE POLICY "user_roles_delete"
  ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND public.is_company_admin()
  );

-- ============================================================
-- PHASE 1E: HIGH — Restrict platform_api_keys to admin/manager
-- ============================================================

-- Helper function: check if current user is admin or manager
CREATE OR REPLACE FUNCTION public.is_company_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND company_id = public.get_my_company_id()
      AND role IN ('admin', 'manager')
  );
$$;

DROP POLICY IF EXISTS "company_members_manage_api_keys" ON public.platform_api_keys;
CREATE POLICY "company_members_manage_api_keys"
  ON public.platform_api_keys
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
    AND public.is_company_admin_or_manager()
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
    AND public.is_company_admin_or_manager()
  );

-- ============================================================
-- PHASE 1F: Remove IS NULL escape clauses from all SELECT policies
-- (Tenant isolation: no row without company_id should be visible)
-- ============================================================

-- JOBS
DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
CREATE POLICY "jobs_select" ON public.jobs
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- CONTRACTORS
DROP POLICY IF EXISTS "contractors_select" ON public.contractors;
CREATE POLICY "contractors_select" ON public.contractors
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- CLIENTS
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- SITES
DROP POLICY IF EXISTS "sites_select" ON public.sites;
CREATE POLICY "sites_select" ON public.sites
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- EMPLOYEES
DROP POLICY IF EXISTS "employees_select" ON public.employees;
CREATE POLICY "employees_select" ON public.employees
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- COMPLIANCE ITEMS
DROP POLICY IF EXISTS "compliance_items_select" ON public.compliance_items;
CREATE POLICY "compliance_items_select" ON public.compliance_items
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- INCIDENTS
DROP POLICY IF EXISTS "incidents_select" ON public.incidents;
CREATE POLICY "incidents_select" ON public.incidents
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- DOCUMENTS
DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- INVENTORY
DROP POLICY IF EXISTS "inventory_select" ON public.inventory;
CREATE POLICY "inventory_select" ON public.inventory
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- VEHICLES
DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- SCHEDULED JOBS
DROP POLICY IF EXISTS "scheduled_jobs_select" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_select" ON public.scheduled_jobs
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- TIME ENTRIES
DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
CREATE POLICY "time_entries_select" ON public.time_entries
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- CHECKLISTS
DROP POLICY IF EXISTS "checklists_select" ON public.checklists;
CREATE POLICY "checklists_select" ON public.checklists
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- ============================================================
-- PHASE 1G: Filename sanitisation helper function
-- ============================================================

CREATE OR REPLACE FUNCTION public.sanitise_filename(raw_filename TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(raw_filename, '[^a-zA-Z0-9._\-]', '_', 'g');
$$;

-- ============================================================
-- PHASE 2A: Remove all mock data without company_id
-- (Eliminates cross-tenant data leakage from seed records)
-- ============================================================

DO $$
BEGIN
  -- Remove mock contractors (no company_id — visible to all tenants)
  DELETE FROM public.contractors WHERE company_id IS NULL;

  -- Remove mock jobs (no company_id)
  DELETE FROM public.jobs WHERE company_id IS NULL;

  -- Remove mock time entries (no company_id)
  DELETE FROM public.time_entries WHERE company_id IS NULL;

  -- Remove mock checklists (no company_id)
  DELETE FROM public.checklists WHERE company_id IS NULL;

  -- Remove mock clients (no company_id)
  DELETE FROM public.clients WHERE company_id IS NULL;

  -- Remove mock sites (no company_id)
  DELETE FROM public.sites WHERE company_id IS NULL;

  -- Remove mock employees (no company_id)
  DELETE FROM public.employees WHERE company_id IS NULL;

  -- Remove mock compliance items (no company_id)
  DELETE FROM public.compliance_items WHERE company_id IS NULL;

  -- Remove mock incidents (no company_id)
  DELETE FROM public.incidents WHERE company_id IS NULL;

  -- Remove mock inventory (no company_id)
  DELETE FROM public.inventory WHERE company_id IS NULL;

  -- Remove mock vehicles (no company_id)
  DELETE FROM public.vehicles WHERE company_id IS NULL;

  -- Remove mock scheduled jobs (no company_id)
  DELETE FROM public.scheduled_jobs WHERE company_id IS NULL;

  -- Remove mock notifications (no company_id)
  DELETE FROM public.notifications WHERE company_id IS NULL;

  -- Remove recurring job patterns with fictional client names
  DELETE FROM public.recurring_job_patterns
  WHERE client IN ('Acme Corp', 'BuildRight Pty Ltd', 'TechStart Inc')
     OR company_id IS NULL;

  -- Remove test companies (no owner or test/demo names)
  DELETE FROM public.companies
  WHERE owner_id IS NULL
     OR LOWER(name) LIKE '%test%'
     OR LOWER(name) LIKE '%demo%'
     OR LOWER(name) LIKE '%sample%'
     OR LOWER(name) LIKE '%acme%'
     OR LOWER(name) LIKE '%example%';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data cleanup encountered an issue: %', SQLERRM;
END $$;

-- ============================================================
-- PHASE 2B: Convert checklist templates to global (company_id = NULL)
-- and update their RLS to allow all authenticated users to read globals
-- ============================================================

-- Update existing templates to be global (no company ownership)
UPDATE public.checklist_templates
SET company_id = NULL
WHERE company_id IN (
  SELECT id FROM public.companies LIMIT 1
)
AND name IN ('Standard Daily Clean', 'Site Safety Inspection', 'Site Inspection Report');

-- Allow all authenticated users to read global templates (company_id IS NULL)
DROP POLICY IF EXISTS "checklist_templates_select" ON public.checklist_templates;
CREATE POLICY "checklist_templates_select"
  ON public.checklist_templates
  FOR SELECT TO authenticated
  USING (
    company_id IS NULL
    OR company_id = public.get_my_company_id()
  );

DROP POLICY IF EXISTS "checklist_templates_insert" ON public.checklist_templates;
CREATE POLICY "checklist_templates_insert"
  ON public.checklist_templates
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "checklist_templates_update" ON public.checklist_templates;
CREATE POLICY "checklist_templates_update"
  ON public.checklist_templates
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "checklist_templates_delete" ON public.checklist_templates;
CREATE POLICY "checklist_templates_delete"
  ON public.checklist_templates
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ============================================================
-- PHASE 2C: Subscription plan pricing — update from $0 placeholders
-- NOTE: These are the commercial launch prices. Update as needed.
-- Starter: $49/mo, $39/mo billed annually ($468/yr)
-- Professional: $99/mo, $79/mo billed annually ($948/yr)
-- Enterprise: custom (0 = contact us)
-- ============================================================

UPDATE public.subscription_plans
SET
  monthly_price_cents = 4900,
  annual_price_cents  = 3900,
  max_users           = 3,
  max_jobs            = 50,
  features            = '["Up to 3 staff members","Customer management","Job management","Basic scheduling","Mobile app access","Email support"]'::JSONB,
  updated_at          = NOW()
WHERE plan_key = 'starter';

UPDATE public.subscription_plans
SET
  monthly_price_cents = 9900,
  annual_price_cents  = 7900,
  max_users           = 15,
  max_jobs            = 500,
  features            = '["Up to 15 staff members","All Starter features","GPS attendance tracking","Compliance management","Inventory management","Document management","Reporting & analytics","Priority support"]'::JSONB,
  updated_at          = NOW()
WHERE plan_key = 'professional';

UPDATE public.subscription_plans
SET
  monthly_price_cents = 0,
  annual_price_cents  = 0,
  max_users           = 9999,
  max_jobs            = 999999,
  features            = '["Unlimited staff members","All Professional features","Custom integrations","Dedicated account manager","Custom onboarding","SLA guarantee","Advanced reporting","API access"]'::JSONB,
  updated_at          = NOW()
WHERE plan_key = 'enterprise';

-- ============================================================
-- PHASE 3A: Performance — Composite indexes for dashboard queries
-- ============================================================

-- Dashboard: jobs by status + company (most frequent dashboard query)
CREATE INDEX IF NOT EXISTS idx_jobs_company_status
  ON public.jobs(company_id, job_status);

-- Dashboard: jobs by scheduled_date + company
CREATE INDEX IF NOT EXISTS idx_jobs_company_date
  ON public.jobs(company_id, scheduled_date);

-- Scheduling: composite on company + date (replaces separate indexes)
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_company_date
  ON public.scheduled_jobs(company_id, scheduled_date);

-- Compliance: company + status for dashboard compliance widget
CREATE INDEX IF NOT EXISTS idx_compliance_company_status
  ON public.compliance_items(company_id, comp_status);

-- Incidents: company + status for open incidents count
CREATE INDEX IF NOT EXISTS idx_incidents_company_status
  ON public.incidents(company_id, inc_status);

-- Contractors: company + availability for active contractor count
CREATE INDEX IF NOT EXISTS idx_contractors_company_availability
  ON public.contractors(company_id, availability);

-- Inventory: company + status for filtered inventory views
CREATE INDEX IF NOT EXISTS idx_inventory_company_status
  ON public.inventory(company_id, inv_status);

-- Time entries: company + approval_status for timesheet approval
CREATE INDEX IF NOT EXISTS idx_time_entries_company_approval
  ON public.time_entries(company_id, approval_status);

-- Activity log: company + created_at for feed (already has separate, add composite)
CREATE INDEX IF NOT EXISTS idx_activity_log_company_created
  ON public.activity_log(company_id, created_at DESC);

-- Notifications: company + is_read for unread count
CREATE INDEX IF NOT EXISTS idx_notifications_company_read
  ON public.notifications(company_id, is_read);

-- Platform API keys: company + is_active
CREATE INDEX IF NOT EXISTS idx_platform_api_keys_company_active
  ON public.platform_api_keys(company_id, is_active);

-- Contractor invoices: company + status
CREATE INDEX IF NOT EXISTS idx_contractor_invoices_company_status
  ON public.contractor_invoices(company_id, inv_status);

-- Reports: jobs by company + scheduled_date for date-range aggregations
CREATE INDEX IF NOT EXISTS idx_jobs_company_scheduled_date
  ON public.jobs(company_id, scheduled_date);

-- ============================================================
-- PHASE 3B: Storage path isolation policy update
-- Enforce company-scoped folder structure in storage
-- ============================================================

-- Note: Storage bucket policies are managed via Supabase dashboard.
-- The following documents the required policy for the 'documents' bucket:
-- SELECT: bucket_id = 'documents' AND (storage.foldername(name))[1] = get_my_company_id()::text
-- INSERT: bucket_id = 'documents' AND (storage.foldername(name))[1] = get_my_company_id()::text
-- This must be applied in the Supabase Storage dashboard under Policies.

-- ============================================================
-- PHASE 3C: Platform API request log — add composite index
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_api_request_log_company_at
  ON public.platform_api_request_log(company_id, requested_at DESC);
