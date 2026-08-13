'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { BRAND_IDENTITY } from '@/lib/brand';

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
  sortOrder: number;
}

const FAQS = [
  {
    q: `Is ${BRAND_IDENTITY.name} hosted in the cloud?`,
    a: `Yes. ${BRAND_IDENTITY.name} is a fully cloud-based platform. You can access it from any device with an internet connection — desktop, tablet or mobile.`,
  },
  {
    q: `Does ${BRAND_IDENTITY.name} work on mobile devices?`,
    a: `Absolutely. ${BRAND_IDENTITY.name} is designed mobile-first. Field staff can log on and off, complete checklists, upload photos and report issues directly from their smartphone.`,
  },
  {
    q: 'How secure is my data?',
    a: 'Your data is encrypted in transit and at rest. We use enterprise-grade security infrastructure and follow industry best practices for data protection.',
  },
  {
    q: 'Who owns my data?',
    a: 'You do. Your business data belongs to you. You can export your data at any time, and if you choose to leave, your data is returned to you in full.',
  },
  {
    q: 'What support is available?',
    a: 'All plans include email support. Professional and Enterprise plans include priority support. We also provide comprehensive documentation and training resources.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing period.',
  },
  {
    q: 'Is there a free trial?',
    a: `Yes. All plans include a ${14}-day free trial with no credit card required. You get full access to all features during your trial.`,
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'Your data is retained for 30 days after cancellation. During this period you can export everything. After 30 days, data is permanently deleted.',
  },
];

function PlanCard({ plan, billingInterval, isPopular }: { plan: Plan; billingInterval: 'monthly' | 'annual'; isPopular: boolean }) {
  const priceCents = billingInterval === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents;
  const isEnterprise = priceCents === 0 && plan.planKey !== 'starter';
  const displayPrice = isEnterprise ? null : Math.round(priceCents / 100);

  return (
    <div
      className={`relative rounded-2xl p-8 flex flex-col ${
        isPopular
          ? 'bg-[#1E3A5F] text-white shadow-2xl shadow-blue-900/30 ring-2 ring-[#2563EB]/60 scale-[1.02]'
          : 'bg-white border border-slate-200 shadow-sm'
      }`}
    >
      {isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-[#2563EB] text-white text-xs font-700 px-4 py-1.5 rounded-full shadow-lg shadow-blue-500/30">
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className={`text-xl font-700 mb-2 ${isPopular ? 'text-white' : 'text-[#0F1C2E]'}`}>
          {plan.planName}
        </h3>
        <p className={`text-sm leading-relaxed ${isPopular ? 'text-blue-200' : 'text-slate-500'}`}>
          {plan.description}
        </p>
      </div>

      <div className="mb-6">
        {displayPrice !== null ? (
          <div className="flex items-end gap-1">
            <span className={`text-4xl font-800 ${isPopular ? 'text-white' : 'text-[#0F1C2E]'}`}>
              ${displayPrice}
            </span>
            <span className={`text-sm mb-1.5 ${isPopular ? 'text-blue-300' : 'text-slate-400'}`}>/mo</span>
          </div>
        ) : (
          <div className={`text-2xl font-700 ${isPopular ? 'text-white' : 'text-[#0F1C2E]'}`}>
            Contact Sales
          </div>
        )}
        {billingInterval === 'annual' && displayPrice !== null && (
          <p className={`text-xs mt-1 ${isPopular ? 'text-blue-300' : 'text-slate-400'}`}>
            Billed annually · Save ~20%
          </p>
        )}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {(plan.features as string[]).map((feature: string) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm">
            <svg
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isPopular ? 'text-blue-300' : 'text-[#2563EB]'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className={isPopular ? 'text-blue-100' : 'text-slate-600'}>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/sign-up-login"
        className={`block text-center py-3 rounded-xl text-sm font-600 transition-all duration-200 ${
          isPopular
            ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-lg shadow-blue-500/30 hover:-translate-y-px'
            : 'bg-slate-900 hover:bg-slate-800 text-white hover:-translate-y-px'
        }`}
      >
        {isEnterprise ? 'Contact Us' : 'Start Free Trial'}
      </Link>
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div className="rounded-2xl p-8 bg-white border border-slate-200 animate-pulse">
      <div className="h-6 bg-slate-200 rounded w-24 mb-2" />
      <div className="h-4 bg-slate-100 rounded w-full mb-1" />
      <div className="h-4 bg-slate-100 rounded w-3/4 mb-6" />
      <div className="h-10 bg-slate-200 rounded w-20 mb-6" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 bg-slate-200 rounded-full" />
          <div className="h-4 bg-slate-100 rounded flex-1" />
        </div>
      ))}
      <div className="h-11 bg-slate-200 rounded-xl mt-6" />
    </div>
  );
}

export default function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setPlans(
          (data || []).map((p: Record<string, unknown>) => ({
            id: p.id as string,
            planKey: p.plan_key as string,
            planName: p.plan_name as string,
            description: (p.description as string) || '',
            monthlyPriceCents: (p.monthly_price_cents as number) || 0,
            annualPriceCents: (p.annual_price_cents as number) || 0,
            trialDays: (p.trial_days as number) || 14,
            maxUsers: (p.max_users as number) || 5,
            maxJobs: (p.max_jobs as number) || 100,
            features: (p.features as string[]) || [],
            sortOrder: (p.sort_order as number) || 0,
          }))
        );
        setLoading(false);
      });
  }, []);

  // Determine "popular" plan — second plan by sort order, or the one named "professional"
  const popularIndex = plans.findIndex((p) => p.planKey === 'professional') !== -1
    ? plans.findIndex((p) => p.planKey === 'professional')
    : Math.min(1, plans.length - 1);

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="bg-[#0F1C2E] py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2563EB]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#1E3A5F]/50 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-[#60a5fa] rounded-full" />
            <span className="text-white/70 text-xs font-semibold tracking-wide uppercase">Simple Pricing</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Transparent pricing.<br />No surprises.
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            Start with a {14}-day free trial. No credit card required. Cancel any time.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 bg-white/10 border border-white/20 rounded-xl p-1">
            {(['monthly', 'annual'] as const).map((interval) => (
              <button
                key={interval}
                onClick={() => setBillingInterval(interval)}
                className={`px-5 py-2 rounded-lg text-sm font-600 transition-all duration-200 capitalize ${
                  billingInterval === interval
                    ? 'bg-white text-[#0F1C2E] shadow-sm'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {interval}
                {interval === 'annual' && (
                  <span className="ml-1.5 text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded-full font-700">
                    Save 20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Plans grid */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              {[0, 1, 2].map((i) => <PlanSkeleton key={i} />)}
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg">Pricing plans are being updated. Please check back shortly.</p>
              <Link href="/marketing/contact" className="mt-4 inline-block text-[#2563EB] font-600 hover:underline">
                Contact us for pricing →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              {plans.map((plan, idx) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  billingInterval={billingInterval}
                  isPopular={idx === popularIndex}
                />
              ))}
            </div>
          )}

          {/* Trial note */}
          <p className="text-center text-sm text-slate-400 mt-10">
            All plans include a {14}-day free trial · No credit card required · Cancel any time
          </p>
        </div>
      </section>

      {/* Feature comparison note */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-[#0F1C2E] mb-4">Everything you need to run your operation</h2>
          <p className="text-slate-500 leading-relaxed">
            {BRAND_IDENTITY.name} includes scheduling, job management, compliance, documents, inventory, reporting, contractor management and more — all in one platform.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {[
              'Job Management', 'Scheduling', 'Compliance', 'Documents',
              'Inventory', 'Reporting', 'Contractor Invoices', 'Time Tracking',
              'Incident Reporting', 'Checklists', 'Notifications', 'Mobile Access',
            ].map((feature) => (
              <span key={feature} className="bg-slate-50 border border-slate-200 text-slate-600 text-xs font-500 px-3 py-1.5 rounded-full">
                {feature}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0F1C2E] mb-4">Frequently asked questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                >
                  <span className="font-600 text-[#0F1C2E] text-sm">{faq.q}</span>
                  <svg
                    className={`w-4 h-4 text-slate-400 flex-shrink-0 ml-4 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#0F1C2E]">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-slate-300 mb-8">
            Join businesses already using {BRAND_IDENTITY.name} to run their operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up-login"
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-600 px-8 py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:-translate-y-px"
            >
              Start Free Trial
            </Link>
            <Link
              href="/marketing/contact"
              className="border border-white/20 text-white hover:bg-white/10 font-600 px-8 py-3.5 rounded-xl transition-all duration-200"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
