'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface SiteRow {
  id: string;
  name: string;
  client: string;
  address: string;
  suburb: string;
  state: string;
  site_type: string;
  area: string;
  floors: number;
  active_jobs: number;
  last_service: string;
  next_service: string;
  site_status: 'active' | 'inactive' | 'on-hold';
  assigned_team: string[];
  access_notes: string;
  frequency: string;
  logo: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteRecord {
  id: string;
  name: string;
  client: string;
  address: string;
  suburb: string;
  state: string;
  type: string;
  area: string;
  floors: number;
  activeJobs: number;
  lastService: string;
  nextService: string;
  status: 'active' | 'inactive' | 'on-hold';
  assignedTeam: string[];
  accessNotes: string;
  frequency: string;
  logo: string;
  companyId?: string | null;
}

function rowToSite(row: SiteRow): SiteRecord {
  return {
    id: row.id, name: row.name, client: row.client, address: row.address,
    suburb: row.suburb, state: row.state, type: row.site_type, area: row.area,
    floors: row.floors, activeJobs: row.active_jobs, lastService: row.last_service,
    nextService: row.next_service, status: row.site_status, assignedTeam: row.assigned_team,
    accessNotes: row.access_notes, frequency: row.frequency, logo: row.logo,
    companyId: row.company_id,
  };
}

export const siteService = {
  async getAll(companyId?: string | null): Promise<SiteRecord[]> {
    const supabase = createClient();
    let query = supabase.from('sites').select('*').order('created_at', { ascending: false });
    if (companyId) { query = query.eq('company_id', companyId); }
    const { data, error } = await query;
    if (error) { logger.error('siteService', 'Failed to fetch sites', { companyId, error: error.message }); return []; }
    return (data as SiteRow[]).map(rowToSite);
  },

  async create(site: Omit<SiteRecord, 'id'>, companyId?: string | null): Promise<SiteRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('sites').insert({
      name: site.name, client: site.client, address: site.address, suburb: site.suburb,
      state: site.state, site_type: site.type, area: site.area, floors: site.floors,
      active_jobs: site.activeJobs, last_service: site.lastService, next_service: site.nextService,
      site_status: site.status, assigned_team: site.assignedTeam, access_notes: site.accessNotes,
      frequency: site.frequency, logo: site.logo,
      company_id: companyId ?? site.companyId ?? null,
    }).select().single();
    if (error) { logger.error('siteService', 'Failed to create site', { name: site.name, error: error.message }); return null; }
    return rowToSite(data as SiteRow);
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) { logger.error('siteService', 'Failed to delete site', { id, error: error.message }); return false; }
    return true;
  },
};
