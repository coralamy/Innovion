'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import { BRAND_IDENTITY } from '@/lib/brand';

const NAV_LINKS = [
  { label: 'Features', href: '/marketing/features' },
  { label: 'Industries', href: '/marketing/industries' },
  { label: 'Pricing', href: '/marketing/pricing' },
  { label: 'Resources', href: '/marketing/resources' },
  { label: 'About', href: '/marketing/about' },
  { label: 'Contact', href: '/marketing/contact' },
];

const FOOTER_PLATFORM = [
  { label: 'Features', href: '/marketing/features' },
  { label: 'Industries', href: '/marketing/industries' },
  { label: 'Pricing', href: '/marketing/pricing' },
  { label: 'Resources', href: '/marketing/resources' },
];

const FOOTER_COMPANY = [
  { label: 'About', href: '/marketing/about' },
  { label: 'Contact', href: '/marketing/contact' },
  { label: 'Privacy Policy', href: '/marketing/privacy' },
  { label: 'Terms of Service', href: '/marketing/terms' },
];

const CORALAMY_LINKS = [
  { label: 'Coralamy Group', href: 'https://www.coralamy.com' },
  { label: 'OmniCleanOS', href: 'https://www.omnicleanos.com' },
  { label: 'EzBillable', href: 'https://www.ezbillable.com' },
  { label: 'Synapse', href: 'https://www.synapse.app' },
  { label: 'InnovatechIQ', href: 'https://www.innovatechiq.com' },
  { label: 'Rhixo', href: 'https://www.rhixo.com' },
];

function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === '/marketing';

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docH > 0 ? Math.min(y / docH, 1) : 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/96 backdrop-blur-xl shadow-[0_1px_0_rgba(0,0,0,0.06)] border-b border-slate-100/80'
            : isHome
            ? 'bg-transparent' :'bg-[#0F1C2E]/95 backdrop-blur-xl'
        }`}
      >
        {/* Scroll progress bar */}
        <div
          className="absolute bottom-0 left-0 h-[2px] transition-all duration-100"
          style={{
            width: `${scrollProgress * 100}%`,
            background: 'linear-gradient(90deg, #2563EB, #60A5FA)',
            opacity: scrolled ? 1 : 0,
          }}
        />

        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="flex items-center justify-between h-[60px] lg:h-[68px]">
            {/* Logo lockup */}
            <Link href="/marketing" className="flex-shrink-0 transition-opacity duration-150 hover:opacity-80">
              <AppLogo
                variant="full"
                size={32}
                darkBg={!scrolled}
                showWordmark={true}
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3.5 py-2 rounded-lg text-[13.5px] font-500 transition-all duration-200 ${
                    isActive(link.href)
                      ? scrolled
                        ? 'text-[#1E3A5F] bg-slate-50'
                        : 'text-white bg-white/12'
                      : scrolled
                      ? 'text-slate-500 hover:text-[#1E3A5F] hover:bg-slate-50'
                      : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <span
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ backgroundColor: '#2563EB' }}
                    />
                  )}
                </Link>
              ))}
            </nav>

            {/* CTA group */}
            <div className="hidden lg:flex items-center gap-2.5">
              <Link
                href="/sign-up-login"
                className={`text-[13.5px] font-500 px-3.5 py-2 rounded-lg transition-all duration-200 ${
                  scrolled
                    ? 'text-slate-500 hover:text-[#1E3A5F] hover:bg-slate-50'
                    : 'text-white/75 hover:text-white hover:bg-white/10'
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/sign-up-login"
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13.5px] font-600 px-5 py-2.5 rounded-xl transition-all duration-200 shadow-sm shadow-blue-500/20 hover:shadow-blue-500/35 hover:-translate-y-px active:translate-y-0"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`lg:hidden p-2 rounded-lg transition-all duration-150 active:scale-90 ${
                scrolled ? 'text-slate-600 hover:bg-slate-100' : 'text-white hover:bg-white/10'
              }`}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <div
          className="lg:hidden overflow-hidden transition-all duration-300"
          style={{
            maxHeight: mobileOpen ? '480px' : '0',
            opacity: mobileOpen ? 1 : 0,
          }}
        >
          <div className="bg-white border-t border-slate-100 shadow-xl">
            <div className="max-w-7xl mx-auto px-5 py-4 space-y-0.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-500 transition-colors ${
                    isActive(link.href)
                      ? 'text-[#1E3A5F] bg-blue-50 font-600'
                      : 'text-slate-600 hover:text-[#1E3A5F] hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                  )}
                </Link>
              ))}
              <div className="pt-3 mt-2 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  href="/sign-up-login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm font-500 text-slate-600 hover:text-[#1E3A5F] rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up-login"
                  onClick={() => setMobileOpen(false)}
                  className="block bg-[#2563EB] text-white text-sm font-600 px-4 py-3 rounded-xl text-center hover:bg-[#1D4ED8] transition-colors active:scale-95"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

function MarketingFooter() {
  return (
    <footer className="bg-[#070F1A] text-slate-400">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        {/* Main footer grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 pt-16 pb-12 border-b border-white/[0.06]">
          {/* Brand column */}
          <div className="lg:col-span-4 xl:col-span-5">
            <AppLogo variant="full" size={30} darkBg={true} showWordmark={true} className="mb-5" />
            <p className="text-sm text-slate-400 leading-relaxed mb-1.5 max-w-xs">
              Intelligent Micro Business Operations Management
            </p>
            <p className="text-xs text-slate-600 mb-7">A Member Company of the Coralamy Group.</p>
            <Link
              href="/sign-up-login"
              className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-600 px-5 py-2.5 rounded-xl transition-all duration-200 shadow-sm shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-px active:translate-y-0"
            >
              Start Free Trial
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Platform links */}
          <div className="lg:col-span-2">
            <h4 className="text-white text-xs font-700 mb-4 tracking-widest uppercase">Platform</h4>
            <ul className="space-y-2.5">
              {FOOTER_PLATFORM.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-500 hover:text-slate-200 transition-colors animated-underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div className="lg:col-span-2">
            <h4 className="text-white text-xs font-700 mb-4 tracking-widest uppercase">Company</h4>
            <ul className="space-y-2.5">
              {FOOTER_COMPANY.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-500 hover:text-slate-200 transition-colors animated-underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Coralamy Group */}
          <div className="lg:col-span-3 xl:col-span-3">
            <h4 className="text-white text-xs font-700 mb-4 tracking-widest uppercase">Coralamy Group</h4>
            <ul className="space-y-2.5">
              {CORALAMY_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:text-slate-200 transition-colors animated-underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-6">
          <p className="text-xs text-slate-600" suppressHydrationWarning>
            © {new Date().getFullYear()} {BRAND_IDENTITY.copyright}
          </p>
          <div className="flex items-center gap-4">
            <Link href="/marketing/privacy" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Privacy</Link>
            <Link href="/marketing/terms" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />
      <main className="flex-1">
        {children}
      </main>
      <MarketingFooter />
      <CookieConsentBanner />
    </div>
  );
}
