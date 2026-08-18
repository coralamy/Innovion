-- SECTION A - migrations with a marker object unique to them.
WITH m(version, team, migration, kind, obj) AS (VALUES
  ('20260728000001', 'B', '20260728000001_fix_contractors_user_id', 'index', 'idx_contractors_user_id'),
  ('20260807030000', 'A', '20260807030000_schema_push_indexes', 'index', 'idx_compliance_items_company_status'),
  ('20260816120000', 'A', '20260816120000_notification_type_geofence_anomaly', 'enumvalue', 'notification_type|geofence_anomaly'),
  ('20260817000001', 'B', '20260817000001_tenant_authority_hardening', 'policy', 'public|contractors|contractors_select_own'),
  ('20260817000002', 'B', '20260817000002_issue_attachment_storage_isolation', 'policy', 'storage|objects|issue_photos_select_own'),
  ('20260817001000', 'A', '20260817001000_tenant_authority_helpers_and_bootstrap', 'function', 'innovion_owns_company')
)
SELECT 'A. object marker' AS section,
       m.team || '  ' || m.migration AS item,
       CASE m.kind
         WHEN 'table'     THEN (to_regclass(m.obj) IS NOT NULL)::text
         WHEN 'function'  THEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                                        WHERE n.nspname='public' AND p.proname=m.obj)::text
         WHEN 'policy'    THEN EXISTS (SELECT 1 FROM pg_policies
                                        WHERE schemaname=split_part(m.obj,'|',1)
                                          AND tablename=split_part(m.obj,'|',2)
                                          AND policyname=split_part(m.obj,'|',3))::text
         WHEN 'index'     THEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=m.obj)::text
         WHEN 'trigger'   THEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname=m.obj AND NOT tgisinternal)::text
         WHEN 'column'    THEN EXISTS (SELECT 1 FROM information_schema.columns
                                        WHERE table_schema='public'
                                          AND table_name=split_part(m.obj,'|',1)
                                          AND column_name=split_part(m.obj,'|',2))::text
         WHEN 'enumvalue' THEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type ty ON ty.oid=e.enumtypid
                                        WHERE ty.typname=split_part(m.obj,'|',1)
                                          AND e.enumlabel=split_part(m.obj,'|',2))::text
         WHEN 'bucket'    THEN EXISTS (SELECT 1 FROM storage.buckets WHERE id=m.obj)::text
       END AS value,
       m.kind || ' ' || m.obj AS interpretation
  FROM m

UNION ALL

-- SECTION B - migrations that create no unique object. Reported as COUNTS so a
-- vacuous zero cannot be mistaken for success, context rows included.
SELECT 'B. state probe', item, value, interpretation FROM (
  SELECT '20260727030000_documents_storage_bucket' AS item, ((SELECT count(*) FROM storage.buckets WHERE id='documents'))::text AS value, '1 = applied' AS interpretation
  UNION ALL
  SELECT '20260817002000_tenant_authority_close_metadata_vectors' AS item, ((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='get_user_company_id'
        AND pg_get_functiondef(p.oid) LIKE '%get_my_company_id%'))::text AS value, '1 = applied (delegates to the unified resolver)' AS interpretation
  UNION ALL
  SELECT '20260817004000_close_null_tenant_escape' AS item, ((SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'company_access_%'))::text AS value, '0 = applied, >0 = NOT applied (that many null-tenant policies remain)' AS interpretation
  UNION ALL
  SELECT '20260817006500_view_security_invoker' AS item, ((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='v'
        AND NOT COALESCE(c.reloptions,'{}') && ARRAY['security_invoker=true','security_invoker=on']))::text AS value, '0 = applied, >0 = that many views still bypass RLS' AS interpretation
  UNION ALL
  SELECT '20260817006500_view_security_invoker  [total views, for context]' AS item, ((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='v'))::text AS value, 'context: if 0, the check above is vacuous' AS interpretation
  UNION ALL
  SELECT '20260817008000_secdef_search_path_hardening' AS item, ((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prosecdef
        AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig,'{}')) cfg WHERE cfg LIKE 'search_path=%')))::text AS value, '0 = applied, >0 = that many SECURITY DEFINER functions unpinned' AS interpretation
  UNION ALL
  SELECT '20260817008000_secdef_search_path_hardening  [total secdef, for context]' AS item, ((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prosecdef))::text AS value, 'context: if 0, the check above is vacuous' AS interpretation
  UNION ALL
  SELECT '20260817003500_purge_fictitious_seed_data' AS item, ((SELECT count(*) FROM public.companies WHERE company_id IS NULL AND owner_id IS NULL))::text AS value, 'tenant-less company rows, 0 is consistent with applied but not proof' AS interpretation
) b

UNION ALL

-- SECTION C - the foreign key delete action, read from pg_catalog rather than a
-- truncatable text column. 20260818000700 requires CASCADE and aborts otherwise.
SELECT 'C. user_roles FK', conname,
       CASE confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
                        WHEN 'c' THEN 'CASCADE'  WHEN 'n' THEN 'SET NULL'
                        WHEN 'd' THEN 'SET DEFAULT' ELSE confdeltype::text END,
       'references ' || confrelid::regclass::text
  FROM pg_constraint
 WHERE conrelid = 'public.user_roles'::regclass AND contype = 'f'

ORDER BY 1, 2;
