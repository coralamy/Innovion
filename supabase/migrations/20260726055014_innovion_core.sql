-- ============================================================
-- Innovion Core Schema: contractors, jobs, timesheets, checklists
-- ============================================================

-- 1. ENUM TYPES
DROP TYPE IF EXISTS public.contractor_availability CASCADE;
CREATE TYPE public.contractor_availability AS ENUM ('available', 'on-job', 'unavailable', 'leave');

DROP TYPE IF EXISTS public.contractor_compliance CASCADE;
CREATE TYPE public.contractor_compliance AS ENUM ('compliant', 'expiring', 'expired');

DROP TYPE IF EXISTS public.job_status CASCADE;
CREATE TYPE public.job_status AS ENUM ('scheduled', 'in-progress', 'completed', 'cancelled', 'overdue');

DROP TYPE IF EXISTS public.job_priority CASCADE;
CREATE TYPE public.job_priority AS ENUM ('low', 'medium', 'high', 'urgent');

DROP TYPE IF EXISTS public.timeentry_status CASCADE;
CREATE TYPE public.timeentry_status AS ENUM ('active', 'on-break', 'completed');

DROP TYPE IF EXISTS public.checklist_type CASCADE;
CREATE TYPE public.checklist_type AS ENUM ('daily-job', 'site-inspection', 'safety');

DROP TYPE IF EXISTS public.checklist_status CASCADE;
CREATE TYPE public.checklist_status AS ENUM ('pending', 'in-progress', 'completed', 'flagged');

-- 2. CORE TABLES

-- Contractors
CREATE TABLE IF NOT EXISTS public.contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Cleaner',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  skills TEXT[] NOT NULL DEFAULT '{}',
  rating NUMERIC(3,1) NOT NULL DEFAULT 4.5,
  jobs_completed INTEGER NOT NULL DEFAULT 0,
  hours_this_week NUMERIC(5,1) NOT NULL DEFAULT 0,
  availability public.contractor_availability NOT NULL DEFAULT 'available',
  compliance_status public.contractor_compliance NOT NULL DEFAULT 'compliant',
  license_expiry TEXT NOT NULL DEFAULT '',
  insurance_expiry TEXT NOT NULL DEFAULT '',
  joined_date TEXT NOT NULL DEFAULT '',
  initials TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#2563EB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  client TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT '',
  assigned_to TEXT NOT NULL DEFAULT '',
  assigned_color TEXT NOT NULL DEFAULT '#2563EB',
  assigned_initials TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'Regular Clean',
  scheduled_date TEXT NOT NULL DEFAULT '',
  scheduled_time TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  job_status public.job_status NOT NULL DEFAULT 'scheduled',
  priority public.job_priority NOT NULL DEFAULT 'medium',
  value TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time entries
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date TEXT NOT NULL DEFAULT 'Today',
  contractor TEXT NOT NULL DEFAULT '',
  initials TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#2563EB',
  job TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT '',
  clock_in TEXT NOT NULL DEFAULT '',
  clock_out TEXT,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  total_hours NUMERIC(5,2),
  entry_status public.timeentry_status NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklists
CREATE TABLE IF NOT EXISTS public.checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  checklist_type public.checklist_type NOT NULL DEFAULT 'daily-job',
  site TEXT NOT NULL DEFAULT '',
  job TEXT NOT NULL DEFAULT '',
  assigned_to TEXT NOT NULL DEFAULT '',
  initials TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL DEFAULT '#2563EB',
  checklist_date TEXT NOT NULL DEFAULT 'Today',
  checklist_status public.checklist_status NOT NULL DEFAULT 'pending',
  sections JSONB NOT NULL DEFAULT '[]',
  signed_off_by TEXT,
  signed_off_at TEXT,
  signature_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_contractors_availability ON public.contractors(availability);
CREATE INDEX IF NOT EXISTS idx_contractors_compliance ON public.contractors(compliance_status);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON public.jobs(priority);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON public.time_entries(entry_status);
CREATE INDEX IF NOT EXISTS idx_checklists_status ON public.checklists(checklist_status);
CREATE INDEX IF NOT EXISTS idx_checklists_type ON public.checklists(checklist_type);

-- 4. ENABLE RLS
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES (open access for app - no user auth required for these tables)
DROP POLICY IF EXISTS "open_access_contractors" ON public.contractors;
CREATE POLICY "open_access_contractors" ON public.contractors FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_jobs" ON public.jobs;
CREATE POLICY "open_access_jobs" ON public.jobs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_time_entries" ON public.time_entries;
CREATE POLICY "open_access_time_entries" ON public.time_entries FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_access_checklists" ON public.checklists;
CREATE POLICY "open_access_checklists" ON public.checklists FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. MOCK DATA
DO $$
BEGIN
  -- Contractors
  INSERT INTO public.contractors (id, name, role, phone, email, location, skills, rating, jobs_completed, hours_this_week, availability, compliance_status, license_expiry, insurance_expiry, joined_date, initials, color)
  VALUES
    (gen_random_uuid(), 'Marcus Johnson', 'Senior Cleaner', '+61 412 345 678', 'm.johnson@cleanpro.com.au', 'Sydney, NSW', ARRAY['Commercial','High-Rise','Carpet'], 4.9, 312, 38, 'on-job', 'compliant', '15 Mar 2027', '01 Jan 2027', 'Feb 2021', 'MJ', '#2563EB'),
    (gen_random_uuid(), 'Priya Sharma', 'Team Leader', '+61 423 456 789', 'p.sharma@cleanpro.com.au', 'Sydney, NSW', ARRAY['Team Lead','Medical','Industrial'], 4.8, 287, 40, 'available', 'compliant', '22 Jun 2026', '01 Jan 2027', 'May 2021', 'PS', '#8B5CF6'),
    (gen_random_uuid(), 'Tom Nguyen', 'Cleaner', '+61 434 567 890', 't.nguyen@cleanpro.com.au', 'Melbourne, VIC', ARRAY['Residential','End-of-Lease','Windows'], 4.6, 198, 32, 'available', 'expiring', '08 Aug 2025', '15 Sep 2025', 'Sep 2022', 'TN', '#10B981'),
    (gen_random_uuid(), 'Sarah Williams', 'Specialist Cleaner', '+61 445 678 901', 's.williams@cleanpro.com.au', 'Brisbane, QLD', ARRAY['Medical','Biohazard','Sterile'], 5.0, 156, 36, 'on-job', 'compliant', '30 Nov 2026', '01 Jan 2027', 'Jan 2023', 'SW', '#F59E0B'),
    (gen_random_uuid(), 'David Kim', 'Cleaner', '+61 456 789 012', 'd.kim@cleanpro.com.au', 'Sydney, NSW', ARRAY['Commercial','Pressure Wash'], 4.3, 89, 0, 'leave', 'compliant', '12 Apr 2027', '01 Jan 2027', 'Jun 2023', 'DK', '#EF4444'),
    (gen_random_uuid(), 'Emma Rodriguez', 'Team Leader', '+61 467 890 123', 'e.rodriguez@cleanpro.com.au', 'Perth, WA', ARRAY['Team Lead','Commercial','Retail'], 4.7, 224, 40, 'on-job', 'expired', '01 Jan 2025', '01 Jan 2025', 'Mar 2022', 'ER', '#06B6D4'),
    (gen_random_uuid(), 'James O''Brien', 'Cleaner', '+61 478 901 234', 'j.obrien@cleanpro.com.au', 'Adelaide, SA', ARRAY['Industrial','Warehouse'], 4.4, 134, 28, 'available', 'compliant', '20 Oct 2026', '01 Jan 2027', 'Nov 2022', 'JO', '#84CC16'),
    (gen_random_uuid(), 'Aisha Patel', 'Cleaner', '+61 489 012 345', 'a.patel@cleanpro.com.au', 'Melbourne, VIC', ARRAY['Residential','Commercial'], 4.5, 67, 24, 'unavailable', 'compliant', '05 Jul 2027', '01 Jan 2027', 'Apr 2024', 'AP', '#F97316')
  ON CONFLICT (id) DO NOTHING;

  -- Jobs
  INSERT INTO public.jobs (id, job_number, title, client, site, assigned_to, assigned_color, assigned_initials, type, scheduled_date, scheduled_time, duration, job_status, priority, value, notes)
  VALUES
    (gen_random_uuid(), 'JOB-2026-0842', 'Daily Office Clean', 'Crown Casino Complex', 'Crown Casino – Level 3', 'Marcus Johnson', '#2563EB', 'MJ', 'Regular Clean', 'Today', '6:00 AM', '3h', 'in-progress', 'high', '$420', 'Use eco-friendly products only'),
    (gen_random_uuid(), 'JOB-2026-0843', 'Post-Event Deep Clean', 'Westfield Shopping Centre', 'Westfield – Food Court', 'Priya Sharma', '#8B5CF6', 'PS', 'Deep Clean', 'Today', '2:00 PM', '4h', 'scheduled', 'urgent', '$680', 'Post-event cleanup, extra staff may be needed'),
    (gen_random_uuid(), 'JOB-2026-0840', 'Window Cleaning', 'Harbor View Towers', 'Harbor View – Exterior', 'Tom Nguyen', '#10B981', 'TN', 'Specialist', 'Yesterday', '9:00 AM', '5h', 'overdue', 'high', '$850', 'Requires safety harness certification'),
    (gen_random_uuid(), 'JOB-2026-0841', 'Medical Grade Clean', 'Riverside Medical Centre', 'Riverside – Ward B', 'Sarah Williams', '#F59E0B', 'SW', 'Medical', 'Today', '8:00 AM', '2h', 'completed', 'urgent', '$380', 'Sterile protocol required'),
    (gen_random_uuid(), 'JOB-2026-0844', 'Carpet Steam Clean', 'TechPark Business Hub', 'TechPark – Level 2', 'James O''Brien', '#84CC16', 'JO', 'Specialist', 'Tomorrow', '7:00 AM', '6h', 'scheduled', 'medium', '$920', 'Move furniture before cleaning'),
    (gen_random_uuid(), 'JOB-2026-0839', 'Warehouse Floor Clean', 'Metro Office Complex', 'Metro – Warehouse', 'Aisha Patel', '#F97316', 'AP', 'Industrial', 'Yesterday', '4:00 PM', '3h', 'completed', 'low', '$310', ''),
    (gen_random_uuid(), 'JOB-2026-0845', 'End-of-Lease Clean', 'Harbor View Towers', 'Harbor View – Unit 14B', 'Emma Rodriguez', '#06B6D4', 'ER', 'End-of-Lease', 'Mon 28 Jul', '9:00 AM', '8h', 'scheduled', 'high', '$1,200', 'Full bond clean required'),
    (gen_random_uuid(), 'JOB-2026-0838', 'Gym Deep Clean', 'Crown Casino Complex', 'Crown – Fitness Centre', 'David Kim', '#EF4444', 'DK', 'Deep Clean', 'Yesterday', '11:00 PM', '4h', 'cancelled', 'medium', '$560', 'Cancelled by client')
  ON CONFLICT (job_number) DO NOTHING;

  -- Time entries
  INSERT INTO public.time_entries (id, entry_date, contractor, initials, color, job, site, clock_in, clock_out, break_minutes, total_hours, entry_status)
  VALUES
    (gen_random_uuid(), 'Today', 'Priya Sharma', 'PS', '#8B5CF6', 'Medical Centre Sanitisation', 'Westmead Medical Centre', '07:00', '14:30', 30, 7.0, 'completed'),
    (gen_random_uuid(), 'Today', 'Sarah Williams', 'SW', '#F59E0B', 'Office Deep Clean – CBD Tower', 'CBD Tower, Sydney', '08:00', '15:00', 45, 6.25, 'completed'),
    (gen_random_uuid(), 'Yesterday', 'Marcus Johnson', 'MJ', '#2563EB', 'Warehouse Industrial Clean', 'Eastern Creek Logistics', '06:30', '15:00', 30, 8.0, 'completed'),
    (gen_random_uuid(), 'Yesterday', 'Tom Nguyen', 'TN', '#10B981', 'Retail End-of-Lease Clean', 'Westfield Parramatta', '09:00', '16:30', 60, 6.5, 'completed'),
    (gen_random_uuid(), 'Yesterday', 'James O''Brien', 'JO', '#84CC16', 'Residential Move-Out Clean', '14 Harbour St, Pyrmont', '10:00', '14:00', 0, 4.0, 'completed')
  ON CONFLICT (id) DO NOTHING;

  -- Checklists
  INSERT INTO public.checklists (id, title, checklist_type, site, job, assigned_to, initials, avatar_color, checklist_date, checklist_status, sections, signed_off_by, signed_off_at, signature_data)
  VALUES
    (
      gen_random_uuid(),
      'Daily Cleaning Checklist',
      'daily-job',
      'Crown Casino – Main Floor',
      'Office Deep Clean – CBD Tower',
      'Marcus Johnson',
      'MJ',
      '#2563EB',
      'Today',
      'in-progress',
      '[{"id":"s1","title":"Entry & Reception","tasks":[{"id":"t1","label":"Vacuum entrance mats and lobby carpet","completed":true,"required":true,"notes":"","photos":[]},{"id":"t2","label":"Wipe down reception desk and counters","completed":true,"required":true,"notes":"","photos":[]},{"id":"t3","label":"Clean glass entry doors (both sides)","completed":false,"required":true,"notes":"","photos":[]},{"id":"t4","label":"Empty and reline reception bins","completed":false,"required":false,"notes":"","photos":[]}]},{"id":"s2","title":"Restrooms","tasks":[{"id":"t5","label":"Sanitise all toilet bowls and seats","completed":true,"required":true,"notes":"","photos":[]},{"id":"t6","label":"Clean and disinfect sinks and taps","completed":true,"required":true,"notes":"","photos":[]},{"id":"t7","label":"Restock paper towels and soap dispensers","completed":false,"required":true,"notes":"Low on soap – need to reorder","photos":[]},{"id":"t8","label":"Mop restroom floors with disinfectant","completed":false,"required":true,"notes":"","photos":[]}]},{"id":"s3","title":"Common Areas","tasks":[{"id":"t9","label":"Vacuum all carpeted areas","completed":false,"required":true,"notes":"","photos":[]},{"id":"t10","label":"Mop hard floor surfaces","completed":false,"required":true,"notes":"","photos":[]},{"id":"t11","label":"Dust horizontal surfaces and ledges","completed":false,"required":false,"notes":"","photos":[]}]}]',
      NULL, NULL, NULL
    ),
    (
      gen_random_uuid(),
      'Site Safety Inspection',
      'site-inspection',
      'Harbor View – Exterior',
      'Rope Access Window Clean',
      'Tom Nguyen',
      'TN',
      '#10B981',
      'Today',
      'flagged',
      '[{"id":"s4","title":"PPE & Equipment","tasks":[{"id":"t12","label":"Harness inspection – no fraying or damage","completed":true,"required":true,"notes":"","photos":[]},{"id":"t13","label":"Rope condition check – no kinks or wear","completed":true,"required":true,"notes":"","photos":[]},{"id":"t14","label":"Anchor points tested and certified","completed":false,"required":true,"notes":"Anchor point 3 needs re-certification","photos":[]},{"id":"t15","label":"Helmet and eye protection present","completed":true,"required":true,"notes":"","photos":[]}]},{"id":"s5","title":"Site Conditions","tasks":[{"id":"t16","label":"Wind speed below 40 km/h","completed":true,"required":true,"notes":"","photos":[]},{"id":"t17","label":"Exclusion zone barriers in place","completed":false,"required":true,"notes":"Barrier missing on north side","photos":[]},{"id":"t18","label":"Emergency contact list posted on site","completed":true,"required":true,"notes":"","photos":[]}]}]',
      NULL, NULL, NULL
    ),
    (
      gen_random_uuid(),
      'Medical Facility Inspection',
      'site-inspection',
      'Riverside Medical – Ward B',
      'Medical Centre Sanitisation',
      'Sarah Williams',
      'SW',
      '#F59E0B',
      'Yesterday',
      'completed',
      '[{"id":"s6","title":"High-Touch Surfaces","tasks":[{"id":"t19","label":"Disinfect door handles and push plates","completed":true,"required":true,"notes":"","photos":[]},{"id":"t20","label":"Wipe down nurse station surfaces","completed":true,"required":true,"notes":"","photos":[]},{"id":"t21","label":"Clean and sanitise patient bed rails","completed":true,"required":true,"notes":"","photos":[]}]},{"id":"s7","title":"Waste Management","tasks":[{"id":"t22","label":"Clinical waste bins emptied and relined","completed":true,"required":true,"notes":"","photos":[]},{"id":"t23","label":"Sharps containers checked and replaced if full","completed":true,"required":true,"notes":"","photos":[]}]}]',
      'Dr. Karen Mills', 'Yesterday 3:45 PM', 'signed'
    ),
    (
      gen_random_uuid(),
      'Retail Deep Clean Checklist',
      'daily-job',
      'Westfield – Food Court',
      'Retail End-of-Lease Clean',
      'Priya Sharma',
      'PS',
      '#8B5CF6',
      'Tomorrow',
      'pending',
      '[{"id":"s8","title":"Kitchen & Food Prep Areas","tasks":[{"id":"t24","label":"Degrease all cooking surfaces and exhaust hoods","completed":false,"required":true,"notes":"","photos":[]},{"id":"t25","label":"Clean inside all ovens and microwaves","completed":false,"required":true,"notes":"","photos":[]},{"id":"t26","label":"Sanitise food prep benches","completed":false,"required":true,"notes":"","photos":[]}]}]',
      NULL, NULL, NULL
    )
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
