'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { emailService } from '@/lib/emailService';

interface SignupFormValues {
  companyName: string;
  abn: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  plan: string;
  terms: boolean;
}

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

const plans = [
  {
    id: 'plan-starter',
    value: 'starter',
    label: 'Starter',
    price: '$49/mo',
    desc: 'Up to 5 contractors',
  },
  {
    id: 'plan-growth',
    value: 'growth',
    label: 'Growth',
    price: '$99/mo',
    desc: 'Up to 15 contractors',
  },
  {
    id: 'plan-enterprise',
    value: 'enterprise',
    label: 'Enterprise',
    price: 'Custom',
    desc: 'Unlimited contractors',
  },
];

export default function SignupForm({ onSwitchToLogin }: SignupFormProps) {
  const router = useRouter();
  const { signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    defaultValues: { plan: 'growth' },
  });

  const passwordValue = watch('password');

  const onSubmit = async (data: SignupFormValues) => {
    setAuthError(null);
    if (!data.terms) {
      setAuthError('You must accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    try {
      await signUp(data.email, data.password, {
        fullName: `${data.firstName} ${data.lastName}`,
        companyName: data.companyName,
        plan: data.plan,
      });
      // Send welcome email (non-blocking)
      emailService
        .sendWelcome(data.email, `${data.firstName} ${data.lastName}`, data.companyName, data.plan)
        .catch(() => {
          /* silent fail — email is best-effort */
        });
      toast.success('Account created! Welcome to Innovion.');
      router.push('/onboarding');
      router.refresh();
    } catch (error: unknown) {
      const msg =
        (error as { message?: string })?.message || 'Failed to create account. Please try again.';
      setAuthError(msg);
    }
  };

  return (
    <div className="animate-fade-in" suppressHydrationWarning>
      <div className="mb-6">
        <h2 className="text-2xl font-700 text-foreground">Create your workspace</h2>
        <p className="text-sm text-muted-foreground mt-1">
          14-day free trial · No credit card required
        </p>
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
        className="space-y-4"
        noValidate
        suppressHydrationWarning
      >
        {/* Company name */}
        <div suppressHydrationWarning>
          <label
            className="block text-sm font-600 text-foreground mb-1.5"
            htmlFor="signup-company"
            suppressHydrationWarning
          >
            Company name
          </label>
          <div suppressHydrationWarning>
            <input
              id="signup-company"
              type="text"
              className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
              placeholder="Acme Cleaning Services Pty Ltd"
              suppressHydrationWarning
              {...register('companyName', { required: 'Company name is required' })}
            />
          </div>
          {errors.companyName && (
            <p className="text-xs text-danger mt-1 font-500">{errors.companyName.message}</p>
          )}
        </div>

        {/* ABN */}
        <div suppressHydrationWarning>
          <label
            className="block text-sm font-600 text-foreground mb-1.5"
            htmlFor="signup-abn"
            suppressHydrationWarning
          >
            ABN
            <span className="ml-1 text-muted-foreground font-400">(optional)</span>
          </label>
          <p className="text-xs text-muted-foreground mb-1.5">
            11-digit Australian Business Number
          </p>
          <div suppressHydrationWarning>
            <input
              id="signup-abn"
              type="text"
              className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground font-tabular"
              placeholder="12 345 678 901"
              suppressHydrationWarning
              {...register('abn', {
                pattern: {
                  value: /^(\d{2}\s?\d{3}\s?\d{3}\s?\d{3}|\d{11})$/,
                  message: 'Enter a valid 11-digit ABN',
                },
              })}
            />
          </div>
          {errors.abn && <p className="text-xs text-danger mt-1 font-500">{errors.abn.message}</p>}
        </div>

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3" suppressHydrationWarning>
          <div suppressHydrationWarning>
            <label
              className="block text-sm font-600 text-foreground mb-1.5"
              htmlFor="signup-firstname"
              suppressHydrationWarning
            >
              First name
            </label>
            <div suppressHydrationWarning>
              <input
                id="signup-firstname"
                type="text"
                className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
                placeholder="Jessica"
                suppressHydrationWarning
                {...register('firstName', { required: 'Required' })}
              />
            </div>
            {errors.firstName && (
              <p className="text-xs text-danger mt-1 font-500">{errors.firstName.message}</p>
            )}
          </div>
          <div suppressHydrationWarning>
            <label
              className="block text-sm font-600 text-foreground mb-1.5"
              htmlFor="signup-lastname"
              suppressHydrationWarning
            >
              Last name
            </label>
            <div suppressHydrationWarning>
              <input
                id="signup-lastname"
                type="text"
                className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
                placeholder="Thompson"
                suppressHydrationWarning
                {...register('lastName', { required: 'Required' })}
              />
            </div>
            {errors.lastName && (
              <p className="text-xs text-danger mt-1 font-500">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div suppressHydrationWarning>
          <label
            className="block text-sm font-600 text-foreground mb-1.5"
            htmlFor="signup-email"
            suppressHydrationWarning
          >
            Work email
          </label>
          <div suppressHydrationWarning>
            <input
              id="signup-email"
              type="email"
              className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
              placeholder="you@company.com.au"
              suppressHydrationWarning
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
              })}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-danger mt-1 font-500">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div suppressHydrationWarning>
          <label
            className="block text-sm font-600 text-foreground mb-1.5"
            htmlFor="signup-password"
            suppressHydrationWarning
          >
            Password
          </label>
          <p className="text-xs text-muted-foreground mb-1.5">
            Minimum 8 characters with a number and symbol
          </p>
          <div className="relative" suppressHydrationWarning>
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              className="w-full px-4 py-3 pr-12 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
              placeholder="••••••••"
              suppressHydrationWarning
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Minimum 8 characters' },
                pattern: {
                  value: /(?=.*[0-9])(?=.*[!@#$%^&*])/,
                  message: 'Must include a number and symbol',
                },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-danger mt-1 font-500">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div suppressHydrationWarning>
          <label
            className="block text-sm font-600 text-foreground mb-1.5"
            htmlFor="signup-confirm-password"
            suppressHydrationWarning
          >
            Confirm password
          </label>
          <div className="relative" suppressHydrationWarning>
            <input
              id="signup-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              className="w-full px-4 py-3 pr-12 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
              placeholder="••••••••"
              suppressHydrationWarning
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) => value === passwordValue || 'Passwords do not match',
              })}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-danger mt-1 font-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Plan selection */}
        <div suppressHydrationWarning>
          <label className="block text-sm font-600 text-foreground mb-2" suppressHydrationWarning>
            Select plan
          </label>
          <div className="grid grid-cols-3 gap-2" suppressHydrationWarning>
            {plans.map((plan) => (
              <label key={plan.id} className="cursor-pointer">
                <input type="radio" value={plan.value} className="sr-only" {...register('plan')} />
                <div
                  className={`border rounded-xl p-3 text-center transition-all ${watch('plan') === plan.value ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-accent/50'}`}
                >
                  <p className="text-xs font-700 text-foreground">{plan.label}</p>
                  <p className="text-xs font-600 text-accent mt-0.5">{plan.price}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Terms */}
        <div suppressHydrationWarning>
          <label className="flex items-start gap-2.5 cursor-pointer" suppressHydrationWarning>
            <div suppressHydrationWarning>
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5 rounded border-border text-accent focus:ring-accent focus:ring-offset-0 flex-shrink-0"
                suppressHydrationWarning
                {...register('terms', { required: 'You must accept the terms to continue' })}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              I agree to Innovion&apos;s{' '}
              <a
                href="/marketing/terms"
                target="_blank"
                className="text-accent font-600 hover:underline"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="/marketing/privacy"
                target="_blank"
                className="text-accent font-600 hover:underline"
              >
                Privacy Policy
              </a>
            </span>
          </label>
          {errors.terms && (
            <p className="text-xs text-danger mt-1 font-500">{errors.terms.message}</p>
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
              Creating workspace…
            </>
          ) : (
            'Start Free Trial'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-4">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="font-600 text-accent hover:underline">
          Sign in
        </button>
      </p>
    </div>
  );
}
