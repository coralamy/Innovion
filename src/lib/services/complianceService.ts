'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface ComplianceRow {
  id: string;
  title: string;
  category: 'license' | 'insurance' | 'certification' | 'whs' | 'induction';
  assigned_to: string;
  assigned_type: 'contractor' | 'employee' | 'company';
  comp_status: 'compliant' | 'expiring' | 'expired' | 'pending';
  expiry_date: string;
  days_until_expiry: number;
  issued_by: string;
  document_ref: string;
  last_reviewed: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceRecord {
  id: string;
  title: string;
  category: 'license' | 'insurance' | 'certification' | 'whs' | 'induction';
  assignedTo: string;
  assignedType: 'contractor' | 'employee' | 'company';
  status: 'compliant' | 'expiring' | 'expired' | 'pending';
  expiryDate: string;
  daysUntilExpiry: number;
  issuedBy: string;
  documentRef: string;
  lastReviewed: string;
  companyId?: string | null;
}

function rowToCompliance(row: ComplianceRow): ComplianceRecord {
  return {
    id: row.id, title: row.title, category: row.category, assignedTo: row.assigned_to,
    assignedType: row.assigned_type, status: row.comp_status, expiryDate: row.expiry_date,
    daysUntilExpiry: row.days_until_expiry, issuedBy: row.issued_by,
    documentRef: row.document_ref, lastReviewed: row.last_reviewed,
    companyId: row.company_id,
  };
}

export const complianceService = {
  async getAll(companyId?: string | null): Promise<ComplianceRecord[]> {
    const supabase = createClient();
    let query = supabase.from('compliance_items').select('*').order('created_at', { ascending: false });
    if (companyId) { query = query.eq('company_id', companyId); }
    const { data, error } = await query;
    if (error) { logger.error('complianceService', 'Failed to fetch compliance items', { companyId, error: error.message }); return []; }
    return (data as ComplianceRow[]).map(rowToCompliance);
  },

  async create(item: Omit<ComplianceRecord, 'id'>, companyId?: string | null): Promise<ComplianceRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('compliance_items').insert({
      title: item.title, category: item.category, assigned_to: item.assignedTo,
      assigned_type: item.assignedType, comp_status: item.status, expiry_date: item.expiryDate,
      days_until_expiry: item.daysUntilExpiry, issued_by: item.issuedBy,
      document_ref: item.documentRef, last_reviewed: item.lastReviewed,
      company_id: companyId ?? item.companyId ?? null,
    }).select().single();
    if (error) { logger.error('complianceService', 'Failed to create compliance item', { title: item.title, error: error.message }); return null; }
    return rowToCompliance(data as ComplianceRow);
  },

  async updateStatus(id: string, status: ComplianceRecord['status']): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('compliance_items').update({ comp_status: status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { logger.error('complianceService', 'Failed to update compliance status', { id, status, error: error.message }); return false; }
    return true;
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('compliance_items').delete().eq('id', id);
    if (error) { logger.error('complianceService', 'Failed to delete compliance item', { id, error: error.message }); return false; }
    return true;
  },
};
