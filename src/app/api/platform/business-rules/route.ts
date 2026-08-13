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
import { authenticateApiKey, hasScope, unauthorizedResponse, forbiddenResponse } from '@/lib/platformApiAuth';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import {
  checkRateLimit,
  getRequestIdentifier,
  RATE_LIMIT_CONFIGS,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from '@/lib/rateLimit';

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
  const identifier = getRequestIdentifier(req);
  const rlResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.platformApi);
  if (!rlResult.success) return rateLimitExceededResponse(rlResult);

  const ctx = await authenticateApiKey(req);
  if (!ctx) return unauthorizedResponse();
  if (!hasScope(ctx, 'business-rules:read')) return forbiddenResponse();

  try {
    const supabase = await createClient();

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('plan_name, status, max_users, max_jobs, features, trial_ends_at, current_period_end')
      .eq('company_id', ctx.companyId)
      .maybeSingle();

    if (error) {
      logger.warn('api/platform/business-rules', 'Failed to fetch subscription', { companyId: ctx.companyId, error: error.message });
    }

    const response = NextResponse.json({
      data: {
        rbac: {
          roles: Object.keys(ROLE_PERMISSIONS),
          permissions: ROLE_PERMISSIONS,
        },
        subscription: {
          planName: subscription?.plan_name ?? null,
          status: subscription?.status ?? null,
          maxUsers: subscription?.max_users ?? null,
          maxJobs: subscription?.max_jobs ?? null,
          features: subscription?.features ?? [],
          trialEndsAt: subscription?.trial_ends_at ?? null,
          currentPeriodEnd: subscription?.current_period_end ?? null,
          isReadOnly: READ_ONLY_STATUSES.includes(subscription?.status ?? ''),
          isActive: ACTIVE_STATUSES.includes(subscription?.status ?? ''),
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
    logger.error('api/platform/business-rules', 'Unexpected error', { companyId: ctx.companyId }, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
