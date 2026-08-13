-- ============================================================
-- Migration: Seed data for new company onboarding
-- Timestamp: 20260728010000
-- ============================================================

-- This migration creates initial subscription record for existing companies
-- and ensures new companies get a trial subscription on signup

-- Function: auto-create trial subscription when a new company is created
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only create if owner_id is set (real company, not test data)
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      company_id,
      plan_name,
      billing_interval,
      sub_status,
      trial_ends_at,
      trial_days,
      max_users,
      max_jobs,
      features
    )
    VALUES (
      NEW.id,
      'starter',
      'monthly',
      'trialing'::public.subscription_status,
      NOW() + INTERVAL '14 days',
      14,
      5,
      100,
      '["Jobs","Scheduling","Checklists","Time Tracking","Compliance","Documents","Incidents"]'::JSONB
    )
    ON CONFLICT (company_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_trial_subscription();

-- Backfill: create trial subscriptions for existing companies that don't have one
DO $$
DECLARE
  co RECORD;
BEGIN
  FOR co IN SELECT id FROM public.companies WHERE owner_id IS NOT NULL LOOP
    INSERT INTO public.subscriptions (
      company_id,
      plan_name,
      billing_interval,
      sub_status,
      trial_ends_at,
      trial_days,
      max_users,
      max_jobs,
      features
    )
    VALUES (
      co.id,
      'starter',
      'monthly',
      'trialing'::public.subscription_status,
      NOW() + INTERVAL '14 days',
      14,
      5,
      100,
      '["Jobs","Scheduling","Checklists","Time Tracking","Compliance","Documents","Incidents"]'::JSONB
    )
    ON CONFLICT (company_id) DO NOTHING;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Subscription backfill failed: %', SQLERRM;
END $$;
