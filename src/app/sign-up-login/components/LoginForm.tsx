'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface ForgotPasswordValues {
  resetEmail: string;
}

interface LoginFormProps {
  onSwitchToSignup: () => void;
}

export default function LoginForm({ onSwitchToSignup }: LoginFormProps) {
  const router = useRouter();
  const { signIn, resetPassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors, isSubmitting: isResetSubmitting },
  } = useForm<ForgotPasswordValues>();

  const onSubmit = async (data: LoginFormValues) => {
    setAuthError(null);
    try {
      await signIn(data.email, data.password);
      toast.success('Welcome back! Signed in successfully.');
      router.push('/dashboard');
      router.refresh();
    } catch (error: unknown) {
      const msg =
        (error as { message?: string })?.message || 'Invalid email or password. Please try again.';
      setAuthError(msg);
    }
  };

  const onResetSubmit = async (data: ForgotPasswordValues) => {
    setResetError(null);
    try {
      await resetPassword(data.resetEmail);
      setResetSent(true);
    } catch (error: unknown) {
      setResetError(
        (error as { message?: string })?.message || 'Failed to send reset email. Please try again.'
      );
    }
  };

  if (showForgotPassword) {
    return (
      <div className="animate-fade-in" suppressHydrationWarning>
        <div className="mb-8">
          <button
            type="button"
            onClick={() => {
              setShowForgotPassword(false);
              setResetSent(false);
              setResetError(null);
            }}
            className="text-sm font-600 text-accent hover:underline flex items-center gap-1 mb-4"
          >
            ← Back to sign in
          </button>
          <h2 className="text-2xl font-700 text-foreground">Reset your password</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {resetSent ? (
          <div className="text-center py-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--success-bg)' }}
            >
              <CheckCircle2 size={28} className="text-success" />
            </div>
            <h3 className="text-lg font-700 text-foreground">Check your inbox</h3>
            <p className="text-sm text-muted-foreground mt-2">
              We&apos;ve sent a password reset link to your email address.
            </p>
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setResetSent(false);
              }}
              className="mt-6 text-sm font-600 text-accent hover:underline"
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleResetSubmit(onResetSubmit)}
            className="space-y-5"
            noValidate
            suppressHydrationWarning
          >
            {resetError && (
              <div
                className="flex items-start gap-3 p-3 rounded-xl mb-5 border"
                style={{ backgroundColor: 'var(--danger-bg)', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                <AlertCircle size={16} className="text-danger flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger font-500">{resetError}</p>
              </div>
            )}
            <div>
              <label
                className="block text-sm font-600 text-foreground mb-1.5"
                htmlFor="reset-email"
                suppressHydrationWarning
              >
                Email address
              </label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
                placeholder="you@company.com.au"
                {...registerReset('resetEmail', {
                  required: 'Email address is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
              />
              {resetErrors.resetEmail && (
                <p className="text-xs text-danger mt-1.5 font-500">
                  {resetErrors.resetEmail.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isResetSubmitting}
              className="w-full py-3.5 rounded-xl text-sm font-700 text-white transition-all duration-150 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {isResetSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Sending…</span>
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in" suppressHydrationWarning>
      <div className="mb-8">
        <h2 className="text-2xl font-700 text-foreground">Welcome back</h2>
        <p className="text-sm text-muted-foreground mt-1">Sign in to your Innovion workspace</p>
      </div>

      {authError && (
        <div
          className="flex items-start gap-3 p-3 rounded-xl mb-5 border"
          style={{ backgroundColor: 'var(--danger-bg)', borderColor: 'rgba(239,68,68,0.3)' }}
        >
          <AlertCircle size={16} className="text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger font-500">{authError}</p>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
        suppressHydrationWarning
      >
        {/* Email */}
        <div suppressHydrationWarning>
          <label
            className="block text-sm font-600 text-foreground mb-1.5"
            htmlFor="login-email"
            suppressHydrationWarning
          >
            Email address
          </label>
          <div suppressHydrationWarning>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
              placeholder="you@company.com.au"
              suppressHydrationWarning
              {...register('email', {
                required: 'Email address is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Enter a valid email address',
                },
              })}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-danger mt-1.5 font-500">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div suppressHydrationWarning>
          <div className="flex items-center justify-between mb-1.5" suppressHydrationWarning>
            <label
              className="block text-sm font-600 text-foreground"
              htmlFor="login-password"
              suppressHydrationWarning
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-xs font-600 text-accent hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative" suppressHydrationWarning>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="w-full px-4 py-3 pr-12 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
              placeholder="••••••••"
              suppressHydrationWarning
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
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
            <p className="text-xs text-danger mt-1.5 font-500">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me + MFA */}
        <div className="flex items-center justify-between" suppressHydrationWarning>
          <label className="flex items-center gap-2.5 cursor-pointer" suppressHydrationWarning>
            <div suppressHydrationWarning>
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent focus:ring-offset-0"
                suppressHydrationWarning
                {...register('rememberMe')}
              />
            </div>
            <span className="text-sm font-500 text-foreground">Remember me for 30 days</span>
          </label>
          <span className="text-xs text-muted-foreground font-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            MFA ready
          </span>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-xl text-sm font-700 text-white transition-all duration-150 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Signing in…</span>
            </>
          ) : (
            'Sign In to Innovion'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-5">
        Don&apos;t have an account?{' '}
        <button onClick={onSwitchToSignup} className="font-600 text-accent hover:underline">
          Create one free
        </button>
      </p>
    </div>
  );
}
