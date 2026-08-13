-- ============================================================
-- Migration: EDR-006 Resolutions
-- 1. Supervisor RBAC — configurable permissions (not hard-coded)
-- 2. Encrypted secrets storage for Provider Integration Framework
-- Timestamp: 20260807040000
-- ============================================================

-- ── 1. SUPERVISOR PERMISSIONS TABLE ──────────────────────────────────────────
-- Stores per-company, per-role configurable permissions.
-- Inherits from the Platform Identity model (role hierarchy).
-- No permissions are hard-coded — all are stored and resolved at runtime.

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role_name         TEXT NOT NULL,
  -- Permission flags (all default to false — must be explicitly granted)
  can_manage_users        BOOLEAN NOT NULL DEFAULT false,
  can_manage_company      BOOLEAN NOT NULL DEFAULT false,
  can_view_reports        BOOLEAN NOT NULL DEFAULT false,
  can_manage_jobs         BOOLEAN NOT NULL DEFAULT false,
  can_manage_compliance   BOOLEAN NOT NULL DEFAULT false,
  can_manage_documents    BOOLEAN NOT NULL DEFAULT false,
  can_manage_inventory    BOOLEAN NOT NULL DEFAULT false,
  can_view_financials     BOOLEAN NOT NULL DEFAULT false,
  -- Audit
  created_by        UUID,
  updated_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One permission record per role per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_company_role
  ON public.role_permissions (company_id, role_name);

CREATE INDEX IF NOT EXISTS idx_role_permissions_company_id
  ON public.role_permissions (company_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_role_permissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER trg_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_role_permissions_updated_at();

-- RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Company members may read their company's role permissions
DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
CREATE POLICY "role_permissions_select"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (
    company_id = ((auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID)
  );

-- Only admins may insert role permissions
DROP POLICY IF EXISTS "role_permissions_insert" ON public.role_permissions;
CREATE POLICY "role_permissions_insert"
  ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = ((auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID)
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Only admins may update role permissions
DROP POLICY IF EXISTS "role_permissions_update" ON public.role_permissions;
CREATE POLICY "role_permissions_update"
  ON public.role_permissions
  FOR UPDATE
  TO authenticated
  USING (
    company_id = ((auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID)
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    company_id = ((auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID)
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Only admins may delete role permissions
DROP POLICY IF EXISTS "role_permissions_delete" ON public.role_permissions;
CREATE POLICY "role_permissions_delete"
  ON public.role_permissions
  FOR DELETE
  TO authenticated
  USING (
    company_id = ((auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID)
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ── 2. ENCRYPTED SECRETS STORAGE ─────────────────────────────────────────────
-- Add encrypted_config column to provider_integrations.
-- config_json (plain JSONB) is retained for backward compatibility during migration.
-- encrypted_config stores pgcrypto-encrypted secrets (symmetric AES via pgcrypto).
-- The encryption key is stored as a Supabase secret (not in application code).

ALTER TABLE public.provider_integrations
  ADD COLUMN IF NOT EXISTS encrypted_config TEXT;

-- Helper: encrypt a JSONB value using pgcrypto symmetric encryption.
-- The passphrase is read from app.settings.encryption_key (set via Supabase dashboard).
-- Falls back to a compile-time constant if not set (development only).
CREATE OR REPLACE FUNCTION public.encrypt_provider_config(plain_json JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  enc_key TEXT;
BEGIN
  BEGIN
    enc_key := current_setting('app.settings.encryption_key');
  EXCEPTION WHEN OTHERS THEN
    enc_key := 'innovion-dev-key-change-in-production';
  END;
  RETURN encode(
    pgp_sym_encrypt(plain_json::TEXT, enc_key),
    'base64'
  );
END;
$$;

-- Helper: decrypt an encrypted config back to JSONB.
CREATE OR REPLACE FUNCTION public.decrypt_provider_config(cipher_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  enc_key TEXT;
BEGIN
  IF cipher_text IS NULL OR cipher_text = '' THEN
    RETURN '{}'::JSONB;
  END IF;
  BEGIN
    enc_key := current_setting('app.settings.encryption_key');
  EXCEPTION WHEN OTHERS THEN
    enc_key := 'innovion-dev-key-change-in-production';
  END;
  RETURN pgp_sym_decrypt(
    decode(cipher_text, 'base64'),
    enc_key
  )::JSONB;
EXCEPTION WHEN OTHERS THEN
  RETURN '{}'::JSONB;
END;
$$;

-- ── 3. SEED DEFAULT SUPERVISOR PERMISSIONS ────────────────────────────────────
-- Seed default supervisor permissions for any existing companies.
-- These defaults reflect the constitutional guidance:
--   supervisor inherits from Platform Identity model (operational scope).
-- Admins may override these per-company via the RBAC settings UI.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.companies LOOP
    INSERT INTO public.role_permissions (
      company_id,
      role_name,
      can_manage_users,
      can_manage_company,
      can_view_reports,
      can_manage_jobs,
      can_manage_compliance,
      can_manage_documents,
      can_manage_inventory,
      can_view_financials
    ) VALUES (
      rec.id,
      'supervisor',
      false,   -- cannot manage users
      false,   -- cannot manage company settings
      true,    -- can view reports (operational visibility)
      true,    -- can manage jobs (core supervisor function)
      true,    -- can manage compliance (site supervisor responsibility)
      true,    -- can manage documents (operational documents)
      false,   -- cannot manage inventory
      false    -- cannot view financials
    )
    ON CONFLICT (company_id, role_name) DO NOTHING;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Supervisor permission seeding skipped: %', SQLERRM;
END $$;
