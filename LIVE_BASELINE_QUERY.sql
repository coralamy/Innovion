-- READ-ONLY. Reports, for each migration in the A+B+D chain, whether the
-- object it creates is present in the live database. Every marker was validated
-- against a locally-built full chain, so FALSE means "not applied", not
-- "bad marker".
WITH m(version, team, migration, kind, obj) AS (VALUES
  ('20260726055014', 'A', '20260726055014_innovion_core', 'table', 'public.contractors'),
  ('20260726090000', 'A', '20260726090000_innovion_extended', 'table', 'public.clients'),
  ('20260727000001', 'B', '20260727000001_checklist_responses', 'table', 'public.checklist_responses'),
  ('20260727000002', 'B', '20260727000002_issue_reports', 'table', 'public.issue_reports'),
  ('20260727000003', 'B', '20260727000003_messages', 'table', 'public.conversations'),
  ('20260727000004', 'B', '20260727000004_company_logo', 'column', 'settings|company_logo_url'),
  ('20260727000005', 'B', '20260727000005_supply_requests_notes_contractor_docs', 'table', 'public.supply_requests'),
  ('20260727000006', 'B', '20260727000006_company_id_rls_enforcement', 'function', 'get_my_company_id'),
  ('20260727010000', 'A', '20260727010000_add_company_id', 'function', 'get_user_company_id'),
  ('20260727020000', 'A', '20260727020000_scheduled_jobs_activity_rbac', 'table', 'public.scheduled_jobs'),
  ('20260727030000', 'A', '20260727030000_documents_storage_bucket', 'NONE', ''),
  ('20260727040000', 'A', '20260727040000_rls_notifications_invites', 'table', 'public.pending_invites'),
  ('20260728000000', 'A', '20260728000000_timesheet_invoices_stripe_templates', 'table', 'public.timesheet_audit_log'),
  ('20260728000001', 'B', '20260728000001_fix_contractors_user_id', 'function', 'get_my_company_id'),
  ('20260728000002', 'B', '20260728000002_rls_complete_audit', 'function', 'get_my_company_id'),
  ('20260728010000', 'A', '20260728010000_seed_onboarding', 'function', 'create_trial_subscription'),
  ('20260728020000', 'A', '20260728020000_i18n_localisation_partners', 'table', 'public.currencies'),
  ('20260728030000', 'A', '20260728030000_platform_api_layer', 'table', 'public.platform_api_keys'),
  ('20260731000001', 'B', '20260731000001_documents_bucket_and_cleanup', 'index', 'idx_jobs_company_date'),
  ('20260731070000', 'A', '20260731070000_production_hardening', 'function', 'is_company_admin'),
  ('20260806130000', 'A', '20260806130000_provider_integrations', 'table', 'public.provider_integrations'),
  ('20260807030000', 'A', '20260807030000_schema_push_indexes', 'index', 'idx_jobs_company_status'),
  ('20260807040000', 'A', '20260807040000_supervisor_rbac_encrypted_secrets', 'table', 'public.role_permissions'),
  ('20260807050000', 'A', '20260807050000_workforce_roster_notifications', 'table', 'public.notification_preferences'),
  ('20260807050002', 'D', '20260807050002_platform_foundation_schema', 'table', 'public.identity_user_profiles'),
  ('20260809000001', 'B', '20260809000001_device_tokens_and_security_hardening', 'table', 'public.device_tokens'),
  ('20260809160000', 'A', '20260809160000_pilot_readiness_security_sync', 'table', 'public.sync_idempotency_keys'),
  ('20260810000000', 'D', '20260810000000_platform_event_bus_runtime', 'table', 'public.platform_event_subscribers'),
  ('20260810140000', 'A', '20260810140000_integration_framework_phase1a', 'table', 'public.integration_oauth_credentials'),
  ('20260810160000', 'A', '20260810160000_integration_prereqs_phase1b', 'table', 'public.integration_event_bus_outbox'),
  ('20260811000000', 'A', '20260811000000_xero_connector_phase1b', 'column', 'integration_sync_jobs|sync_cursor'),
  ('20260816120000', 'A', '20260816120000_notification_type_geofence_anomaly', 'NONE', ''),
  ('20260817000000', 'A', '20260817000000_tenant_authority_remediation', 'function', 'innovion_auth_company_ids'),
  ('20260817000001', 'B', '20260817000001_tenant_authority_hardening', 'function', 'get_my_company_id'),
  ('20260817000002', 'B', '20260817000002_issue_attachment_storage_isolation', 'NONE', ''),
  ('20260817000003', 'B', '20260817000003_isolation_policy_consolidation', 'function', 'request_jwt_role'),
  ('20260817000500', 'D', '20260817000500_platform_authority_hardening', 'table', 'public.platform_tenants'),
  ('20260817001000', 'A', '20260817001000_tenant_authority_helpers_and_bootstrap', 'function', 'get_my_company_id'),
  ('20260817002000', 'A', '20260817002000_tenant_authority_close_metadata_vectors', 'function', 'get_user_company_id'),
  ('20260817003000', 'A', '20260817003000_remove_dev_encryption_key_fallback', 'function', 'innovion_encryption_key'),
  ('20260817003500', 'A', '20260817003500_purge_fictitious_seed_data', 'NONE', ''),
  ('20260817004000', 'A', '20260817004000_close_null_tenant_escape', 'policy', 'company_localisation|company_localisation_select'),
  ('20260817005000', 'A', '20260817005000_storage_tenant_isolation', 'function', 'innovion_storage_tenant_ok'),
  ('20260817006000', 'A', '20260817006000_integration_credential_authority', 'policy', 'integration_oauth_credentials|integration_oauth_creds_read'),
  ('20260817006500', 'A', '20260817006500_view_security_invoker', 'NONE', ''),
  ('20260817007000', 'A', '20260817007000_platform_operator_scoping', 'table', 'public.platform_operators'),
  ('20260817008000', 'A', '20260817008000_secdef_search_path_hardening', 'NONE', ''),
  ('20260817010000', 'A', '20260817010000_company_branding_columns', 'column', 'companies|primary_colour'),
  ('20260817011000', 'A', '20260817011000_contractor_rates', 'column', 'contractors|hourly_rate'),
  ('20260818000100', 'A', '20260818000100_abd_authority_reconciliation', 'function', 'innovion_contractor_company_ids'),
  ('20260818000200', 'B', '20260818000200_workforce_data_access_carveouts', 'NONE', ''),
  ('20260818000300', 'A', '20260818000300_workforce_carveout_assertions', 'NONE', ''),
  ('20260818000400', 'D', '20260818000400_innovion_tenancy_projection', 'function', 'platform_tenant_id_for_company'),
  ('20260818000500', 'A', '20260818000500_tenant_directory_scope', 'NONE', ''),
  ('20260818000600', 'A', '20260818000600_tenancy_projection_refresh', 'function', 'innovion_refresh_tenancy_projection'),
  ('20260818000700', 'A', '20260818000700_user_roles_company_fk', 'index', 'idx_user_roles_company_id')
)
SELECT m.team, m.migration, m.kind,
       CASE m.kind
         WHEN 'table'    THEN to_regclass(m.obj) IS NOT NULL
         WHEN 'function' THEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                                       WHERE n.nspname='public' AND p.proname=m.obj)
         WHEN 'policy'   THEN EXISTS (SELECT 1 FROM pg_policies
                                       WHERE schemaname='public'
                                         AND tablename=split_part(m.obj,'|',1)
                                         AND policyname=split_part(m.obj,'|',2))
         WHEN 'column'   THEN EXISTS (SELECT 1 FROM information_schema.columns
                                       WHERE table_schema='public'
                                         AND table_name=split_part(m.obj,'|',1)
                                         AND column_name=split_part(m.obj,'|',2))
         WHEN 'index'    THEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=m.obj)
         ELSE NULL
       END AS applied
  FROM m
 ORDER BY m.version;

-- The exact definition of the hand-added foreign key, including its ON DELETE
-- action. 20260818000700 requires ON DELETE CASCADE and aborts otherwise.
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.user_roles'::regclass AND contype = 'f';

-- Is company_id NOT NULL live? 20260818000700 sets it.
SELECT is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND table_name='user_roles' AND column_name='company_id';
