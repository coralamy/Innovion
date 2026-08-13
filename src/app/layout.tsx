import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '../styles/tailwind.css';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { RBACProvider } from '@/contexts/RBACContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { LocalisationProvider } from '@/contexts/LocalisationContext';
import ErrorBoundary from '@/components/ErrorBoundary';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Innovion by Coralamy — intelligent Micro Business Operations Management',
  description: 'Innovion by Coralamy brings customers, jobs, staff, contractors, scheduling, compliance, inventory and reporting together in one intelligent cloud platform for micro businesses.',
  icons: {
    icon: [
      { url: '/assets/images/Favicon-1786073542962.png', type: 'image/png', sizes: '32x32' },
      { url: '/assets/images/Favicon-1786073542962.png', type: 'image/png', sizes: '16x16' },
    ],
    shortcut: '/assets/images/Favicon-1786073542962.png',
    apple: '/assets/images/Favicon-1786073542962.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Innovion — intelligent Micro Business Operations Management',
    description: 'Schedule contractors, manage compliance, track jobs in real time — all from one platform built for growing service businesses.',
    siteName: 'Innovion',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={plusJakartaSans.variable} suppressHydrationWarning>
      <body className={plusJakartaSans.className}>
        <ThemeProvider>
          <AuthProvider>
            <RBACProvider>
              <SubscriptionProvider>
                <LocalisationProvider>
                  <ErrorBoundary pageName="application">
                    {children}
                  </ErrorBoundary>
                </LocalisationProvider>
              </SubscriptionProvider>
            </RBACProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-plus-jakarta-sans)',
              fontSize: '14px',
            },
          }}
        />
</body>
    </html>
  );
}