-- ============================================================================
-- Innovion Team A — Remove hard-coded development encryption-key fallback
-- Timestamp: 20260817003000
-- ----------------------------------------------------------------------------
-- DEFECT REMEDIATED (P0 under the governing Vault/F-04 architecture):
--   public.encrypt_provider_config() and public.decrypt_provider_config()
--   silently fell back to the hard-coded constant
--     'innovion-dev-key-change-in-production'
--   whenever app.settings.encryption_key was unset. The constant is committed
--   to this repository, so any provider credential encrypted under it is
--   effectively stored in plaintext to anyone with the repo and the ciphertext.
--
--   Migration 20260809160000 added a RAISE WARNING but LEFT THE FALLBACK IN
--   PLACE. A warning in the Postgres log is not a control: encryption still
--   proceeded under the published key.
--
--   The governing architecture prohibits hard-coded encryption keys and
--   development-key fallbacks. This migration removes them.
--
-- DEFECT 2 REMEDIATED:
--   decrypt_provider_config() ended with `EXCEPTION WHEN OTHERS THEN RETURN
--   '{}'::JSONB`, silently converting a wrong key, corrupted ciphertext or
--   tampering into an empty-but-successful result. Failures are now raised.
--
-- DEVELOPER ERGONOMICS (deliberate, explicit, opt-in):
--   Local development may set
--     SET app.settings.allow_insecure_dev_key = 'on';
--   which permits an explicitly-supplied weak key. It cannot be reached by
--   accident and never applies unless deliberately turned on.
--
-- REMAINING SCOPE (NOT addressed here — see Completion Report):
--   Full migration to Supabase Vault (F-04) for credential storage. This
--   migration removes the prohibited fallback from the existing pgcrypto
--   implementation; it does not itself constitute Vault adoption.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.innovion_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  enc_key   TEXT;
  allow_dev TEXT;
BEGIN
  BEGIN
    enc_key := current_setting('app.settings.encryption_key');
  EXCEPTION WHEN OTHERS THEN
    enc_key := NULL;
  END;

  BEGIN
    allow_dev := current_setting('app.settings.allow_insecure_dev_key');
  EXCEPTION WHEN OTHERS THEN
    allow_dev := 'off';
  END;

  IF enc_key IS NULL OR length(trim(enc_key)) = 0 THEN
    RAISE EXCEPTION
      'Provider credential encryption key is not configured. Set app.settings.encryption_key (ALTER DATABASE ... SET app.settings.encryption_key = ...). No fallback key exists.'
      USING ERRCODE = 'config_file_error';
  END IF;

  -- Refuse the previously-published constant outright, even if supplied.
  IF enc_key = 'innovion-dev-key-change-in-production' THEN
    RAISE EXCEPTION
      'Refusing to use the published development encryption key. This value is committed to the repository and must never be used.'
      USING ERRCODE = 'config_file_error';
  END IF;

  IF length(enc_key) < 32 AND COALESCE(lower(allow_dev),'off') NOT IN ('on','true','1') THEN
    RAISE EXCEPTION
      'Provider credential encryption key is shorter than 32 characters. Supply a stronger key, or set app.settings.allow_insecure_dev_key = ''on'' for local development only.'
      USING ERRCODE = 'config_file_error';
  END IF;

  RETURN enc_key;
END;
$$;

REVOKE ALL ON FUNCTION public.innovion_encryption_key() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.encrypt_provider_config(plain_json JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(plain_json::TEXT, public.innovion_encryption_key()),
    'base64'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_provider_config(cipher_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF cipher_text IS NULL OR cipher_text = '' THEN
    RETURN '{}'::JSONB;
  END IF;

  -- Deliberately NOT wrapped in EXCEPTION WHEN OTHERS: a decryption failure
  -- means a wrong key, corrupted ciphertext or tampering, and must surface.
  RETURN pgp_sym_decrypt(decode(cipher_text, 'base64'),
                         public.innovion_encryption_key())::JSONB;
END;
$$;

-- ── Regression guard ────────────────────────────────────────────────────────
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.proname, ', ')
    INTO bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND pg_get_functiondef(p.oid) LIKE '%innovion-dev-key-change-in-production%'
    AND p.proname <> 'innovion_encryption_key';   -- this one REJECTS the value

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Hard-coded development encryption key still present in: %', bad;
  END IF;
END $$;
