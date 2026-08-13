'use client';
import React from 'react';
import Link from 'next/link';

const RESOURCES = [
  {
    category: 'Getting Started',
    items: [
      { title: 'Quick Start Guide', desc: 'Get your Innovion account set up and your first job created in under 30 minutes.', type: 'Guide', time: '30 min read' },
      { title: 'Adding Your First Customers', desc: 'Learn how to import or manually add your customer database to Innovion.', type: 'Guide', time: '10 min read' },
      { title: 'Setting Up Your Team', desc: 'Add employees and contractors, assign roles and configure mobile access.', type: 'Guide', time: '15 min read' },
      { title: 'Configuring Your Schedule', desc: 'Set up recurring jobs, configure your calendar view and assign work to your team.', type: 'Guide', time: '20 min read' },
    ],
  },
  {
    category: 'Platform Guides',
    items: [
      { title: 'Compliance Management Explained', desc: 'How to store, track and receive reminders for licences, certifications and insurance documents.', type: 'Guide', time: '12 min read' },
      { title: 'Mobile App for Field Staff', desc: 'A complete guide for field workers on using the Innovion mobile app.', type: 'Guide', time: '8 min read' },
      { title: 'Inventory Management', desc: 'Track stock across multiple locations and manage supply requests.', type: 'Guide', time: '10 min read' },
      { title: 'Reporting & Analytics', desc: 'Understanding your operational dashboards and generating reports.', type: 'Guide', time: '15 min read' },
    ],
  },
  {
    category: 'Best Practices',
    items: [
      { title: 'Transitioning from Spreadsheets', desc: 'A practical guide to moving your business from Excel to Innovion without disruption.', type: 'Article', time: '8 min read' },
      { title: 'Building Effective Checklists', desc: 'How to design digital checklists that your field team will actually use.', type: 'Article', time: '6 min read' },
      { title: 'Managing Contractor Compliance', desc: 'Best practices for tracking contractor licences, insurance and inductions.', type: 'Article', time: '7 min read' },
    ],
  },
];

export default function ResourcesPage() {
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="bg-[#0F1C2E] py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/3 w-96 h-96 bg-[#2563EB]/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-[#60a5fa] rounded-full" />
            <span className="text-white/70 text-xs font-semibold tracking-wide uppercase">Resources</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Everything you need to succeed
          </h1>
          <p className="text-xl text-slate-300 max-w-xl mx-auto">
            Guides, tutorials and best practices to help you get the most from Innovion.
          </p>
        </div>
      </section>
      {/* Resources by category */}
      {RESOURCES?.map((category, ci) => (
        <section key={category?.category} className={`py-16 ${ci % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-[#0F1C2E]">{category?.category}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {category?.items?.map((item) => (
                <div
                  key={item?.title}
                  className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-bold text-[#0F1C2E] group-hover:text-[#2563EB] transition-colors">{item?.title}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs bg-blue-50 text-[#2563EB] font-medium px-2.5 py-1 rounded-full">{item?.type}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">{item?.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{item?.time}</span>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
      {/* Support CTA */}
      <section className="py-20 bg-[#1E3A5F]">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Need more help?</h2>
          <p className="text-slate-300 mb-8">Our support team is ready to assist you with any questions about Innovion.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/marketing/contact"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-[#1E3A5F] font-bold px-8 py-4 rounded-xl transition-all duration-200"
            >
              Contact Support
            </Link>
            <Link
              href="/sign-up-login"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
