'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import PlannedAction from '@/components/ui/PlannedAction';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Lock,
  Bell,
  Save,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Briefcase,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Smartphone,
  Camera,
} from 'lucide-react';

interface ProfileTab {
  id: string;
  label: string;
  icon: React.ElementType;
}

const tabs: ProfileTab[] = [
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'password', label: 'Change Password', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-600 text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="flex-shrink-0 transition-colors"
        style={{ color: value ? 'var(--accent)' : 'var(--muted-foreground)' }}
      >
        {value ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Profile state
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    job_title: '',
    department: '',
    avatar_url: '',
  });

  // Password state
  const [passwords, setPasswords] = useState({
    current: '',
    newPass: '',
    confirm: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Notification preferences stored in user metadata
  const [notifPrefs, setNotifPrefs] = useState({
    emailJobs: true,
    emailCompliance: true,
    emailIncidents: true,
    emailReports: false,
    pushJobs: false,
    pushCompliance: true,
    pushIncidents: true,
    smsIncidents: false,
  });

  // Load user data from Supabase auth metadata
  useEffect(() => {
    if (user) {
      const meta = user.user_metadata || {};
      setProfile({
        full_name: meta.full_name || '',
        email: user.email || '',
        phone: meta.phone || '',
        job_title: meta.job_title || '',
        department: meta.department || '',
        avatar_url: meta.avatar_url || '',
      });
      if (meta.notification_preferences) {
        setNotifPrefs((prev) => ({ ...prev, ...meta.notification_preferences }));
      }
    }
  }, [user]);

  const getInitials = (name: string) => {
    if (!name) return user?.email?.slice(0, 2).toUpperCase() || 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSaveProfile = async () => {
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
          phone: profile.phone,
          job_title: profile.job_title,
          department: profile.department,
          avatar_url: profile.avatar_url,
        },
      });
      if (updateError) throw updateError;
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (!passwords.newPass || passwords.newPass.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setPasswordLoading(true);
    try {
      const { error: pwError } = await supabase.auth.updateUser({
        password: passwords.newPass,
      });
      if (pwError) throw pwError;
      setPasswordSuccess(true);
      setPasswords({ current: '', newPass: '', confirm: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { notification_preferences: notifPrefs },
      });
      if (updateError) throw updateError;
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save notification preferences.');
    }
  };

  const updateNotif = (key: keyof typeof notifPrefs) => (v: boolean) =>
    setNotifPrefs((p) => ({ ...p, [key]: v }));

  const passwordStrength = (pw: string) => {
    if (!pw) return { label: '', color: '' };
    if (pw.length < 6) return { label: 'Weak', color: 'var(--danger)' };
    if (pw.length < 10) return { label: 'Fair', color: 'var(--warning)' };
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw))
      return { label: 'Strong', color: 'var(--success)' };
    return { label: 'Good', color: 'var(--info)' };
  };

  const strength = passwordStrength(passwords.newPass);

  return (
    <AppLayout currentPath="/profile">
      <div className="space-y-6 animate-fade-in max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-700 text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your personal information, password, and notification preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tab nav */}
          <div className="lg:col-span-1">
            <div className="card-elevated overflow-hidden">
              {/* Avatar section */}
              <div
                className="p-5 border-b flex flex-col items-center gap-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="relative">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-700 flex-shrink-0"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {getInitials(profile.full_name)}
                  </div>
                  <PlannedAction
                    className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: 'var(--accent)' }}
                    title="Uploading a profile photo is not available yet."
                  >
                    <Camera size={12} />
                  </PlannedAction>
                </div>
                <div className="text-center min-w-0">
                  <p className="text-sm font-700 text-foreground truncate">
                    {profile.full_name || 'Your Name'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                  {profile.job_title && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {profile.job_title}
                    </p>
                  )}
                </div>
              </div>

              {tabs.map((tab, idx) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setError('');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left"
                    style={{
                      backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                      color: isActive ? 'white' : 'var(--foreground)',
                      borderBottom: idx < tabs.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <TabIcon size={15} />
                    <span className="font-600">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content panel */}
          <div className="lg:col-span-3">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="card-elevated p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-700 text-foreground">Personal Information</h2>
                  <button
                    onClick={handleSaveProfile}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: saved ? 'var(--success)' : 'var(--accent)' }}
                  >
                    {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                    {saved ? 'Saved!' : 'Save Changes'}
                  </button>
                </div>

                {error && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}
                  >
                    <AlertCircle size={15} />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label
                      className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                      style={{ fontSize: '11px' }}
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <User
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                      <input
                        suppressHydrationWarning
                        type="text"
                        value={profile.full_name}
                        onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                        placeholder="Your full name"
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                        style={{ borderColor: 'var(--border)' }}
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                      style={{ fontSize: '11px' }}
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                      <input
                        suppressHydrationWarning
                        type="email"
                        value={profile.email}
                        disabled
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border bg-muted cursor-not-allowed opacity-70"
                        style={{ borderColor: 'var(--border)' }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Email cannot be changed here. Contact your administrator.
                    </p>
                  </div>

                  <div>
                    <label
                      className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                      style={{ fontSize: '11px' }}
                    >
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                      <input
                        suppressHydrationWarning
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+61 4xx xxx xxx"
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                        style={{ borderColor: 'var(--border)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                      style={{ fontSize: '11px' }}
                    >
                      Job Title
                    </label>
                    <div className="relative">
                      <Briefcase
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                      <input
                        suppressHydrationWarning
                        type="text"
                        value={profile.job_title}
                        onChange={(e) => setProfile((p) => ({ ...p, job_title: e.target.value }))}
                        placeholder="e.g. Operations Manager"
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                        style={{ borderColor: 'var(--border)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                      style={{ fontSize: '11px' }}
                    >
                      Department
                    </label>
                    <input
                      suppressHydrationWarning
                      type="text"
                      value={profile.department}
                      onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))}
                      placeholder="e.g. Operations"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>

                  <div>
                    <label
                      className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                      style={{ fontSize: '11px' }}
                    >
                      Account Created
                    </label>
                    <input
                      suppressHydrationWarning
                      type="text"
                      value={
                        user?.created_at
                          ? new Date(user.created_at).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : '—'
                      }
                      disabled
                      className="w-full px-3 py-2.5 text-sm rounded-lg border bg-muted cursor-not-allowed opacity-70"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
              <div className="card-elevated p-6 space-y-5">
                <h2 className="text-base font-700 text-foreground">Change Password</h2>
                <p className="text-sm text-muted-foreground">
                  Choose a strong password with at least 8 characters, including uppercase letters,
                  numbers, and symbols.
                </p>

                {passwordError && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}
                  >
                    <AlertCircle size={15} />
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}
                  >
                    <CheckCircle2 size={15} />
                    Password updated successfully.
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                      style={{ fontSize: '11px' }}
                    >
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                      <input
                        suppressHydrationWarning
                        type={showCurrent ? 'text' : 'password'}
                        value={passwords.current}
                        onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                        placeholder="Enter current password"
                        className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                        style={{ borderColor: 'var(--border)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                      style={{ fontSize: '11px' }}
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                      <input
                        suppressHydrationWarning
                        type={showNew ? 'text' : 'password'}
                        value={passwords.newPass}
                        onChange={(e) => setPasswords((p) => ({ ...p, newPass: e.target.value }))}
                        placeholder="Enter new password"
                        className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                        style={{ borderColor: 'var(--border)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {passwords.newPass && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              backgroundColor: strength.color,
                              width:
                                strength.label === 'Weak'
                                  ? '25%'
                                  : strength.label === 'Fair'
                                    ? '50%'
                                    : strength.label === 'Good'
                                      ? '75%'
                                      : '100%',
                            }}
                          />
                        </div>
                        <span className="text-xs font-600" style={{ color: strength.color }}>
                          {strength.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide"
                      style={{ fontSize: '11px' }}
                    >
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                      <input
                        suppressHydrationWarning
                        type={showConfirm ? 'text' : 'password'}
                        value={passwords.confirm}
                        onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                        placeholder="Confirm new password"
                        className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                        style={{
                          borderColor:
                            passwords.confirm && passwords.confirm !== passwords.newPass
                              ? 'var(--danger)'
                              : 'var(--border)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {passwords.confirm && passwords.confirm !== passwords.newPass && (
                      <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
                        Passwords do not match
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleChangePassword}
                    disabled={passwordLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {passwordLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Lock size={15} />
                    )}
                    {passwordLoading ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-700 text-foreground">Notification Preferences</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Choose how and when you receive alerts
                    </p>
                  </div>
                  <button
                    onClick={handleSaveNotifications}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: saved ? 'var(--success)' : 'var(--accent)' }}
                  >
                    {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                    {saved ? 'Saved!' : 'Save Changes'}
                  </button>
                </div>

                {error && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}
                  >
                    <AlertCircle size={15} />
                    {error}
                  </div>
                )}

                {[
                  {
                    title: 'Email Notifications',
                    icon: Mail,
                    items: [
                      {
                        key: 'emailJobs',
                        label: 'Job updates',
                        description: 'New assignments, completions, and cancellations',
                      },
                      {
                        key: 'emailCompliance',
                        label: 'Compliance alerts',
                        description: 'Expiring licenses, certifications, and insurance',
                      },
                      {
                        key: 'emailIncidents',
                        label: 'Incident reports',
                        description: 'New incidents and status changes',
                      },
                      {
                        key: 'emailReports',
                        label: 'Weekly reports',
                        description: 'Automated weekly operations summary',
                      },
                    ],
                  },
                  {
                    title: 'Push Notifications',
                    icon: Smartphone,
                    items: [
                      {
                        key: 'pushJobs',
                        label: 'Job updates',
                        description: 'Real-time job status changes',
                      },
                      {
                        key: 'pushCompliance',
                        label: 'Compliance alerts',
                        description: 'Critical compliance issues requiring immediate action',
                      },
                      {
                        key: 'pushIncidents',
                        label: 'Incident alerts',
                        description: 'New critical and high severity incidents',
                      },
                    ],
                  },
                  {
                    title: 'SMS Notifications',
                    icon: Phone,
                    items: [
                      {
                        key: 'smsIncidents',
                        label: 'Critical incidents',
                        description: 'SMS alerts for critical severity incidents only',
                      },
                    ],
                  },
                ].map((group) => (
                  <div key={group.title} className="card-elevated p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <group.icon size={15} className="text-muted-foreground" />
                      <h3 className="text-sm font-700 text-foreground">{group.title}</h3>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {group.items.map((item) => (
                        <ToggleRow
                          key={item.key}
                          label={item.label}
                          description={item.description}
                          value={notifPrefs[item.key as keyof typeof notifPrefs]}
                          onChange={updateNotif(item.key as keyof typeof notifPrefs)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
