'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface ChecklistRow {
  id: string;
  title: string;
  checklist_type: 'daily-job' | 'site-inspection' | 'safety';
  site: string;
  job: string;
  assigned_to: string;
  initials: string;
  avatar_color: string;
  checklist_date: string;
  checklist_status: 'pending' | 'in-progress' | 'completed' | 'flagged';
  sections: any[];
  signed_off_by: string | null;
  signed_off_at: string | null;
  signature_data: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTask {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  notes: string;
  photos: string[];
}

export interface ChecklistSection {
  id: string;
  title: string;
  tasks: ChecklistTask[];
}

export interface Checklist {
  id: string;
  title: string;
  type: 'daily-job' | 'site-inspection' | 'safety';
  site: string;
  job: string;
  assignedTo: string;
  initials: string;
  avatarColor: string;
  date: string;
  status: 'pending' | 'in-progress' | 'completed' | 'flagged';
  sections: ChecklistSection[];
  signedOffBy: string | null;
  signedOffAt: string | null;
  signatureData: string | null;
  companyId?: string | null;
}

function rowToChecklist(row: ChecklistRow): Checklist {
  return {
    id: row.id, title: row.title, type: row.checklist_type, site: row.site, job: row.job,
    assignedTo: row.assigned_to, initials: row.initials, avatarColor: row.avatar_color,
    date: row.checklist_date, status: row.checklist_status, sections: row.sections,
    signedOffBy: row.signed_off_by, signedOffAt: row.signed_off_at,
    signatureData: row.signature_data, companyId: row.company_id,
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

export const checklistService = {
  async getAll(companyId?: string | null): Promise<Checklist[]> {
    const supabase = createClient();
    try {
      let query = supabase.from('checklists').select('*').order('created_at', { ascending: false });
      if (companyId) { query = query.eq('company_id', companyId); }
      const { data, error } = await query;
      if (error) {
        if (isSchemaError(error)) throw error;
        logger.warn('checklistService', 'Failed to fetch checklists', { companyId, error: error.message });
        return [];
      }
      return (data as ChecklistRow[]).map(rowToChecklist);
    } catch (err: unknown) {
      logger.error('checklistService', 'Schema error fetching checklists', { companyId }, err);
      throw err;
    }
  },

  async update(id: string, updates: Partial<Checklist>): Promise<Checklist | null> {
    const supabase = createClient();
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.status !== undefined) dbUpdates.checklist_status = updates.status;
    if (updates.sections !== undefined) dbUpdates.sections = updates.sections;
    if (updates.signedOffBy !== undefined) dbUpdates.signed_off_by = updates.signedOffBy;
    if (updates.signedOffAt !== undefined) dbUpdates.signed_off_at = updates.signedOffAt;
    if (updates.signatureData !== undefined) dbUpdates.signature_data = updates.signatureData;
    try {
      const { data, error } = await supabase
        .from('checklists')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (isSchemaError(error)) throw error;
        logger.warn('checklistService', 'Failed to update checklist', { id, error: error.message });
        return null;
      }
      return rowToChecklist(data as ChecklistRow);
    } catch (err: unknown) {
      logger.error('checklistService', 'Schema error updating checklist', { id }, err);
      throw err;
    }
  },

  async create(checklist: Omit<Checklist, 'id'>, companyId?: string | null): Promise<Checklist | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('checklists')
        .insert({
          title: checklist.title, checklist_type: checklist.type, site: checklist.site,
          job: checklist.job, assigned_to: checklist.assignedTo, initials: checklist.initials,
          avatar_color: checklist.avatarColor, checklist_date: checklist.date,
          checklist_status: checklist.status, sections: checklist.sections,
          signed_off_by: checklist.signedOffBy, signed_off_at: checklist.signedOffAt,
          signature_data: checklist.signatureData,
          company_id: companyId ?? checklist.companyId ?? null,
        })
        .select()
        .single();
      if (error) {
        if (isSchemaError(error)) throw error;
        logger.warn('checklistService', 'Failed to create checklist', { title: checklist.title, error: error.message });
        return null;
      }
      return rowToChecklist(data as ChecklistRow);
    } catch (err: unknown) {
      logger.error('checklistService', 'Schema error creating checklist', { title: checklist.title }, err);
      throw err;
    }
  },
};
