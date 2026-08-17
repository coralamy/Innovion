'use client';
import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { BRAND_IDENTITY, PLATFORM_IDENTITY } from '@/lib/brand';

export default function AboutPage() {
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="bg-[#0F1C2E] py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2563EB]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#1E3A5F]/50 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 bg-[#60a5fa] rounded-full" />
              <span className="text-white/70 text-xs font-semibold tracking-wide uppercase">
                About {BRAND_IDENTITY?.name}
              </span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Built from real operational experience
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed">
              {BRAND_IDENTITY?.name} was created to solve a problem we experienced firsthand — the
              chaos of running an operational business on disconnected systems, paperwork and
              spreadsheets.
            </p>
          </div>
        </div>
      </section>
      {/* Mission */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-[#0F1C2E] mb-6">Our mission</h2>
              <p className="text-lg text-slate-500 leading-relaxed mb-6">
                We believe every micro business deserves access to the same operational tools that
                large enterprises use — without the complexity, cost or implementation headaches.
              </p>
              <p className="text-slate-500 leading-relaxed mb-6">
                {BRAND_IDENTITY?.name} centralises your entire operation into one intelligent
                platform. Manage your business from anywhere. Know exactly what is happening. Stay
                organised. Scale with confidence.
              </p>
              <p className="text-slate-500 leading-relaxed">
                Simple enough for every employee. Powerful enough to transform the way your business
                works.
              </p>
            </div>
            <div className="bg-slate-50 rounded-3xl p-10">
              <div className="flex items-center gap-3 mb-8">
                <AppLogo variant="full" size={28} darkBg={false} />
              </div>
              <div className="space-y-5">
                {[
                  { label: 'Founded', value: PLATFORM_IDENTITY?.platformName + ' Group' },
                  { label: 'Platform type', value: 'Cloud SaaS' },
                  { label: 'Target market', value: 'Micro businesses (up to 15 staff)' },
                  { label: 'Industries served', value: '14+ operational industries' },
                  { label: 'Deployment', value: 'Web, iOS, Android' },
                ]?.map((item) => (
                  <div
                    key={item?.label}
                    className="flex items-start justify-between py-3 border-b border-slate-200 last:border-0"
                  >
                    <span className="text-sm text-slate-400">{item?.label}</span>
                    <span className="text-sm font-semibold text-[#0F1C2E] text-right max-w-[60%]">
                      {item?.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Values */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0F1C2E] mb-4">What we believe</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Simplicity first',
                desc: 'Software should be intuitive enough for every employee to use without training.',
              },
              {
                title: 'Real-world design',
                desc: 'Every feature is designed around how operational businesses actually work.',
              },
              {
                title: 'Visibility matters',
                desc: 'Business owners deserve to know exactly what is happening in their operation at all times.',
              },
              {
                title: 'Growth without complexity',
                desc: 'Adding staff and customers should not mean adding administrative burden.',
              },
            ]?.map((value) => (
              <div
                key={value?.title}
                className="bg-white rounded-2xl border border-slate-100 p-7 shadow-sm"
              >
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                  <div className="w-2 h-2 bg-[#2563EB] rounded-full" />
                </div>
                <h3 className="font-bold text-[#0F1C2E] mb-2">{value?.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{value?.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Coralamy Group */}
      <section className="py-20 bg-[#0F1C2E]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              The {PLATFORM_IDENTITY?.platformName} Group
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto">
              {BRAND_IDENTITY?.name} is one of the intelligent business platforms developed by the{' '}
              {PLATFORM_IDENTITY?.platformName} Group — a portfolio of purpose-built software
              solutions for modern businesses.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: BRAND_IDENTITY?.name, desc: BRAND_IDENTITY?.tagline, active: true },
              {
                name: 'OmniCleanOS',
                desc: 'Intelligent cleaning operations management',
                active: false,
              },
              {
                name: 'EzBillable',
                desc: 'Smart billing and invoicing for service businesses',
                active: false,
              },
              { name: 'Synapse', desc: 'Connected workforce intelligence platform', active: false },
              {
                name: 'InnovatechIQ',
                desc: 'Technology innovation management suite',
                active: false,
              },
              { name: 'Rhixo', desc: 'Retail and hospitality operations platform', active: false },
            ]?.map((product) => (
              <div
                key={product?.name}
                className={`rounded-xl p-6 border ${
                  product?.active
                    ? 'bg-[#2563EB]/20 border-[#2563EB]/40'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={`font-700 ${product?.active ? 'text-white' : 'text-slate-300'}`}>
                    {product?.name}
                  </h3>
                  {product?.active && (
                    <span className="text-[10px] bg-[#2563EB] text-white px-2 py-0.5 rounded-full font-700">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{product?.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-[#0F1C2E] mb-4">
            Ready to transform your operation?
          </h2>
          <p className="text-slate-500 mb-8">
            Join businesses already using {BRAND_IDENTITY?.qualifiedName} to run smarter operations.
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
              className="border border-slate-200 text-slate-600 hover:bg-slate-50 font-600 px-8 py-3.5 rounded-xl transition-all duration-200"
            >
              Get in Touch
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-4">{BRAND_IDENTITY?.copyright}</p>
        </div>
      </section>
    </div>
  );
}
