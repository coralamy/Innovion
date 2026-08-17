/**
 * GET /api/platform/business-rules
 *
 * Returns the business rules for the authenticated company.
 * Scope required: business-rules:read
 *
 * Business rules include:
 *   - RBAC role definitions and permission sets
 *   - Subscription plan limits (maxUsers, maxJobs, features)
 *   - Read-only mode rules
 *   - Supported subscription statuses
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardPlatformRequest } from '@/lib/platformApiRoute';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { addRateLimitHeaders } from '@/lib/rateLimit';

// Role permission matrix — single source of truth
const ROLE_PERMISSIONS = {
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
  supervisor: {
    canManageUsers: false,
    canManageCompany: false,
    canViewReports: false,
    canManageJobs: true,
    canManageCompliance: false,
    canManageDocuments: false,
    canManageInventory: false,
    canViewFinancials: false,
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

const READ_ONLY_STATUSES = ['read_only', 'suspended', 'cancelled', 'past_due'];
const ACTIVE_STATUSES = ['active', 'trialing'];

const READ_ONLY_ALLOWED_PATHS = [
  '/dashboard',
  '/reports',
  '/time-tracking',
  '/documents',
  '/profile',
  '/settings',
  '/billing',
];

export async function GET(req: NextRequest) {
  const guard = await guardPlatformRequest(req, 'business-rules:read');
  if (!guard.ok) return guard.response;
  const { ctx, rate: rlResult } = guard;

  try {
    const supabase = createAdminClient();

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      // The column is sub_status; status does not exist on subscriptions.
      .select(
        'plan_name, sub_status, max_users, max_jobs, features, trial_ends_at, current_period_end'
      )
      .eq('company_id', ctx.companyId)
      .maybeSingle();

    if (error) {
      logger.warn('api/platform/business-rules', 'Failed to fetch subscription', {
        companyId: ctx.companyId,
        error: error.message,
      });
    }

    const response = NextResponse.json({
      data: {
        rbac: {
          roles: Object.keys(ROLE_PERMISSIONS),
          permissions: ROLE_PERMISSIONS,
        },
        subscription: {
          planName: subscription?.plan_name ?? null,
          status: subscription?.sub_status ?? null,
          maxUsers: subscription?.max_users ?? null,
          maxJobs: subscription?.max_jobs ?? null,
          features: subscription?.features ?? [],
          trialEndsAt: subscription?.trial_ends_at ?? null,
          currentPeriodEnd: subscription?.current_period_end ?? null,
          isReadOnly: READ_ONLY_STATUSES.includes(subscription?.sub_status ?? ''),
          isActive: ACTIVE_STATUSES.includes(subscription?.sub_status ?? ''),
        },
        readOnly: {
          triggeredByStatuses: READ_ONLY_STATUSES,
          allowedPaths: READ_ONLY_ALLOWED_PATHS,
          message:
            'Your account is in read-only mode. Upgrade your subscription to create or modify records.',
        },
      },
    });
    return addRateLimitHeaders(response, rlResult);
  } catch (err) {
    logger.error(
      'api/platform/business-rules',
      'Unexpected error',
      { companyId: ctx.companyId },
      err
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
