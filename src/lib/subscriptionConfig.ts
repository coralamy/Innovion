// Subscription configuration — all values are configurable, no hard-coded pricing
// Update these values or load from database (subscription_plans table)

export type SubscriptionStatus =
  | 'trialing' |'active' |'past_due' |'cancelled' |'suspended' |'read_only';

export interface SubscriptionPlan {
  key: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  trialDays: number;
  maxUsers: number;
  maxJobs: number;
  features: string[];
}

export interface Subscription {
  id: string;
  companyId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  planName: string;
  billingInterval: 'monthly' | 'annual';
  status: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelledAt?: string;
  trialDays: number;
  monthlyPriceCents: number;
  annualPriceCents: number;
  maxUsers: number;
  maxJobs: number;
  features: string[];
}

// Read-only mode: what is allowed when subscription is expired/cancelled
export const READ_ONLY_ALLOWED_PATHS = [
  '/dashboard',
  '/reports',
  '/time-tracking',
  '/documents',
  '/profile',
  '/settings',
  '/billing',
];

export const READ_ONLY_MESSAGE =
  'Your account is in read-only mode. Upgrade your subscription to create or modify records.';

export function isReadOnly(status: SubscriptionStatus): boolean {
  return ['read_only', 'suspended', 'cancelled', 'past_due'].includes(status);
}

export function isActive(status: SubscriptionStatus): boolean {
  return ['active', 'trialing'].includes(status);
}

export function getStatusLabel(status: SubscriptionStatus): string {
  const labels: Record<SubscriptionStatus, string> = {
    trialing: 'Trial',
    active: 'Active',
    past_due: 'Past Due',
    cancelled: 'Cancelled',
    suspended: 'Suspended',
    read_only: 'Read Only',
  };
  return labels[status] || status;
}

export function getStatusColor(status: SubscriptionStatus): string {
  const colors: Record<SubscriptionStatus, string> = {
    trialing: '#F59E0B',
    active: '#10B981',
    past_due: '#EF4444',
    cancelled: '#6B7280',
    suspended: '#EF4444',
    read_only: '#8B5CF6',
  };
  return colors[status] || '#6B7280';
}
