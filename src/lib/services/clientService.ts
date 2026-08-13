'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface ClientRow {
  id: string;
  name: string;
  contact_name: string;
  contact_role: string;
  industry: string;
  location: string;
  phone: string;
  email: string;
  active_contracts: number;
  total_jobs: number;
  monthly_value: string;
  total_revenue: string;
  client_status: 'active' | 'inactive' | 'at-risk';
  rating: number;
  since: string;
  next_service: string;
  logo: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  contactName: string;
  contactRole: string;
  industry: string;
  location: string;
  phone: string;
  email: string;
  activeContracts: number;
  totalJobs: number;
  monthlyValue: string;
  totalRevenue: string;
  status: 'active' | 'inactive' | 'at-risk';
  rating: number;
  since: string;
  nextService: string;
  logo: string;
  companyId?: string | null;
}

function rowToClient(row: ClientRow): ClientRecord {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    contactRole: row.contact_role,
    industry: row.industry,
    location: row.location,
    phone: row.phone,
    email: row.email,
    activeContracts: row.active_contracts,
    totalJobs: row.total_jobs,
    monthlyValue: row.monthly_value,
    totalRevenue: row.total_revenue,
    status: row.client_status,
    rating: row.rating,
    since: row.since,
    nextService: row.next_service,
    logo: row.logo,
    companyId: row.company_id,
  };
}

export const clientService = {
  async getAll(companyId?: string | null): Promise<ClientRecord[]> {
    const supabase = createClient();
    let query = supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (companyId) { query = query.eq('company_id', companyId); }
    const { data, error } = await query;
    if (error) { logger.error('clientService', 'Failed to fetch clients', { companyId, error: error.message }); return []; }
    return (data as ClientRow[]).map(rowToClient);
  },

  async create(client: Omit<ClientRecord, 'id'>, companyId?: string | null): Promise<ClientRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('clients').insert({
      name: client.name, contact_name: client.contactName, contact_role: client.contactRole,
      industry: client.industry, location: client.location, phone: client.phone, email: client.email,
      active_contracts: client.activeContracts, total_jobs: client.totalJobs,
      monthly_value: client.monthlyValue, total_revenue: client.totalRevenue,
      client_status: client.status, rating: client.rating, since: client.since,
      next_service: client.nextService, logo: client.logo,
      company_id: companyId ?? client.companyId ?? null,
    }).select().single();
    if (error) { logger.error('clientService', 'Failed to create client', { name: client.name, error: error.message }); return null; }
    return rowToClient(data as ClientRow);
  },

  async update(id: string, updates: Partial<ClientRecord>): Promise<ClientRecord | null> {
    const supabase = createClient();
    const dbUpdates: Partial<ClientRow> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.contactName !== undefined) dbUpdates.contact_name = updates.contactName;
    if (updates.contactRole !== undefined) dbUpdates.contact_role = updates.contactRole;
    if (updates.industry !== undefined) dbUpdates.industry = updates.industry;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.status !== undefined) dbUpdates.client_status = updates.status;
    const { data, error } = await supabase.from('clients').update({ ...dbUpdates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) { logger.error('clientService', 'Failed to update client', { id, error: error.message }); return null; }
    return rowToClient(data as ClientRow);
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) { logger.error('clientService', 'Failed to delete client', { id, error: error.message }); return false; }
    return true;
  },
};
