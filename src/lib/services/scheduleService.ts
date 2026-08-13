'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface ScheduledJob {
  id: string;
  jobNum: string;
  site: string;
  client: string;
  contractorId: string | null;
  contractorName: string;
  contractorInitials: string;
  scheduledDate: string;
  startTime: string;
  durationMinutes: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'issue' | 'unassigned';
  type: 'recurring' | 'one-off' | 'emergency' | 'inspection' | 'maintenance';
  priority: 'high' | 'medium' | 'low';
  region: string;
  hasConflict?: boolean;
  isRecurring?: boolean;
  instructions?: string;
  companyId?: string | null;
}

interface ScheduledJobRow {
  id: string;
  job_num: string;
  site: string;
  client: string;
  contractor_id: string | null;
  contractor_name: string;
  contractor_initials: string;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  type: string;
  priority: string;
  region: string;
  has_conflict: boolean;
  is_recurring: boolean;
  instructions: string;
  company_id: string | null;
  created_at: string;
}

function rowToJob(row: ScheduledJobRow): ScheduledJob {
  return {
    id: row.id,
    jobNum: row.job_num,
    site: row.site,
    client: row.client,
    contractorId: row.contractor_id,
    contractorName: row.contractor_name,
    contractorInitials: row.contractor_initials,
    scheduledDate: row.scheduled_date,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    status: row.status as ScheduledJob['status'],
    type: row.type as ScheduledJob['type'],
    priority: row.priority as ScheduledJob['priority'],
    region: row.region,
    hasConflict: row.has_conflict,
    isRecurring: row.is_recurring,
    instructions: row.instructions,
    companyId: row.company_id,
  };
}

export const scheduleService = {
  async getWeekJobs(weekStart: string, weekEnd: string, companyId?: string | null): Promise<ScheduledJob[]> {
    const supabase = createClient();
    let query = supabase
      .from('scheduled_jobs')
      .select('*')
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', weekEnd)
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true });
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query;
    if (error) { logger.error('scheduleService', 'Failed to fetch week jobs', { weekStart, weekEnd, companyId, error: error.message }); return []; }
    return (data as ScheduledJobRow[]).map(rowToJob);
  },

  async createJob(job: Omit<ScheduledJob, 'id'>, companyId?: string | null): Promise<ScheduledJob | null> {
    const supabase = createClient();
    const count = await supabase.from('scheduled_jobs').select('id', { count: 'exact', head: true });
    const jobNum = `JOB-${String((count.count || 0) + 1000 + 1).padStart(4, '0')}`;

    const { data, error } = await supabase
      .from('scheduled_jobs')
      .insert({
        job_num: jobNum,
        site: job.site,
        client: job.client,
        contractor_id: job.contractorId,
        contractor_name: job.contractorName,
        contractor_initials: job.contractorInitials,
        scheduled_date: job.scheduledDate,
        start_time: job.startTime,
        duration_minutes: job.durationMinutes,
        status: job.status,
        type: job.type,
        priority: job.priority,
        region: job.region || '',
        has_conflict: false,
        is_recurring: job.isRecurring || false,
        instructions: job.instructions || '',
        company_id: companyId ?? job.companyId ?? null,
      })
      .select()
      .single();
    if (error) { logger.error('scheduleService', 'Failed to create scheduled job', { site: job.site, error: error.message }); return null; }
    return rowToJob(data as ScheduledJobRow);
  },

  async updateJobStatus(id: string, status: ScheduledJob['status']): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('scheduled_jobs')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { logger.error('scheduleService', 'Failed to update job status', { id, status, error: error.message }); return false; }
    return true;
  },

  async deleteJob(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('scheduled_jobs').delete().eq('id', id);
    if (error) { logger.error('scheduleService', 'Failed to delete scheduled job', { id, error: error.message }); return false; }
    return true;
  },
};
