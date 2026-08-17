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
 * The fail-closed permission set. Used whenever a role cannot be established
 * authoritatively: no session, no tenant, no `user_roles` row, an RLS denial,
 * or a transport failure. Never guess upward.
 */
const NO_PERMISSIONS: RolePermissions = {
  canManageUsers: false,
  canManageCompany: false,
  canViewReports: false,
  canManageJobs: false,
  canManageCompliance: false,
  canManageDocuments: false,
  canManageInventory: false,
  canViewFinancials: false,
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
    canManageUsers: row.can_manage_users as boolean,
    canManageCompany: row.can_manage_company as boolean,
    canViewReports: row.can_view_reports as boolean,
    canManageJobs: row.can_manage_jobs as boolean,
    canManageCompliance: row.can_manage_compliance as boolean,
    canManageDocuments: row.can_manage_documents as boolean,
    canManageInventory: row.can_manage_inventory as boolean,
    canViewFinancials: row.can_view_financials as boolean,
  };
}

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const { user, companyId } = useAuth();
  const [role, setRole] = useState<UserRole>('viewer');
  const [permissions, setPermissions] = useState<RolePermissions>(
    DEFAULT_ROLE_PERMISSIONS['viewer']
  );
  const [loading, setLoading] = useState(true);

  const resolvePermissions = async (resolvedRole: UserRole, cid: string | null) => {
    // Supervisor permissions are ALWAYS loaded from the database (EDR-006).
    // Other roles may also have company-specific overrides in role_permissions.
    if (!cid) {
      if (resolvedRole === 'supervisor') {
        setPermissions(SUPERVISOR_BASELINE);
      } else {
        setPermissions(
          DEFAULT_ROLE_PERMISSIONS[resolvedRole as Exclude<UserRole, 'supervisor'>] ??
            DEFAULT_ROLE_PERMISSIONS['viewer']
        );
      }
      return;
    }

    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('role_permissions')
        .select(
          'can_manage_users, can_manage_company, can_view_reports, can_manage_jobs, can_manage_compliance, can_manage_documents, can_manage_inventory, can_view_financials'
        )
        .eq('company_id', cid)
        .eq('role_name', resolvedRole)
        .maybeSingle();

      if (data) {
        setPermissions(mapDbPermissions(data as Record<string, unknown>));
      } else if (resolvedRole === 'supervisor') {
        // No DB record yet — use baseline (will be seeded on next company creation)
        setPermissions(SUPERVISOR_BASELINE);
      } else {
        setPermissions(
          DEFAULT_ROLE_PERMISSIONS[resolvedRole as Exclude<UserRole, 'supervisor'>] ??
            DEFAULT_ROLE_PERMISSIONS['viewer']
        );
      }
    } catch {
      // Graceful fallback — table may not exist in older environments
      if (resolvedRole === 'supervisor') {
        setPermissions(SUPERVISOR_BASELINE);
      } else {
        setPermissions(
          DEFAULT_ROLE_PERMISSIONS[resolvedRole as Exclude<UserRole, 'supervisor'>] ??
            DEFAULT_ROLE_PERMISSIONS['viewer']
        );
      }
    }
  };

  /**
   * Resolve the caller's role for the active tenant.
   *
   * DEFECT 1 REMEDIATED (P0 — privilege escalation by self-service):
   *   The previous implementation read the role from
   *       user.user_metadata.role
   *   in preference to the database, and only consulted `user_roles` when that
   *   claim was absent. `user_metadata` is written by the end user via
   *   `supabase.auth.updateUser({ data: { role: 'admin' } })`, so any user of
   *   any role could grant themselves the full administrative permission set:
   *   every gated control in the product (user management, company settings,
   *   financials, compliance) unlocked, and every write those controls perform
   *   attempted against the database.
   *
   *   Row Level Security stops the writes, but a UI that presents administrative
   *   capability to a viewer is itself the defect: it discloses administrative
   *   structure and produces a stream of failed privileged operations that is
   *   indistinguishable from an outage.
   *
   *   `user_roles` is now the only source. Client-writable metadata is not
   *   consulted for authority at all.
   *
   * DEFECT 2 REMEDIATED (P0 — fail-open to administrator):
   *   When no `user_roles` row was found, the previous code executed
   *       resolvedRole = 'admin'; // First user of a company defaults to admin
   *   so *any* failure to resolve a role — a user with no membership, a
   *   transient network error, an RLS denial, a user signed in to a tenant they
   *   have been removed from — granted full administrative permissions. The
   *   onboarding defect fixed in migration 20260817001000 meant tenants really
   *   were created with no `user_roles` row, so this path was reached in normal
   *   operation, not only under attack.
   *
   *   Resolution now fails CLOSED: an unresolvable role yields no permissions.
   *
   * DEFECT 3 REMEDIATED:
   *   `.single()` raises when a user belongs to more than one tenant and no
   *   company filter is applied, which fell through to the same fail-open path.
   *   The query is now always tenant-scoped and uses `maybeSingle()`.
   */
  const VALID_ROLES: UserRole[] = ['admin', 'manager', 'supervisor', 'viewer', 'contractor'];

  const loadRole = async () => {
    if (!user || !companyId) {
      // No session, or no authoritative tenant yet: no role, no permissions.
      setRole('viewer');
      setPermissions(NO_PERMISSIONS);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error || !data?.role || !VALID_ROLES.includes(data.role as UserRole)) {
      // Fail closed. Never assume administrator.
      setRole('viewer');
      setPermissions(NO_PERMISSIONS);
      setLoading(false);
      return;
    }

    const resolvedRole = data.role as UserRole;
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
