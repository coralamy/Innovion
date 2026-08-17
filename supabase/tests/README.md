# Innovion Team A — Local tenant-isolation verification harness

Reproduces, on a throwaway PostgreSQL 16 instance, the tenant-isolation and
credential-encryption verification performed during the 2026-08-17 remediation.
Requires only PostgreSQL 16 with `pgcrypto`. It does **not** touch Supabase and
performs no network access.

## Run

```bash
export PATH=/usr/lib/postgresql/16/bin:$PATH
initdb -D /tmp/pgdata -U postgres --auth=trust
pg_ctl -D /tmp/pgdata -l /tmp/pg.log -o '-p 5433 -k /tmp' start

psql -h /tmp -p 5433 -U postgres -f supabase/tests/00_supabase_shim.sql
for f in supabase/migrations/*.sql; do
  psql -h /tmp -p 5433 -U postgres -v ON_ERROR_STOP=1 -q -f "$f" || echo "FAIL $f"
done
bash supabase/tests/tenant_isolation_suite.sh
```

## What the shim provides

`auth.uid()`, `auth.jwt()`, `auth.role()`, `auth.users`, the `anon` /
`authenticated` / `service_role` roles, and a minimal `storage` schema —
enough to exercise RLS exactly as Supabase evaluates it. A JWT is simulated by
setting `request.jwt.claims`, which is precisely how Supabase's PostgREST
presents claims to Postgres.

## Threat model exercised

The attacker is a **legitimate, authenticated, non-admin ('viewer') member of
Tenant B**. They forge tenant and role authority on both client-writable
channels available to a real Supabase user:

1. the `user_metadata` JWT claim, and
2. the `auth.users.raw_user_meta_data` column,

both of which are written by `supabase.auth.updateUser({ data: { ... } })`.
The authoritative `public.user_roles` table is never modified by the attacker.

Expected result after remediation: zero rows of Tenant A data visible or
mutable through either channel, while legitimate Tenant A access is unaffected.
