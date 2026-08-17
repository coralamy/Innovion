#!/bin/bash
P="psql -h /tmp -p 5433 -U postgres -d postgres -tA"
# ---------- fixtures ----------
$P -q <<'SQL'
INSERT INTO auth.users(id,email) VALUES
 ('11111111-1111-1111-1111-111111111111','attacker@tenantB.test'),
 ('22222222-2222-2222-2222-222222222222','admin@tenantA.test'),
 ('33333333-3333-3333-3333-333333333333','newuser@fresh.test'),
 ('44444444-4444-4444-4444-444444444444','abuser@x.test')
ON CONFLICT (id) DO NOTHING;
DO $$
DECLARE cA uuid := gen_random_uuid(); cB uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.companies(id,name,company_type,industry,location,phone,email,contacts,active_jobs,revenue,comp_status,since,logo,size,address)
  VALUES (cA,'Tenant A','client','cleaning','Sydney','0','a@a.test',0,0,'0','active','2026','','small','1 A St'),
         (cB,'Tenant B','client','cleaning','Melbourne','0','b@b.test',0,0,'0','active','2026','','small','1 B St');
  INSERT INTO public.user_roles(user_id,company_id,role) VALUES
    ('11111111-1111-1111-1111-111111111111', cB, 'viewer'),
    ('22222222-2222-2222-2222-222222222222', cA, 'admin');
  INSERT INTO public.provider_integrations(company_id,provider_slug,provider_name,category,encrypted_config)
  VALUES (cA,'ivxtest_xero','Xero (Tenant A)','other','TENANT-A-CIPHERTEXT');
  -- attacker forges BOTH vectors: JWT claim and auth.users row
  UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('company_id',cA::text,'role','admin')
   WHERE id='11111111-1111-1111-1111-111111111111';
END $$;
SQL
CA=$($P -c "select company_id::text from public.provider_integrations where provider_slug='ivxtest_xero';")
CLAIMS="select set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated','user_metadata',jsonb_build_object('company_id','$CA','role','admin'))::text,false);"
GOOD="select set_config('request.jwt.claims', json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated')::text,false);"
chk(){ printf "  %-58s %s\n" "$1" "$2"; }
r(){ $P -c "set role authenticated; $2 $3" 2>&1 | tail -1; }

echo "── A. CROSS-TENANT ISOLATION (attacker = Tenant B viewer, forging Tenant A admin on BOTH vectors)"
for t in provider_integrations jobs clients employees documents time_entries sites incidents user_roles companies; do
  n=$($P -c "select count(*) from public.$t where company_id='$CA';" 2>/dev/null || echo 0)
  v=$(r x "$CLAIMS" "select count(*) from public.$t where company_id='$CA';")
  [ "$v" = "0" ] && s="PASS" || s="**FAIL**"
  chk "$t (tenantA rows=$n) visible to attacker=$v" "$s"
done
v=$(r x "$CLAIMS" "select coalesce(public.get_my_company_id()::text,'NULL');")
[ "$v" != "$CA" ] && chk "get_my_company_id() not steerable to victim tenant" "PASS" || chk "get_my_company_id()" "**FAIL**"
v=$(r x "$CLAIMS" "select coalesce(public.get_user_company_id()::text,'NULL');")
[ "$v" != "$CA" ] && chk "get_user_company_id() not steerable to victim tenant" "PASS" || chk "get_user_company_id()" "**FAIL**"
v=$(r x "$CLAIMS" "select public.is_company_admin();")
[ "$v" = "f" ] && chk "is_company_admin() false under forged admin claim" "PASS" || chk "is_company_admin()" "**FAIL**"

echo
echo "── B. WRITE-PATH ISOLATION"
v=$($P -c "set role authenticated; $CLAIMS with u as (update public.provider_integrations set encrypted_config='PWNED' where company_id='$CA' returning 1) select count(*) from u;" | tail -1)
[ "$v" = "0" ] && chk "forged admin UPDATE on victim provider_integrations = $v rows" "PASS" || chk "forged UPDATE = $v rows" "**FAIL**"
v=$($P -c "set role authenticated; $CLAIMS with d as (delete from public.provider_integrations where company_id='$CA' returning 1) select count(*) from d;" | tail -1)
[ "$v" = "0" ] && chk "forged admin DELETE on victim provider_integrations = $v rows" "PASS" || chk "forged DELETE = $v rows" "**FAIL**"
v=$($P -c "set role authenticated; select set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated')::text,false); with u as (update public.user_roles set role='admin' where user_id='11111111-1111-1111-1111-111111111111' returning 1) select count(*) from u;" | tail -1)
[ "$v" = "0" ] && chk "viewer self-escalation to admin via UPDATE = $v rows" "PASS" || chk "self-escalation = $v" "**FAIL**"

echo
echo "── C. LEGITIMATE ACCESS (regression)"
v=$(r x "$GOOD" "select count(*) from public.provider_integrations where company_id='$CA';")
[ "$v" = "1" ] && chk "Tenant A admin reads own provider_integrations = $v" "PASS" || chk "legit read = $v" "**FAIL**"
v=$($P -c "set role authenticated; $GOOD with u as (update public.provider_integrations set last_error='ok' where company_id='$CA' returning 1) select count(*) from u;" | tail -1)
[ "$v" = "1" ] && chk "Tenant A admin writes own provider_integrations = $v" "PASS" || chk "legit write = $v" "**FAIL**"
v=$(r x "$GOOD" "select count(*) from public.user_roles;")
[ "$v" -ge 1 ] && chk "user_roles SELECT: no infinite recursion ($v rows)" "PASS" || chk "user_roles recursion" "**FAIL**"

echo
echo "── D. ANONYMOUS"
v=$($P -c "set role anon; select set_config('request.jwt.claims','',false); select count(*) from public.provider_integrations;" | tail -1)
[ "$v" = "0" ] && chk "anon reads provider_integrations = $v" "PASS" || chk "anon = $v" "**FAIL**"
