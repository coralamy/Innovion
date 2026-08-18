-- ============================================================================
-- Innovion Team A — A→D tenancy projection: refresh cadence
-- Timestamp: 20260818000600
-- ----------------------------------------------------------------------------
-- Adjudicates Team D's P1: the A→D projection is stale between refresh runs,
-- and Team D deliberately declined to place a trigger on a Team A table, invent
-- a scheduler, or introduce reverse D→A authority. All three refusals were
-- correct.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- RULING
-- ═══════════════════════════════════════════════════════════════════════════
--
--   WHAT CAUSES REFRESH   A change to Team A's authoritative membership inputs:
--                         public.user_roles (any command) and public.companies
--                         (INSERT, DELETE, or UPDATE of owner_id or name).
--
--   WHO OWNS IT           TEAM A. The trigger sits on Team A's tables, in this
--                         Team A migration, and calls Team D's function.
--
--   MODE                  SYNCHRONOUS and EVENT-DRIVEN, in the same transaction
--                         as the Team A change. Not scheduled.
--
--   FAIL-CLOSED           If Team D is present and the projection fails, the
--                         Team A authority change ABORTS.
--
-- ── Why Team A owns it, given the one-way rule ─────────────────────────────
--
-- A trigger on a Team A table that calls a Team D function is Team A PUSHING to
-- Team D. That is the contracted direction. What the rule forbids is Team D
-- reaching into Team A — installing triggers on Team A tables, or deriving
-- membership for itself — and none of that happens here. Team D remains a pure
-- receiver: it is still true after this migration that Team D never decides who
-- belongs to a tenant.
--
-- Placing it on Team A's side also puts the mechanism where the knowledge is.
-- Team A knows which of its columns are authority-bearing; Team D would have to
-- guess, and would have to keep guessing every time Team A's schema moves.
--
-- ── Why synchronous, and not scheduled ─────────────────────────────────────
--
-- Staleness is ASYMMETRIC, and that asymmetry decides the whole question.
--
--   A stale GRANT — a principal revoked in Team A who is still a member in
--   Team D — leaves a removed administrator holding Platform event-publish and
--   audit-write authority for the length of the staleness window. That is a
--   privilege-retention vulnerability, and its duration would be exactly the
--   scheduler interval.
--
--   A stale ABSENCE — granted in Team A, not yet projected — costs a new
--   administrator the ability to publish a Platform event until the next run.
--   A functional lag, not a security defect.
--
-- A schedule bounds the harmless direction and the dangerous one identically.
-- Synchronous refresh eliminates the dangerous one outright, which is why it is
-- worth its cost. The projection is idempotent, so the cost of running it too
-- often is work, not risk.
--
-- Triggers are STATEMENT-level, not row-level: Team D's projection is a full
-- sweep, so one call per statement is both sufficient and strictly cheaper than
-- one per row. A bulk role update fires it once.
--
-- ── Fail-closed, stated exactly ────────────────────────────────────────────
--
-- The invariant this protects is: TEAM A AND TEAM D NEVER DISAGREE ABOUT
-- MEMBERSHIP.
--
-- So when Team D is present and the projection raises, the whole transaction
-- rolls back and the Team A change does not happen either. An administrator who
-- cannot complete a revocation receives an error and escalates. An
-- administrator who believes a revocation succeeded while Team D still grants
-- the access is the silent failure, and it is the one worth refusing writes to
-- prevent.
--
-- When Team D is ABSENT the trigger is not installed at all. Team A must remain
-- deployable on its own, and there is nothing to keep in step.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- TEAM D FOLLOW-UP REQUIRED — the trigger cannot be armed until it lands
-- ═══════════════════════════════════════════════════════════════════════════
--
-- public.platform_project_innovion_tenancy() refuses any caller with a JWT that
-- is not a platform administrator:
--
--   IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
--     RAISE EXCEPTION 'permission denied: projecting Innovion tenancy is a
--                      platform-administrative action';
--
-- That check is correct for interactive callers and must stay. But a trigger
-- fires inside the transaction of whoever made the Team A change, and that
-- principal is never a platform administrator.
--
-- Team A has no admin-adds-another-user path at all — user_roles_select_own
-- means an administrator cannot even list their own team from the client. The
-- only two client writes to public.user_roles in the codebase are SELF-SERVICE:
--
--   src/app/onboarding/page.tsx:435            owner bootstraps their own admin role
--   src/app/accept-invite/AcceptInviteContent.tsx:104   invitee inserts their own role
--
-- Both run as an ordinary authenticated user. Measured against the integrated
-- chain:
--
--   projection with no JWT claims set     → runs (1 tenant, 2 memberships)
--   projection with an ordinary user JWT  → REFUSED, permission denied
--
-- So an unconditional trigger would break onboarding and invitation acceptance —
-- the two moments a tenant is created and staffed. Team D must accept
-- trigger-origin calls:
--
--   IF auth.uid() IS NOT NULL
--      AND pg_trigger_depth() = 0            -- ← add this conjunct
--      AND NOT public.is_platform_admin() THEN
--     RAISE EXCEPTION …
--
-- pg_trigger_depth() is 0 outside a trigger and non-zero inside one (verified:
-- 0 and 1 respectively). A client cannot make it non-zero without genuinely
-- being inside a trigger, so it is not forgeable from the API, and the only
-- trigger that calls this function is the Team A one installed below.
--
-- Until that lands, this migration installs NOTHING and says so. It does not
-- guess: it PROBES, by building a throwaway trigger that calls the projection
-- exactly as the real one would, and rolling the probe back. So the mechanism
-- arms itself the moment Team D ships, on the next migration run, with no
-- coordination and no manual step.
-- ============================================================================

-- ── The trigger function ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.innovion_refresh_tenancy_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Team D absent: nothing to project. Team A stands alone.
  IF to_regprocedure('public.platform_project_innovion_tenancy()') IS NULL THEN
    RETURN NULL;
  END IF;

  -- No exception handler. A failure here must abort the Team A authority change
  -- rather than let Team A and Team D diverge. See "Fail-closed" above.
  PERFORM public.platform_project_innovion_tenancy();
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.innovion_refresh_tenancy_projection() IS
  'A/B/D contract: pushes Team A tenant/membership changes into Team D''s projection synchronously. Statement-level. Aborts the originating change if the projection fails, so Team A and Team D cannot disagree about membership.';

REVOKE ALL ON FUNCTION public.innovion_refresh_tenancy_projection() FROM PUBLIC, anon;

-- ── Arm it, but only if Team D will actually accept a trigger-origin call ──
DO $$
DECLARE
  probe_ok  boolean := false;
  probe_err text;
BEGIN
  IF to_regprocedure('public.platform_project_innovion_tenancy()') IS NULL THEN
    RAISE NOTICE 'Team D not present; tenancy projection refresh not installed.';
    RETURN;
  END IF;

  -- Behavioural capability probe. Build a throwaway table and trigger that call
  -- the projection exactly as the real trigger will, with a non-platform JWT
  -- set, then roll the whole thing back. Checking the function's source text
  -- for 'pg_trigger_depth' would test its spelling, not its behaviour.
  BEGIN
    CREATE TEMP TABLE _innovion_probe(i int) ON COMMIT DROP;

    CREATE OR REPLACE FUNCTION pg_temp._innovion_probe_fn()
    RETURNS trigger LANGUAGE plpgsql AS $probe$
    BEGIN
      PERFORM public.platform_project_innovion_tenancy();
      RETURN NULL;
    END;
    $probe$;

    CREATE TRIGGER _innovion_probe_trg
      AFTER INSERT ON _innovion_probe
      FOR EACH STATEMENT EXECUTE FUNCTION pg_temp._innovion_probe_fn();

    -- A principal who is emphatically NOT a platform administrator: no such
    -- user exists, so is_platform_admin() is false by every model.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', '00000000-0000-0000-0000-0000000d0d0d',
                        'role', 'authenticated')::text, true);

    INSERT INTO _innovion_probe VALUES (1);

    probe_ok := true;
    RAISE EXCEPTION USING ERRCODE = 'raise_exception',
                          MESSAGE = 'INNOVION_PROBE_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'INNOVION_PROBE_ROLLBACK' THEN
      probe_ok  := false;
      probe_err := SQLERRM;
    END IF;
  END;

  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT probe_ok THEN
    RAISE WARNING
      'Tenancy projection refresh NOT installed: Team D''s platform_project_innovion_tenancy() rejects trigger-origin calls (%). The projection remains manual and therefore stale between runs. Team D must add "AND pg_trigger_depth() = 0" to its authorisation check; this migration arms itself on the next run once that lands.',
      COALESCE(probe_err, 'unknown');
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS innovion_tenancy_projection_roles     ON public.user_roles;
  DROP TRIGGER IF EXISTS innovion_tenancy_projection_companies ON public.companies;

  CREATE TRIGGER innovion_tenancy_projection_roles
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH STATEMENT EXECUTE FUNCTION public.innovion_refresh_tenancy_projection();

  -- companies: only the columns the directory reads. comp_status and the CRM
  -- fields are not authority-bearing and must not fire a projection.
  CREATE TRIGGER innovion_tenancy_projection_companies
    AFTER INSERT OR DELETE OR UPDATE OF owner_id, name ON public.companies
    FOR EACH STATEMENT EXECUTE FUNCTION public.innovion_refresh_tenancy_projection();

  RAISE NOTICE 'Tenancy projection refresh armed on user_roles and companies.';
END $$;

-- ── Guard ───────────────────────────────────────────────────────────────────
-- If the triggers ARE installed, they must point at the sanctioned function and
-- must be statement-level. A row-level trigger here would run a full sweep per
-- row and turn a bulk role import into an O(n²) operation.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(c.relname || '.' || t.tgname, ', ') INTO bad
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE t.tgname IN ('innovion_tenancy_projection_roles',
                     'innovion_tenancy_projection_companies')
    AND ( (t.tgtype & 1) <> 0                                   -- row-level
          OR t.tgfoid <> to_regprocedure('public.innovion_refresh_tenancy_projection()')::oid );

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Tenancy projection trigger is misconfigured: %', bad;
  END IF;
END $$;
