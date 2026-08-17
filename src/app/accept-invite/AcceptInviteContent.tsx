'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

import AppLogo from '@/components/ui/AppLogo';

export default function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email');

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'verify' | 'setup' | 'success'>('verify');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    verifyInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const verifyInvite = async () => {
    if (!email) {
      setError('Invalid invitation link. Please request a new invitation.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from('pending_invites')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .single();

    if (fetchError || !data) {
      setError('This invitation is invalid, expired, or has already been used.');
      setLoading(false);
      return;
    }

    const invitedAt = new Date(data.invited_at);
    const now = new Date();
    const daysDiff = (now.getTime() - invitedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 7) {
      await supabase.from('pending_invites').update({ status: 'expired' }).eq('id', data.id);
      setError('This invitation has expired. Please request a new invitation.');
      setLoading(false);
      return;
    }

    setInvite(data);
    setStep('setup');
    setLoading(false);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: invite.role,
            company_id: invite.company_id,
          },
        },
      });

      if (signUpError) throw signUpError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('Failed to create account.');

      await supabase.from('user_roles').insert({
        user_id: userId,
        company_id: invite.company_id,
        role: invite.role,
      });

      await supabase
        .from('pending_invites')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      setStep('success');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to activate account. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <AppLogo variant="full" size={36} darkBg={false} showWordmark={true} />
        </div>

        <div className="card-elevated p-8 rounded-2xl">
          {error && step !== 'setup' ? (
            <div className="text-center space-y-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ backgroundColor: 'var(--danger-bg)' }}
              >
                <AlertCircle size={32} style={{ color: 'var(--danger)' }} />
              </div>
              <h1 className="text-xl font-700 text-foreground">Invitation Error</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={() => router.push('/sign-up-login')}
                className="w-full py-2.5 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Go to Login
              </button>
            </div>
          ) : step === 'success' ? (
            <div className="text-center space-y-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ backgroundColor: 'var(--success-bg)' }}
              >
                <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
              </div>
              <h1 className="text-xl font-700 text-foreground">Account Activated!</h1>
              <p className="text-sm text-muted-foreground">
                Your account has been created. Please check your email to verify your address, then
                sign in.
              </p>
              <button
                onClick={() => router.push('/sign-up-login')}
                className="w-full py-2.5 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-5">
              <div className="text-center mb-2">
                <h1 className="text-xl font-700 text-foreground">Accept Invitation</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  You&apos;ve been invited as <strong>{invite?.role}</strong>. Set up your account
                  below.
                </p>
              </div>

              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={invite?.email || ''}
                  readOnly
                  className="w-full px-3 py-2.5 text-sm rounded-lg border bg-secondary opacity-70 cursor-not-allowed"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30"
                  style={{ borderColor: 'var(--border)' }}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full px-3 py-2.5 pr-10 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30"
                    style={{ borderColor: 'var(--border)' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30"
                  style={{ borderColor: 'var(--border)' }}
                  required
                />
              </div>

              {error && (
                <div
                  className="flex items-center gap-2 p-3 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}
                >
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Activating...
                  </>
                ) : (
                  'Activate Account'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
