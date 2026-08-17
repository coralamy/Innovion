import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface SettingsRow {
  id: string;
  company_name: string;
  abn: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  timezone: string;
  currency: string;
  notif_email_compliance: boolean;
  notif_email_jobs: boolean;
  notif_email_incidents: boolean;
  notif_email_reports: boolean;
  notif_push_compliance: boolean;
  notif_push_jobs: boolean;
  notif_push_incidents: boolean;
  notif_sms_incidents: boolean;
  security_two_factor: boolean;
  security_session_timeout: string;
  security_ip_whitelist: boolean;
  security_audit_log: boolean;
  security_password_policy: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettingsRecord {
  id: string;
  companyName: string;
  abn: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  timezone: string;
  currency: string;
  notifEmailCompliance: boolean;
  notifEmailJobs: boolean;
  notifEmailIncidents: boolean;
  notifEmailReports: boolean;
  notifPushCompliance: boolean;
  notifPushJobs: boolean;
  notifPushIncidents: boolean;
  notifSmsIncidents: boolean;
  securityTwoFactor: boolean;
  securitySessionTimeout: string;
  securityIpWhitelist: boolean;
  securityAuditLog: boolean;
  securityPasswordPolicy: string;
  companyId?: string | null;
}

function rowToSettings(row: SettingsRow): SettingsRecord {
  return {
    id: row.id,
    companyName: row.company_name,
    abn: row.abn,
    email: row.email,
    phone: row.phone,
    address: row.address,
    website: row.website,
    timezone: row.timezone,
    currency: row.currency,
    notifEmailCompliance: row.notif_email_compliance,
    notifEmailJobs: row.notif_email_jobs,
    notifEmailIncidents: row.notif_email_incidents,
    notifEmailReports: row.notif_email_reports,
    notifPushCompliance: row.notif_push_compliance,
    notifPushJobs: row.notif_push_jobs,
    notifPushIncidents: row.notif_push_incidents,
    notifSmsIncidents: row.notif_sms_incidents,
    securityTwoFactor: row.security_two_factor,
    securitySessionTimeout: row.security_session_timeout,
    securityIpWhitelist: row.security_ip_whitelist,
    securityAuditLog: row.security_audit_log,
    securityPasswordPolicy: row.security_password_policy,
    companyId: row.company_id,
  };
}

export const settingsService = {
  async get(companyId?: string | null): Promise<SettingsRecord | null> {
    const supabase = createClient();
    let query = supabase.from('settings').select('*');
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    const { data, error } = await query.limit(1).single();
    if (error) {
      logger.warn('settingsService', 'Failed to fetch settings', {
        companyId,
        error: error.message,
      });
      return null;
    }
    return rowToSettings(data as SettingsRow);
  },

  async save(settings: Partial<SettingsRecord> & { id: string }): Promise<SettingsRecord | null> {
    const supabase = createClient();
    const dbUpdates: Partial<SettingsRow> = { updated_at: new Date().toISOString() };
    if (settings.companyName !== undefined) dbUpdates.company_name = settings.companyName;
    if (settings.abn !== undefined) dbUpdates.abn = settings.abn;
    if (settings.email !== undefined) dbUpdates.email = settings.email;
    if (settings.phone !== undefined) dbUpdates.phone = settings.phone;
    if (settings.address !== undefined) dbUpdates.address = settings.address;
    if (settings.website !== undefined) dbUpdates.website = settings.website;
    if (settings.timezone !== undefined) dbUpdates.timezone = settings.timezone;
    if (settings.currency !== undefined) dbUpdates.currency = settings.currency;
    if (settings.notifEmailCompliance !== undefined)
      dbUpdates.notif_email_compliance = settings.notifEmailCompliance;
    if (settings.notifEmailJobs !== undefined) dbUpdates.notif_email_jobs = settings.notifEmailJobs;
    if (settings.notifEmailIncidents !== undefined)
      dbUpdates.notif_email_incidents = settings.notifEmailIncidents;
    if (settings.notifEmailReports !== undefined)
      dbUpdates.notif_email_reports = settings.notifEmailReports;
    if (settings.notifPushCompliance !== undefined)
      dbUpdates.notif_push_compliance = settings.notifPushCompliance;
    if (settings.notifPushJobs !== undefined) dbUpdates.notif_push_jobs = settings.notifPushJobs;
    if (settings.notifPushIncidents !== undefined)
      dbUpdates.notif_push_incidents = settings.notifPushIncidents;
    if (settings.notifSmsIncidents !== undefined)
      dbUpdates.notif_sms_incidents = settings.notifSmsIncidents;
    if (settings.securityTwoFactor !== undefined)
      dbUpdates.security_two_factor = settings.securityTwoFactor;
    if (settings.securitySessionTimeout !== undefined)
      dbUpdates.security_session_timeout = settings.securitySessionTimeout;
    if (settings.securityIpWhitelist !== undefined)
      dbUpdates.security_ip_whitelist = settings.securityIpWhitelist;
    if (settings.securityAuditLog !== undefined)
      dbUpdates.security_audit_log = settings.securityAuditLog;
    if (settings.securityPasswordPolicy !== undefined)
      dbUpdates.security_password_policy = settings.securityPasswordPolicy;

    const { data, error } = await supabase
      .from('settings')
      .update(dbUpdates)
      .eq('id', settings.id)
      .select()
      .single();
    if (error) {
      logger.error('settingsService', 'Failed to save settings', {
        id: settings.id,
        error: error.message,
      });
      return null;
    }
    return rowToSettings(data as SettingsRow);
  },
};
