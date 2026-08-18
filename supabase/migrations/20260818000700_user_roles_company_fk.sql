-- ============================================================================
-- Innovion Team A — public.user_roles.company_id referential integrity
-- Timestamp: 20260818000700
-- ----------------------------------------------------------------------------
-- Closes Team D's P2. They identified the missing foreign key as the root cause
-- of the associated integrity issue, and that is correct.
--
-- ── The defect, measured ────────────────────────────────────────────────────
--
-- public.user_roles is Team A's AUTHORITY table — it is what get_my_company_id(),
-- is_company_admin(), innovion_auth_company_ids() and the whole A→D membership
-- contract are built on. It was the only tenant-scoped table without a foreign
-- key to public.companies; twelve others already have one, all ON DELETE CASCADE
-- (checklists, conversations, and the ten integration_* tables).
--
-- Two consequences, both demonstrated against the integrated chain:
--
--   1. A role row naming a company that does not exist is accepted:
--        INSERT INTO user_roles(user_id, company_id, role)
--        VALUES (…, 'deadbeef-0000-0000-0000-00000000dead', 'admin');   -- succeeds
--
--   2. That row then appears in the A→D contract as a real membership:
--        innovion_tenant_membership_directory
--          → tenant_id 'company:deadbeef-…', tenant_role 'tenant_admin'
--
--      So Team A was publishing a tenant administrator of a tenant that has
--      never existed. The tenant directory does not list it (it selects from
--      companies), which means the two halves of the contract disagreed — the
--      membership directory asserted authority over a tenant the tenant
--      directory did not contain.
--
--   3. Deleting a company left its role grants behind. If that company id were
--      ever reissued, the stale grants would attach to the new tenant.
--
-- ── Remediation ─────────────────────────────────────────────────────────────
--
-- ON DELETE CASCADE, matching every other companies foreign key in the schema
-- and matching Team D's platform_tenants.company_id. Removing a company removes
-- the grants inside it; that is what deleting a tenant means.
--
-- company_id also becomes NOT NULL. Every policy on this table already requires
-- `company_id IS NOT NULL` (user_roles_tenant_guard), so a NULL row grants
-- nothing and exists only as a trap.
--
-- ── This migration DELETES rows, deliberately and loudly ───────────────────
--
-- A foreign key cannot be added over rows that violate it. The rows removed are
-- role grants naming a company that does not exist, and grants with no company
-- at all. Neither can authorise anything: get_my_company_id() cannot resolve to
-- a company that is absent, and the policies reject NULL. They are not access
-- being taken away — they are the defect itself.
--
-- Every removal is reported by user_id and company_id before it happens, so a
-- restored-copy rehearsal produces an auditable record rather than a silent
-- cleanup. If the count is ever non-trivial, that is a finding to investigate
-- before deploying, not a number to skim past.
-- ============================================================================

DO $$
DECLARE
  n_orphan int;
  n_null   int;
  detail   text;
BEGIN
  SELECT count(*) INTO n_null FROM public.user_roles WHERE company_id IS NULL;

  SELECT count(*) INTO n_orphan
  FROM public.user_roles ur
  WHERE ur.company_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ur.company_id);

  IF n_null = 0 AND n_orphan = 0 THEN
    RAISE NOTICE 'user_roles referential integrity: clean (no orphaned or company-less grants).';
  ELSE
    SELECT string_agg(format('user=%s company=%s role=%s',
                             ur.user_id, coalesce(ur.company_id::text,'NULL'), ur.role), '; ')
      INTO detail
    FROM public.user_roles ur
    WHERE ur.company_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ur.company_id);

    RAISE WARNING
      'user_roles: removing % grant(s) with no company and % grant(s) naming a company that does not exist. Detail: %',
      n_null, n_orphan, detail;

    DELETE FROM public.user_roles ur
    WHERE ur.company_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ur.company_id);
  END IF;
END $$;

-- ── The foreign key ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_roles'::regclass
      AND confrelid = 'public.companies'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.user_roles ALTER COLUMN company_id SET NOT NULL;

-- The FK gives PostgreSQL an index requirement on the referencing side for
-- cascade performance; user_roles is read on every authorisation decision.
CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON public.user_roles(company_id);

COMMENT ON CONSTRAINT user_roles_company_id_fkey ON public.user_roles IS
  'Team A authority integrity. Added 20260818000700 after Team D found that a role grant could name a non-existent company and still be published through the A→D membership directory as a tenant administrator.';

-- ── Guard ───────────────────────────────────────────────────────────────────
DO $$
DECLARE fk_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO fk_def
  FROM pg_constraint
  WHERE conrelid = 'public.user_roles'::regclass
    AND confrelid = 'public.companies'::regclass
    AND contype = 'f';

  IF fk_def IS NULL THEN
    RAISE EXCEPTION 'user_roles has no foreign key to companies: a role grant could name a tenant that does not exist.';
  END IF;

  IF fk_def !~ 'ON DELETE CASCADE' THEN
    RAISE EXCEPTION
      'user_roles → companies foreign key is not ON DELETE CASCADE (%): deleting a company would strand its role grants.',
      fk_def;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_roles'
      AND column_name='company_id' AND is_nullable='YES'
  ) THEN
    RAISE EXCEPTION 'user_roles.company_id is still nullable; every policy on this table already requires it to be present.';
  END IF;
END $$;
