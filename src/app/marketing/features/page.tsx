'use client';
import React from 'react';
import Link from 'next/link';

const ALL_FEATURES = [
  {
    category: 'Operations',
    items: [
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        ),
        title: 'Customer Management',
        desc: 'Maintain complete customer records, locations, contacts and operational information. Every customer detail is accessible from any device, at any time.',
        points: [
          'Complete customer profiles',
          'Multiple site locations',
          'Contact management',
          'Operational notes & history',
        ],
      },
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        ),
        title: 'Job Management',
        desc: 'Create one-off or recurring jobs, allocate resources and monitor progress in real time. Never lose track of a job again.',
        points: [
          'One-off and recurring jobs',
          'Resource allocation',
          'Real-time progress tracking',
          'Job history and reporting',
        ],
      },
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        ),
        title: 'Intelligent Scheduling',
        desc: 'Powerful drag-and-drop scheduling with recurring work, team allocation and workload visibility. See your entire operation at a glance.',
        points: [
          'Drag-and-drop interface',
          'Recurring job scheduling',
          'Team workload visibility',
          'Conflict detection',
        ],
      },
    ],
  },
  {
    category: 'Workforce',
    items: [
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        ),
        title: 'Staff Management',
        desc: 'Manage employees, contractors, roles, qualifications and operational responsibilities from one central location.',
        points: [
          'Employee profiles',
          'Contractor management',
          'Role and qualification tracking',
          'Operational responsibilities',
        ],
      },
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M12 18h.01M8 21h8a2 2 0 002-2v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2a2 2 0 002 2zM12 3a4 4 0 100 8 4 4 0 000-8z"
            />
          </svg>
        ),
        title: 'Mobile Workforce',
        desc: 'Enable field staff to log on, log off, complete digital checklists, upload photographs, record notes and report issues — all from their mobile device.',
        points: ['Mobile log on/off', 'Digital checklists', 'Photo uploads', 'Issue reporting'],
      },
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        desc: 'Confirm attendance using location-aware clock on and clock off functionality. Know exactly where your team is at all times.',
        points: [
          'Location-aware clock on/off',
          'Attendance verification',
          'Site arrival confirmation',
          'Time tracking',
        ],
      },
    ],
  },
  {
    category: 'Compliance & Resources',
    items: [
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        ),
        title: 'Compliance Management',
        desc: 'Store licences, inductions, certifications, insurance documents and operational compliance records. Receive reminders before important documents expire.',
        points: [
          'Document storage',
          'Expiry reminders',
          'Induction tracking',
          'Insurance management',
        ],
      },
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        ),
        title: 'Inventory Management',
        desc: 'Monitor products and consumables across multiple locations. Track stock levels, manage supply requests and maintain approved product lists for every customer site.',
        points: [
          'Multi-location stock tracking',
          'Supply request management',
          'Approved product lists',
          'Low stock alerts',
        ],
      },
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        ),
        title: 'Document Management',
        desc: 'Store operational documents securely in one location. Policies, procedures, site information, safety documentation and customer documents.',
        points: [
          'Secure document storage',
          'Policy management',
          'Safety documentation',
          'Customer documents',
        ],
      },
    ],
  },
  {
    category: 'Insights',
    items: [
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        ),
        title: 'Reporting & Analytics',
        desc: 'Real-time operational dashboards providing complete visibility across your business. Make informed decisions based on accurate, up-to-date data.',
        points: [
          'Real-time dashboards',
          'Operational reports',
          'Performance metrics',
          'Custom reporting',
        ],
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="bg-[#0F1C2E] py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#2563EB]/15 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-[#60a5fa] rounded-full" />
            <span className="text-white/70 text-xs font-semibold tracking-wide uppercase">
              Platform Features
            </span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Everything your business needs.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60a5fa] to-[#93c5fd]">
              Nothing it doesn&apos;t.
            </span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            Ten powerful modules designed around the way micro businesses actually operate.
          </p>
          <Link
            href="/sign-up-login"
            className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25"
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
      </section>
      {/* Features by category */}
      {ALL_FEATURES?.map((category, ci) => (
        <section
          key={category?.category}
          className={`py-20 ${ci % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="mb-12">
              <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5">
                <div className="w-1.5 h-1.5 bg-[#2563EB] rounded-full" />
                <span className="text-[#2563EB] text-xs font-semibold tracking-wide uppercase">
                  {category?.category}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {category?.items?.map((feature) => (
                <div
                  key={feature?.title}
                  className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center mb-6">
                    {feature?.icon}
                  </div>
                  <h3 className="text-xl font-bold text-[#0F1C2E] mb-3">{feature?.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-6">{feature?.desc}</p>
                  <ul className="space-y-2">
                    {feature?.points?.map((point) => (
                      <li key={point} className="flex items-center gap-2.5 text-sm text-slate-600">
                        <svg
                          className="w-4 h-4 text-[#2563EB] flex-shrink-0"
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
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
      {/* CTA */}
      <section className="py-20 bg-[#1E3A5F]">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-slate-300 mb-8">
            Start your free trial today. No credit card required.
          </p>
          <Link
            href="/sign-up-login"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-[#1E3A5F] font-bold px-8 py-4 rounded-xl transition-all duration-200"
          >
            Start Free Trial
          </Link>
        </div>
      </section>
    </div>
  );
}
