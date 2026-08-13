-- ============================================================
-- Innovion: Scheduled Jobs, Activity Log, RBAC, Storage
-- ============================================================

-- 1. Scheduled Jobs table (for scheduling module)
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_num TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE SET NULL,
  contractor_name TEXT NOT NULL DEFAULT '',
  contractor_initials TEXT NOT NULL DEFAULT '',
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '09:00',
  duration_minutes INTEGER NOT NULL DEFAULT 120,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in-progress','completed','issue','unassigned')),
  type TEXT NOT NULL DEFAULT 'recurring' CHECK (type IN ('recurring','one-off','emergency','inspection','maintenance')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  region TEXT NOT NULL DEFAULT '',
  has_conflict BOOLEAN NOT NULL DEFAULT false,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  instructions TEXT NOT NULL DEFAULT '',
  company_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Activity Log table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT,
  description TEXT NOT NULL DEFAULT '',
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. User roles table (RBAC)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','manager','supervisor','viewer','contractor')),
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- 4. Companies table (for onboarding)
-- The companies table already exists from a prior migration; we only add missing columns here.
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abn TEXT,
  industry TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  postcode TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  primary_service TEXT NOT NULL DEFAULT '',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure owner_id column exists on companies (table may have been created without it)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ensure other columns exist on companies (added by onboarding flow)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS abn TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS size TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS postcode TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS primary_service TEXT NOT NULL DEFAULT '';

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_company ON public.scheduled_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_date ON public.scheduled_jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_activity_log_company ON public.activity_log(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company ON public.user_roles(company_id);

-- 6. RLS Policies

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Scheduled jobs: authenticated users can read/write their company's jobs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scheduled_jobs' AND policyname = 'scheduled_jobs_auth') THEN
    CREATE POLICY scheduled_jobs_auth ON public.scheduled_jobs
      FOR ALL TO authenticated
      USING (company_id IS NULL OR company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID)
      WITH CHECK (company_id IS NULL OR company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID);
  END IF;
END $$;

-- Activity log: authenticated users can read their company's log, insert their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_log_read') THEN
    CREATE POLICY activity_log_read ON public.activity_log
      FOR SELECT TO authenticated
      USING (company_id IS NULL OR company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_log_insert') THEN
    CREATE POLICY activity_log_insert ON public.activity_log
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- User roles: users can read their own roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'user_roles_read') THEN
    CREATE POLICY user_roles_read ON public.user_roles
      FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'user_roles_write') THEN
    CREATE POLICY user_roles_write ON public.user_roles
      FOR ALL TO authenticated
      USING (company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID)
      WITH CHECK (company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID);
  END IF;
END $$;

-- Companies: owner can manage, members can read
-- Drop the broad company_access_companies policy from prior migration to avoid conflicts
DROP POLICY IF EXISTS "company_access_companies" ON public.companies;
DROP POLICY IF EXISTS "open_access_companies" ON public.companies;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'companies_read') THEN
    CREATE POLICY companies_read ON public.companies
      FOR SELECT TO authenticated
      USING (owner_id = auth.uid() OR id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'companies_insert') THEN
    CREATE POLICY companies_insert ON public.companies
      FOR INSERT TO authenticated
      WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'companies_update') THEN
    CREATE POLICY companies_update ON public.companies
      FOR UPDATE TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;
