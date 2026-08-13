-- ============================================================
-- Innovion Extended Schema: clients, sites, employees, compliance,
-- documents, incidents, inventory, vehicles, companies, notifications, settings
-- ============================================================

-- 1. ENUM TYPES

DROP TYPE IF EXISTS public.client_status CASCADE;
CREATE TYPE public.client_status AS ENUM ('active', 'inactive', 'at-risk');

DROP TYPE IF EXISTS public.site_status CASCADE;
CREATE TYPE public.site_status AS ENUM ('active', 'inactive', 'on-hold');

DROP TYPE IF EXISTS public.employee_status CASCADE;
CREATE TYPE public.employee_status AS ENUM ('active', 'on-leave', 'terminated');

DROP TYPE IF EXISTS public.employment_type CASCADE;
CREATE TYPE public.employment_type AS ENUM ('full-time', 'part-time', 'casual');

DROP TYPE IF EXISTS public.compliance_status CASCADE;
CREATE TYPE public.compliance_status AS ENUM ('compliant', 'expiring', 'expired', 'pending');

DROP TYPE IF EXISTS public.compliance_category CASCADE;
CREATE TYPE public.compliance_category AS ENUM ('license', 'insurance', 'certification', 'whs', 'induction');

DROP TYPE IF EXISTS public.compliance_assigned_type CASCADE;
CREATE TYPE public.compliance_assigned_type AS ENUM ('contractor', 'employee', 'company');

DROP TYPE IF EXISTS public.incident_severity CASCADE;
CREATE TYPE public.incident_severity AS ENUM ('critical', 'high', 'medium', 'low');

DROP TYPE IF EXISTS public.incident_status CASCADE;
CREATE TYPE public.incident_status AS ENUM ('open', 'investigating', 'resolved', 'closed');

DROP TYPE IF EXISTS public.incident_type CASCADE;
CREATE TYPE public.incident_type AS ENUM ('injury', 'near-miss', 'property', 'environmental', 'security');

DROP TYPE IF EXISTS public.inventory_status CASCADE;
CREATE TYPE public.inventory_status AS ENUM ('in-stock', 'low-stock', 'out-of-stock');

DROP TYPE IF EXISTS public.inventory_category CASCADE;
CREATE TYPE public.inventory_category AS ENUM ('chemicals', 'equipment', 'ppe', 'consumables', 'tools');

DROP TYPE IF EXISTS public.vehicle_status CASCADE;
CREATE TYPE public.vehicle_status AS ENUM ('active', 'maintenance', 'out-of-service');

DROP TYPE IF EXISTS public.vehicle_type CASCADE;
CREATE TYPE public.vehicle_type AS ENUM ('van', 'ute', 'truck', 'car');

DROP TYPE IF EXISTS public.fuel_type CASCADE;
CREATE TYPE public.fuel_type AS ENUM ('petrol', 'diesel', 'electric');

DROP TYPE IF EXISTS public.company_type CASCADE;
CREATE TYPE public.company_type AS ENUM ('client', 'contractor', 'partner');

DROP TYPE IF EXISTS public.company_status CASCADE;
CREATE TYPE public.company_status AS ENUM ('active', 'inactive', 'pending');

DROP TYPE IF EXISTS public.notification_type CASCADE;
CREATE TYPE public.notification_type AS ENUM ('alert', 'success', 'info', 'warning');

DROP TYPE IF EXISTS public.notification_category CASCADE;
CREATE TYPE public.notification_category AS ENUM ('compliance', 'jobs', 'workforce', 'system', 'incidents');

-- 2. TABLES

-- Clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  contact_role TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  active_contracts INTEGER NOT NULL DEFAULT 0,
  total_jobs INTEGER NOT NULL DEFAULT 0,
  monthly_value TEXT NOT NULL DEFAULT '',
  total_revenue TEXT NOT NULL DEFAULT '',
  client_status public.client_status NOT NULL DEFAULT 'active',
  rating INTEGER NOT NULL DEFAULT 4,
  since TEXT NOT NULL DEFAULT '',
  next_service TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sites
CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  suburb TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  site_type TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  floors INTEGER NOT NULL DEFAULT 1,
  active_jobs INTEGER NOT NULL DEFAULT 0,
  last_service TEXT NOT NULL DEFAULT '',
  next_service TEXT NOT NULL DEFAULT '',
  site_status public.site_status NOT NULL DEFAULT 'active',
  assigned_team TEXT[] NOT NULL DEFAULT '{}',
  access_notes TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Employees
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  emp_status public.employee_status NOT NULL DEFAULT 'active',
  employment_type public.employment_type NOT NULL DEFAULT 'full-time',
  start_date TEXT NOT NULL DEFAULT '',
  salary TEXT NOT NULL DEFAULT '',
  hours_this_week NUMERIC(5,1) NOT NULL DEFAULT 0,
  jobs_completed INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,1) NOT NULL DEFAULT 4.5,
  initials TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#2563EB',
  skills TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compliance
CREATE TABLE IF NOT EXISTS public.compliance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category public.compliance_category NOT NULL DEFAULT 'certification',
  assigned_to TEXT NOT NULL DEFAULT '',
  assigned_type public.compliance_assigned_type NOT NULL DEFAULT 'employee',
  comp_status public.compliance_status NOT NULL DEFAULT 'compliant',
  expiry_date TEXT NOT NULL DEFAULT '',
  days_until_expiry INTEGER NOT NULL DEFAULT 0,
  issued_by TEXT NOT NULL DEFAULT '',
  document_ref TEXT NOT NULL DEFAULT '',
  last_reviewed TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  file_type TEXT NOT NULL DEFAULT 'PDF',
  file_size TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT '',
  upload_date TEXT NOT NULL DEFAULT '',
  access_level TEXT NOT NULL DEFAULT 'All Staff',
  tags TEXT[] NOT NULL DEFAULT '{}',
  file_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Incidents
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  severity public.incident_severity NOT NULL DEFAULT 'medium',
  inc_status public.incident_status NOT NULL DEFAULT 'open',
  inc_type public.incident_type NOT NULL DEFAULT 'near-miss',
  site TEXT NOT NULL DEFAULT '',
  reported_by TEXT NOT NULL DEFAULT '',
  reported_date TEXT NOT NULL DEFAULT '',
  resolved_date TEXT,
  assigned_to TEXT NOT NULL DEFAULT '',
  actions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inventory
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  category public.inventory_category NOT NULL DEFAULT 'consumables',
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  max_stock INTEGER NOT NULL DEFAULT 100,
  unit TEXT NOT NULL DEFAULT 'units',
  unit_cost TEXT NOT NULL DEFAULT '',
  total_value TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  last_restocked TEXT NOT NULL DEFAULT '',
  inv_status public.inventory_status NOT NULL DEFAULT 'in-stock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT 2020,
  rego TEXT NOT NULL UNIQUE,
  vehicle_type public.vehicle_type NOT NULL DEFAULT 'van',
  vehicle_status public.vehicle_status NOT NULL DEFAULT 'active',
  assigned_to TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  odometer TEXT NOT NULL DEFAULT '',
  fuel_type public.fuel_type NOT NULL DEFAULT 'diesel',
  rego_expiry TEXT NOT NULL DEFAULT '',
  insurance_expiry TEXT NOT NULL DEFAULT '',
  next_service TEXT NOT NULL DEFAULT '',
  last_service TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#2563EB',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Companies
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_type public.company_type NOT NULL DEFAULT 'client',
  industry TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  contacts INTEGER NOT NULL DEFAULT 0,
  active_jobs INTEGER NOT NULL DEFAULT 0,
  revenue TEXT NOT NULL DEFAULT '',
  comp_status public.company_status NOT NULL DEFAULT 'active',
  since TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  notif_type public.notification_type NOT NULL DEFAULT 'info',
  category public.notification_category NOT NULL DEFAULT 'system',
  timestamp_label TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  action_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'CleanPro Services Pty Ltd',
  abn TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
  currency TEXT NOT NULL DEFAULT 'AUD',
  notif_email_compliance BOOLEAN NOT NULL DEFAULT true,
  notif_email_jobs BOOLEAN NOT NULL DEFAULT true,
  notif_email_incidents BOOLEAN NOT NULL DEFAULT true,
  notif_email_reports BOOLEAN NOT NULL DEFAULT false,
  notif_push_compliance BOOLEAN NOT NULL DEFAULT true,
  notif_push_jobs BOOLEAN NOT NULL DEFAULT false,
  notif_push_incidents BOOLEAN NOT NULL DEFAULT true,
  notif_sms_incidents BOOLEAN NOT NULL DEFAULT true,
  security_two_factor BOOLEAN NOT NULL DEFAULT true,
  security_session_timeout TEXT NOT NULL DEFAULT '8h',
  security_ip_whitelist BOOLEAN NOT NULL DEFAULT false,
  security_audit_log BOOLEAN NOT NULL DEFAULT true,
  security_password_policy TEXT NOT NULL DEFAULT 'strong',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(client_status);
CREATE INDEX IF NOT EXISTS idx_sites_status ON public.sites(site_status);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(emp_status);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON public.compliance_items(comp_status);
CREATE INDEX IF NOT EXISTS idx_compliance_category ON public.compliance_items(category);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(inc_status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incidents(severity);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON public.inventory(inv_status);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory(category);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(vehicle_status);
CREATE INDEX IF NOT EXISTS idx_companies_type ON public.companies(company_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(category);

-- 4. ENABLE RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES (open access)
DROP POLICY IF EXISTS "open_access_clients" ON public.clients;
CREATE POLICY "open_access_clients" ON public.clients FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_sites" ON public.sites;
CREATE POLICY "open_access_sites" ON public.sites FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_employees" ON public.employees;
CREATE POLICY "open_access_employees" ON public.employees FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_compliance_items" ON public.compliance_items;
CREATE POLICY "open_access_compliance_items" ON public.compliance_items FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_documents" ON public.documents;
CREATE POLICY "open_access_documents" ON public.documents FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_incidents" ON public.incidents;
CREATE POLICY "open_access_incidents" ON public.incidents FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_inventory" ON public.inventory;
CREATE POLICY "open_access_inventory" ON public.inventory FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_vehicles" ON public.vehicles;
CREATE POLICY "open_access_vehicles" ON public.vehicles FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_companies" ON public.companies;
CREATE POLICY "open_access_companies" ON public.companies FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_notifications" ON public.notifications;
CREATE POLICY "open_access_notifications" ON public.notifications FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_settings" ON public.settings;
CREATE POLICY "open_access_settings" ON public.settings FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. MOCK DATA
DO $$
BEGIN
  -- Clients
  INSERT INTO public.clients (id, name, contact_name, contact_role, industry, location, phone, email, active_contracts, total_jobs, monthly_value, total_revenue, client_status, rating, since, next_service, logo)
  VALUES
    (gen_random_uuid(), 'Westfield Shopping Centre', 'Sarah Mitchell', 'Facilities Manager', 'Retail', 'Sydney, NSW', '+61 2 9876 5432', 'sarah.m@westfield.com.au', 3, 148, '$8,400', '$48,200', 'active', 5, 'Jan 2022', 'Tomorrow, 7:00 AM', 'WS'),
    (gen_random_uuid(), 'Harbor View Towers', 'James Chen', 'Building Manager', 'Commercial RE', 'Melbourne, VIC', '+61 3 9123 4567', 'j.chen@harborview.com.au', 2, 96, '$5,200', '$31,500', 'active', 4, 'Mar 2022', 'Today, 2:00 PM', 'HV'),
    (gen_random_uuid(), 'TechPark Business Hub', 'Lisa Park', 'Operations Director', 'Technology', 'Brisbane, QLD', '+61 7 3456 7890', 'l.park@techpark.com.au', 1, 52, '$3,300', '$19,800', 'active', 4, 'Jun 2023', 'Mon, 8:00 AM', 'TP'),
    (gen_random_uuid(), 'Crown Casino Complex', 'David Walsh', 'Head of Facilities', 'Entertainment', 'Melbourne, VIC', '+61 3 9292 8888', 'd.walsh@crown.com.au', 4, 210, '$11,200', '$67,300', 'active', 5, 'Oct 2021', 'Today, 6:00 AM', 'CC'),
    (gen_random_uuid(), 'Riverside Medical Centre', 'Dr. Emma Torres', 'Admin Director', 'Healthcare', 'Adelaide, SA', '+61 8 8345 6789', 'e.torres@riverside.com.au', 2, 74, '$3,700', '$22,100', 'active', 4, 'Aug 2023', 'Wed, 9:00 AM', 'RM'),
    (gen_random_uuid(), 'Metro Office Complex', 'Tom Bradley', 'Property Manager', 'Commercial RE', 'Perth, WA', '+61 8 9234 5678', 't.bradley@metro.com.au', 1, 18, '$2,400', '$14,200', 'at-risk', 3, 'Nov 2024', 'Fri, 10:00 AM', 'MO')
  ON CONFLICT (id) DO NOTHING;

  -- Sites
  INSERT INTO public.sites (id, name, client, address, suburb, state, site_type, area, floors, active_jobs, last_service, next_service, site_status, assigned_team, access_notes, frequency, logo)
  VALUES
    (gen_random_uuid(), 'Crown Casino – Main Floor', 'Crown Casino Complex', '8 Whiteman St', 'Southbank', 'VIC', 'Entertainment', '12,400 m²', 3, 4, 'Today 6:00 AM', 'Tomorrow 6:00 AM', 'active', ARRAY['MJ','PS','TN'], 'Security badge required. Contact David Walsh on arrival.', 'Daily', 'CC'),
    (gen_random_uuid(), 'Westfield – Food Court', 'Westfield Shopping Centre', '188 Pitt St', 'Sydney CBD', 'NSW', 'Retail', '3,200 m²', 1, 2, 'Yesterday 11:00 PM', 'Today 2:00 PM', 'active', ARRAY['PS','ER'], 'After-hours access via loading dock B.', 'Daily', 'WS'),
    (gen_random_uuid(), 'Harbor View – Exterior', 'Harbor View Towers', '1 Harbour St', 'Docklands', 'VIC', 'Commercial RE', '8,600 m²', 32, 1, '2 days ago', 'Overdue', 'active', ARRAY['TN'], 'Rope access permit required. Notify building manager 24h prior.', 'Monthly', 'HV'),
    (gen_random_uuid(), 'Riverside Medical – Ward B', 'Riverside Medical Centre', '120 Greenhill Rd', 'Unley', 'SA', 'Healthcare', '1,800 m²', 1, 2, 'Today 8:00 AM', 'Tomorrow 8:00 AM', 'active', ARRAY['SW'], 'Medical-grade PPE mandatory. No entry during patient rounds.', 'Daily', 'RM'),
    (gen_random_uuid(), 'TechPark – Level 2', 'TechPark Business Hub', '45 Innovation Dr', 'Fortitude Valley', 'QLD', 'Technology', '2,100 m²', 1, 1, '3 days ago', 'Mon 28 Jul', 'active', ARRAY['JO'], 'Keycard access. Park in visitor bay 3.', 'Weekly', 'TP'),
    (gen_random_uuid(), 'Metro Office – Warehouse', 'Metro Office Complex', '77 Stirling Hwy', 'Nedlands', 'WA', 'Industrial', '5,400 m²', 1, 0, 'Yesterday 4:00 PM', 'Fri 1 Aug', 'on-hold', ARRAY['AP'], 'Forklift operating hours 7am–5pm. Coordinate with warehouse manager.', 'Fortnightly', 'MO')
  ON CONFLICT (id) DO NOTHING;

  -- Employees
  INSERT INTO public.employees (id, name, role, department, phone, email, location, emp_status, employment_type, start_date, salary, hours_this_week, jobs_completed, rating, initials, color, skills)
  VALUES
    (gen_random_uuid(), 'Jessica Thompson', 'Operations Manager', 'Management', '+61 412 111 001', 'jessica@cleanpro.com.au', 'Sydney, NSW', 'active', 'full-time', 'Jan 2020', '$95,000', 40, 0, 4.9, 'JT', '#2563EB', ARRAY['Leadership','Scheduling','Compliance']),
    (gen_random_uuid(), 'Ryan Carter', 'Field Supervisor', 'Field Operations', '+61 412 111 002', 'r.carter@cleanpro.com.au', 'Sydney, NSW', 'active', 'full-time', 'Mar 2021', '$72,000', 38, 142, 4.7, 'RC', '#10B981', ARRAY['Supervision','Training','Safety']),
    (gen_random_uuid(), 'Mia Nguyen', 'HR Coordinator', 'Human Resources', '+61 412 111 003', 'm.nguyen@cleanpro.com.au', 'Melbourne, VIC', 'active', 'full-time', 'Jun 2021', '$68,000', 40, 0, 4.8, 'MN', '#8B5CF6', ARRAY['Recruitment','Onboarding','Payroll']),
    (gen_random_uuid(), 'Daniel Park', 'Senior Cleaner', 'Field Operations', '+61 412 111 004', 'd.park@cleanpro.com.au', 'Brisbane, QLD', 'active', 'full-time', 'Sep 2021', '$58,000', 36, 287, 4.6, 'DP', '#F59E0B', ARRAY['Commercial','High-Rise','Medical']),
    (gen_random_uuid(), 'Sophie Walsh', 'Compliance Officer', 'Compliance', '+61 412 111 005', 's.walsh@cleanpro.com.au', 'Sydney, NSW', 'active', 'full-time', 'Feb 2022', '$74,000', 40, 0, 4.9, 'SW', '#EF4444', ARRAY['WHS','Auditing','Documentation']),
    (gen_random_uuid(), 'Liam O''Connor', 'Cleaner', 'Field Operations', '+61 412 111 006', 'l.oconnor@cleanpro.com.au', 'Perth, WA', 'on-leave', 'part-time', 'Apr 2023', '$42,000', 0, 98, 4.3, 'LO', '#06B6D4', ARRAY['Residential','End-of-Lease']),
    (gen_random_uuid(), 'Chloe Adams', 'Scheduler', 'Operations', '+61 412 111 007', 'c.adams@cleanpro.com.au', 'Sydney, NSW', 'active', 'full-time', 'Jul 2023', '$62,000', 40, 0, 4.5, 'CA', '#84CC16', ARRAY['Scheduling','Client Relations','Reporting']),
    (gen_random_uuid(), 'Noah Singh', 'Cleaner', 'Field Operations', '+61 412 111 008', 'n.singh@cleanpro.com.au', 'Adelaide, SA', 'active', 'casual', 'Oct 2023', '$28/hr', 24, 54, 4.4, 'NS', '#F97316', ARRAY['Industrial','Warehouse'])
  ON CONFLICT (id) DO NOTHING;

  -- Compliance items
  INSERT INTO public.compliance_items (id, title, category, assigned_to, assigned_type, comp_status, expiry_date, days_until_expiry, issued_by, document_ref, last_reviewed)
  VALUES
    (gen_random_uuid(), 'Public Liability Insurance', 'insurance', 'CleanPro Services', 'company', 'compliant', '01 Jan 2027', 160, 'Allianz Australia', 'POL-2024-001', '15 Jan 2025'),
    (gen_random_uuid(), 'Workers Compensation Insurance', 'insurance', 'CleanPro Services', 'company', 'compliant', '01 Jan 2027', 160, 'icare NSW', 'WC-2024-002', '15 Jan 2025'),
    (gen_random_uuid(), 'WHS Management System Certification', 'whs', 'CleanPro Services', 'company', 'compliant', '30 Jun 2026', 340, 'SAI Global', 'WHS-CERT-001', '10 Feb 2025'),
    (gen_random_uuid(), 'Cleaning Industry License — NSW', 'license', 'Marcus Johnson', 'contractor', 'compliant', '15 Mar 2027', 233, 'NSW Fair Trading', 'LIC-NSW-0412', '01 Mar 2025'),
    (gen_random_uuid(), 'Working at Heights Certificate', 'certification', 'Tom Nguyen', 'contractor', 'expiring', '08 Aug 2025', 14, 'SafeWork NSW', 'WAH-2023-TN', '08 Aug 2023'),
    (gen_random_uuid(), 'Confined Space Entry Permit', 'certification', 'Emma Rodriguez', 'contractor', 'expired', '01 Jan 2025', -205, 'SafeWork WA', 'CSE-2022-ER', '01 Jan 2023'),
    (gen_random_uuid(), 'First Aid Certificate', 'certification', 'Ryan Carter', 'employee', 'expiring', '20 Sep 2025', 57, 'St John Ambulance', 'FA-2022-RC', '20 Sep 2022'),
    (gen_random_uuid(), 'Site Induction — Crown Casino', 'induction', 'Sarah Williams', 'contractor', 'compliant', '30 Nov 2026', 493, 'Crown Resorts', 'IND-CC-SW', '30 Nov 2024'),
    (gen_random_uuid(), 'Chemical Handling Certificate', 'certification', 'Priya Sharma', 'contractor', 'compliant', '22 Jun 2026', 332, 'TAFE NSW', 'CHEM-2024-PS', '22 Jun 2024'),
    (gen_random_uuid(), 'Privacy Act Compliance Training', 'whs', 'Jessica Thompson', 'employee', 'pending', '31 Dec 2025', 159, 'Internal', 'PRIV-2025-JT', 'Not completed')
  ON CONFLICT (id) DO NOTHING;

  -- Documents
  INSERT INTO public.documents (id, name, category, file_type, file_size, uploaded_by, upload_date, access_level, tags, file_url)
  VALUES
    (gen_random_uuid(), 'WHS Management Plan 2025', 'Safety', 'PDF', '2.4 MB', 'Sophie Walsh', '15 Jan 2025', 'All Staff', ARRAY['WHS','Safety','Policy'], ''),
    (gen_random_uuid(), 'Crown Casino Site Procedures', 'Site Information', 'PDF', '1.1 MB', 'Jessica Thompson', '01 Feb 2025', 'Field Staff', ARRAY['Crown','Procedures','Site'], ''),
    (gen_random_uuid(), 'Chemical Handling SDS — Floor Cleaner', 'Safety', 'PDF', '340 KB', 'Sophie Walsh', '10 Mar 2025', 'All Staff', ARRAY['SDS','Chemicals','Safety'], ''),
    (gen_random_uuid(), 'Employee Handbook 2025', 'HR', 'PDF', '3.2 MB', 'Mia Nguyen', '01 Jan 2025', 'All Staff', ARRAY['HR','Policy','Onboarding'], ''),
    (gen_random_uuid(), 'Westfield Contract Agreement', 'Contracts', 'PDF', '890 KB', 'Jessica Thompson', '15 Jan 2022', 'Management', ARRAY['Contract','Westfield','Legal'], ''),
    (gen_random_uuid(), 'Vehicle Fleet Policy', 'Operations', 'PDF', '560 KB', 'Ryan Carter', '01 Mar 2025', 'All Staff', ARRAY['Vehicles','Fleet','Policy'], '')
  ON CONFLICT (id) DO NOTHING;

  -- Incidents
  INSERT INTO public.incidents (id, title, description, severity, inc_status, inc_type, site, reported_by, reported_date, resolved_date, assigned_to, actions)
  VALUES
    (gen_random_uuid(), 'Slip and Fall — Wet Floor', 'Contractor slipped on wet floor in lobby area. Minor bruising to left knee. Area was not adequately signed.', 'high', 'investigating', 'injury', 'Westfield Shopping Centre', 'Marcus Johnson', '22 Jul 2025', NULL, 'Sophie Walsh', ARRAY['Medical assessment completed','Incident report filed','Wet floor signs ordered']),
    (gen_random_uuid(), 'Chemical Spill — Cleaning Agent', 'Small spill of industrial cleaning agent in storage room. Contained immediately. No injuries.', 'medium', 'resolved', 'environmental', 'Crown Casino Complex', 'Sarah Williams', '18 Jul 2025', '19 Jul 2025', 'Ryan Carter', ARRAY['Area contained and cleaned','SDS reviewed','Staff retrained on chemical handling']),
    (gen_random_uuid(), 'Near Miss — Falling Object', 'Cleaning equipment fell from elevated platform. No one was in the area at the time.', 'high', 'open', 'near-miss', 'Harbor View Towers', 'Tom Nguyen', '20 Jul 2025', NULL, 'Sophie Walsh', ARRAY['Area cordoned off','Equipment inspection scheduled']),
    (gen_random_uuid(), 'Vehicle Damage — Car Park Incident', 'Company vehicle sustained minor damage to rear bumper while reversing in client car park.', 'low', 'closed', 'property', 'TechPark Business Hub', 'Liam O''Connor', '10 Jul 2025', '12 Jul 2025', 'Jessica Thompson', ARRAY['Insurance claim lodged','Vehicle repaired','Driver counselled on reversing procedures']),
    (gen_random_uuid(), 'Unauthorised Access — Restricted Area', 'Contractor found in restricted server room without authorisation. Access badge malfunction suspected.', 'critical', 'investigating', 'security', 'Riverside Medical Centre', 'Chloe Adams', '23 Jul 2025', NULL, 'Jessica Thompson', ARRAY['Contractor suspended pending investigation','Client notified','Access logs reviewed']),
    (gen_random_uuid(), 'Minor Cut — Broken Glass', 'Contractor sustained minor cut to hand while handling broken glass during cleaning. First aid administered on site.', 'low', 'closed', 'injury', 'Metro Office Complex', 'Noah Singh', '05 Jul 2025', '05 Jul 2025', 'Ryan Carter', ARRAY['First aid administered','Incident documented','Glove policy reinforced'])
  ON CONFLICT (id) DO NOTHING;

  -- Inventory
  INSERT INTO public.inventory (id, name, sku, category, current_stock, min_stock, max_stock, unit, unit_cost, total_value, supplier, location, last_restocked, inv_status)
  VALUES
    (gen_random_uuid(), 'Industrial Floor Cleaner (5L)', 'CHEM-001', 'chemicals', 48, 20, 100, 'bottles', '$12.50', '$600', 'CleanChem Australia', 'Warehouse A', '15 Jul 2025', 'in-stock'),
    (gen_random_uuid(), 'Microfibre Cloths (Pack 10)', 'CONS-001', 'consumables', 12, 30, 150, 'packs', '$8.00', '$96', 'Cleaning Supplies Co.', 'Warehouse A', '01 Jul 2025', 'low-stock'),
    (gen_random_uuid(), 'Commercial Vacuum Cleaner', 'EQUIP-001', 'equipment', 8, 5, 20, 'units', '$450.00', '$3,600', 'Nilfisk Australia', 'Warehouse B', '01 Mar 2025', 'in-stock'),
    (gen_random_uuid(), 'Disposable Gloves (Box 100)', 'PPE-001', 'ppe', 0, 50, 200, 'boxes', '$15.00', '$0', 'SafetyFirst Supplies', 'Warehouse A', '20 Jun 2025', 'out-of-stock'),
    (gen_random_uuid(), 'Mop Heads (Pack 5)', 'CONS-002', 'consumables', 25, 20, 80, 'packs', '$22.00', '$550', 'Cleaning Supplies Co.', 'Warehouse A', '10 Jul 2025', 'in-stock'),
    (gen_random_uuid(), 'Safety Goggles', 'PPE-002', 'ppe', 6, 15, 50, 'units', '$18.00', '$108', 'SafetyFirst Supplies', 'Warehouse B', '01 Jun 2025', 'low-stock'),
    (gen_random_uuid(), 'Pressure Washer', 'EQUIP-002', 'equipment', 3, 2, 8, 'units', '$1,200.00', '$3,600', 'Karcher Australia', 'Warehouse B', '01 Jan 2025', 'in-stock'),
    (gen_random_uuid(), 'Bin Liners 240L (Roll 25)', 'CONS-003', 'consumables', 40, 30, 120, 'rolls', '$9.50', '$380', 'Packaging Direct', 'Warehouse A', '20 Jul 2025', 'in-stock'),
    (gen_random_uuid(), 'Squeegee Set', 'TOOLS-001', 'tools', 14, 10, 40, 'sets', '$35.00', '$490', 'Unger Australia', 'Warehouse A', '15 Jun 2025', 'in-stock'),
    (gen_random_uuid(), 'Disinfectant Spray (750ml)', 'CHEM-002', 'chemicals', 8, 25, 100, 'bottles', '$6.00', '$48', 'CleanChem Australia', 'Warehouse A', '01 Jul 2025', 'low-stock')
  ON CONFLICT (sku) DO NOTHING;

  -- Vehicles
  INSERT INTO public.vehicles (id, make, model, year, rego, vehicle_type, vehicle_status, assigned_to, location, odometer, fuel_type, rego_expiry, insurance_expiry, next_service, last_service, color, notes)
  VALUES
    (gen_random_uuid(), 'Toyota', 'HiAce Van', 2022, 'ABC 123', 'van', 'active', 'Marcus Johnson', 'Sydney, NSW', '42,300 km', 'diesel', '31 Mar 2026', '01 Jan 2027', '50,000 km', '01 Apr 2025', '#2563EB', 'Primary vehicle for CBD routes'),
    (gen_random_uuid(), 'Ford', 'Transit Van', 2021, 'DEF 456', 'van', 'active', 'Priya Sharma', 'Sydney, NSW', '68,100 km', 'diesel', '30 Jun 2025', '01 Jan 2027', '70,000 km', '15 Feb 2025', '#10B981', 'Team leader vehicle'),
    (gen_random_uuid(), 'Isuzu', 'D-Max Ute', 2023, 'GHI 789', 'ute', 'maintenance', 'Unassigned', 'Workshop — Sydney', '28,500 km', 'diesel', '28 Feb 2026', '01 Jan 2027', '30,000 km', '20 Jul 2025', '#F59E0B', 'Scheduled service — brake inspection'),
    (gen_random_uuid(), 'Mercedes', 'Sprinter', 2020, 'JKL 012', 'van', 'active', 'Ryan Carter', 'Melbourne, VIC', '91,200 km', 'diesel', '31 Oct 2025', '01 Jan 2027', '100,000 km', '01 Jun 2025', '#8B5CF6', 'Melbourne operations vehicle'),
    (gen_random_uuid(), 'Toyota', 'Camry', 2022, 'MNO 345', 'car', 'active', 'Jessica Thompson', 'Sydney, NSW', '31,800 km', 'petrol', '30 Sep 2025', '01 Jan 2027', '40,000 km', '15 Mar 2025', '#06B6D4', 'Management vehicle'),
    (gen_random_uuid(), 'Hyundai', 'iLoad Van', 2019, 'PQR 678', 'van', 'out-of-service', 'Unassigned', 'Impound — Brisbane', '118,400 km', 'petrol', '31 Jan 2025', '01 Jan 2025', 'Overdue', '01 Jan 2024', '#EF4444', 'Rego expired — pending disposal decision'),
    (gen_random_uuid(), 'Nissan', 'NV200 Van', 2023, 'STU 901', 'van', 'active', 'Daniel Park', 'Brisbane, QLD', '19,600 km', 'electric', '31 Aug 2026', '01 Jan 2027', '25,000 km', '01 May 2025', '#84CC16', 'EV fleet addition — Brisbane')
  ON CONFLICT (rego) DO NOTHING;

  -- Companies
  INSERT INTO public.companies (id, name, company_type, industry, location, phone, email, contacts, active_jobs, revenue, comp_status, since, logo)
  VALUES
    (gen_random_uuid(), 'Westfield Shopping Centre', 'client', 'Retail', 'Sydney, NSW', '+61 2 9876 5432', 'ops@westfield.com.au', 4, 12, '$48,200', 'active', 'Jan 2022', 'WS'),
    (gen_random_uuid(), 'Harbor View Towers', 'client', 'Commercial Real Estate', 'Melbourne, VIC', '+61 3 9123 4567', 'facilities@harborview.com.au', 2, 8, '$31,500', 'active', 'Mar 2022', 'HV'),
    (gen_random_uuid(), 'TechPark Business Hub', 'client', 'Technology', 'Brisbane, QLD', '+61 7 3456 7890', 'admin@techpark.com.au', 3, 5, '$19,800', 'active', 'Jun 2023', 'TP'),
    (gen_random_uuid(), 'GreenClean Supplies Co.', 'partner', 'Supplies', 'Sydney, NSW', '+61 2 8765 4321', 'orders@greenclean.com.au', 1, 0, '$8,400', 'active', 'Feb 2023', 'GC'),
    (gen_random_uuid(), 'Metro Office Complex', 'client', 'Commercial Real Estate', 'Perth, WA', '+61 8 9234 5678', 'building@metro.com.au', 2, 3, '$14,200', 'pending', 'Nov 2024', 'MO'),
    (gen_random_uuid(), 'Riverside Medical Centre', 'client', 'Healthcare', 'Adelaide, SA', '+61 8 8345 6789', 'admin@riverside.com.au', 3, 6, '$22,100', 'active', 'Aug 2023', 'RM'),
    (gen_random_uuid(), 'Apex Facility Services', 'contractor', 'Facilities', 'Sydney, NSW', '+61 2 9111 2222', 'info@apexfacility.com.au', 2, 4, '$0', 'inactive', 'May 2021', 'AF'),
    (gen_random_uuid(), 'Crown Casino Complex', 'client', 'Entertainment', 'Melbourne, VIC', '+61 3 9292 8888', 'ops@crown.com.au', 5, 18, '$67,300', 'active', 'Oct 2021', 'CC')
  ON CONFLICT (id) DO NOTHING;

  -- Notifications
  INSERT INTO public.notifications (id, title, message, notif_type, category, timestamp_label, is_read, action_label)
  VALUES
    (gen_random_uuid(), 'Compliance Item Expired', 'Emma Rodriguez''s Confined Space Entry Permit expired on 01 Jan 2025. Immediate renewal required before next site assignment.', 'alert', 'compliance', '2 minutes ago', false, 'View Compliance'),
    (gen_random_uuid(), 'Incident Reported', 'A new critical incident has been reported at Riverside Medical Centre. Unauthorised access to restricted area. Assigned to Jessica Thompson.', 'alert', 'incidents', '18 minutes ago', false, 'View Incident'),
    (gen_random_uuid(), 'Job Completed', 'Marcus Johnson completed Job #JOB-2847 at Westfield Shopping Centre. Duration: 3.5 hours. Client rating: 5 stars.', 'success', 'jobs', '1 hour ago', false, 'View Job'),
    (gen_random_uuid(), 'Contractor Certification Expiring', 'Tom Nguyen''s Working at Heights Certificate expires in 14 days (08 Aug 2025). Schedule renewal to maintain compliance.', 'warning', 'compliance', '2 hours ago', false, 'View Compliance'),
    (gen_random_uuid(), 'New Job Assigned', 'Job #JOB-2851 has been assigned to Priya Sharma at Crown Casino Complex. Scheduled for tomorrow at 6:00 AM.', 'info', 'jobs', '3 hours ago', true, NULL),
    (gen_random_uuid(), 'Inventory Low Stock Alert', 'Microfibre Cloths (Pack 10) stock is below minimum level. Current: 12 packs. Minimum: 30 packs. Reorder recommended.', 'warning', 'system', '4 hours ago', true, 'View Inventory'),
    (gen_random_uuid(), 'Vehicle Service Due', 'Ford Transit Van (DEF 456) is approaching its scheduled service at 70,000 km. Current odometer: 68,100 km.', 'info', 'system', '6 hours ago', true, 'View Vehicles'),
    (gen_random_uuid(), 'New Contractor Onboarded', 'Aisha Patel has completed onboarding and is now active in the system. Skills: Residential, Commercial.', 'success', 'workforce', 'Yesterday', true, NULL),
    (gen_random_uuid(), 'Weekly Report Ready', 'Your weekly operations summary for 14–20 Jul 2025 is ready to download. 174 jobs completed, 94.1% completion rate.', 'info', 'system', 'Yesterday', true, 'View Reports'),
    (gen_random_uuid(), 'Client Contract Renewed', 'Westfield Shopping Centre contract has been renewed for 12 months. New contract value: $100,800 per annum.', 'success', 'jobs', '2 days ago', true, NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Settings (single row)
  INSERT INTO public.settings (id, company_name, abn, email, phone, address, website, timezone, currency)
  VALUES
    (gen_random_uuid(), 'CleanPro Services Pty Ltd', '12 345 678 901', 'admin@cleanpro.com.au', '+61 2 9876 5432', '100 George Street, Sydney NSW 2000', 'www.cleanpro.com.au', 'Australia/Sydney', 'AUD')
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
