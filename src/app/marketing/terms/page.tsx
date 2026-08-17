'use client';
import React from 'react';

export default function TermsPage() {
  return (
    <div className="pt-16">
      <section className="bg-[#0F1C2E] py-20">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-slate-300">Last updated: January 2025</p>
        </div>
      </section>
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="space-y-8 text-slate-600">
            {[
              {
                title: 'Acceptance of Terms',
                body: 'By accessing or using Innovion, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.',
              },
              {
                title: 'Use of Services',
                body: 'Innovion grants you a limited, non-exclusive, non-transferable licence to use our platform for your internal business operations. You may not resell, sublicense, or otherwise transfer your rights to use the platform.',
              },
              {
                title: 'Account Responsibilities',
                body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorised use of your account.',
              },
              {
                title: 'Subscription and Payment',
                body: 'Innovion is offered on a subscription basis. Fees are charged in advance on a monthly or annual basis. You may cancel your subscription at any time, and cancellation will take effect at the end of the current billing period.',
              },
              {
                title: 'Limitation of Liability',
                body: 'To the maximum extent permitted by law, Innovion shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our services.',
              },
              {
                title: 'Governing Law',
                body: 'These Terms of Service are governed by the laws of Australia. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts of Australia.',
              },
              {
                title: 'Contact',
                body: 'If you have any questions about these Terms of Service, please contact us at legal@innovion.com.au.',
              },
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
