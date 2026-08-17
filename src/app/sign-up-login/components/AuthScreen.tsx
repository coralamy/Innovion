'use client';
import React, { useState } from 'react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import AppLogo from '@/components/ui/AppLogo';
import { BRAND_GRADIENTS, BRAND_IDENTITY } from '@/lib/brand';
import { Shield, Clock, BarChart3, Users } from 'lucide-react';

const features = [
  { id: 'feat-schedule', icon: Clock, text: 'Intelligent scheduling with conflict detection' },
  { id: 'feat-compliance', icon: Shield, text: 'Automated compliance tracking & expiry alerts' },
  { id: 'feat-reports', icon: BarChart3, text: 'Real-time operational dashboards & reports' },
  { id: 'feat-workforce', icon: Users, text: 'Multi-contractor workforce management' },
];

const stats = [
  { value: '1,200+', label: 'Active contractors' },
  { value: '98.4%', label: 'Uptime SLA' },
  { value: '350+', label: 'Companies' },
];

export default function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  return (
    <div className="min-h-screen flex">
      {/* ── Brand panel ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col justify-between p-10 xl:p-14 relative overflow-hidden"
        style={{ background: BRAND_GRADIENTS.authPanel }}
      >
        {/* Multi-layer ambient glows */}
        <div
          className="absolute top-[-80px] right-[-60px] w-[420px] h-[420px] rounded-full pointer-events-none animate-glow-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-[-60px] left-[-40px] w-[320px] h-[320px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(30,58,95,0.5) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(37,99,235,0.05) 0%, transparent 60%)',
          }}
        />

        {/* Grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          }}
        />

        {/* Diagonal accent line */}
        <div
          className="absolute top-0 right-0 w-px h-full pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(37,99,235,0.3) 40%, rgba(37,99,235,0.1) 70%, transparent 100%)',
          }}
        />

        {/* Logo */}
        <div className="relative animate-fade-in">
          <AppLogo variant="full" size={30} darkBg={true} showWordmark={true} />
        </div>

        {/* Main content */}
        <div
          className="relative animate-slide-up"
          style={{ animationDelay: '80ms', opacity: 0, animationFillMode: 'forwards' }}
        >
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-8"
            style={{
              backgroundColor: 'rgba(37,99,235,0.15)',
              border: '1px solid rgba(37,99,235,0.3)',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: '#60A5FA' }}
            />
            <span className="text-xs font-600 tracking-wide" style={{ color: '#93C5FD' }}>
              Intelligent Micro Business Operations
            </span>
          </div>

          <h1 className="text-4xl xl:text-[2.75rem] font-800 text-white leading-[1.08] tracking-tight mb-5">
            Field service
            <br />
            <span className="text-gradient-blue">
              {BRAND_IDENTITY.tagline.split(' ').slice(0, 2).join(' ')},
            </span>
            <br />
            simplified.
          </h1>
          <p
            className="text-[15px] leading-relaxed mb-10"
            style={{ color: 'rgba(148,163,184,0.85)' }}
          >
            Schedule contractors, manage compliance, track jobs in real time — all from one platform
            built for growing service businesses.
          </p>

          <div className="space-y-3">
            {features.map((f, i) => {
              const FIcon = f.icon;
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-3.5 animate-slide-in-left"
                  style={{
                    animationDelay: `${160 + i * 60}ms`,
                    opacity: 0,
                    animationFillMode: 'forwards',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: 'rgba(37,99,235,0.2)',
                      border: '1px solid rgba(37,99,235,0.25)',
                    }}
                  >
                    <FIcon size={15} style={{ color: '#60A5FA' }} />
                  </div>
                  <p className="text-[13.5px] font-500" style={{ color: 'rgba(203,213,225,0.85)' }}>
                    {f.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats bar */}
        <div
          className="relative flex items-center rounded-2xl overflow-hidden animate-slide-up"
          style={{
            border: '1px solid rgba(255,255,255,0.07)',
            backgroundColor: 'rgba(255,255,255,0.03)',
            animationDelay: '400ms',
            opacity: 0,
            animationFillMode: 'forwards',
          }}
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="flex-1 text-center py-4"
              style={{
                borderRight: i < stats.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}
            >
              <p className="text-xl font-800 text-white leading-none mb-1">{s.value}</p>
              <p className="text-[11px] font-500" style={{ color: 'rgba(148,163,184,0.6)' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form panel ──────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative"
        style={{ backgroundColor: 'var(--background)' }}
      >
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.015]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, var(--foreground) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 relative">
          <AppLogo variant="full" size={28} darkBg={false} showWordmark={true} />
        </div>

        <div
          className="w-full max-w-[400px] relative animate-slide-up"
          style={{ opacity: 0, animationFillMode: 'forwards' }}
        >
          {/* Tab switcher */}
          <div
            className="flex rounded-xl p-1 mb-8"
            style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 text-[13.5px] font-600 rounded-lg transition-all duration-200"
                style={{
                  backgroundColor: tab === t ? 'var(--card)' : 'transparent',
                  color: tab === t ? 'var(--foreground)' : 'var(--muted-foreground)',
                  boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <LoginForm onSwitchToSignup={() => setTab('signup')} />
          ) : (
            <SignupForm onSwitchToLogin={() => setTab('login')} />
          )}
        </div>

        {/* Bottom trust note */}
        <p
          className="relative mt-8 text-[11px] text-center"
          style={{ color: 'var(--muted-foreground)' }}
        >
          No credit card required · Free 14-day trial · Cancel anytime
        </p>
      </div>
    </div>
  );
}
