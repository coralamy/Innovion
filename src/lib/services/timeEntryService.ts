'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface TimeEntryRow {
  id: string;
  entry_date: string;
  contractor: string;
  initials: string;
  color: string;
  job: string;
  site: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number | null;
  entry_status: 'active' | 'on-break' | 'completed';
  company_id: string | null;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  date: string;
  contractor: string;
  initials: string;
  color: string;
  job: string;
  site: string;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  totalHours: number | null;
  status: 'active' | 'on-break' | 'completed';
  companyId?: string | null;
}

function rowToEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    date: row.entry_date,
    contractor: row.contractor,
    initials: row.initials,
    color: row.color,
    job: row.job,
    site: row.site,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    breakMinutes: row.break_minutes,
    totalHours: row.total_hours,
    status: row.entry_status,
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
    return /relation.*does not exist|column.*does not exist|function.*does not exist|syntax error/i.test(e.message);
  }
  return false;
}

export const timeEntryService = {
  async getAll(companyId?: string | null): Promise<TimeEntry[]> {
    const supabase = createClient();
    try {
      let query = supabase.from('time_entries').select('*').order('created_at', { ascending: false });
      if (companyId) { query = query.eq('company_id', companyId); }
      const { data, error } = await query;
      if (error) {
        if (isSchemaError(error)) throw error;
        logger.warn('timeEntryService', 'Failed to fetch time entries', { companyId, error: error.message });
        return [];
      }
      return (data as TimeEntryRow[]).map(rowToEntry);
    } catch (err: unknown) {
      logger.error('timeEntryService', 'Schema error fetching time entries', { companyId }, err);
      throw err;
    }
  },

  async create(entry: Omit<TimeEntry, 'id'>, companyId?: string | null): Promise<TimeEntry | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          entry_date: entry.date,
          contractor: entry.contractor,
          initials: entry.initials,
          color: entry.color,
          job: entry.job,
          site: entry.site,
          clock_in: entry.clockIn,
          clock_out: entry.clockOut,
          break_minutes: entry.breakMinutes,
          total_hours: entry.totalHours,
          entry_status: entry.status,
          company_id: companyId ?? entry.companyId ?? null,
        })
        .select()
        .single();
      if (error) {
        if (isSchemaError(error)) throw error;
        logger.warn('timeEntryService', 'Failed to create time entry', { contractor: entry.contractor, error: error.message });
        return null;
      }
      return rowToEntry(data as TimeEntryRow);
    } catch (err: unknown) {
      logger.error('timeEntryService', 'Schema error creating time entry', { contractor: entry.contractor }, err);
      throw err;
    }
  },
};
