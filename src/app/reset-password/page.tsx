'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

interface ResetPasswordValues {
  password: string;
  confirmPassword: string;
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f59e0b' };
  if (score <= 3) return { score, label: 'Good', color: '#3b82f6' };
  return { score, label: 'Strong', color: '#22c55e' };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>();

  const passwordValue = watch('password', '');
  const strength = getPasswordStrength(passwordValue);

  useEffect(() => {
    // Supabase sets the session from the URL hash automatically on page load
    // We just need to verify a session exists
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      } else {
        // Wait briefly for the hash-based session to be processed
        setTimeout(async () => {
          const {
            data: { session: retrySession },
          } = await supabase.auth.getSession();
          if (retrySession) {
            setSessionReady(true);
          } else {
            setSessionError(true);
          }
        }, 1000);
      }
    };
    checkSession();
  }, []);

  const onSubmit = async (data: ResetPasswordValues) => {
    setSubmitError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.push('/sign-up-login'), 3000);
    } catch (error: unknown) {
      setSubmitError(
        (error as { message?: string })?.message || 'Failed to update password. Please try again.'
      );
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-2/5 xl:w-1/2 flex-col justify-between p-10 xl:p-16 gradient-navy">
        <div className="flex items-center">
          <AppLogo variant="full" size={32} darkBg={true} />
        </div>
        <div>
          <h1 className="text-4xl xl:text-5xl font-800 text-white leading-tight">
            Secure your
            <br />
            <span style={{ color: '#60A5FA' }}>account,</span>
            <br />
            stay in control.
          </h1>
          <p className="text-lg mt-6 leading-relaxed" style={{ color: 'rgba(203,213,225,0.8)' }}>
            Choose a strong password to keep your Innovion workspace protected.
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-800 text-white">256-bit</p>
            <p className="text-xs font-500 mt-0.5" style={{ color: 'rgba(203,213,225,0.6)' }}>
              AES Encryption
            </p>
          </div>
          <div className="w-px h-10" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <div className="text-center">
            <p className="text-2xl font-800 text-white">SOC 2</p>
            <p className="text-xs font-500 mt-0.5" style={{ color: 'rgba(203,213,225,0.6)' }}>
              Compliant
            </p>
          </div>
          <div className="w-px h-10" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <div className="text-center">
            <p className="text-2xl font-800 text-white">99.9%</p>
            <p className="text-xs font-500 mt-0.5" style={{ color: 'rgba(203,213,225,0.6)' }}>
              Uptime
            </p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <AppLogo variant="full" size={28} darkBg={false} />
        </div>

        <div className="w-full max-w-md">
          {success ? (
            <div className="text-center py-8">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ backgroundColor: 'var(--success-bg, #dcfce7)' }}
              >
                <CheckCircle2 size={32} className="text-success" style={{ color: '#22c55e' }} />
              </div>
              <h2 className="text-2xl font-700 text-foreground">Password updated!</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Your password has been changed successfully. Redirecting you to sign in…
              </p>
              <button
                onClick={() => router.push('/sign-up-login')}
                className="mt-6 text-sm font-600 text-accent hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Go to sign in →
              </button>
            </div>
          ) : sessionError ? (
            <div className="text-center py-8">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ backgroundColor: 'var(--danger-bg, #fee2e2)' }}
              >
                <AlertCircle size={32} style={{ color: '#ef4444' }} />
              </div>
              <h2 className="text-2xl font-700 text-foreground">Link expired</h2>
              <p className="text-sm text-muted-foreground mt-2">
                This password reset link has expired or already been used. Please request a new one.
              </p>
              <button
                onClick={() => router.push('/sign-up-login')}
                className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-700 text-white transition-all duration-150 active:scale-95"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Back to sign in
              </button>
            </div>
          ) : !sessionReady ? (
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Verifying reset link…</p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}
                >
                  <Lock size={22} style={{ color: 'var(--accent)' }} />
                </div>
                <h2 className="text-2xl font-700 text-foreground">Set new password</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a strong password for your Innovion account.
                </p>
              </div>

              {submitError && (
                <div
                  className="flex items-start gap-3 p-3 rounded-xl mb-5 border"
                  style={{
                    backgroundColor: 'var(--danger-bg, #fee2e2)',
                    borderColor: 'rgba(239,68,68,0.3)',
                  }}
                >
                  <AlertCircle
                    size={16}
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: '#ef4444' }}
                  />
                  <p className="text-sm font-500" style={{ color: '#ef4444' }}>
                    {submitError}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                {/* New password */}
                <div>
                  <label
                    className="block text-sm font-600 text-foreground mb-1.5"
                    htmlFor="new-password"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="w-full px-4 py-3 pr-12 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
                      placeholder="••••••••"
                      {...register('password', {
                        required: 'Password is required',
                        minLength: { value: 8, message: 'Password must be at least 8 characters' },
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs mt-1.5 font-500" style={{ color: '#ef4444' }}>
                      {errors.password.message}
                    </p>
                  )}
                  {/* Strength bar */}
                  {passwordValue && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{
                              backgroundColor:
                                i <= strength.score ? strength.color : 'var(--border)',
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-xs font-500" style={{ color: strength.color }}>
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label
                    className="block text-sm font-600 text-foreground mb-1.5"
                    htmlFor="confirm-password"
                  >
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="w-full px-4 py-3 pr-12 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
                      placeholder="••••••••"
                      {...register('confirmPassword', {
                        required: 'Please confirm your password',
                        validate: (val) => val === passwordValue || 'Passwords do not match',
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs mt-1.5 font-500" style={{ color: '#ef4444' }}>
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl text-sm font-700 text-white transition-all duration-150 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Updating password…</span>
                    </>
                  ) : (
                    'Update password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
