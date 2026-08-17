'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface ContractorRow {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  location: string;
  skills: string[];
  rating: number;
  jobs_completed: number;
  hours_this_week: number;
  availability: 'available' | 'on-job' | 'unavailable' | 'leave';
  compliance_status: 'compliant' | 'expiring' | 'expired';
  license_expiry: string;
  insurance_expiry: string;
  joined_date: string;
  initials: string;
  color: string;
  hourly_rate: number | null;
  abn: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contractor {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  location: string;
  skills: string[];
  rating: number;
  jobsCompleted: number;
  hoursThisWeek: number;
  availability: 'available' | 'on-job' | 'unavailable' | 'leave';
  complianceStatus: 'compliant' | 'expiring' | 'expired';
  licenseExpiry: string;
  insuranceExpiry: string;
  joinedDate: string;
  initials: string;
  color: string;
  /** Agreed charge-out rate. Added 20260817011000 — see migration for the
   *  invoicing defect this closes. */
  hourlyRate: number | null;
  /** Contractor business identifier (ABN/NZBN/EIN). */
  abn: string | null;
  companyId?: string | null;
}

function rowToContractor(row: ContractorRow): Contractor {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    location: row.location,
    skills: row.skills,
    rating: row.rating,
    jobsCompleted: row.jobs_completed,
    hoursThisWeek: row.hours_this_week,
    availability: row.availability,
    complianceStatus: row.compliance_status,
    licenseExpiry: row.license_expiry,
    insuranceExpiry: row.insurance_expiry,
    joinedDate: row.joined_date,
    initials: row.initials,
    color: row.color,
    hourlyRate: row.hourly_rate ?? null,
    abn: row.abn ?? null,
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

export const contractorService = {
  async getAll(companyId?: string | null): Promise<Contractor[]> {
    const supabase = createClient();
    try {
      let query = supabase.from('contractors').select('*').order('name', { ascending: true });
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data, error } = await query;
      if (error) {
        if (isSchemaError(error)) throw error;
        logger.warn('contractorService', 'Failed to fetch contractors', {
          companyId,
          error: error.message,
        });
        return [];
      }
      return (data as ContractorRow[]).map(rowToContractor);
    } catch (err: unknown) {
      logger.error('contractorService', 'Schema error fetching contractors', { companyId }, err);
      throw err;
    }
  },

  async create(
    contractor: Omit<Contractor, 'id'>,
    companyId?: string | null
  ): Promise<Contractor | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('contractors')
        .insert({
          name: contractor.name,
          role: contractor.role,
          phone: contractor.phone,
          email: contractor.email,
          location: contractor.location,
          skills: contractor.skills,
          rating: contractor.rating,
          jobs_completed: contractor.jobsCompleted,
          hours_this_week: contractor.hoursThisWeek,
          availability: contractor.availability,
          compliance_status: contractor.complianceStatus,
          license_expiry: contractor.licenseExpiry,
          insurance_expiry: contractor.insuranceExpiry,
          joined_date: contractor.joinedDate,
          initials: contractor.initials,
          color: contractor.color,
          hourly_rate: contractor.hourlyRate ?? null,
          abn: contractor.abn ?? null,
          company_id: companyId ?? contractor.companyId ?? null,
        })
        .select()
        .single();
      if (error) {
        if (isSchemaError(error)) throw error;
        logger.warn('contractorService', 'Failed to create contractor', {
          name: contractor.name,
          error: error.message,
        });
        return null;
      }
      return rowToContractor(data as ContractorRow);
    } catch (err: unknown) {
      logger.error(
        'contractorService',
        'Schema error creating contractor',
        { name: contractor.name },
        err
      );
      throw err;
    }
  },

  async update(id: string, updates: Partial<Contractor>): Promise<Contractor | null> {
    const supabase = createClient();
    const dbUpdates: any = {};
    if (updates.availability !== undefined) dbUpdates.availability = updates.availability;
    if (updates.complianceStatus !== undefined)
      dbUpdates.compliance_status = updates.complianceStatus;
    if (updates.hoursThisWeek !== undefined) dbUpdates.hours_this_week = updates.hoursThisWeek;
    if (updates.jobsCompleted !== undefined) dbUpdates.jobs_completed = updates.jobsCompleted;
    if (updates.hourlyRate !== undefined) dbUpdates.hourly_rate = updates.hourlyRate;
    if (updates.abn !== undefined) dbUpdates.abn = updates.abn;
    dbUpdates.updated_at = new Date().toISOString();
    try {
      const { data, error } = await supabase
        .from('contractors')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (isSchemaError(error)) throw error;
        logger.warn('contractorService', 'Failed to update contractor', {
          id,
          error: error.message,
        });
        return null;
      }
      return rowToContractor(data as ContractorRow);
    } catch (err: unknown) {
      logger.error('contractorService', 'Schema error updating contractor', { id }, err);
      throw err;
    }
  },
};
