'use client';
import React from 'react';
import Link from 'next/link';

const SECTOR_DATA = [
  { sector: 'Property & Facilities', industries: 28 },
  { sector: 'Trades', industries: 23 },
  { sector: 'Construction', industries: 17 },
  { sector: 'Security', industries: 9 },
  { sector: 'Healthcare', industries: 15 },
  { sector: 'Hospitality', industries: 10 },
  { sector: 'Retail', industries: 10 },
  { sector: 'Logistics', industries: 10 },
  { sector: 'Automotive', industries: 9 },
  { sector: 'Agriculture', industries: 8 },
  { sector: 'Education', industries: 6 },
  { sector: 'Government', industries: 5 },
  { sector: 'Emergency Services', industries: 6 },
  { sector: 'Mining & Resources', industries: 6 },
  { sector: 'Manufacturing', industries: 8 },
  { sector: 'Professional Services', industries: 6 },
  { sector: 'Utilities', industries: 6 },
  { sector: 'Recreation', industries: 6 },
  { sector: 'Animal Services', industries: 5 },
  { sector: 'Personal Services', industries: 5 },
  { sector: 'Marine', industries: 5 },
  { sector: 'Aviation', industries: 4 },
  { sector: 'Religious & Community', industries: 5 },
  { sector: 'Event Services', industries: 6 },
  { sector: 'Franchise Operations', industries: 5 },
  { sector: 'Home Services', industries: 6 },
  { sector: 'Inspection Services', industries: 7 },
  { sector: 'Tourism', industries: 5 },
  { sector: 'Specialist Services', industries: 6 },
];

const INDUSTRIES = [
  {
    name: 'Commercial Cleaning',
    desc: 'Manage cleaning contracts, staff rosters, site checklists and compliance documentation for commercial cleaning operations.',
    icon: '🏢',
    features: ['Site-specific checklists', 'Staff rostering', 'Compliance tracking', 'Customer portals'],
  },
  {
    name: 'Residential Cleaning',
    desc: 'Schedule recurring residential cleans, manage customer preferences and track staff attendance at every property.',
    icon: '🏠',
    features: ['Recurring schedules', 'Customer preferences', 'GPS attendance', 'Mobile checklists'],
  },
  {
    name: 'Property Maintenance',
    desc: 'Coordinate maintenance teams, track work orders and manage contractor compliance across multiple properties.',
    icon: '🔧',
    features: ['Work order management', 'Contractor coordination', 'Multi-site visibility', 'Compliance records'],
  },
  {
    name: 'Electrical Contractors',
    desc: 'Manage electrical jobs, track licences and certifications, and coordinate field electricians from one platform.',
    icon: '⚡',
    features: ['Licence tracking', 'Job scheduling', 'Field team management', 'Safety compliance'],
  },
  {
    name: 'Plumbers',
    desc: 'Schedule plumbing jobs, manage parts inventory and ensure all plumbers hold current licences and insurance.',
    icon: '🔩',
    features: ['Job management', 'Parts inventory', 'Licence management', 'Customer records'],
  },
  {
    name: 'Landscapers',
    desc: 'Plan recurring landscape maintenance, manage seasonal crews and track equipment and consumable inventory.',
    icon: '🌿',
    features: ['Recurring maintenance', 'Crew management', 'Equipment tracking', 'Seasonal scheduling'],
  },
  {
    name: 'Pest Control',
    desc: 'Manage treatment schedules, track chemical inventory, store safety data sheets and maintain compliance records.',
    icon: '🛡️',
    features: ['Treatment scheduling', 'Chemical inventory', 'Safety documentation', 'Compliance records'],
  },
  {
    name: 'Security Services',
    desc: 'Coordinate security patrols, manage guard licences, track incidents and maintain site-specific procedures.',
    icon: '🔐',
    features: ['Patrol scheduling', 'Guard licence tracking', 'Incident reporting', 'Site procedures'],
  },
  {
    name: 'HVAC',
    desc: 'Schedule preventive maintenance, manage technician certifications and track parts across service vehicles.',
    icon: '❄️',
    features: ['Preventive maintenance', 'Technician certifications', 'Parts management', 'Service history'],
  },
  {
    name: 'Mobile Service Businesses',
    desc: 'Coordinate mobile service teams, track vehicle locations and manage customer appointments efficiently.',
    icon: '🚐',
    features: ['Mobile team coordination', 'Appointment management', 'Route planning', 'Customer records'],
  },
  {
    name: 'Trade Contractors',
    desc: 'Manage trade jobs, subcontractor relationships, compliance documentation and project scheduling.',
    icon: '🏗️',
    features: ['Job management', 'Subcontractor management', 'Compliance documentation', 'Project scheduling'],
  },
  {
    name: 'Inspection Services',
    desc: 'Schedule inspections, manage digital inspection checklists, generate reports and track follow-up actions.',
    icon: '🔍',
    features: ['Inspection scheduling', 'Digital checklists', 'Report generation', 'Follow-up tracking'],
  },
];

export default function IndustriesPage() {
  const totalIndustries = SECTOR_DATA?.reduce((sum, row) => sum + row?.industries, 0);

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="bg-[#0F1C2E] py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#2563EB]/15 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-[#60a5fa] rounded-full" />
            <span className="text-white/70 text-xs font-semibold tracking-wide uppercase">Industries</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Built for businesses<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60a5fa] to-[#93c5fd]">that work in the field</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Innovion serves operational businesses across <strong className="text-white">247+ industries</strong> in 29 sectors. Every workflow designed around how you actually work.
          </p>
        </div>
      </section>
      {/* Industries Breakdown Table */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0F1C2E] mb-3">Industries by Sector</h2>
            <p className="text-slate-500 text-lg">
              A complete breakdown of the {totalIndustries} industries Innovion supports across {SECTOR_DATA?.length} sectors.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-2 bg-[#0F1C2E] px-6 py-3">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Sector</span>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide text-right">Industries</span>
            </div>
            <div className="divide-y divide-slate-50">
              {SECTOR_DATA?.map((row, idx) => (
                <div
                  key={row?.sector}
                  className={`grid grid-cols-2 px-6 py-3.5 items-center transition-colors hover:bg-blue-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                >
                  <span className="text-sm font-medium text-[#0F1C2E]">{row?.sector}</span>
                  <div className="flex items-center justify-end gap-3">
                    <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#60a5fa]"
                        style={{ width: `${(row?.industries / 28) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-[#2563EB] w-6 text-right">{row?.industries}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Total row */}
            <div className="grid grid-cols-2 px-6 py-4 bg-[#0F1C2E] items-center">
              <span className="text-sm font-bold text-white">Total</span>
              <span className="text-sm font-bold text-[#60a5fa] text-right">{totalIndustries}</span>
            </div>
          </div>
        </div>
      </section>
      {/* Industries grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0F1C2E] mb-3">Featured Industries</h2>
            <p className="text-slate-500 text-lg">A closer look at some of the industries Innovion powers every day.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {INDUSTRIES?.map((industry) => (
              <div
                key={industry?.name}
                className="bg-white rounded-2xl border border-slate-100 p-7 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group"
              >
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                    {industry?.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-[#0F1C2E] text-lg leading-tight">{industry?.name}</h3>
                  </div>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed mb-5">{industry?.desc}</p>
                <ul className="space-y-1.5">
                  {industry?.features?.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-slate-500">
                      <svg className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Why section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-[#0F1C2E] mb-6">Don&apos;t see your industry?</h2>
          <p className="text-lg text-slate-500 mb-8">
            If your business manages jobs, staff, customers and compliance — Innovion is built for you. Start a free trial and see how it fits your operation.
          </p>
          <Link
            href="/sign-up-login"
            className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200"
          >
            Start Free Trial
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
