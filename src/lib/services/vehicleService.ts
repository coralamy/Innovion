'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface VehicleRow {
  id: string;
  make: string;
  model: string;
  year: number;
  rego: string;
  vehicle_type: 'van' | 'ute' | 'truck' | 'car';
  vehicle_status: 'active' | 'maintenance' | 'out-of-service';
  assigned_to: string;
  location: string;
  odometer: string;
  fuel_type: 'petrol' | 'diesel' | 'electric';
  rego_expiry: string;
  insurance_expiry: string;
  next_service: string;
  last_service: string;
  color: string;
  notes: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleRecord {
  id: string;
  make: string;
  model: string;
  year: number;
  rego: string;
  type: 'van' | 'ute' | 'truck' | 'car';
  status: 'active' | 'maintenance' | 'out-of-service';
  assignedTo: string;
  location: string;
  odometer: string;
  fuelType: 'petrol' | 'diesel' | 'electric';
  regoExpiry: string;
  insuranceExpiry: string;
  nextService: string;
  lastService: string;
  color: string;
  notes: string;
  companyId?: string | null;
}

function rowToVehicle(row: VehicleRow): VehicleRecord {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    rego: row.rego,
    type: row.vehicle_type,
    status: row.vehicle_status,
    assignedTo: row.assigned_to,
    location: row.location,
    odometer: row.odometer,
    fuelType: row.fuel_type,
    regoExpiry: row.rego_expiry,
    insuranceExpiry: row.insurance_expiry,
    nextService: row.next_service,
    lastService: row.last_service,
    color: row.color,
    notes: row.notes,
    companyId: row.company_id,
  };
}

export const vehicleService = {
  async getAll(companyId?: string | null): Promise<VehicleRecord[]> {
    const supabase = createClient();
    let query = supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    const { data, error } = await query;
    if (error) {
      logger.error('vehicleService', 'Failed to fetch vehicles', {
        companyId,
        error: error.message,
      });
      return [];
    }
    return (data as VehicleRow[]).map(rowToVehicle);
  },

  async create(
    vehicle: Omit<VehicleRecord, 'id'>,
    companyId?: string | null
  ): Promise<VehicleRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        rego: vehicle.rego,
        vehicle_type: vehicle.type,
        vehicle_status: vehicle.status,
        assigned_to: vehicle.assignedTo,
        location: vehicle.location,
        odometer: vehicle.odometer,
        fuel_type: vehicle.fuelType,
        rego_expiry: vehicle.regoExpiry,
        insurance_expiry: vehicle.insuranceExpiry,
        next_service: vehicle.nextService,
        last_service: vehicle.lastService,
        color: vehicle.color,
        notes: vehicle.notes,
        company_id: companyId ?? vehicle.companyId ?? null,
      })
      .select()
      .single();
    if (error) {
      logger.error('vehicleService', 'Failed to create vehicle', {
        rego: vehicle.rego,
        error: error.message,
      });
      return null;
    }
    return rowToVehicle(data as VehicleRow);
  },

  async updateStatus(id: string, status: VehicleRecord['status']): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('vehicles')
      .update({ vehicle_status: status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      logger.error('vehicleService', 'Failed to update vehicle status', {
        id,
        status,
        error: error.message,
      });
      return false;
    }
    return true;
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) {
      logger.error('vehicleService', 'Failed to delete vehicle', { id, error: error.message });
      return false;
    }
    return true;
  },
};
