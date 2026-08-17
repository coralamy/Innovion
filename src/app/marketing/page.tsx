'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import AppLogo from '@/components/ui/AppLogo';

// ─── Animated counter hook ───────────────────────────────────────────────────
function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

// ─── Intersection observer hook ──────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Feature data ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    title: 'Customer Management',
    desc: 'Complete customer records, locations, contacts and operational information — all in one place.',
    span: 'col-span-1',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    ),
    title: 'Job Management',
    desc: 'Create one-off or recurring jobs, allocate resources and monitor progress in real time.',
    span: 'col-span-1',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    title: 'Intelligent Scheduling',
    desc: 'Drag-and-drop scheduling with recurring work, team allocation and workload visibility.',
    span: 'col-span-1 lg:col-span-2',
    wide: true,
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M12 18h.01M8 21h8a2 2 0 002-2v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2a2 2 0 002 2zM12 3a4 4 0 100 8 4 4 0 000-8z"
        />
      </svg>
    ),
    title: 'Mobile Workforce',
    desc: 'Field staff log on/off, complete digital checklists, upload photos and report issues — all from mobile.',
    span: 'col-span-1 lg:col-span-2',
    wide: true,
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    title: 'GPS Attendance',
    desc: 'Location-aware clock on and off confirms attendance at every job site.',
    span: 'col-span-1',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    title: 'Compliance Management',
    desc: 'Store licences, certifications and insurance. Receive reminders before documents expire.',
    span: 'col-span-1',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
    title: 'Inventory Management',
    desc: 'Track stock across multiple locations, manage supply requests and maintain approved product lists.',
    span: 'col-span-1',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    title: 'Reporting & Analytics',
    desc: 'Real-time operational dashboards providing complete visibility across your entire business.',
    span: 'col-span-1',
  },
];

const INDUSTRIES = [
  'Commercial Cleaning',
  'Residential Cleaning',
  'Property Maintenance',
  'Electrical Contractors',
  'Plumbers',
  'Landscapers',
  'Pest Control',
  'Security Services',
  'HVAC',
  'Mobile Service Businesses',
  'Trade Contractors',
  'Inspection Services',
];

const STATS = [
  { value: 15, suffix: '+', label: 'Staff supported per business' },
  { value: 10, suffix: '+', label: 'Core operational modules' },
  { value: 247, suffix: '+', label: 'Industries served' },
  { value: 100, suffix: '%', label: 'Cloud-based platform' },
];

const ECOSYSTEM = [
  {
    name: 'EzBillable',
    tagline: 'Intelligent Business Financial Management',
    href: 'https://www.ezbillable.com',
    color: 'from-emerald-500/10 to-teal-500/10',
    border: 'border-emerald-200',
  },
  {
    name: 'Synapse',
    tagline: 'Intelligent Business Communications',
    href: 'https://www.synapse.app',
    color: 'from-violet-500/10 to-purple-500/10',
    border: 'border-violet-200',
  },
  {
    name: 'OmniCleanOS',
    tagline: 'Enterprise Business Operations Management',
    href: 'https://www.omnicleanos.com',
    color: 'from-orange-500/10 to-amber-500/10',
    border: 'border-orange-200',
  },
];

// ─── Section: Hero ────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0F1C2E]">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F1C2E] via-[#1E3A5F] to-[#0F1C2E]" />
        <div
          className="absolute top-0 left-1/4 w-96 h-96 bg-[#2563EB]/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#1d4ed8]/15 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '6s', animationDelay: '2s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#2563EB]/5 rounded-full blur-3xl" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-20">
        <div className="max-w-4xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
            <div className="w-1.5 h-1.5 bg-[#2563EB] rounded-full animate-pulse" />
            <span className="text-white/80 text-xs font-medium tracking-wide">
              Intelligent Micro Business Operations Management
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-6">
            Run Your Entire Business From{' '}
            <span className="relative">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60a5fa] to-[#93c5fd]">
                One Intelligent
              </span>
            </span>{' '}
            Platform
          </h1>

          {/* Subheadline */}
          <p className="text-lg lg:text-xl text-slate-300 leading-relaxed max-w-2xl mb-10">
            Innovion gives growing micro businesses complete operational control by bringing
            customers, jobs, staff, contractors, scheduling, compliance, inventory and reporting
            together in one intelligent cloud platform.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Link
              href="/sign-up-login"
              className="inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold px-8 py-4 rounded-xl text-base transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
            >
              Start Free Trial
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
            <Link
              href="/marketing/features"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all duration-200"
            >
              Explore Features
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
            {['No credit card required', 'Free 14-day trial', 'Cancel anytime'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-[#60a5fa]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40">
        <span className="text-xs tracking-widest uppercase">Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-white/40 to-transparent animate-pulse" />
      </div>
    </section>
  );
}

// ─── Section: Stats ───────────────────────────────────────────────────────────
function StatsSection() {
  const { ref, inView } = useInView();
  const counts = [
    useCountUp(STATS[0].value, 1500, inView),
    useCountUp(STATS[1].value, 1500, inView),
    useCountUp(STATS[2].value, 1500, inView),
    useCountUp(STATS[3].value, 1500, inView),
  ];

  return (
    <section ref={ref} className="bg-[#1E3A5F] py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <div key={stat.label} className="text-center">
              <div className="text-4xl lg:text-5xl font-bold text-white mb-2 tabular-nums">
                {counts[i]}
                {stat.suffix}
              </div>
              <div className="text-sm text-slate-300">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Problem ─────────────────────────────────────────────────────────
function ProblemSection() {
  const { ref, inView } = useInView();
  const problems = [
    { label: 'Paper & Diaries', icon: '📋' },
    { label: 'Whiteboards', icon: '📌' },
    { label: 'Phone Calls', icon: '📞' },
    { label: 'Text Messages', icon: '💬' },
    { label: 'Excel Spreadsheets', icon: '📊' },
    { label: 'Disconnected Apps', icon: '🔗' },
  ];

  return (
    <section ref={ref} className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div
            className={`transition-all duration-700 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
          >
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 rounded-full px-4 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
              <span className="text-red-600 text-xs font-semibold tracking-wide uppercase">
                The Problem
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-[#0F1C2E] leading-tight mb-6">
              Most micro businesses run on chaos
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed mb-8">
              As businesses grow, disconnected systems become impossible to manage — resulting in
              lost information, inconsistent processes and reduced productivity.
            </p>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                Sound familiar?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {problems.map((p) => (
                  <div key={p.label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <span className="text-lg">{p.icon}</span>
                    <span className="text-sm font-medium text-slate-600">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className={`transition-all duration-700 delay-200 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-orange-50 rounded-3xl" />
              <div className="relative p-8">
                <div className="space-y-4">
                  {[
                    {
                      title: 'Lost Information',
                      desc: 'Job details scattered across texts, emails and sticky notes',
                      pct: 78,
                    },
                    {
                      title: 'Inconsistent Processes',
                      desc: 'Every staff member does things differently',
                      pct: 65,
                    },
                    {
                      title: 'Reduced Productivity',
                      desc: 'Hours wasted on admin instead of billable work',
                      pct: 54,
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-red-100"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-[#0F1C2E] text-sm">{item.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                        <span className="text-red-500 font-bold text-sm">{item.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-red-50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-1000"
                          style={{ width: inView ? `${item.pct}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Solution ────────────────────────────────────────────────────────
function SolutionSection() {
  const { ref, inView } = useInView();
  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-[#2563EB] rounded-full" />
            <span className="text-[#2563EB] text-xs font-semibold tracking-wide uppercase">
              The Solution
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-[#0F1C2E] leading-tight mb-6">
            Everything centralised.
            <br />
            Everything connected.
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">
            Innovion centralises your entire operation into one intelligent platform. Manage your
            business from anywhere. Know exactly what is happening. Stay organised. Scale with
            confidence.
          </p>
        </div>

        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {[
            {
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              ),
              title: 'Complete Visibility',
              desc: 'See every job, every staff member, every customer and every compliance item — in real time.',
              bg: 'bg-blue-50',
              color: 'text-[#2563EB]',
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              ),
              title: 'Total Control',
              desc: 'Manage operations from your phone, tablet or desktop — wherever your business takes you.',
              bg: 'bg-indigo-50',
              color: 'text-indigo-600',
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              ),
              title: 'Built to Scale',
              desc: 'Add staff, customers and jobs without adding complexity. Innovion grows with your business.',
              bg: 'bg-emerald-50',
              color: 'text-emerald-600',
            },
          ].map((item, i) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div
                className={`w-12 h-12 ${item.bg} ${item.color} rounded-xl flex items-center justify-center mb-5`}
              >
                {item.icon}
              </div>
              <h3 className="text-lg font-bold text-[#0F1C2E] mb-3">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Features Bento ──────────────────────────────────────────────────
function FeaturesSection() {
  const { ref, inView } = useInView();
  return (
    <section ref={ref} className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-[#2563EB] rounded-full" />
            <span className="text-slate-600 text-xs font-semibold tracking-wide uppercase">
              Platform Features
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-[#0F1C2E] leading-tight mb-4">
            Everything your business needs
          </h2>
          <p className="text-lg text-slate-500">Ten powerful modules. One unified platform.</p>
        </div>

        {/* Bento grid */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className={`${feature.span} bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#2563EB] group-hover:text-white transition-colors duration-300">
                {feature.icon}
              </div>
              <h3 className="font-bold text-[#0F1C2E] mb-2 text-sm">{feature.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/marketing/features"
            className="inline-flex items-center gap-2 text-[#2563EB] font-semibold text-sm hover:gap-3 transition-all duration-200"
          >
            View all features
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Industries ──────────────────────────────────────────────────────
function IndustriesSection() {
  const { ref, inView } = useInView();
  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div
            className={`transition-all duration-700 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
          >
            <div className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-4 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 bg-[#1E3A5F] rounded-full" />
              <span className="text-slate-600 text-xs font-semibold tracking-wide uppercase">
                Industries
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-[#0F1C2E] leading-tight mb-6">
              Built for operational businesses
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed mb-8">
              Innovion was developed from real operational experience. Every workflow has been
              designed around the way micro businesses actually operate — not how software companies
              think they should operate.
            </p>
            <Link
              href="/marketing/industries"
              className="inline-flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all duration-200"
            >
              View all industries
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>

          <div
            className={`transition-all duration-700 delay-200 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
          >
            <div className="grid grid-cols-2 gap-3">
              {INDUSTRIES.map((industry, i) => (
                <div
                  key={industry}
                  className="flex items-center gap-3 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl px-4 py-3 transition-all duration-200 cursor-default group"
                  style={{ transitionDelay: `${i * 40}ms` }}
                >
                  <div className="w-1.5 h-1.5 bg-[#2563EB] rounded-full flex-shrink-0 group-hover:scale-150 transition-transform" />
                  <span className="text-sm font-medium text-slate-600 group-hover:text-[#1E3A5F]">
                    {industry}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Why Innovion ────────────────────────────────────────────────────
function WhySection() {
  const { ref, inView } = useInView();
  return (
    <section ref={ref} className="py-24 bg-[#0F1C2E] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#2563EB]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#1E3A5F]/50 rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div
            className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 bg-[#60a5fa] rounded-full" />
              <span className="text-white/70 text-xs font-semibold tracking-wide uppercase">
                Why Innovion
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
              Designed around how you actually work
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed mb-6">
              Innovion was developed from real operational experience. Every workflow has been
              designed around the way micro businesses actually operate — not how software companies
              think they should operate.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Simple enough for every employee. Powerful enough to transform the way your business
              works.
            </p>
          </div>

          <div
            className={`transition-all duration-700 delay-200 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="space-y-4">
              {[
                {
                  title: 'Manage from anywhere',
                  desc: 'Cloud-based platform accessible from any device, anywhere in the world.',
                },
                {
                  title: 'Real-time visibility',
                  desc: 'Know exactly what is happening across your entire operation at any moment.',
                },
                {
                  title: 'Scales with you',
                  desc: 'Add staff, customers and jobs without adding complexity or cost.',
                },
                {
                  title: 'Built for the field',
                  desc: 'Mobile-first design that works for office staff and field workers alike.',
                },
              ].map((item, i) => (
                <div
                  key={item.title}
                  className="flex gap-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 transition-all duration-200"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className="w-8 h-8 bg-[#2563EB]/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg
                      className="w-4 h-4 text-[#60a5fa]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm mb-1">{item.title}</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Ecosystem ───────────────────────────────────────────────────────
function EcosystemSection() {
  const { ref, inView } = useInView();
  return (
    <section ref={ref} className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 mb-6">
            <AppLogo variant="icon" size={16} darkBg={false} />
            <span className="text-slate-600 text-xs font-semibold tracking-wide uppercase">
              Coralamy Group
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-[#0F1C2E] leading-tight mb-4">
            Part of something bigger
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">
            Innovion is one of the intelligent business platforms developed by the Coralamy Group.
            As your organisation grows, additional solutions can extend your capability.
          </p>
        </div>

        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {ECOSYSTEM.map((item, i) => (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`bg-gradient-to-br ${item.color} border ${item.border} rounded-2xl p-8 hover:shadow-md transition-all duration-300 hover:-translate-y-1 group`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-[#0F1C2E]">{item.name}</h3>
                <svg
                  className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{item.tagline}</p>
            </a>
          ))}
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
          Each platform has a distinct purpose while working together as part of the Coralamy
          business ecosystem.
        </p>
      </div>
    </section>
  );
}

// ─── Section: Testimonials ────────────────────────────────────────────────────
function TestimonialsSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-[#2563EB] rounded-full" />
            <span className="text-slate-600 text-xs font-semibold tracking-wide uppercase">
              Customer Stories
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-[#0F1C2E] leading-tight mb-4">
            Trusted by operational businesses
          </h2>
          <p className="text-lg text-slate-500">
            Customer success stories coming soon. Be among the first to share yours.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-slate-50 rounded-2xl border border-slate-100 p-8 flex flex-col gap-4"
            >
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg
                    key={s}
                    className="w-4 h-4 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-slate-400 text-sm italic leading-relaxed">
                &ldquo;Customer testimonial reserved for future use. Start your free trial and be
                among our first success stories.&rdquo;
              </p>
              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-slate-200">
                <div className="w-9 h-9 bg-slate-200 rounded-full" />
                <div>
                  <div className="w-24 h-3 bg-slate-200 rounded-full mb-1.5" />
                  <div className="w-16 h-2.5 bg-slate-100 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Final CTA ───────────────────────────────────────────────────────
function FinalCTASection() {
  return (
    <section className="py-24 bg-[#1E3A5F] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-[#2563EB]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-[#1d4ed8]/20 rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <h2 className="text-4xl lg:text-6xl font-bold text-white leading-tight mb-6">
          Ready to simplify your business?
        </h2>
        <p className="text-xl text-slate-300 mb-4">Stop managing paperwork.</p>
        <p className="text-xl text-slate-300 mb-10">Start managing your business.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/sign-up-login"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-[#1E3A5F] font-bold px-10 py-4 rounded-xl text-base transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            Start Free Trial
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </div>
        <p className="text-slate-400 text-sm mt-6">
          No credit card required. Free 14-day trial. Cancel anytime.
        </p>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MarketingHomePage() {
  return (
    <>
      <HeroSection />
      <StatsSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <IndustriesSection />
      <WhySection />
      <EcosystemSection />
      <TestimonialsSection />
      <FinalCTASection />
    </>
  );
}
