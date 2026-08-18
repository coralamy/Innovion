SELECT
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'supabase_migrations' AND c.relname = 'schema_migrations')  AS "2_1_ledger_exists",
  (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND policyname LIKE 'company_access_%')             AS "2_2_company_access",
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v')                                   AS "2_2_views_total",
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v'
      AND NOT COALESCE(c.reloptions,'{}') && ARRAY['security_invoker=true','security_invoker=on'])
                                                                                  AS "2_2_views_unsafe",
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef)                                     AS "2_2_secdef_total",
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig,'{}')) cfg WHERE cfg LIKE 'search_path=%'))
                                                                                  AS "2_2_secdef_unpinned",
  (SELECT CASE confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'c' THEN 'CASCADE'
                           WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL'
                           WHEN 'd' THEN 'SET DEFAULT' END
     FROM pg_constraint
    WHERE conrelid='public.user_roles'::regclass AND contype='f'
      AND confrelid='public.companies'::regclass)                                 AS "2_3_fk_on_delete",
  (SELECT count(*) FROM public.companies WHERE owner_id IS NULL)                  AS "2_4_ownerless_companies",
  (SELECT count(*) FROM public.documents WHERE company_id IS NULL)                AS "2_4_tenantless_documents",
  (SELECT count(*) FROM public.settings  WHERE company_id IS NULL)                AS "2_4_tenantless_settings",
  (SELECT count(*) FROM public.user_roles ur
    WHERE ur.company_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ur.company_id))
                                                                                  AS "2_4_orphan_role_grants",
  (SELECT count(*) FROM public.companies)                                         AS "ref_companies_total",
  (SELECT count(*) FROM public.user_roles)                                        AS "ref_role_grants",
  (SELECT count(*) FROM public.jobs)                                              AS "ref_jobs";
