'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface InventoryRow {
  id: string;
  name: string;
  sku: string;
  category: 'chemicals' | 'equipment' | 'ppe' | 'consumables' | 'tools';
  current_stock: number;
  min_stock: number;
  max_stock: number;
  unit: string;
  unit_cost: string;
  total_value: string;
  supplier: string;
  location: string;
  last_restocked: string;
  inv_status: 'in-stock' | 'low-stock' | 'out-of-stock';
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryRecord {
  id: string;
  name: string;
  sku: string;
  category: 'chemicals' | 'equipment' | 'ppe' | 'consumables' | 'tools';
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  unitCost: string;
  totalValue: string;
  supplier: string;
  location: string;
  lastRestocked: string;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  companyId?: string | null;
}

function rowToInventory(row: InventoryRow): InventoryRecord {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    currentStock: row.current_stock,
    minStock: row.min_stock,
    maxStock: row.max_stock,
    unit: row.unit,
    unitCost: row.unit_cost,
    totalValue: row.total_value,
    supplier: row.supplier,
    location: row.location,
    lastRestocked: row.last_restocked,
    status: row.inv_status,
    companyId: row.company_id,
  };
}

export const inventoryService = {
  async getAll(companyId?: string | null): Promise<InventoryRecord[]> {
    const supabase = createClient();
    let query = supabase.from('inventory').select('*').order('created_at', { ascending: false });
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    const { data, error } = await query;
    if (error) {
      logger.error('inventoryService', 'Failed to fetch inventory', {
        companyId,
        error: error.message,
      });
      return [];
    }
    return (data as InventoryRow[]).map(rowToInventory);
  },

  async create(
    item: Omit<InventoryRecord, 'id'>,
    companyId?: string | null
  ): Promise<InventoryRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        name: item.name,
        sku: item.sku,
        category: item.category,
        current_stock: item.currentStock,
        min_stock: item.minStock,
        max_stock: item.maxStock,
        unit: item.unit,
        unit_cost: item.unitCost,
        total_value: item.totalValue,
        supplier: item.supplier,
        location: item.location,
        last_restocked: item.lastRestocked,
        inv_status: item.status,
        company_id: companyId ?? item.companyId ?? null,
      })
      .select()
      .single();
    if (error) {
      logger.error('inventoryService', 'Failed to create inventory item', {
        name: item.name,
        error: error.message,
      });
      return null;
    }
    return rowToInventory(data as InventoryRow);
  },

  async updateStock(id: string, currentStock: number): Promise<boolean> {
    const supabase = createClient();
    const newStatus: InventoryRecord['status'] = currentStock === 0 ? 'out-of-stock' : 'in-stock';
    const { error } = await supabase
      .from('inventory')
      .update({
        current_stock: currentStock,
        inv_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      logger.error('inventoryService', 'Failed to update stock', {
        id,
        currentStock,
        error: error.message,
      });
      return false;
    }
    return true;
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) {
      logger.error('inventoryService', 'Failed to delete inventory item', {
        id,
        error: error.message,
      });
      return false;
    }
    return true;
  },
};
