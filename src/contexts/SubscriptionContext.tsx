'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Subscription,
  SubscriptionStatus,
  isReadOnly,
  isActive,
  READ_ONLY_MESSAGE,
} from '@/lib/subscriptionConfig';

interface SubscriptionContextValue {
  subscription: Subscription | null;
  loading: boolean;
  isReadOnly: boolean;
  isActive: boolean;
  status: SubscriptionStatus | null;
  readOnlyMessage: string;
  refresh: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  loading: true,
  isReadOnly: false,
  isActive: true,
  status: null,
  readOnlyMessage: READ_ONLY_MESSAGE,
  refresh: () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { companyId } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (data) {
      setSubscription({
        id: data.id,
        companyId: data.company_id,
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
        stripePriceId: data.stripe_price_id,
        planName: data.plan_name,
        billingInterval: data.billing_interval,
        status: data.sub_status as SubscriptionStatus,
        trialEndsAt: data.trial_ends_at,
        currentPeriodStart: data.current_period_start,
        currentPeriodEnd: data.current_period_end,
        cancelledAt: data.cancelled_at,
        trialDays: data.trial_days,
        monthlyPriceCents: data.monthly_price_cents,
        annualPriceCents: data.annual_price_cents,
        maxUsers: data.max_users,
        maxJobs: data.max_jobs,
        features: data.features || [],
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSubscription();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const status = subscription?.status ?? null;
  const readOnly = status ? isReadOnly(status) : false;
  const active = status ? isActive(status) : true; // default allow if no subscription record

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        isReadOnly: readOnly,
        isActive: active,
        status,
        readOnlyMessage: READ_ONLY_MESSAGE,
        refresh: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
