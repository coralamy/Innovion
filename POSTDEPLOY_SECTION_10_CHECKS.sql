SELECT
  (SELECT count(*) FROM supabase_migrations.schema_migrations)                    AS "10_1_applied_total",
  (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND policyname LIKE 'company_access_%')             AS "10_2_company_access_remaining",
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v'
      AND NOT COALESCE(c.reloptions,'{}') && ARRAY['security_invoker=true','security_invoker=on'])
                                                                                  AS "10_2_views_bypassing_rls",
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig,'{}')) cfg WHERE cfg LIKE 'search_path=%'))
                                                                                  AS "10_2_secdef_unpinned",
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity)          AS "10_2_tables_without_rls",
  (SELECT CASE confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'a' THEN 'NO ACTION'
                           WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL'
                           WHEN 'd' THEN 'SET DEFAULT' END
     FROM pg_constraint
    WHERE conrelid='public.user_roles'::regclass AND contype='f'
      AND confrelid='public.companies'::regclass)                                 AS "10_3_fk_on_delete",
  (SELECT count(*) FROM pg_trigger
    WHERE tgname LIKE 'innovion_tenancy_projection%')                             AS "10_4_refresh_triggers",
  (SELECT count(*) FROM public.platform_tenants WHERE company_id IS NOT NULL)     AS "10_4_projected_tenants",
  (SELECT count(*) FROM public.innovion_tenant_directory)                         AS "10_4_directory_tenants",
  (SELECT count(*) FROM public.companies)                                         AS "10_5_companies_total",
  (SELECT count(*) FROM public.companies WHERE owner_id IS NULL)                  AS "10_5_ownerless_companies",
  (SELECT count(*) FROM public.user_roles)                                        AS "10_5_role_grants",
  (SELECT count(*) FROM public.jobs)                                              AS "10_5_jobs",
  (SELECT count(*) FROM public.documents)                                         AS "10_5_documents",
  (SELECT count(*) FROM public.settings)                                          AS "10_5_settings";
