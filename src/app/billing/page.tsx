'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Lock, Users, Briefcase } from 'lucide-react';
import { SubscriptionStatus, getStatusLabel, getStatusColor, isReadOnly } from '@/lib/subscriptionConfig';

interface Plan {
  id: string;
  planKey: string;
  planName: string;
  description: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  trialDays: number;
  maxUsers: number;
  maxJobs: number;
  features: string[];
}

interface Subscription {
  id: string;
  planName: string;
  billingInterval: string;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  maxUsers: number;
  maxJobs: number;
  features: string[];
}

const STATUS_ICONS: Record<SubscriptionStatus, React.ElementType> = {
  trialing: Clock,
  active: CheckCircle2,
  past_due: AlertTriangle,
  cancelled: XCircle,
  suspended: Lock,
  read_only: Lock,
};

export default function BillingPage() {
  const { companyId } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();

    // Load plans
    const { data: planData } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    setPlans((planData || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      planKey: p.plan_key,
      planName: p.plan_name,
      description: p.description,
      monthlyPriceCents: p.monthly_price_cents,
      annualPriceCents: p.annual_price_cents,
      trialDays: p.trial_days,
      maxUsers: p.max_users,
      maxJobs: p.max_jobs,
      features: p.features || [],
    })));

    // Load subscription
    if (companyId) {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (subData) {
        setSubscription({
          id: subData.id,
          planName: subData.plan_name,
          billingInterval: subData.billing_interval,
          status: subData.sub_status as SubscriptionStatus,
          trialEndsAt: subData.trial_ends_at,
          currentPeriodEnd: subData.current_period_end,
          monthlyPriceCents: subData.monthly_price_cents,
          annualPriceCents: subData.annual_price_cents,
          maxUsers: subData.max_users,
          maxJobs: subData.max_jobs,
          features: subData.features || [],
        });
        setBillingInterval(subData.billing_interval || 'monthly');
      }
    }

    setLoading(false);
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Contact Sales';
    return `$${(cents / 100).toFixed(0)}/mo`;
  };

  const statusColor = subscription ? getStatusColor(subscription.status) : '#10B981';
  const statusLabel = subscription ? getStatusLabel(subscription.status) : 'Active';
  const StatusIcon = subscription ? STATUS_ICONS[subscription.status] : CheckCircle2;
  const readOnly = subscription ? isReadOnly(subscription.status) : false;

  if (loading) {
    return (
      <AppLayout currentPath="/billing">
        <div className="space-y-6 animate-fade-in">
          <div>
            <div className="skeleton h-7 w-48 mb-2" />
            <div className="skeleton h-4 w-72" />
          </div>
          {/* Current plan skeleton */}
          <div className="card-elevated p-6 rounded-2xl">
            <div className="skeleton h-3 w-20 mb-2" />
            <div className="skeleton h-6 w-32 mb-3" />
            <div className="skeleton h-6 w-24 rounded-full mb-4" />
            <div className="grid grid-cols-2 gap-4 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-9 h-9 rounded-lg" />
                  <div>
                    <div className="skeleton h-3 w-16 mb-1.5" />
                    <div className="skeleton h-4 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Plans skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card-elevated p-5 rounded-2xl space-y-3">
                <div className="skeleton h-5 w-24" />
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-8 w-20" />
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <div className="skeleton w-3 h-3 rounded-full" />
                    <div className="skeleton h-3 w-32" />
                  </div>
                ))}
                <div className="skeleton h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath="/billing">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-700 text-foreground">Billing & Subscription</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your subscription plan and billing settings</p>
        </div>

        {/* Read-only banner */}
        {readOnly && (
          <div className="flex items-center gap-3 p-4 rounded-lg text-sm" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>
            <Lock size={16} />
            <span>
              <strong>Account Read-Only:</strong> Your subscription has expired. All data is preserved. Upgrade to restore full access.
            </span>
          </div>
        )}

        {/* Current subscription */}
        {subscription && (
          <div className="card-elevated p-6 rounded-2xl">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs font-600 text-muted-foreground mb-1">Current Plan</p>
                <h2 className="text-xl font-700 text-foreground capitalize">{subscription.planName}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600" style={{ backgroundColor: `${statusColor}18`, color: statusColor }}>
                    <StatusIcon size={11} />
                    {statusLabel}
                  </span>
                  {subscription.billingInterval && (
                    <span className="text-xs text-muted-foreground capitalize">{subscription.billingInterval} billing</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                {subscription.trialEndsAt && subscription.status === 'trialing' && (
                  <div>
                    <p className="text-xs text-muted-foreground">Trial ends</p>
                    <p className="text-sm font-600 text-foreground">{new Date(subscription.trialEndsAt).toLocaleDateString('en-AU')}</p>
                  </div>
                )}
                {subscription.currentPeriodEnd && subscription.status === 'active' && (
                  <div>
                    <p className="text-xs text-muted-foreground">Next billing</p>
                    <p className="text-sm font-600 text-foreground">{new Date(subscription.currentPeriodEnd).toLocaleDateString('en-AU')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Usage */}
            <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
                  <Users size={14} style={{ color: '#2563EB' }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Max Users</p>
                  <p className="text-sm font-600 text-foreground">{subscription.maxUsers === 999 ? 'Unlimited' : subscription.maxUsers}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}>
                  <Briefcase size={14} style={{ color: '#10B981' }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Max Jobs</p>
                  <p className="text-sm font-600 text-foreground">{subscription.maxJobs === 9999 ? 'Unlimited' : subscription.maxJobs}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plans */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-700 text-foreground">Available Plans</h3>
            <div className="flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--border)' }}>
              {(['monthly', 'annual'] as const).map((interval) => (
                <button
                  key={interval}
                  onClick={() => setBillingInterval(interval)}
                  className="px-3 py-1.5 rounded-md text-xs font-600 transition-all capitalize"
                  style={{ backgroundColor: billingInterval === interval ? 'var(--accent)' : 'transparent', color: billingInterval === interval ? 'white' : 'var(--muted-foreground)' }}
                >
                  {interval}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const price = billingInterval === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents;
              const isCurrent = subscription?.planName === plan.planKey;
              return (
                <div
                  key={plan.id}
                  className="card-elevated p-5 rounded-2xl relative"
                  style={{ border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)' }}
                >
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-700 text-white" style={{ backgroundColor: 'var(--accent)' }}>
                      Current Plan
                    </span>
                  )}
                  <h4 className="text-base font-700 text-foreground">{plan.planName}</h4>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">{plan.description}</p>
                  <p className="text-2xl font-700 text-foreground mb-4">
                    {formatPrice(price)}
                    {price === 0 && <span className="text-xs font-400 text-muted-foreground ml-1">(pricing TBD)</span>}
                  </p>
                  <ul className="space-y-1.5 mb-5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-foreground">
                        <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={isCurrent}
                    className="w-full py-2 rounded-lg text-sm font-600 transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: isCurrent ? 'var(--secondary)' : 'var(--accent)', color: isCurrent ? 'var(--muted-foreground)' : 'white' }}
                  >
                    {isCurrent ? 'Current Plan' : 'Select Plan'}
                  </button>
                  <p className="text-xs text-muted-foreground text-center mt-2">{plan.trialDays}-day free trial</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Pricing is configurable. Contact your administrator to update plan pricing.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
