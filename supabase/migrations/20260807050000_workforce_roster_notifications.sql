-- ============================================================
-- Migration: 20260807050000_workforce_roster_notifications.sql
-- Workforce Roster enhancements + Notification delivery tracking
-- ============================================================

-- ── 1. Workforce Roster: add shift tracking columns ──────────────────────────

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS shift_start      TIME,
  ADD COLUMN IF NOT EXISTS shift_end        TIME,
  ADD COLUMN IF NOT EXISTS roster_notes     TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS certifications   TEXT[] DEFAULT '{}';

ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS shift_start      TIME,
  ADD COLUMN IF NOT EXISTS shift_end        TIME,
  ADD COLUMN IF NOT EXISTS roster_notes     TEXT,
  ADD COLUMN IF NOT EXISTS preferred_areas  TEXT[] DEFAULT '{}';

-- ── 2. Notifications: add delivery tracking + priority ───────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS priority         TEXT    NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_module    TEXT,
  ADD COLUMN IF NOT EXISTS metadata         JSONB   DEFAULT '{}';

-- ── 3. Notification preferences per user ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  email_enabled   BOOLEAN NOT NULL DEFAULT true,
  push_enabled    BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled  BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_preferences' AND policyname = 'Users manage own notification preferences'
  ) THEN
    CREATE POLICY "Users manage own notification preferences"
      ON public.notification_preferences
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. Roster view: unified employees + contractors ───────────────────────────

CREATE OR REPLACE VIEW public.workforce_roster AS
  SELECT
    e.id,
    e.name,
    e.role,
    e.department,
    'employee'::TEXT                    AS worker_type,
    e.emp_status::TEXT                  AS status,
    e.employment_type::TEXT             AS employment_type,
    e.location,
    e.phone,
    e.email,
    e.hours_this_week,
    e.jobs_completed,
    e.rating,
    e.initials,
    e.color,
    e.skills,
    e.shift_start,
    e.shift_end,
    e.company_id,
    e.created_at
  FROM public.employees e

  UNION ALL

  SELECT
    c.id,
    c.name,
    c.role,
    'Contractors'::TEXT                 AS department,
    'contractor'::TEXT                  AS worker_type,
    c.availability::TEXT                AS status,
    NULL::TEXT                          AS employment_type,
    c.location,
    c.phone,
    c.email,
    COALESCE(c.hours_this_week, 0)      AS hours_this_week,
    c.jobs_completed,
    c.rating,
    c.initials,
    c.color,
    c.skills,
    c.shift_start,
    c.shift_end,
    c.company_id,
    c.created_at
  FROM public.contractors c;

-- ── 5. Performance indexes ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_priority
  ON public.notifications (priority, company_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_expires
  ON public.notifications (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user
  ON public.notification_preferences (user_id);

CREATE INDEX IF NOT EXISTS idx_employees_shift
  ON public.employees (company_id, shift_start, shift_end)
  WHERE shift_start IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contractors_shift
  ON public.contractors (company_id, shift_start, shift_end)
  WHERE shift_start IS NOT NULL;

-- ── 6. Auto-expire old notifications (30 days) ───────────────────────────────

CREATE OR REPLACE FUNCTION public.expire_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < now() - INTERVAL '30 days'
    AND is_read = true;
END;
$$;
