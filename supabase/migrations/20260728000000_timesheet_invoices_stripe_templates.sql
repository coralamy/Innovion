-- ============================================================
-- Migration: Timesheet Approval, Contractor Invoices, Stripe,
--            Checklist Templates, Recurring Jobs, Seed Data
-- Timestamp: 20260728000000
-- ============================================================

-- ─── 1. ENUMS ────────────────────────────────────────────────

DROP TYPE IF EXISTS public.timesheet_approval_status CASCADE;
CREATE TYPE public.timesheet_approval_status AS ENUM (
  'in_progress', 'submitted', 'approved', 'rejected', 'correction_required'
);

DROP TYPE IF EXISTS public.invoice_status CASCADE;
CREATE TYPE public.invoice_status AS ENUM (
  'draft', 'reviewed', 'submitted', 'paid', 'cancelled'
);

DROP TYPE IF EXISTS public.subscription_status CASCADE;
CREATE TYPE public.subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'cancelled', 'suspended', 'read_only'
);

-- ─── 2. ALTER time_entries: add approval columns ─────────────

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS approval_status public.timesheet_approval_status DEFAULT 'in_progress'::public.timesheet_approval_status,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approver_id UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS correction_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contractor_id UUID;

-- ─── 3. TIMESHEET AUDIT LOG ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.timesheet_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  performer_id UUID,
  old_status TEXT,
  new_status TEXT,
  notes TEXT,
  company_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. CONTRACTOR INVOICES ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contractor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  time_entry_id UUID NOT NULL,
  contractor_id UUID,
  contractor_name TEXT NOT NULL DEFAULT '',
  contractor_email TEXT NOT NULL DEFAULT '',
  contractor_abn TEXT DEFAULT '',
  company_id UUID,
  job TEXT DEFAULT '',
  site TEXT DEFAULT '',
  work_date TEXT DEFAULT '',
  hours_worked NUMERIC DEFAULT 0,
  hourly_rate NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  gst NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  inv_status public.invoice_status DEFAULT 'draft'::public.invoice_status,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  submitted_by TEXT,
  email_sent_at TIMESTAMPTZ,
  pdf_url TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. INVOICE AUDIT LOG ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  performer_id UUID,
  old_status TEXT,
  new_status TEXT,
  notes TEXT,
  company_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 6. STRIPE SUBSCRIPTIONS ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  plan_name TEXT DEFAULT 'starter',
  billing_interval TEXT DEFAULT 'monthly',
  sub_status public.subscription_status DEFAULT 'trialing'::public.subscription_status,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  trial_days INTEGER DEFAULT 14,
  monthly_price_cents INTEGER DEFAULT 0,
  annual_price_cents INTEGER DEFAULT 0,
  max_users INTEGER DEFAULT 5,
  max_jobs INTEGER DEFAULT 100,
  features JSONB DEFAULT '[]'::JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 7. SUBSCRIPTION CONFIG (configurable, no hard-coded plans) ──

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT UNIQUE NOT NULL,
  plan_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  monthly_price_cents INTEGER DEFAULT 0,
  annual_price_cents INTEGER DEFAULT 0,
  trial_days INTEGER DEFAULT 14,
  max_users INTEGER DEFAULT 5,
  max_jobs INTEGER DEFAULT 100,
  features JSONB DEFAULT '[]'::JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 8. CHECKLIST TEMPLATES ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  template_type TEXT DEFAULT 'daily-job',
  sections JSONB DEFAULT '[]'::JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  company_id UUID,
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 9. RECURRING JOB PATTERNS ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.recurring_job_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  site TEXT DEFAULT '',
  client TEXT DEFAULT '',
  contractor_name TEXT DEFAULT '',
  contractor_id UUID,
  job_type TEXT DEFAULT 'Regular Clean',
  frequency TEXT DEFAULT 'weekly',
  day_of_week INTEGER,
  day_of_month INTEGER,
  start_time TEXT DEFAULT '09:00',
  duration_minutes INTEGER DEFAULT 120,
  priority TEXT DEFAULT 'medium',
  instructions TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  next_occurrence DATE,
  company_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 10. INDEXES ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_timesheet_audit_entry ON public.timesheet_audit_log(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_audit_company ON public.timesheet_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_contractor_invoices_entry ON public.contractor_invoices(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_contractor_invoices_company ON public.contractor_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_invoice ON public.invoice_audit_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON public.subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_company ON public.checklist_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_patterns_company ON public.recurring_job_patterns(company_id);

-- ─── 11. FUNCTIONS ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID,
    (SELECT company_id FROM public.companies WHERE owner_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_account_read_only()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.company_id = public.get_my_company_id()
    AND s.sub_status IN ('read_only', 'suspended', 'cancelled')
  );
$$;

-- ─── 12. ENABLE RLS ──────────────────────────────────────────

ALTER TABLE public.timesheet_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_job_patterns ENABLE ROW LEVEL SECURITY;

-- ─── 13. RLS POLICIES ────────────────────────────────────────

DROP POLICY IF EXISTS "company_timesheet_audit" ON public.timesheet_audit_log;
CREATE POLICY "company_timesheet_audit" ON public.timesheet_audit_log
FOR ALL TO authenticated
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "company_contractor_invoices" ON public.contractor_invoices;
CREATE POLICY "company_contractor_invoices" ON public.contractor_invoices
FOR ALL TO authenticated
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "company_invoice_audit" ON public.invoice_audit_log;
CREATE POLICY "company_invoice_audit" ON public.invoice_audit_log
FOR ALL TO authenticated
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "company_subscriptions" ON public.subscriptions;
CREATE POLICY "company_subscriptions" ON public.subscriptions
FOR ALL TO authenticated
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "plans_public_read" ON public.subscription_plans;
CREATE POLICY "plans_public_read" ON public.subscription_plans
FOR SELECT TO authenticated
USING (is_active = TRUE);

DROP POLICY IF EXISTS "company_checklist_templates" ON public.checklist_templates;
CREATE POLICY "company_checklist_templates" ON public.checklist_templates
FOR ALL TO authenticated
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "company_recurring_patterns" ON public.recurring_job_patterns;
CREATE POLICY "company_recurring_patterns" ON public.recurring_job_patterns
FOR ALL TO authenticated
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

-- ─── 14. SEED: Subscription Plans (configurable, no hard-coded prices) ──

INSERT INTO public.subscription_plans (plan_key, plan_name, description, monthly_price_cents, annual_price_cents, trial_days, max_users, max_jobs, features, sort_order)
VALUES
  ('starter', 'Starter', 'For small teams getting started', 0, 0, 14, 5, 50, '["Jobs","Scheduling","Checklists","Time Tracking"]'::JSONB, 1),
  ('professional', 'Professional', 'For growing businesses', 0, 0, 14, 20, 500, '["Jobs","Scheduling","Checklists","Time Tracking","Reports","Compliance","Incidents","Documents"]'::JSONB, 2),
  ('enterprise', 'Enterprise', 'For large organisations', 0, 0, 14, 999, 9999, '["All Features","Priority Support","Custom Integrations","API Access"]'::JSONB, 3)
ON CONFLICT (plan_key) DO NOTHING;

-- ─── 15. SEED: Checklist Templates ───────────────────────────

DO $$
DECLARE
  existing_company_id UUID;
BEGIN
  SELECT id INTO existing_company_id FROM public.companies LIMIT 1;

  INSERT INTO public.checklist_templates (id, name, description, template_type, sections, company_id)
  VALUES
    (gen_random_uuid(), 'Standard Daily Clean', 'Default daily cleaning checklist', 'daily-job',
     '[{"id":"s1","title":"Entry & Setup","tasks":[{"id":"t1","label":"Check site access and sign in","completed":false,"required":true,"notes":"","photos":[]},{"id":"t2","label":"Inspect equipment and supplies","completed":false,"required":true,"notes":"","photos":[]}]},{"id":"s2","title":"Cleaning Tasks","tasks":[{"id":"t3","label":"Vacuum all carpeted areas","completed":false,"required":true,"notes":"","photos":[]},{"id":"t4","label":"Mop hard floor surfaces","completed":false,"required":true,"notes":"","photos":[]},{"id":"t5","label":"Clean and sanitise bathrooms","completed":false,"required":true,"notes":"","photos":[]},{"id":"t6","label":"Empty all bins and replace liners","completed":false,"required":true,"notes":"","photos":[]}]},{"id":"s3","title":"Completion","tasks":[{"id":"t7","label":"Final walkthrough completed","completed":false,"required":true,"notes":"","photos":[]},{"id":"t8","label":"All equipment stored and secured","completed":false,"required":true,"notes":"","photos":[]}]}]'::JSONB,
     existing_company_id),
    (gen_random_uuid(), 'Site Safety Inspection', 'Pre-work safety inspection template', 'safety',
     '[{"id":"s1","title":"Hazard Assessment","tasks":[{"id":"t1","label":"Identify and document all hazards","completed":false,"required":true,"notes":"","photos":[]},{"id":"t2","label":"Check emergency exits are clear","completed":false,"required":true,"notes":"","photos":[]},{"id":"t3","label":"Verify first aid kit is stocked","completed":false,"required":true,"notes":"","photos":[]}]},{"id":"s2","title":"PPE Check","tasks":[{"id":"t4","label":"All team members have correct PPE","completed":false,"required":true,"notes":"","photos":[]},{"id":"t5","label":"PPE is in good condition","completed":false,"required":true,"notes":"","photos":[]}]}]'::JSONB,
     existing_company_id),
    (gen_random_uuid(), 'Site Inspection Report', 'Comprehensive site inspection template', 'site-inspection',
     '[{"id":"s1","title":"External Areas","tasks":[{"id":"t1","label":"Car park and pathways clear","completed":false,"required":true,"notes":"","photos":[]},{"id":"t2","label":"External signage intact","completed":false,"required":false,"notes":"","photos":[]}]},{"id":"s2","title":"Internal Areas","tasks":[{"id":"t3","label":"Reception and common areas inspected","completed":false,"required":true,"notes":"","photos":[]},{"id":"t4","label":"Amenities checked and stocked","completed":false,"required":true,"notes":"","photos":[]},{"id":"t5","label":"All areas meet cleanliness standard","completed":false,"required":true,"notes":"","photos":[]}]}]'::JSONB,
     existing_company_id)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Checklist template seed failed: %', SQLERRM;
END $$;

-- ─── 16. SEED: Recurring Job Patterns ────────────────────────

DO $$
DECLARE
  existing_company_id UUID;
BEGIN
  SELECT id INTO existing_company_id FROM public.companies LIMIT 1;

  IF existing_company_id IS NOT NULL THEN
    INSERT INTO public.recurring_job_patterns (title, site, client, job_type, frequency, day_of_week, start_time, duration_minutes, priority, is_active, company_id)
    VALUES
      ('Weekly Office Clean - CBD Tower', 'CBD Tower Level 12', 'Acme Corp', 'Regular Clean', 'weekly', 1, '07:00', 180, 'high', TRUE, existing_company_id),
      ('Bi-weekly Warehouse Clean', 'Northside Warehouse', 'BuildRight Pty Ltd', 'Deep Clean', 'fortnightly', 5, '06:00', 240, 'medium', TRUE, existing_company_id),
      ('Monthly Carpet Steam Clean', 'Riverside Office Park', 'TechStart Inc', 'Carpet Clean', 'monthly', NULL, '08:00', 300, 'medium', TRUE, existing_company_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Recurring pattern seed failed: %', SQLERRM;
END $$;
