-- ============================================================================
-- Innovion Team A — Tenant directory: scope, and the suspension question
-- Timestamp: 20260818000500
-- ----------------------------------------------------------------------------
-- Two corrections to the A→D tenancy contract published in 20260818000100 §3c,
-- arising from Team D's P3 question about innovion_tenant_directory.is_active.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. DEFECT — the directory enumerated rows that are not tenants
-- ═══════════════════════════════════════════════════════════════════════════
--
-- public.companies is a MIXED table. Its company_type enum is
-- (client, contractor, partner) and DEFAULTS TO 'client', so the table holds
-- customer records alongside tenant records. The directory selected every row.
--
-- Demonstrated against the integrated chain before this migration: a company
-- inserted as a plain customer — no owner_id, no user_roles, no contractors,
-- comp_status 'inactive' — appeared as
--
--   Acme Cleaning Client Pty Ltd   company:cccccccc-…-c1   is_active = true
--
-- and Team D's projection would have created a platform_tenants row for it.
-- That is Team A customer data crossing into the Platform register. It grants
-- nobody anything — a customer record has no members, so no membership is
-- projected — but a commercial customer list is not Platform Foundation's to
-- hold, and an entry that cannot have members makes `is_active` meaningless for
-- that row.
--
-- A company is a tenant when a principal can act inside it. That is exactly the
-- test public.innovion_tenant_ids() already applies, and the directory now
-- applies the same one: an owner, an authoritative role, or a Workforce
-- contractor. One definition of tenancy, not two.
--
-- Team D's projection prunes on the next run: its orphaned-tenant block deletes
-- platform_tenants rows with company_id IS NOT NULL that the directory no
-- longer reports. No Team D change is needed for this, and Team D operations
-- tenants (company_id IS NULL) are untouched.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 2. is_active — THERE IS NO AUTHORITATIVE SUSPENSION STATE. SAID PLAINLY.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Team D is right that a hard-coded literal is unsatisfactory. The honest
-- answer is that Team A has no tenant-suspension concept to expose yet, and
-- inventing one here would be Team A doing precisely what Team D correctly
-- refused to do when it declined to invent the tenancy mapping.
--
-- Two candidates were examined and both are rejected:
--
--   public.companies.comp_status  ENUM (active, inactive, pending)
--     Describes the company RECORD, on a table that is mostly customer records.
--     The demonstration above has a customer at comp_status='inactive', which
--     means "not a current customer" and says nothing about platform access.
--     Deriving an access decision from a CRM lifecycle field would make every
--     future edit to that field a silent security event.
--
--   public.subscriptions.sub_status  ENUM (trialing, active, past_due,
--                                          cancelled, suspended, read_only)
--     A billing lifecycle. Whether non-payment should cut off Platform event
--     publication and audit write is a COMMERCIAL POLICY DECISION, not a fact
--     already present in the schema. 'past_due' plainly should not. 'suspended'
--     and 'cancelled' plausibly should. Choosing is the Founder's, not Team A's,
--     and certainly not a migration's.
--
-- INTERIM BEHAVIOUR, and it is deliberate rather than unfinished:
--
--   is_active is CONSTANT TRUE for every Innovion tenant.
--
--   Safe because authority flows the other way. Access is granted by
--   membership, membership is projected from Team A, and removing a principal
--   in Team A removes their Platform membership on the next projection. Tenant
--   suspension is therefore not a hole that is_active is failing to close — it
--   is a capability Team A does not yet offer, and the contract says so rather
--   than implying otherwise with a value that looks computed.
--
--   TEAM D MUST NOT build suspension behaviour on this column while it is
--   constant. A gate that is always open is worse than no gate, because it
--   reads as protection.
--
--   When a suspension state is introduced, it belongs on the tenant record
--   itself — a companies.tenant_suspended_at timestamptz, or an explicit
--   tenancy status distinct from comp_status — and this view is the single
--   place that changes. Team D's projection already copies is_active through,
--   so Team D needs no change then either.
-- ============================================================================

CREATE OR REPLACE VIEW public.innovion_tenant_directory
WITH (security_invoker = true) AS
  SELECT
    c.id                     AS company_id,
    'company:' || c.id::text AS tenant_id,
    c.name                   AS display_name,
    -- Constant by contract, not by omission. See section 2 above.
    true                     AS is_active
  FROM public.companies c
  WHERE
    -- A tenant is a company some principal can act inside. Same test as
    -- public.innovion_tenant_ids(), so tenancy has one definition.
       c.owner_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.company_id = c.id)
    OR (
         to_regclass('public.contractors') IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.contractors ct WHERE ct.company_id = c.id)
       );

COMMENT ON VIEW public.innovion_tenant_directory IS
  'A/B/D contract: the authoritative set of Innovion tenants, with the canonical Platform Foundation tenant_id. Scoped to companies a principal can act inside; customer records on public.companies are excluded. is_active is CONSTANT TRUE — Team A has no tenant-suspension state and Team D must not build suspension logic on it. See 20260818000500.';

-- ── Guard ───────────────────────────────────────────────────────────────────
-- The scoping must exclude non-tenants and must not exclude real ones. Both
-- directions are checked, because a filter that is too tight would silently
-- strip a legitimate tenant admin of Platform authority on the next projection
-- — the same failure as never having granted it.
DO $$
DECLARE
  n_tenants   int;
  n_companies int;
  n_orphans   int;
BEGIN
  SELECT count(*) INTO n_companies FROM public.companies;
  SELECT count(*) INTO n_tenants   FROM public.innovion_tenant_directory;

  -- Every company carrying a membership MUST be present in the directory.
  SELECT count(*) INTO n_orphans
  FROM (SELECT DISTINCT company_id FROM public.innovion_tenant_membership_directory) m
  WHERE NOT EXISTS (
    SELECT 1 FROM public.innovion_tenant_directory d WHERE d.company_id = m.company_id
  );

  IF n_orphans > 0 THEN
    RAISE EXCEPTION
      'Tenant directory scoping is too tight: % company/companies carry a membership but are not listed as tenants. Their administrators would lose Platform Foundation authority.',
      n_orphans;
  END IF;

  RAISE NOTICE 'Tenant directory: % of % company rows are tenants.', n_tenants, n_companies;
END $$;
