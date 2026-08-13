-- ============================================================
-- Innovion: Enforce RLS, Notifications Triggers, Pending Invites,
--           Compliance Alerts, Conflict Detection
-- ============================================================

-- ============================================================
-- 1. PENDING INVITES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pending_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','manager','supervisor','viewer','contractor')),
  company_id UUID,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_invites_email ON public.pending_invites(email);
CREATE INDEX IF NOT EXISTS idx_pending_invites_company ON public.pending_invites(company_id);

ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pending_invites_company_read" ON public.pending_invites;
CREATE POLICY "pending_invites_company_read" ON public.pending_invites
  FOR SELECT TO authenticated
  USING (company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID);

DROP POLICY IF EXISTS "pending_invites_company_insert" ON public.pending_invites;
CREATE POLICY "pending_invites_company_insert" ON public.pending_invites
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID);

DROP POLICY IF EXISTS "pending_invites_company_update" ON public.pending_invites;
CREATE POLICY "pending_invites_company_update" ON public.pending_invites
  FOR UPDATE TO authenticated
  USING (company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID)
  WITH CHECK (company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID);

-- ============================================================
-- 2. ENFORCE RLS ON ALL CORE TABLES (drop open policies, add scoped ones)
-- ============================================================

-- Helper function: get company_id from JWT metadata
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT NULLIF((auth.jwt() -> 'user_metadata' ->> 'company_id'), '')::UUID;
$$;

-- ---- JOBS ----
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_jobs" ON public.jobs;
DROP POLICY IF EXISTS "jobs_company_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_auth" ON public.jobs;

DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
CREATE POLICY "jobs_select" ON public.jobs
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "jobs_insert" ON public.jobs;
CREATE POLICY "jobs_insert" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "jobs_update" ON public.jobs;
CREATE POLICY "jobs_update" ON public.jobs
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "jobs_delete" ON public.jobs;
CREATE POLICY "jobs_delete" ON public.jobs
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- CONTRACTORS ----
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_contractors" ON public.contractors;
DROP POLICY IF EXISTS "contractors_company_policy" ON public.contractors;
DROP POLICY IF EXISTS "contractors_auth" ON public.contractors;

DROP POLICY IF EXISTS "contractors_select" ON public.contractors;
CREATE POLICY "contractors_select" ON public.contractors
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "contractors_insert" ON public.contractors;
CREATE POLICY "contractors_insert" ON public.contractors
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "contractors_update" ON public.contractors;
CREATE POLICY "contractors_update" ON public.contractors
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "contractors_delete" ON public.contractors;
CREATE POLICY "contractors_delete" ON public.contractors
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- CLIENTS ----
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_clients" ON public.clients;
DROP POLICY IF EXISTS "clients_company_policy" ON public.clients;
DROP POLICY IF EXISTS "clients_auth" ON public.clients;

DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "clients_insert" ON public.clients;
CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "clients_delete" ON public.clients;
CREATE POLICY "clients_delete" ON public.clients
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- SITES ----
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_sites" ON public.sites;
DROP POLICY IF EXISTS "sites_company_policy" ON public.sites;
DROP POLICY IF EXISTS "sites_auth" ON public.sites;

DROP POLICY IF EXISTS "sites_select" ON public.sites;
CREATE POLICY "sites_select" ON public.sites
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "sites_insert" ON public.sites;
CREATE POLICY "sites_insert" ON public.sites
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "sites_update" ON public.sites;
CREATE POLICY "sites_update" ON public.sites
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "sites_delete" ON public.sites;
CREATE POLICY "sites_delete" ON public.sites
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- EMPLOYEES ----
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_employees" ON public.employees;
DROP POLICY IF EXISTS "employees_company_policy" ON public.employees;
DROP POLICY IF EXISTS "employees_auth" ON public.employees;

DROP POLICY IF EXISTS "employees_select" ON public.employees;
CREATE POLICY "employees_select" ON public.employees
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "employees_insert" ON public.employees;
CREATE POLICY "employees_insert" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "employees_update" ON public.employees;
CREATE POLICY "employees_update" ON public.employees
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "employees_delete" ON public.employees;
CREATE POLICY "employees_delete" ON public.employees
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- COMPLIANCE ITEMS ----
ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_compliance_items" ON public.compliance_items;
DROP POLICY IF EXISTS "compliance_items_company_policy" ON public.compliance_items;
DROP POLICY IF EXISTS "compliance_items_auth" ON public.compliance_items;

DROP POLICY IF EXISTS "compliance_items_select" ON public.compliance_items;
CREATE POLICY "compliance_items_select" ON public.compliance_items
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "compliance_items_insert" ON public.compliance_items;
CREATE POLICY "compliance_items_insert" ON public.compliance_items
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "compliance_items_update" ON public.compliance_items;
CREATE POLICY "compliance_items_update" ON public.compliance_items
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "compliance_items_delete" ON public.compliance_items;
CREATE POLICY "compliance_items_delete" ON public.compliance_items
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- INCIDENTS ----
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_incidents" ON public.incidents;
DROP POLICY IF EXISTS "incidents_company_policy" ON public.incidents;
DROP POLICY IF EXISTS "incidents_auth" ON public.incidents;

DROP POLICY IF EXISTS "incidents_select" ON public.incidents;
CREATE POLICY "incidents_select" ON public.incidents
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "incidents_insert" ON public.incidents;
CREATE POLICY "incidents_insert" ON public.incidents
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "incidents_update" ON public.incidents;
CREATE POLICY "incidents_update" ON public.incidents
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "incidents_delete" ON public.incidents;
CREATE POLICY "incidents_delete" ON public.incidents
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- DOCUMENTS ----
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_documents" ON public.documents;
DROP POLICY IF EXISTS "documents_company_policy" ON public.documents;
DROP POLICY IF EXISTS "documents_auth" ON public.documents;

DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "documents_insert" ON public.documents;
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "documents_delete" ON public.documents;
CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- INVENTORY ----
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_inventory" ON public.inventory;
DROP POLICY IF EXISTS "inventory_company_policy" ON public.inventory;
DROP POLICY IF EXISTS "inventory_auth" ON public.inventory;

DROP POLICY IF EXISTS "inventory_select" ON public.inventory;
CREATE POLICY "inventory_select" ON public.inventory
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "inventory_insert" ON public.inventory;
CREATE POLICY "inventory_insert" ON public.inventory
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "inventory_update" ON public.inventory;
CREATE POLICY "inventory_update" ON public.inventory
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "inventory_delete" ON public.inventory;
CREATE POLICY "inventory_delete" ON public.inventory
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- VEHICLES ----
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_company_policy" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_auth" ON public.vehicles;

DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "vehicles_insert" ON public.vehicles;
CREATE POLICY "vehicles_insert" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "vehicles_update" ON public.vehicles;
CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "vehicles_delete" ON public.vehicles;
CREATE POLICY "vehicles_delete" ON public.vehicles
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- NOTIFICATIONS ----
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_company_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_auth" ON public.notifications;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() OR company_id IS NULL);

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

-- ---- SCHEDULED JOBS ----
DROP POLICY IF EXISTS "scheduled_jobs_auth" ON public.scheduled_jobs;

DROP POLICY IF EXISTS "scheduled_jobs_select" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_select" ON public.scheduled_jobs
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "scheduled_jobs_insert" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_insert" ON public.scheduled_jobs
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "scheduled_jobs_update" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_update" ON public.scheduled_jobs
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "scheduled_jobs_delete" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_delete" ON public.scheduled_jobs
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- TIME ENTRIES ----
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_auth" ON public.time_entries;

DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
CREATE POLICY "time_entries_select" ON public.time_entries
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "time_entries_insert" ON public.time_entries;
CREATE POLICY "time_entries_insert" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "time_entries_update" ON public.time_entries;
CREATE POLICY "time_entries_update" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "time_entries_delete" ON public.time_entries;
CREATE POLICY "time_entries_delete" ON public.time_entries
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ---- CHECKLISTS ----
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_access_checklists" ON public.checklists;
DROP POLICY IF EXISTS "checklists_auth" ON public.checklists;

DROP POLICY IF EXISTS "checklists_select" ON public.checklists;
CREATE POLICY "checklists_select" ON public.checklists
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "checklists_insert" ON public.checklists;
CREATE POLICY "checklists_insert" ON public.checklists
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "checklists_update" ON public.checklists;
CREATE POLICY "checklists_update" ON public.checklists
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "checklists_delete" ON public.checklists;
CREATE POLICY "checklists_delete" ON public.checklists
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ============================================================
-- 3. NOTIFICATION TRIGGERS
-- ============================================================

-- Function: create notification helper
CREATE OR REPLACE FUNCTION public.create_notification(
  p_company_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_notif_type TEXT,
  p_category TEXT,
  p_action_label TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  INSERT INTO public.notifications (
    title, message, notif_type, category, timestamp_label,
    is_read, action_label, company_id
  ) VALUES (
    p_title, p_message, p_notif_type, p_category,
    TO_CHAR(NOW(), 'DD Mon YYYY HH24:MI'),
    false, p_action_label, p_company_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'create_notification failed: %', SQLERRM;
END;
$func$;

-- Trigger: new incident → notification
CREATE OR REPLACE FUNCTION public.notify_on_incident()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  PERFORM public.create_notification(
    NEW.company_id,
    'New Incident Reported: ' || NEW.title,
    'Severity: ' || NEW.severity || ' · Site: ' || COALESCE(NEW.site, 'Unknown') || ' · Reported by: ' || COALESCE(NEW.reported_by, 'Unknown'),
    CASE WHEN NEW.severity IN ('critical','high') THEN 'alert' ELSE 'warning' END,
    'incidents',
    'View Incident'
  );
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_notify_incident ON public.incidents;
CREATE TRIGGER trg_notify_incident
  AFTER INSERT ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_incident();

-- Trigger: compliance item expiring/expired → notification
CREATE OR REPLACE FUNCTION public.notify_on_compliance_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  IF NEW.comp_status IN ('expiring', 'expired') AND (OLD IS NULL OR OLD.comp_status != NEW.comp_status) THEN
    PERFORM public.create_notification(
      NEW.company_id,
      CASE WHEN NEW.comp_status = 'expired' THEN 'Compliance Item Expired: ' ELSE 'Compliance Expiring Soon: ' END || NEW.title,
      'Assigned to: ' || COALESCE(NEW.assigned_to, 'Unknown') || ' · Expiry: ' || COALESCE(NEW.expiry_date::TEXT, 'N/A'),
      CASE WHEN NEW.comp_status = 'expired' THEN 'alert' ELSE 'warning' END,
      'compliance',
      'Review Compliance'
    );
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_notify_compliance ON public.compliance_items;
CREATE TRIGGER trg_notify_compliance
  AFTER INSERT OR UPDATE ON public.compliance_items
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_compliance_change();

-- Trigger: job completed → notification
CREATE OR REPLACE FUNCTION public.notify_on_job_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  IF NEW.job_status = 'completed' AND (OLD IS NULL OR OLD.job_status != 'completed') THEN
    PERFORM public.create_notification(
      NEW.company_id,
      'Job Completed: ' || COALESCE(NEW.title, NEW.job_number),
      'Client: ' || COALESCE(NEW.client, 'Unknown') || ' · Site: ' || COALESCE(NEW.site, 'Unknown'),
      'success',
      'jobs',
      'View Job'
    );
  ELSIF NEW.job_status = 'overdue' AND (OLD IS NULL OR OLD.job_status != 'overdue') THEN
    PERFORM public.create_notification(
      NEW.company_id,
      'Job Overdue: ' || COALESCE(NEW.title, NEW.job_number),
      'Client: ' || COALESCE(NEW.client, 'Unknown') || ' · Scheduled: ' || COALESCE(NEW.scheduled_date::TEXT, 'Unknown'),
      'alert',
      'jobs',
      'View Job'
    );
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_notify_job_status ON public.jobs;
CREATE TRIGGER trg_notify_job_status
  AFTER INSERT OR UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_job_status();

-- ============================================================
-- 4. COMPLIANCE EXPIRY AUTO-UPDATE
-- Automatically update days_until_expiry and comp_status based on expiry_date
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_compliance_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  UPDATE public.compliance_items
  SET
    days_until_expiry = GREATEST(0, (expiry_date::DATE - CURRENT_DATE)),
    comp_status = CASE
      WHEN expiry_date::DATE < CURRENT_DATE THEN 'expired'
      WHEN expiry_date::DATE <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
      ELSE 'compliant'
    END,
    updated_at = NOW()
  WHERE expiry_date IS NOT NULL AND expiry_date != '';
END;
$func$;

-- Trigger to auto-update status when expiry_date changes
CREATE OR REPLACE FUNCTION public.auto_update_compliance_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date != '' THEN
    NEW.days_until_expiry := GREATEST(0, (NEW.expiry_date::DATE - CURRENT_DATE));
    NEW.comp_status := CASE
      WHEN NEW.expiry_date::DATE < CURRENT_DATE THEN 'expired'
      WHEN NEW.expiry_date::DATE <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
      ELSE 'compliant'
    END;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_auto_compliance_status ON public.compliance_items;
CREATE TRIGGER trg_auto_compliance_status
  BEFORE INSERT OR UPDATE ON public.compliance_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_compliance_status();

-- ============================================================
-- 5. CONFLICT DETECTION FOR SCHEDULED JOBS
-- ============================================================

CREATE OR REPLACE FUNCTION public.detect_schedule_conflicts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  conflict_count INTEGER;
BEGIN
  -- Check if this contractor has overlapping jobs on the same date
  IF NEW.contractor_id IS NOT NULL THEN
    SELECT COUNT(*) INTO conflict_count
    FROM public.scheduled_jobs
    WHERE
      id != NEW.id
      AND contractor_id = NEW.contractor_id
      AND scheduled_date = NEW.scheduled_date
      AND status NOT IN ('completed', 'cancelled')
      AND (
        -- Overlap check: new job starts during existing job
        (NEW.start_time >= start_time AND NEW.start_time < (start_time + (duration_minutes || ' minutes')::INTERVAL))
        OR
        -- Overlap check: existing job starts during new job
        (start_time >= NEW.start_time AND start_time < (NEW.start_time + (NEW.duration_minutes || ' minutes')::INTERVAL))
      );

    IF conflict_count > 0 THEN
      NEW.has_conflict := true;
      -- Also mark existing conflicting jobs
      UPDATE public.scheduled_jobs
      SET has_conflict = true
      WHERE
        id != NEW.id
        AND contractor_id = NEW.contractor_id
        AND scheduled_date = NEW.scheduled_date
        AND status NOT IN ('completed', 'cancelled')
        AND (
          (NEW.start_time >= start_time AND NEW.start_time < (start_time + (duration_minutes || ' minutes')::INTERVAL))
          OR
          (start_time >= NEW.start_time AND start_time < (NEW.start_time + (NEW.duration_minutes || ' minutes')::INTERVAL))
        );
    ELSE
      NEW.has_conflict := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_detect_conflicts ON public.scheduled_jobs;
CREATE TRIGGER trg_detect_conflicts
  BEFORE INSERT OR UPDATE ON public.scheduled_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_schedule_conflicts();

-- ============================================================
-- 6. INCIDENT PHOTO UPLOADS COLUMN
-- ============================================================
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}';

-- ============================================================
-- 7. ENABLE REALTIME ON NOTIFICATIONS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add notifications to realtime publication: %', SQLERRM;
END $$;
