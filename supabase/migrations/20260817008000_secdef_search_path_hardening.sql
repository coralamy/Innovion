-- ============================================================================
-- Innovion Team A — SECURITY DEFINER search_path hardening
-- Timestamp: 20260817008000
-- ----------------------------------------------------------------------------
-- DEFECT REMEDIATED (P2 — search-path hijacking of privileged functions):
--
--   Eleven SECURITY DEFINER functions ran without a pinned `search_path`:
--
--     auto_update_compliance_status   create_default_localisation
--     create_notification             create_trial_subscription
--     detect_schedule_conflicts       expire_old_notifications
--     is_account_read_only            notify_on_compliance_change
--     notify_on_incident              notify_on_job_status
--     refresh_compliance_status
--
--   A SECURITY DEFINER function executes with the privileges of its owner
--   (in Supabase, a superuser-equivalent). Without a pinned search_path it
--   resolves unqualified names against the CALLER's search_path. A caller who
--   can create objects in any schema on that path — `public` is writable by
--   design in many Supabase projects, and `pg_temp` always is — can shadow a
--   table, an operator or a function that the body references and have their
--   own definition executed with the owner's privileges.
--
--   `is_account_read_only()` is the sharpest instance: it gates whether an
--   account may write at all, and several of the notify_* functions are
--   TRIGGERS, so the hijack fires on an ordinary INSERT the attacker controls.
--
--   Remediation pins `search_path = public, pg_temp` on every SECURITY DEFINER
--   function in the `public` schema, in place, without altering any body.
--
--   Rather than re-declaring eleven bodies (and risking drift from the
--   definitions the earlier migrations installed), this applies
--   `ALTER FUNCTION ... SET search_path` — which changes only the setting.
-- ============================================================================

DO $$
DECLARE
  fn      record;
  patched text := '';
BEGIN
  FOR fn IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
      fn.proname, fn.args
    );
    patched := patched || fn.proname || ' ';
  END LOOP;

  IF patched = '' THEN
    RAISE NOTICE 'All SECURITY DEFINER functions already pin search_path.';
  ELSE
    RAISE NOTICE 'Pinned search_path on: %', patched;
  END IF;
END $$;

-- ── Regression guard ────────────────────────────────────────────────────────
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) cfg
      WHERE cfg LIKE 'search_path=%'
    );

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION
      'SECURITY DEFINER function(s) without a pinned search_path: %', bad;
  END IF;
END $$;
