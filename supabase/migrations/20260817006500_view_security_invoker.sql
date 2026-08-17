-- ============================================================================
-- Innovion Team A — Views must not bypass Row Level Security
-- Timestamp: 20260817006500
-- ----------------------------------------------------------------------------
-- DEFECT REMEDIATED (P0 — cross-tenant read of PII and integration state):
--
--   Four views exist in the `public` schema:
--     public.workforce_roster             (employees UNION contractors)
--     public.integration_connection_status(provider connection state)
--     public.xero_connection_health       (Xero connection state)
--     public.sync_health                  (per-tenant sync queue health)
--
--   All four are owned by a superuser role and NONE declared
--   `security_invoker`. A PostgreSQL view without `security_invoker = true`
--   reads its base tables AS THE VIEW OWNER. Row Level Security defined on
--   those base tables is therefore NOT applied to the caller — it is applied
--   (and, for a superuser owner, skipped) for the owner.
--
--   The migrations that created them assert the opposite in comments:
--     20260811000000: "RLS on base tables enforces tenant isolation"
--     20260811000000: "The view inherits RLS from provider_integrations
--                      (company_id isolation). No additional policy needed."
--   That is incorrect, and it is why the defect survived review.
--
--   Empirically demonstrated before this migration: a user with NO membership
--   of the owning tenant read that tenant's row through
--   `integration_connection_status`, while the same user was correctly denied
--   on the base table.
--
--   Exposure by view:
--     workforce_roster              — every tenant's staff and contractor
--                                     names, e-mail addresses, phone numbers,
--                                     locations, skills and ratings (PII)
--     integration_connection_status — every tenant's connected provider,
--                                     external org id and external user e-mail
--     xero_connection_health        — every tenant's Xero connection state
--     sync_health                   — every tenant's queue depth and failures
--
--   `integration_connection_status` and `xero_connection_health` were
--   explicitly `GRANT SELECT ... TO authenticated` by their own migrations, so
--   they were reachable by any signed-in user of any tenant. The other two rely
--   on the project's default privileges for the `public` schema; Supabase
--   grants those to `anon` and `authenticated` by default, so both must be
--   treated as reachable until proven otherwise in the live project.
--
-- REMEDIATION:
--   * `security_invoker = true` on every view, so base-table RLS is evaluated
--     as the calling user.
--   * Explicit privileges: SELECT to `authenticated`, nothing to `anon`.
--   * A guard that fails any future migration adding a view without it.
--
-- REQUIRES PostgreSQL 15 or later (Supabase projects are 15+).
-- ============================================================================

DO $$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, PUBLIC', v.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', v.relname);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v.relname);
    RAISE NOTICE 'security_invoker enabled on view public.%', v.relname;
  END LOOP;
END $$;

-- New views must inherit the same posture rather than the permissive default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- ── Regression guard ────────────────────────────────────────────────────────
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO bad
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'v'
    AND NOT COALESCE(
      (SELECT true FROM unnest(COALESCE(c.reloptions, '{}')) o
        WHERE o IN ('security_invoker=true','security_invoker=on')),
      false);

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION
      'View(s) % bypass Row Level Security: security_invoker is not set.', bad;
  END IF;

  SELECT string_agg(table_name || ':' || privilege_type, ', ') INTO bad
  FROM information_schema.role_table_grants g
  WHERE g.table_schema = 'public'
    AND g.grantee = 'anon'
    AND g.table_name IN (
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v');

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Anonymous role holds privileges on a view: %', bad;
  END IF;
END $$;
