'use client';
import React, { useState, useEffect } from 'react';
import { X, Cookie } from 'lucide-react';

const CONSENT_KEY = 'innovion_cookie_consent';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: true, marketing: true, timestamp: Date.now() }));
    setVisible(false);
  };

  const acceptEssential = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: false, marketing: false, timestamp: Date.now() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up"
      style={{ backgroundColor: 'var(--card)', borderTop: '1px solid var(--border)', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
            <Cookie size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-700 text-foreground">We use cookies</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Innovion uses cookies to improve your experience, analyse site usage, and for marketing purposes.
              By clicking &quot;Accept All&quot; you consent to our use of cookies.{' '}
              <a href="/marketing/privacy" className="text-accent hover:underline font-500">Privacy Policy</a>
              {' '}·{' '}
              <button onClick={() => setShowDetails(!showDetails)} className="text-accent hover:underline font-500">
                {showDetails ? 'Hide details' : 'Cookie details'}
              </button>
            </p>

            {showDetails && (
              <div className="mt-3 space-y-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary)' }}>
                {[
                  { name: 'Essential', desc: 'Required for the site to function. Cannot be disabled.', required: true },
                  { name: 'Analytics', desc: 'Help us understand how visitors interact with the site (Google Analytics).', required: false },
                  { name: 'Marketing', desc: 'Used to deliver relevant advertisements and track campaign performance.', required: false },
                ]?.map((cookie) => (
                  <div key={cookie?.name} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-600 text-foreground">{cookie?.name}</p>
                      <p className="text-xs text-muted-foreground">{cookie?.desc}</p>
                    </div>
                    <span className="text-xs font-500 flex-shrink-0" style={{ color: cookie?.required ? 'var(--success)' : 'var(--muted-foreground)' }}>
                      {cookie?.required ? 'Always on' : 'Optional'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={acceptEssential}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-secondary transition-colors"
            title="Dismiss"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 ml-13 pl-13" style={{ paddingLeft: '52px' }}>
          <button
            onClick={acceptEssential}
            className="px-4 py-2 rounded-lg text-xs font-600 border transition-all hover:bg-secondary"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Essential only
          </button>
          <button
            onClick={acceptAll}
            className="px-4 py-2 rounded-lg text-xs font-700 text-white transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
