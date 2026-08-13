-- ============================================================
-- Add company_id to all data tables for multi-tenant isolation
-- ============================================================

-- 1. ADD company_id COLUMN TO ALL DATA TABLES

ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.compliance_items
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS company_id UUID;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS company_id UUID;

-- 2. INDEXES ON company_id FOR QUERY PERFORMANCE

CREATE INDEX IF NOT EXISTS idx_contractors_company_id ON public.contractors(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_company_id ON public.time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_checklists_company_id ON public.checklists(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_sites_company_id ON public.sites(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_compliance_items_company_id ON public.compliance_items(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_incidents_company_id ON public.incidents(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_company_id ON public.inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON public.vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_company_id ON public.companies(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON public.notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_settings_company_id ON public.settings(company_id);

-- 3. HELPER FUNCTION: get company_id from authenticated user's metadata
-- Returns the company_id stored in auth.users raw_user_meta_data
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT NULLIF(
    (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
    ''
  )::UUID;
$$;

-- 4. UPDATE RLS POLICIES
-- Policy: allow access when company_id matches user's company OR row has no company_id (legacy rows)

-- contractors
DROP POLICY IF EXISTS "open_access_contractors" ON public.contractors;
DROP POLICY IF EXISTS "company_access_contractors" ON public.contractors;
CREATE POLICY "company_access_contractors" ON public.contractors
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- jobs
DROP POLICY IF EXISTS "open_access_jobs" ON public.jobs;
DROP POLICY IF EXISTS "company_access_jobs" ON public.jobs;
CREATE POLICY "company_access_jobs" ON public.jobs
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- time_entries
DROP POLICY IF EXISTS "open_access_time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "company_access_time_entries" ON public.time_entries;
CREATE POLICY "company_access_time_entries" ON public.time_entries
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- checklists
DROP POLICY IF EXISTS "open_access_checklists" ON public.checklists;
DROP POLICY IF EXISTS "company_access_checklists" ON public.checklists;
CREATE POLICY "company_access_checklists" ON public.checklists
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- clients
DROP POLICY IF EXISTS "open_access_clients" ON public.clients;
DROP POLICY IF EXISTS "company_access_clients" ON public.clients;
CREATE POLICY "company_access_clients" ON public.clients
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- sites
DROP POLICY IF EXISTS "open_access_sites" ON public.sites;
DROP POLICY IF EXISTS "company_access_sites" ON public.sites;
CREATE POLICY "company_access_sites" ON public.sites
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- employees
DROP POLICY IF EXISTS "open_access_employees" ON public.employees;
DROP POLICY IF EXISTS "company_access_employees" ON public.employees;
CREATE POLICY "company_access_employees" ON public.employees
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- compliance_items
DROP POLICY IF EXISTS "open_access_compliance_items" ON public.compliance_items;
DROP POLICY IF EXISTS "company_access_compliance_items" ON public.compliance_items;
CREATE POLICY "company_access_compliance_items" ON public.compliance_items
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- documents
DROP POLICY IF EXISTS "open_access_documents" ON public.documents;
DROP POLICY IF EXISTS "company_access_documents" ON public.documents;
CREATE POLICY "company_access_documents" ON public.documents
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- incidents
DROP POLICY IF EXISTS "open_access_incidents" ON public.incidents;
DROP POLICY IF EXISTS "company_access_incidents" ON public.incidents;
CREATE POLICY "company_access_incidents" ON public.incidents
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- inventory
DROP POLICY IF EXISTS "open_access_inventory" ON public.inventory;
DROP POLICY IF EXISTS "company_access_inventory" ON public.inventory;
CREATE POLICY "company_access_inventory" ON public.inventory
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- vehicles
DROP POLICY IF EXISTS "open_access_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "company_access_vehicles" ON public.vehicles;
CREATE POLICY "company_access_vehicles" ON public.vehicles
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- companies
DROP POLICY IF EXISTS "open_access_companies" ON public.companies;
DROP POLICY IF EXISTS "company_access_companies" ON public.companies;
CREATE POLICY "company_access_companies" ON public.companies
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- notifications
DROP POLICY IF EXISTS "open_access_notifications" ON public.notifications;
DROP POLICY IF EXISTS "company_access_notifications" ON public.notifications;
CREATE POLICY "company_access_notifications" ON public.notifications
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

-- settings
DROP POLICY IF EXISTS "open_access_settings" ON public.settings;
DROP POLICY IF EXISTS "company_access_settings" ON public.settings;
CREATE POLICY "company_access_settings" ON public.settings
  FOR ALL TO public
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());
