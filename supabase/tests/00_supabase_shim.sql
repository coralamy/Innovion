-- Supabase-compatible shim for local RLS verification
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator LOGIN NOINHERIT; END IF;
END $$;
GRANT anon, authenticated, service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- Columns mirror the subset of GoTrue's auth.users that the Innovion migrations
-- actually read. `email_confirmed_at` in particular is load-bearing: Team B
-- reads it to decide whether an address may be used as a tenant selector, and
-- Team D reads it in its new-user trigger.
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  email_confirmed_at timestamptz,
  phone text,
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data  jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- session-local JWT claims, mirroring Supabase GoTrue
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid;
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() ->> 'role', current_setting('role', true));
$$;
CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() ->> 'email';
$$;
GRANT USAGE ON SCHEMA auth, storage, extensions TO anon, authenticated, service_role;

/*
 * auth.users is NOT readable by `anon` or `authenticated` on a hosted Supabase
 * project, and this shim previously granted it to both.
 *
 * Raised by Team D's cross-team verification (their item 9.7) and adopted: a
 * grant the real platform does not make can let a Team A test pass locally and
 * fail in production — the precise failure mode a harness exists to prevent.
 *
 * Nothing legitimate needs it. Every function across all three teams that reads
 * auth.users — Team A's innovion_contractor_company_ids(), Team B's
 * get_my_contractor_id() and auth_email_is_confirmed(), Team D's
 * handle_platform_new_user() — is SECURITY DEFINER and therefore runs with the
 * owner's rights. If removing this grant breaks something, that something was
 * relying on an access level production does not give it.
 */
GRANT SELECT ON auth.users TO service_role;

-- storage.objects stub (documents bucket migration touches it)
CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text, owner uuid, created_at timestamptz DEFAULT now(), metadata jsonb
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT string_to_array(name, '/');
$$;

-- storage.buckets columns referenced by 20260727030000_documents_storage_bucket.sql
ALTER TABLE storage.buckets
  ADD COLUMN IF NOT EXISTS file_size_limit bigint,
  ADD COLUMN IF NOT EXISTS allowed_mime_types text[],
  ADD COLUMN IF NOT EXISTS owner uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

/*
 * ── HARNESS FIDELITY ASSERTIONS ────────────────────────────────────────────
 *
 * Team D's P3 reported that this shim grants SELECT on auth.users to anon and
 * authenticated. It no longer does — that was narrowed to service_role in an
 * earlier turn, adopting their own item 9.7 — so the report was against a stale
 * copy. But a correctly-written line is not a control. The substance of their
 * finding is that a harness privilege real Supabase does not give lets a test
 * pass here and fail in production, and nothing was stopping that from being
 * reintroduced.
 *
 * The property is therefore asserted, at the end of the shim, where it sees the
 * final grant state rather than an intermediate one. Any future edit that
 * re-widens the grant fails every suite on the next run instead of quietly
 * restoring the fiction.
 *
 * Scope note: this asserts the specific privilege Team D identified. It is not
 * a general proof that the shim matches hosted Supabase — nothing local can be.
 * The shim's remaining departures are deliberate and narrow (storage.objects is
 * a stub, GoTrue is absent), and are recorded as an external-verification limit
 * in the integration report rather than papered over here.
 */
DO $fidelity$
DECLARE leaked text;
BEGIN
  SELECT string_agg(DISTINCT grantee, ', ') INTO leaked
  FROM information_schema.role_table_grants
  WHERE table_schema = 'auth'
    AND table_name   = 'users'
    AND grantee IN ('anon', 'authenticated', 'PUBLIC');

  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION
      'Harness fidelity: auth.users is granted to %, which hosted Supabase does not do. A test relying on that would pass locally and fail in production.',
      leaked;
  END IF;
END
$fidelity$;
