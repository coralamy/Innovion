-- ============================================================================
-- Innovion Team A — Platform-operator scoping for partner/licensing data
-- Timestamp: 20260817007000
-- ----------------------------------------------------------------------------
-- DEFECT REMEDIATED (P1 — cross-tenant exposure and mutation of platform data):
--
--   The partner/licensing tables introduced by 20260728020000 are PLATFORM
--   data — the Innovion/Coralamy partner register, the products partners may
--   resell, and partner revenue — not tenant data. Their policies were:
--
--     partners.partners_select              TO public  USING (auth.uid() IS NOT NULL)
--     partners.partners_admin_write         TO public  USING (EXISTS (SELECT 1
--         FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
--     partner_products.partner_products_select      — as partners_select
--     partner_products.partner_products_admin_write — as partners_admin_write
--     partner_revenue.partner_revenue_admin         — as partners_admin_write
--
--   Two faults:
--
--   (1) READ: any authenticated user of any tenant could enumerate the entire
--       partner register — partner names, contacts, addresses, commission and
--       royalty rates, contract dates.
--
--   (2) WRITE: the admin test is NOT scoped to a company. It asks only
--       "does this user hold the 'admin' role ANYWHERE?". Every tenant admin
--       on the platform — a role any user obtains automatically by signing up
--       and creating their own company — therefore had full INSERT / UPDATE /
--       DELETE over the global partner register and over partner_revenue,
--       including other partners' financial records.
--
--   Verified locally before this migration: an ordinary Tenant A admin could
--   INSERT into public.partners and SELECT public.partner_revenue.
--
-- REMEDIATION:
--   Introduces an explicit platform-operator identity. The table is EMPTY by
--   default, so the platform tables become deny-all for every end user until an
--   operator is deliberately designated. That is the correct fail-closed
--   posture: no tenant user is a platform operator by accident.
--
--   `partner_revenue` additionally carries a company_id, so a tenant admin is
--   granted READ of their OWN company's revenue rows only — the legitimate
--   use case — while writes remain platform-operator only.
--
-- FOUNDER ACTION REQUIRED BEFORE PARTNER ADMINISTRATION IS USABLE:
--   INSERT INTO public.platform_operators (user_id) VALUES ('<auth.users.id>');
--   This is deliberately left undone: designating a platform operator is a
--   privileged production action, not an automated migration step.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_operators (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_operators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.innovion_is_platform_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_operators WHERE user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.innovion_is_platform_operator() IS
  'True only for users explicitly listed in public.platform_operators. Empty by default — fail closed.';

REVOKE ALL ON FUNCTION public.innovion_is_platform_operator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.innovion_is_platform_operator() TO authenticated, service_role;

-- The roster itself: an operator may read it; nobody may write it through the
-- API. Membership is granted out-of-band by a database administrator.
DROP POLICY IF EXISTS "platform_operators_read" ON public.platform_operators;
CREATE POLICY "platform_operators_read"
  ON public.platform_operators FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.innovion_is_platform_operator());

-- ── partners ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "partners_select"      ON public.partners;
DROP POLICY IF EXISTS "partners_admin_write" ON public.partners;

CREATE POLICY "partners_operator_read"
  ON public.partners FOR SELECT TO authenticated
  USING (public.innovion_is_platform_operator());

CREATE POLICY "partners_operator_write"
  ON public.partners FOR ALL TO authenticated
  USING      (public.innovion_is_platform_operator())
  WITH CHECK (public.innovion_is_platform_operator());

-- ── partner_products ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "partner_products_select"      ON public.partner_products;
DROP POLICY IF EXISTS "partner_products_admin_write" ON public.partner_products;

CREATE POLICY "partner_products_operator_read"
  ON public.partner_products FOR SELECT TO authenticated
  USING (public.innovion_is_platform_operator());

CREATE POLICY "partner_products_operator_write"
  ON public.partner_products FOR ALL TO authenticated
  USING      (public.innovion_is_platform_operator())
  WITH CHECK (public.innovion_is_platform_operator());

-- ── partner_revenue ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "partner_revenue_admin" ON public.partner_revenue;

CREATE POLICY "partner_revenue_read"
  ON public.partner_revenue FOR SELECT TO authenticated
  USING (
    public.innovion_is_platform_operator()
    OR company_id IN (SELECT public.innovion_auth_company_ids())
  );

CREATE POLICY "partner_revenue_operator_write"
  ON public.partner_revenue FOR ALL TO authenticated
  USING      (public.innovion_is_platform_operator())
  WITH CHECK (public.innovion_is_platform_operator());

-- ── coralamy_products / territories / partner_types / currencies ────────────
-- Reference data. `currencies`, `territories` and `partner_types` are genuinely
-- public look-up tables (currency codes, country/territory names) and remain
-- readable — but `TO authenticated`, not to the anonymous internet.
-- `coralamy_products` is a commercial catalogue and becomes operator-only.
DROP POLICY IF EXISTS "currencies_select"        ON public.currencies;
DROP POLICY IF EXISTS "territories_select"       ON public.territories;
DROP POLICY IF EXISTS "partner_types_select"     ON public.partner_types;
DROP POLICY IF EXISTS "coralamy_products_select" ON public.coralamy_products;

CREATE POLICY "currencies_select"
  ON public.currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "territories_select"
  ON public.territories FOR SELECT TO authenticated USING (true);
CREATE POLICY "partner_types_select"
  ON public.partner_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "coralamy_products_select"
  ON public.coralamy_products FOR SELECT TO authenticated
  USING (public.innovion_is_platform_operator());

-- ── notification_preferences — authenticated only ──────────────────────────
-- Predicate was already `auth.uid() = user_id` and so returned nothing for the
-- anonymous role, but a per-user policy must not be offered to `anon` at all.
DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "notification_preferences_own"
  ON public.notification_preferences FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Regression guard ────────────────────────────────────────────────────────
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('partners','partner_products','partner_revenue','coralamy_products')
    AND COALESCE(qual,'') || COALESCE(with_check,'') NOT LIKE '%innovion_is_platform_operator%';

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Platform data reachable without a platform-operator check: %', bad;
  END IF;

  SELECT string_agg(tablename || '.' || policyname, ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND ('anon' = ANY(roles) OR 'public' = ANY(roles));

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Policy still granted to the anonymous role: %', bad;
  END IF;
END $$;
