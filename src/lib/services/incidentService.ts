'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface IncidentRow {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  inc_status: 'open' | 'investigating' | 'resolved' | 'closed';
  inc_type: 'injury' | 'near-miss' | 'property' | 'environmental' | 'security';
  site: string;
  reported_by: string;
  reported_date: string;
  resolved_date: string | null;
  assigned_to: string;
  actions: string[];
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  type: 'injury' | 'near-miss' | 'property' | 'environmental' | 'security';
  site: string;
  reportedBy: string;
  reportedDate: string;
  resolvedDate: string | null;
  assignedTo: string;
  actions: string[];
  companyId?: string | null;
}

function rowToIncident(row: IncidentRow): IncidentRecord {
  return {
    id: row.id, title: row.title, description: row.description, severity: row.severity,
    status: row.inc_status, type: row.inc_type, site: row.site, reportedBy: row.reported_by,
    reportedDate: row.reported_date, resolvedDate: row.resolved_date,
    assignedTo: row.assigned_to, actions: row.actions,
    companyId: row.company_id,
  };
}

export const incidentService = {
  async getAll(companyId?: string | null): Promise<IncidentRecord[]> {
    const supabase = createClient();
    let query = supabase.from('incidents').select('*').order('created_at', { ascending: false });
    if (companyId) { query = query.eq('company_id', companyId); }
    const { data, error } = await query;
    if (error) { logger.error('incidentService', 'Failed to fetch incidents', { companyId, error: error.message }); return []; }
    return (data as IncidentRow[]).map(rowToIncident);
  },

  async create(incident: Omit<IncidentRecord, 'id'>, companyId?: string | null): Promise<IncidentRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('incidents').insert({
      title: incident.title, description: incident.description, severity: incident.severity,
      inc_status: incident.status, inc_type: incident.type, site: incident.site,
      reported_by: incident.reportedBy, reported_date: incident.reportedDate,
      resolved_date: incident.resolvedDate, assigned_to: incident.assignedTo, actions: incident.actions,
      company_id: companyId ?? incident.companyId ?? null,
    }).select().single();
    if (error) { logger.error('incidentService', 'Failed to create incident', { title: incident.title, error: error.message }); return null; }
    return rowToIncident(data as IncidentRow);
  },

  async updateStatus(id: string, status: IncidentRecord['status']): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('incidents').update({ inc_status: status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { logger.error('incidentService', 'Failed to update incident status', { id, status, error: error.message }); return false; }
    return true;
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('incidents').delete().eq('id', id);
    if (error) { logger.error('incidentService', 'Failed to delete incident', { id, error: error.message }); return false; }
    return true;
  },
};
