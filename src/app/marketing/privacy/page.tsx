'use client';
import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="pt-16">
      <section className="bg-[#0F1C2E] py-20">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-slate-300">Last updated: January 2025</p>
        </div>
      </section>
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 prose prose-slate max-w-none">
          <div className="space-y-8 text-slate-600">
            {[
              { title: 'Information We Collect', body: 'Innovion collects information you provide directly to us, such as when you create an account, use our services, or contact us for support. This includes business information, contact details, and operational data you enter into the platform.' },
              { title: 'How We Use Your Information', body: 'We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, and respond to your comments and questions.' },
              { title: 'Data Security', body: 'We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction. All data is encrypted in transit and at rest.' },
              { title: 'Data Ownership', body: 'Your business data belongs to you. You retain full ownership of all data you enter into Innovion. You can export your data at any time, and upon termination of your account, your data will be returned to you in full.' },
              { title: 'Third-Party Services', body: 'Innovion may use third-party service providers to help us operate our platform. These providers are contractually obligated to protect your information and may only use it to provide services to us.' },
              { title: 'Contact Us', body: 'If you have any questions about this Privacy Policy, please contact us at privacy@innovion.com.au.' },
            ]?.map((section) => (
              <div key={section?.title}>
                <h2 className="text-xl font-bold text-[#0F1C2E] mb-3">{section?.title}</h2>
                <p className="leading-relaxed">{section?.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
