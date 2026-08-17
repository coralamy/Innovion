import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export type ActivityAction =
  | 'job_created'
  | 'job_completed'
  | 'job_cancelled'
  | 'issue_raised'
  | 'user_invited'
  | 'clock_in'
  | 'clock_out'
  | 'document_uploaded'
  | 'compliance_alert'
  | 'photo_uploaded'
  | 'company_created'
  | 'contractor_added'
  | 'site_created'
  | 'checklist_completed'
  // Deleting a document is an auditable act; the documents page already logged
  // it, but the action was absent from this union so the call did not compile.
  | 'document_deleted'
  | 'incident_reported'
  | 'settings_updated'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'user_role_changed'
  | 'invoice_created'
  | 'timesheet_approved'
  | 'timesheet_rejected'
  | 'vehicle_updated'
  | 'inventory_updated'
  | 'compliance_updated'
  | 'incident_updated';

interface LogActivityParams {
  userId: string;
  companyId?: string | null;
  action: ActivityAction;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('activity_log').insert({
      user_id: params.userId,
      company_id: params.companyId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      description: params.description,
      metadata: params.metadata ?? null,
    });
    if (error) {
      logger.warn('activityLogger', 'Failed to persist activity log entry', {
        action: params.action,
        entityType: params.entityType,
        error: error.message,
      });
    }
  } catch (err) {
    logger.error(
      'activityLogger',
      'Unexpected error writing activity log',
      {
        action: params.action,
        entityType: params.entityType,
      },
      err
    );
  }
}
