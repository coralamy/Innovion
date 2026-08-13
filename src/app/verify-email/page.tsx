'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2, Mail, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

type VerifyState = 'loading' | 'verified' | 'already_verified' | 'error' | 'pending';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [state, setState] = useState<VerifyState>('loading');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    const checkVerification = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUserEmail(session.user.email ?? null);
        if (session.user.email_confirmed_at) {
          const isNewVerification = searchParams.get('type') === 'signup' || searchParams.get('verified') === 'true';
          setState(isNewVerification ? 'verified' : 'already_verified');
          if (isNewVerification) {
            setTimeout(() => router.push('/'), 3000);
          }
        } else {
          setState('pending');
        }
      } else {
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession?.user) {
            setUserEmail(retrySession.user.email ?? null);
            if (retrySession.user.email_confirmed_at) {
              setState('verified');
              setTimeout(() => router.push('/'), 3000);
            } else {
              setState('pending');
            }
          } else {
            setState('error');
          }
        }, 1200);
      }
    };

    checkVerification();
  }, []);

  const handleResend = async () => {
    if (!userEmail) return;
    setResendLoading(true);
    setResendError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback?type=signup&next=/verify-email&verified=true`,
        },
      });
      if (error) throw error;
      setResendSent(true);
    } catch (error: unknown) {
      setResendError((error as { message?: string })?.message || 'Failed to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md text-center">
      {state === 'loading' && (
        <div className="py-8">
          <Loader2 size={36} className="animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying your email…</p>
        </div>
      )}

      {state === 'verified' && (
        <div className="py-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#dcfce7' }}>
            <CheckCircle2 size={32} style={{ color: '#22c55e' }} />
          </div>
          <h2 className="text-2xl font-700 text-foreground">Email verified!</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your email has been confirmed. Taking you to your workspace…
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            <span>Redirecting…</span>
          </div>
          <button onClick={() => router.push('/dashboard')} className="mt-6 text-sm font-600 hover:underline" style={{ color: 'var(--accent)' }}>
            Go to dashboard →
          </button>
        </div>
      )}

      {state === 'already_verified' && (
        <div className="py-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-2xl font-700 text-foreground">Already verified</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your email address is already confirmed. You can sign in to your workspace.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-700 text-white transition-all duration-150 active:scale-95"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Go to dashboard
          </button>
        </div>
      )}

      {state === 'pending' && (
        <div className="py-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}>
            <Mail size={32} style={{ color: '#f59e0b' }} />
          </div>
          <h2 className="text-2xl font-700 text-foreground">Check your inbox</h2>
          <p className="text-sm text-muted-foreground mt-2">
            We sent a verification link to{' '}
            {userEmail ? <span className="font-600 text-foreground">{userEmail}</span> : 'your email address'}
            . Click the link in the email to verify your account.
          </p>

          <div className="mt-6 p-4 rounded-xl border text-left" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
            <p className="text-xs font-600 text-foreground mb-1">Didn't receive it?</p>
            <p className="text-xs text-muted-foreground">Check your spam folder, or resend the verification email below.</p>
          </div>

          {resendError && (
            <div className="flex items-start gap-3 p-3 rounded-xl mt-4 border text-left" style={{ backgroundColor: '#fee2e2', borderColor: 'rgba(239,68,68,0.3)' }}>
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-xs font-500" style={{ color: '#ef4444' }}>{resendError}</p>
            </div>
          )}

          {resendSent ? (
            <div className="flex items-center justify-center gap-2 mt-5 p-3 rounded-xl" style={{ backgroundColor: '#dcfce7' }}>
              <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
              <p className="text-sm font-600" style={{ color: '#16a34a' }}>Verification email sent!</p>
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendLoading || !userEmail}
              className="mt-5 w-full py-3 rounded-xl text-sm font-700 border transition-all duration-150 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'var(--card)' }}
            >
              {resendLoading ? (
                <><Loader2 size={14} className="animate-spin" /><span>Sending…</span></>
              ) : (
                <><RefreshCw size={14} /><span>Resend verification email</span></>
              )}
            </button>
          )}

          <button onClick={() => router.push('/sign-up-login')} className="mt-4 text-sm font-600 hover:underline text-muted-foreground">
            ← Back to sign in
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="py-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#fee2e2' }}>
            <AlertCircle size={32} style={{ color: '#ef4444' }} />
          </div>
          <h2 className="text-2xl font-700 text-foreground">Link expired</h2>
          <p className="text-sm text-muted-foreground mt-2">
            This verification link has expired or is invalid. Please sign up again or request a new verification email.
          </p>
          <button
            onClick={() => router.push('/sign-up-login')}
            className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-700 text-white transition-all duration-150 active:scale-95"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Back to sign in
          </button>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-2/5 xl:w-1/2 flex-col justify-between p-10 xl:p-16 gradient-navy">
        <div className="flex items-center">
          <AppLogo variant="full" size={32} darkBg={true} />
        </div>
        <div>
          <h1 className="text-4xl xl:text-5xl font-800 text-white leading-tight">
            One step away<br />
            <span style={{ color: '#60A5FA' }}>from your</span><br />
            workspace.
          </h1>
          <p className="text-lg mt-6 leading-relaxed" style={{ color: 'rgba(203,213,225,0.8)' }}>
            Verify your email to unlock full access to Innovion's intelligent operations platform.
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-800 text-white">Free</p>
            <p className="text-xs font-500 mt-0.5" style={{ color: 'rgba(203,213,225,0.6)' }}>14-day trial</p>
          </div>
          <div className="w-px h-10" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <div className="text-center">
            <p className="text-2xl font-800 text-white">No</p>
            <p className="text-xs font-500 mt-0.5" style={{ color: 'rgba(203,213,225,0.6)' }}>Credit card needed</p>
          </div>
          <div className="w-px h-10" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <div className="text-center">
            <p className="text-2xl font-800 text-white">5 min</p>
            <p className="text-xs font-500 mt-0.5" style={{ color: 'rgba(203,213,225,0.6)' }}>Setup time</p>
          </div>
        </div>
      </div>

      {/* Content panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <AppLogo variant="full" size={28} darkBg={false} />
        </div>

        <Suspense fallback={
          <div className="py-8 text-center">
            <Loader2 size={36} className="animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        }>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
