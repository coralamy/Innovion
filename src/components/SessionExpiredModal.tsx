'use client';
import React, { useEffect, useState } from 'react';
import { LogIn, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SessionExpiredModal() {
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        setShow(false);
      }
      if (event === 'SIGNED_OUT') {
        setShow(true);
      }
    });
    return () => subscription?.unsubscribe();
  }, []);

  if (!show) return null;

  const handleSignIn = () => {
    router?.push('/sign-up-login');
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div
        className="card-elevated rounded-2xl w-full max-w-sm p-8 text-center animate-slide-up"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'var(--warning-bg)' }}
        >
          <Clock size={24} style={{ color: 'var(--warning)' }} />
        </div>
        <h2 id="session-expired-title" className="text-lg font-700 text-foreground mb-2">
          Session Expired
        </h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Your session has expired for security reasons. Please sign in again to continue.
        </p>
        <button
          onClick={handleSignIn}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 text-white transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <LogIn size={15} />
          Sign In Again
        </button>
      </div>
    </div>
  );
}
