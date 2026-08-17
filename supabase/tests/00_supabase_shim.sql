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
GRANT SELECT ON auth.users TO anon, authenticated, service_role;

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
