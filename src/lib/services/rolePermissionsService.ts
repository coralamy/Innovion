/**
 * Role Permissions Service (EDR-006)
 *
 * Manages configurable per-company, per-role permissions stored in the
 * role_permissions table. Supervisor permissions are always resolved from
 * this table — never hard-coded.
 *
 * Inherits from the Platform Identity model:
 *   admin > manager > supervisor > viewer > contractor
 */

import { createClient } from '@/lib/supabase/client';
import type { RolePermissions, UserRole } from '@/contexts/RBACContext';

export interface RolePermissionRecord {
  id: string;
  companyId: string;
  roleName: UserRole;
  permissions: RolePermissions;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): RolePermissionRecord {
  return {
    id:        row.id as string,
    companyId: row.company_id as string,
    roleName:  row.role_name as UserRole,
    permissions: {
      canManageUsers:      row.can_manage_users as boolean,
      canManageCompany:    row.can_manage_company as boolean,
      canViewReports:      row.can_view_reports as boolean,
      canManageJobs:       row.can_manage_jobs as boolean,
      canManageCompliance: row.can_manage_compliance as boolean,
      canManageDocuments:  row.can_manage_documents as boolean,
      canManageInventory:  row.can_manage_inventory as boolean,
      canViewFinancials:   row.can_view_financials as boolean,
    },
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const rolePermissionsService = {
  /** List all role permission records for a company */
  async list(companyId: string): Promise<RolePermissionRecord[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('company_id', companyId)
      .order('role_name');
    if (error) throw error;
    return (data ?? []).map(mapRow);
  },

  /** Get permissions for a specific role within a company */
  async getForRole(companyId: string, roleName: UserRole): Promise<RolePermissionRecord | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('company_id', companyId)
      .eq('role_name', roleName)
      .single();
    if (error) return null;
    return mapRow(data as Record<string, unknown>);
  },

  /** Upsert permissions for a role within a company (admin only) */
  async upsert(companyId: string, roleName: UserRole, permissions: RolePermissions): Promise<RolePermissionRecord> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('role_permissions')
      .upsert(
        {
          company_id:            companyId,
          role_name:             roleName,
          can_manage_users:      permissions.canManageUsers,
          can_manage_company:    permissions.canManageCompany,
          can_view_reports:      permissions.canViewReports,
          can_manage_jobs:       permissions.canManageJobs,
          can_manage_compliance: permissions.canManageCompliance,
          can_manage_documents:  permissions.canManageDocuments,
          can_manage_inventory:  permissions.canManageInventory,
          can_view_financials:   permissions.canViewFinancials,
        },
        { onConflict: 'company_id,role_name' }
      )
      .select('*')
      .single();
    if (error) throw error;
    return mapRow(data as Record<string, unknown>);
  },
};
