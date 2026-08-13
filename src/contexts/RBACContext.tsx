'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'manager' | 'supervisor' | 'viewer' | 'contractor';

export interface RolePermissions {
  canManageUsers: boolean;
  canManageCompany: boolean;
  canViewReports: boolean;
  canManageJobs: boolean;
  canManageCompliance: boolean;
  canManageDocuments: boolean;
  canManageInventory: boolean;
  canViewFinancials: boolean;
}

/**
 * Platform Identity default permissions.
 * These are the baseline defaults used when no company-specific override exists
 * in the role_permissions table. Supervisor permissions are intentionally omitted
 * here — they are ALWAYS resolved from the database (EDR-006 resolution).
 */
const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<UserRole, 'supervisor'>, RolePermissions> = {
  admin: {
    canManageUsers: true,
    canManageCompany: true,
    canViewReports: true,
    canManageJobs: true,
    canManageCompliance: true,
    canManageDocuments: true,
    canManageInventory: true,
    canViewFinancials: true,
  },
  manager: {
    canManageUsers: false,
    canManageCompany: false,
    canViewReports: true,
    canManageJobs: true,
    canManageCompliance: true,
    canManageDocuments: true,
    canManageInventory: true,
    canViewFinancials: true,
  },
  viewer: {
    canManageUsers: false,
    canManageCompany: false,
    canViewReports: true,
    canManageJobs: false,
    canManageCompliance: false,
    canManageDocuments: false,
    canManageInventory: false,
    canViewFinancials: false,
  },
  contractor: {
    canManageUsers: false,
    canManageCompany: false,
    canViewReports: false,
    canManageJobs: false,
    canManageCompliance: false,
    canManageDocuments: false,
    canManageInventory: false,
    canViewFinancials: false,
  },
};

/**
 * Supervisor baseline — used only when the role_permissions table has no record
 * for this company. Reflects the Platform Identity model defaults (EDR-006).
 */
const SUPERVISOR_BASELINE: RolePermissions = {
  canManageUsers: false,
  canManageCompany: false,
  canViewReports: true,
  canManageJobs: true,
  canManageCompliance: true,
  canManageDocuments: true,
  canManageInventory: false,
  canViewFinancials: false,
};

interface RBACContextValue {
  role: UserRole;
  permissions: RolePermissions;
  loading: boolean;
  hasPermission: (permission: keyof RolePermissions) => boolean;
  /** Reload permissions from DB (call after admin updates role_permissions) */
  refreshPermissions: () => Promise<void>;
}

const RBACContext = createContext<RBACContextValue>({
  role: 'viewer',
  permissions: DEFAULT_ROLE_PERMISSIONS['viewer'],
  loading: true,
  hasPermission: () => false,
  refreshPermissions: async () => {},
});

export const useRBAC = () => useContext(RBACContext);

/** Map a role_permissions DB row to RolePermissions */
function mapDbPermissions(row: Record<string, unknown>): RolePermissions {
  return {
    canManageUsers:      row.can_manage_users as boolean,
    canManageCompany:    row.can_manage_company as boolean,
    canViewReports:      row.can_view_reports as boolean,
    canManageJobs:       row.can_manage_jobs as boolean,
    canManageCompliance: row.can_manage_compliance as boolean,
    canManageDocuments:  row.can_manage_documents as boolean,
    canManageInventory:  row.can_manage_inventory as boolean,
    canViewFinancials:   row.can_view_financials as boolean,
  };
}

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const { user, companyId } = useAuth();
  const [role, setRole] = useState<UserRole>('viewer');
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS['viewer']);
  const [loading, setLoading] = useState(true);

  const resolvePermissions = async (resolvedRole: UserRole, cid: string | null) => {
    // Supervisor permissions are ALWAYS loaded from the database (EDR-006).
    // Other roles may also have company-specific overrides in role_permissions.
    if (!cid) {
      if (resolvedRole === 'supervisor') {
        setPermissions(SUPERVISOR_BASELINE);
      } else {
        setPermissions(DEFAULT_ROLE_PERMISSIONS[resolvedRole as Exclude<UserRole, 'supervisor'>] ?? DEFAULT_ROLE_PERMISSIONS['viewer']);
      }
      return;
    }

    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('role_permissions')
        .select('can_manage_users, can_manage_company, can_view_reports, can_manage_jobs, can_manage_compliance, can_manage_documents, can_manage_inventory, can_view_financials')
        .eq('company_id', cid)
        .eq('role_name', resolvedRole)
        .single();

      if (data) {
        setPermissions(mapDbPermissions(data as Record<string, unknown>));
      } else if (resolvedRole === 'supervisor') {
        // No DB record yet — use baseline (will be seeded on next company creation)
        setPermissions(SUPERVISOR_BASELINE);
      } else {
        setPermissions(DEFAULT_ROLE_PERMISSIONS[resolvedRole as Exclude<UserRole, 'supervisor'>] ?? DEFAULT_ROLE_PERMISSIONS['viewer']);
      }
    } catch {
      // Graceful fallback — table may not exist in older environments
      if (resolvedRole === 'supervisor') {
        setPermissions(SUPERVISOR_BASELINE);
      } else {
        setPermissions(DEFAULT_ROLE_PERMISSIONS[resolvedRole as Exclude<UserRole, 'supervisor'>] ?? DEFAULT_ROLE_PERMISSIONS['viewer']);
      }
    }
  };

  const loadRole = async () => {
    if (!user) { setLoading(false); return; }

    // Check user_metadata first (set during onboarding)
    const metaRole = user?.user_metadata?.role as UserRole | undefined;
    let resolvedRole: UserRole = 'viewer';

    if (metaRole && (metaRole === 'admin' || metaRole === 'manager' || metaRole === 'supervisor' || metaRole === 'viewer' || metaRole === 'contractor')) {
      resolvedRole = metaRole;
    } else {
      // Fall back to user_roles table
      const supabase = createClient();
      let query = supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      if (companyId) query = query.eq('company_id', companyId);
      const { data } = await query.single();
      if (data?.role) {
        resolvedRole = data.role as UserRole;
      } else {
        resolvedRole = 'admin'; // First user of a company defaults to admin
      }
    }

    setRole(resolvedRole);
    await resolvePermissions(resolvedRole, companyId);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    loadRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, companyId]);

  const refreshPermissions = async () => {
    await resolvePermissions(role, companyId);
  };

  const hasPermission = (permission: keyof RolePermissions) => permissions[permission];

  return (
    <RBACContext.Provider value={{ role, permissions, loading, hasPermission, refreshPermissions }}>
      {children}
    </RBACContext.Provider>
  );
}
