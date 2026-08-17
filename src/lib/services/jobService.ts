'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface JobRow {
  id: string;
  job_number: string;
  title: string;
  client: string;
  site: string;
  assigned_to: string;
  assigned_color: string;
  assigned_initials: string;
  type: string;
  scheduled_date: string;
  scheduled_time: string;
  duration: string;
  job_status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  value: string;
  notes: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  jobNumber: string;
  title: string;
  client: string;
  site: string;
  assignedTo: string;
  assignedColor: string;
  assignedInitials: string;
  type: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  value: string;
  notes: string;
  companyId?: string | null;
}

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    jobNumber: row.job_number,
    title: row.title,
    client: row.client,
    site: row.site,
    assignedTo: row.assigned_to,
    assignedColor: row.assigned_color,
    assignedInitials: row.assigned_initials,
    type: row.type,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    duration: row.duration,
    status: row.job_status,
    priority: row.priority,
    value: row.value,
    notes: row.notes,
    companyId: row.company_id,
  };
}

function isSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  if (e.code && typeof e.code === 'string') {
    const cls = e.code.substring(0, 2);
    if (cls === '42' || cls === '08') return true;
    if (cls === '23') return false;
  }
  if (typeof e.message === 'string') {
    return /relation.*does not exist|column.*does not exist|function.*does not exist|syntax error/i.test(
      e.message
    );
  }
  return false;
}

export const jobService = {
  async getAll(companyId?: string | null): Promise<Job[]> {
    const supabase = createClient();
    try {
      let query = supabase.from('jobs').select('*').order('created_at', { ascending: false });
      if (companyId) query = query.eq('company_id', companyId);
      const { data, error } = await query;
      if (error) {
        if (isSchemaError(error)) throw error;
        logger.warn('jobService', 'Failed to fetch jobs', { companyId, error: error.message });
        return [];
      }
      return (data as JobRow[]).map(rowToJob);
    } catch (err: unknown) {
      logger.error('jobService', 'Schema error fetching jobs', { companyId }, err);
      throw err;
    }
  },

  async create(job: Omit<Job, 'id'>, companyId?: string | null): Promise<Job | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          job_number: job.jobNumber,
          title: job.title,
          client: job.client,
          site: job.site,
          assigned_to: job.assignedTo,
          assigned_color: job.assignedColor,
          assigned_initials: job.assignedInitials,
          type: job.type,
          scheduled_date: job.scheduledDate,
          scheduled_time: job.scheduledTime,
          duration: job.duration,
          job_status: job.status,
          priority: job.priority,
          value: job.value,
          notes: job.notes,
          company_id: companyId ?? job.companyId ?? null,
        })
        .select()
        .single();
      if (error) {
        if (isSchemaError(error)) throw error;
        logger.warn('jobService', 'Failed to create job', {
          title: job.title,
          error: error.message,
        });
        return null;
      }
      return rowToJob(data as JobRow);
    } catch (err: unknown) {
      logger.error('jobService', 'Schema error creating job', { title: job.title }, err);
      throw err;
    }
  },

  async updateStatus(id: string, status: Job['status']): Promise<Job | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('jobs')
        .update({ job_status: status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (isSchemaError(error)) throw error;
        logger.warn('jobService', 'Failed to update job status', {
          id,
          status,
          error: error.message,
        });
        return null;
      }
      return rowToJob(data as JobRow);
    } catch (err: unknown) {
      logger.error('jobService', 'Schema error updating job status', { id, status }, err);
      throw err;
    }
  },
};
