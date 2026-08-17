-- ============================================================================
-- Innovion A/B/D Integration — notification_type: geofence_anomaly
-- Timestamp: 20260816120000
-- ----------------------------------------------------------------------------
-- CROSS-TEAM SCHEMA DEPENDENCY (blocks Team B).
--
-- `public.notification_type` is a Team A enum, created by
-- 20260726055014_innovion_core.sql with the values
--     warning | alert | success | info
--
-- Team B's 20260817000001_tenant_authority_hardening.sql adds
-- `public.notify_geofence_anomaly()`, a trigger on public.time_entries that
-- raises a notification when a clock-in falls outside the site geofence, and
-- its 20260817000003_isolation_policy_consolidation.sql adds a RESTRICTIVE
-- policy that keeps those notifications away from the worker they concern:
--
--     CREATE POLICY "notifications_anomaly_manager_only" ON public.notifications
--       AS RESTRICTIVE FOR SELECT TO authenticated
--       USING (notif_type IS DISTINCT FROM 'geofence_anomaly'
--              OR NOT public.is_workforce_only_user())
--
-- Both write and compare the value 'geofence_anomaly', which does not exist in
-- Team A's enum. In Team B's own database the column is permissive; in the
-- integrated database it is Team A's enum, so the comparison raises
--
--     invalid input value for enum notification_type: "geofence_anomaly"
--
-- and — because a migration runs in a single transaction — the WHOLE of Team B's
-- consolidation migration rolls back. That silently reverted 118 other
-- statements in it, including the DROPs of four `anon`-facing policies
-- (checklist_responses_open_access, anon_read_conversations, anon_read_messages,
-- anon_insert_messages). The visible symptom was a Team A guard failure several
-- migrations later; the cause was this missing enum value.
--
-- Team A owns the type, so Team A adds the value. Dated ahead of Team B's
-- migrations so it is present before either of them runs.
--
-- `ALTER TYPE ... ADD VALUE` is committed in its own migration and only used by
-- later migrations, which is the supported ordering — a value added inside a
-- transaction cannot be used in that same transaction.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'notification_type'
      AND e.enumlabel = 'geofence_anomaly'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'geofence_anomaly';
  END IF;
END $$;
