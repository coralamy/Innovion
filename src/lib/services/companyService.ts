'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface CompanyRow {
  id: string;
  name: string;
  company_type: 'client' | 'contractor' | 'partner';
  industry: string;
  location: string;
  phone: string;
  email: string;
  contacts: number;
  active_jobs: number;
  revenue: string;
  comp_status: 'active' | 'inactive' | 'pending';
  since: string;
  logo: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyRecord {
  id: string;
  name: string;
  type: 'client' | 'contractor' | 'partner';
  industry: string;
  location: string;
  phone: string;
  email: string;
  contacts: number;
  activeJobs: number;
  revenue: string;
  status: 'active' | 'inactive' | 'pending';
  since: string;
  logo: string;
  companyId?: string | null;
}

function rowToCompany(row: CompanyRow): CompanyRecord {
  return {
    id: row.id, name: row.name, type: row.company_type, industry: row.industry,
    location: row.location, phone: row.phone, email: row.email, contacts: row.contacts,
    activeJobs: row.active_jobs, revenue: row.revenue, status: row.comp_status,
    since: row.since, logo: row.logo, companyId: row.company_id,
  };
}

export const companyService = {
  async getAll(companyId?: string | null): Promise<CompanyRecord[]> {
    const supabase = createClient();
    let query = supabase.from('companies').select('*').order('created_at', { ascending: false });
    if (companyId) { query = query.eq('company_id', companyId); }
    const { data, error } = await query;
    if (error) { logger.error('companyService', 'Failed to fetch companies', { companyId, error: error.message }); return []; }
    return (data as CompanyRow[]).map(rowToCompany);
  },

  async create(company: Omit<CompanyRecord, 'id'>, companyId?: string | null): Promise<CompanyRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('companies').insert({
      name: company.name, company_type: company.type, industry: company.industry,
      location: company.location, phone: company.phone, email: company.email,
      contacts: company.contacts, active_jobs: company.activeJobs, revenue: company.revenue,
      comp_status: company.status, since: company.since, logo: company.logo,
      company_id: companyId ?? company.companyId ?? null,
    }).select().single();
    if (error) { logger.error('companyService', 'Failed to create company', { name: company.name, error: error.message }); return null; }
    return rowToCompany(data as CompanyRow);
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) { logger.error('companyService', 'Failed to delete company', { id, error: error.message }); return false; }
    return true;
  },
};
