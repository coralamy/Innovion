-- ============================================================================
-- Innovion Team A — Workforce carve-out assertions (end of chain)
-- Timestamp: 20260818000300
-- ----------------------------------------------------------------------------
-- ASSERTION ONLY. This migration creates no object, drops no object and grants
-- no access. It reads pg_policies and raises if a required restriction is
-- absent.
--
-- ── Why this file exists, and why it is separate ────────────────────────────
--
-- Team B reported that guard 3a in their 20260818000200 does not list
-- public.settings — correctly, since settings is a carve-out rather than a
-- denial — and that after policy ownership moved wholly to Team A, nothing
-- asserted the settings restrictions at all.
--
-- Verified, and wider than reported. Four removals were applied to the fully
-- integrated schema, each on its own database, with both existing guards
-- re-run afterwards:
--
--   dropped settings_workforce_{readonly,no_update,no_delete}  → both PASS
--   dropped settings_workforce_no_update alone                 → both PASS
--   dropped compliance_items write denials, kept own_only      → both PASS
--   dropped compliance_items own_only as well                  → Team B 3b aborts
--
-- Team B's premise that "compliance_items is covered separately by guard 3b" is
-- therefore only half true. 3b tests that SOME restrictive policy naming
-- is_workforce_only_user() survives on the table. The own-only SELECT policy
-- satisfies that by itself, so every write denial can be removed and 3b still
-- passes. 3b guards read scoping. It does not guard write denial.
--
-- Same defect class as the platform-authority guard adjudicated on 2026-08-18:
-- an EXISTENCE check standing in for the protection it claims to verify. The
-- ruling there applies here.
--
-- ── Why not simply add the check to 20260818000100 ──────────────────────────
--
-- Because it would not work, and the first attempt at this fix proved it. An
-- assertion at the end of the migration that CREATES the policies cannot detect
-- their removal: re-running that migration recreates them in section 4a/4b
-- before the assertion in section 6 ever runs. The guard heals the very state
-- it is meant to catch.
--
-- 20260818000100 §6e is retained, with a narrower and honest purpose: it
-- catches an editing mistake INSIDE that file — a carve-out block changed to
-- stop creating a policy. That is a real failure mode and Team A's to prevent.
-- It is not, and cannot be, a guard against later removal.
--
-- A guard against later removal has to observe the schema without rebuilding
-- it, which means a separate migration that creates nothing. Hence this file,
-- stamped after Team B's 20260818000200 so it is the last statement in the
-- combined A/B/D chain.
--
-- ── Ownership ───────────────────────────────────────────────────────────────
--
-- Team A. Team B changes nothing.
--
--   * Team A owns the seven carve-out policy definitions, so Team A owns the
--     statement of what they must continue to mean. Only the definer can say
--     that SELECT on settings is deliberately open while INSERT/UPDATE/DELETE
--     are closed — from outside, an absent SELECT restriction is
--     indistinguishable from a lost one.
--   * A Team A invariant must not live solely in a file Team B owns and could
--     legitimately retire. Their 20260818000200 remains valuable as an
--     independent consumer check; it is not the custodian of this.
--   * Team B has just completed the remediation that made them assertion-only.
--     Handing them a Team A invariant to carry would re-split the ownership
--     that remediation existed to consolidate.
--
-- ── What is asserted ────────────────────────────────────────────────────────
--
-- For each carve-out table, EVERY COMMAND that must stay closed has a
-- RESTRICTIVE policy naming is_workforce_only_user(). Commands are named
-- individually, because per-table checking is exactly what the weaker guard
-- missed. A restrictive FOR ALL policy satisfies any command it covers.
--
-- The two asymmetries are deliberate and are recorded here so that no future
-- reader mistakes either for an oversight:
--
--   settings          SELECT is NOT restricted. company_logo_url is read by the
--                     splash screen and home header on every cold start of every
--                     device. The tenant guard already bounds the read to the
--                     caller's own company.
--   compliance_items  SELECT IS restricted, to the caller's own record. A worker
--                     sees their own certifications and expiry; a colleague's
--                     stay closed.
-- ============================================================================

DO $$
DECLARE
  spec  text[][] := ARRAY[
    ['settings',         'INSERT'],
    ['settings',         'UPDATE'],
    ['settings',         'DELETE'],
    ['compliance_items', 'SELECT'],
    ['compliance_items', 'INSERT'],
    ['compliance_items', 'UPDATE'],
    ['compliance_items', 'DELETE']
  ];
  i      int;
  v_tbl  text;
  v_cmd  text;   -- v_ prefix: `cmd` would shadow pg_policies.cmd below
  bad    text := '';
BEGIN
  -- Team B absent: the carve-outs do not exist and are not required. There is
  -- no workforce-only principal to defend against.
  IF to_regprocedure('public.is_workforce_only_user()') IS NULL THEN
    RAISE NOTICE 'Team B not present; workforce carve-out assertions not applicable.';
    RETURN;
  END IF;

  FOR i IN 1 .. array_length(spec, 1) LOOP
    v_tbl := spec[i][1];
    v_cmd := spec[i][2];

    CONTINUE WHEN to_regclass('public.' || v_tbl) IS NULL;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename  = v_tbl
        AND p.permissive = 'RESTRICTIVE'
        AND p.cmd IN (v_cmd, 'ALL')
        AND COALESCE(p.qual, '') || COALESCE(p.with_check, '') LIKE '%is_workforce_only_user%'
    ) THEN
      bad := bad || v_tbl || '.' || v_cmd || ' ';
    END IF;
  END LOOP;

  IF bad <> '' THEN
    RAISE EXCEPTION
      'Workforce carve-out lost a required restriction: %. A Workforce-only principal would gain that command on a Platform table.',
      bad
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;

-- Second assertion: the carve-out must not have widened into a blanket grant.
-- compliance_items SELECT is restricted TO THE CALLER'S OWN RECORD, resolved
-- server-side. A restrictive SELECT policy that no longer consults
-- get_my_contractor_id() would satisfy the command check above while letting a
-- worker read every colleague's compliance history.
DO $$
BEGIN
  IF to_regprocedure('public.is_workforce_only_user()') IS NULL THEN RETURN; END IF;
  IF to_regclass('public.compliance_items') IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename  = 'compliance_items'
      AND p.permissive = 'RESTRICTIVE'
      AND p.cmd IN ('SELECT', 'ALL')
      AND COALESCE(p.qual, '') LIKE '%get_my_contractor_id%'
  ) THEN
    RAISE EXCEPTION
      'compliance_items SELECT is restricted to workforce users but no longer scoped to the caller''s own record: every worker would read every colleague''s compliance history.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;
