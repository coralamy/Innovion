'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface EmployeeRow {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  location: string;
  emp_status: 'active' | 'on-leave' | 'terminated';
  employment_type: 'full-time' | 'part-time' | 'casual';
  start_date: string;
  salary: string;
  hours_this_week: number;
  jobs_completed: number;
  rating: number;
  initials: string;
  color: string;
  skills: string[];
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRecord {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  location: string;
  status: 'active' | 'on-leave' | 'terminated';
  employmentType: 'full-time' | 'part-time' | 'casual';
  startDate: string;
  salary: string;
  hoursThisWeek: number;
  jobsCompleted: number;
  rating: number;
  initials: string;
  color: string;
  skills: string[];
  companyId?: string | null;
}

function rowToEmployee(row: EmployeeRow): EmployeeRecord {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    department: row.department,
    phone: row.phone,
    email: row.email,
    location: row.location,
    status: row.emp_status,
    employmentType: row.employment_type,
    startDate: row.start_date,
    salary: row.salary,
    hoursThisWeek: row.hours_this_week,
    jobsCompleted: row.jobs_completed,
    rating: row.rating,
    initials: row.initials,
    color: row.color,
    skills: row.skills,
    companyId: row.company_id,
  };
}

export const employeeService = {
  async getAll(companyId?: string | null): Promise<EmployeeRecord[]> {
    const supabase = createClient();
    let query = supabase.from('employees').select('*').order('created_at', { ascending: false });
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    const { data, error } = await query;
    if (error) {
      logger.error('employeeService', 'Failed to fetch employees', {
        companyId,
        error: error.message,
      });
      return [];
    }
    return (data as EmployeeRow[]).map(rowToEmployee);
  },

  async create(
    emp: Omit<EmployeeRecord, 'id'>,
    companyId?: string | null
  ): Promise<EmployeeRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('employees')
      .insert({
        name: emp.name,
        role: emp.role,
        department: emp.department,
        phone: emp.phone,
        email: emp.email,
        location: emp.location,
        emp_status: emp.status,
        employment_type: emp.employmentType,
        start_date: emp.startDate,
        salary: emp.salary,
        hours_this_week: emp.hoursThisWeek,
        jobs_completed: emp.jobsCompleted,
        rating: emp.rating,
        initials: emp.initials,
        color: emp.color,
        skills: emp.skills,
        company_id: companyId ?? emp.companyId ?? null,
      })
      .select()
      .single();
    if (error) {
      logger.error('employeeService', 'Failed to create employee', {
        name: emp.name,
        error: error.message,
      });
      return null;
    }
    return rowToEmployee(data as EmployeeRow);
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) {
      logger.error('employeeService', 'Failed to delete employee', { id, error: error.message });
      return false;
    }
    return true;
  },
};
