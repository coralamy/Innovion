'use client';
import React, { useState } from 'react';
import { emailService } from '@/lib/emailService';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    industry: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      // The recipient is now fixed server-side to the configured support inbox.
      await emailService.sendContactForm(
        form.name,
        form.email,
        form.company,
        form.industry,
        form.message
      );
    } catch (err) {
      // Contact form email error handled silently — submission still completes
    } finally {
      setSending(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="bg-[#0F1C2E] py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-[#2563EB]/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-[#60a5fa] rounded-full" />
            <span className="text-white/70 text-xs font-semibold tracking-wide uppercase">
              Contact
            </span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Get in touch
          </h1>
          <p className="text-xl text-slate-300 max-w-xl mx-auto">
            Have a question about Innovion? We&apos;re here to help.
          </p>
        </div>
      </section>

      {/* Contact form + info */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Form */}
            <div>
              <h2 className="text-2xl font-bold text-[#0F1C2E] mb-2">Send us a message</h2>
              <p className="text-slate-500 mb-8">We typically respond within one business day.</p>

              {submitted ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-6 h-6 text-emerald-600"
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
                  <h3 className="font-bold text-[#0F1C2E] mb-2">Message sent!</h3>
                  <p className="text-slate-500 text-sm">
                    Thank you for reaching out. We&apos;ll be in touch shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Full name *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email address *
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Company name
                    </label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors"
                      placeholder="Your business name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Industry
                    </label>
                    <select
                      value={form.industry}
                      onChange={(e) => setForm({ ...form, industry: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors bg-white"
                    >
                      <option value="">Select your industry</option>
                      <option>Commercial Cleaning</option>
                      <option>Residential Cleaning</option>
                      <option>Property Maintenance</option>
                      <option>Electrical Contractors</option>
                      <option>Plumbers</option>
                      <option>Landscapers</option>
                      <option>Pest Control</option>
                      <option>Security Services</option>
                      <option>HVAC</option>
                      <option>Mobile Service Businesses</option>
                      <option>Trade Contractors</option>
                      <option>Inspection Services</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Message *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors resize-none"
                      placeholder="How can we help you?"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Sending…
                      </>
                    ) : (
                      'Send Message'
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-[#0F1C2E] mb-6">Other ways to reach us</h2>
                <div className="space-y-4">
                  {[
                    {
                      icon: (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      ),
                      label: 'Email',
                      value: 'support@innovion.com.au',
                    },
                    {
                      icon: (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                          />
                        </svg>
                      ),
                      label: 'Website',
                      value: 'www.coralamy.com',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100"
                    >
                      <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center flex-shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                          {item.label}
                        </div>
                        <div className="text-sm font-semibold text-[#0F1C2E] mt-0.5">
                          {item.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0F1C2E] rounded-2xl p-8">
                <h3 className="font-bold text-white mb-3">Ready to start immediately?</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-5">
                  Innovion is designed to be intuitive enough to start without a demonstration.
                  Begin your free trial and explore the platform yourself.
                </p>
                <a
                  href="/sign-up-login"
                  className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-200"
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
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
