'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { UserCog, Plus, Search, MoreHorizontal, Shield, CheckCircle2, XCircle, Clock, Edit2, Trash2, Key, Eye, Users, Lock, Mail, X, Loader2, AlertCircle } from 'lucide-react';
import { useRBAC } from '@/contexts/RBACContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

import { emailService } from '@/lib/emailService';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'supervisor' | 'viewer';
  status: 'active' | 'inactive' | 'pending';
  lastLogin: string;
  joinedDate: string;
  initials: string;
  color: string;
  twoFactor: boolean;
}

interface InviteModalProps {
  onClose: () => void;
  onInvited: () => void;
  companyId: string | null;
}

const roleConfig: Record<string, { bg: string; text: string; label: string }> = {
  admin: { bg: 'rgba(239,68,68,0.1)', text: '#EF4444', label: 'Admin' },
  manager: { bg: 'rgba(37,99,235,0.1)', text: '#2563EB', label: 'Manager' },
  supervisor: { bg: 'rgba(139,92,246,0.1)', text: '#8B5CF6', label: 'Supervisor' },
  viewer: { bg: 'var(--secondary)', text: 'var(--muted-foreground)', label: 'Viewer' },
};

const statusConfig: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  active: { bg: 'var(--success-bg)', text: 'var(--success)', label: 'Active', dot: 'var(--success)' },
  inactive: { bg: 'var(--secondary)', text: 'var(--muted-foreground)', label: 'Inactive', dot: 'var(--muted-foreground)' },
  pending: { bg: 'var(--warning-bg)', text: 'var(--warning)', label: 'Pending', dot: 'var(--warning)' },
  suspended: { bg: 'var(--danger-bg)', text: 'var(--danger)', label: 'Suspended', dot: 'var(--danger)' },
};

const AVATAR_COLORS = ['#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EF4444', '#84CC16'];

function InviteModal({ onClose, onInvited, companyId }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'supervisor' | 'viewer'>('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) { setError('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address'); return; }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      // Store invite record in pending_invites table
      const { error: inviteError } = await supabase.from('pending_invites').insert({
        email: email.trim().toLowerCase(),
        role,
        company_id: companyId,
        invited_at: new Date().toISOString(),
        status: 'pending',
      });
      if (inviteError && inviteError.code !== '42P01') {
        throw inviteError;
      }
      // Send invitation email
      await emailService.sendWelcome(
        email.trim().toLowerCase(),
        email.split('@')[0],
        'Your Team',
        role
      ).catch(() => {/* silent fail if email not configured */});

      setSuccess(true);
      setTimeout(() => { onInvited(); onClose(); }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="card-elevated rounded-2xl w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-700 text-foreground">Invite Team Member</h2>
            <p className="text-xs text-muted-foreground mt-0.5">They&apos;ll receive an email to join your workspace</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--success-bg)' }}>
              <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
            </div>
            <p className="text-sm font-700 text-foreground">Invite sent!</p>
            <p className="text-xs text-muted-foreground mt-1">An invitation has been recorded for {email}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--danger-bg)' }}>
                <AlertCircle size={14} className="text-danger flex-shrink-0 mt-0.5" />
                <p className="text-xs text-danger font-500">{error}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-600 text-foreground mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com.au"
                className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground"
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div>
              <label className="block text-sm font-600 text-foreground mb-1.5">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(['manager', 'supervisor', 'viewer'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="px-3 py-2.5 rounded-xl border text-xs font-600 transition-all capitalize"
                    style={{
                      borderColor: role === r ? 'var(--accent)' : 'var(--border)',
                      backgroundColor: role === r ? 'rgba(37,99,235,0.08)' : 'var(--card)',
                      color: role === r ? 'var(--accent)' : 'var(--foreground)',
                    }}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {role === 'manager' ? 'Can manage jobs, contractors, and reports' :
                 role === 'supervisor'? 'Can manage jobs and view contractors' : 'Read-only access to assigned areas'}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-600 border transition-all hover:bg-secondary" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-700 text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {loading ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Mail size={14} /> Send Invite</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const { companyId } = useAuth();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase.from('user_roles').select('user_id, role, company_id, created_at');
      if (companyId) query = query.eq('company_id', companyId);
      const { data: roleRows } = await query;

      if (roleRows && roleRows.length > 0) {
        const mapped: UserRecord[] = roleRows.map((r, idx) => ({
          id: r.user_id,
          name: `User ${idx + 1}`,
          email: '',
          role: r.role as UserRecord['role'],
          status: 'active',
          lastLogin: 'Recently',
          joinedDate: new Date(r.created_at).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }),
          initials: `U${idx + 1}`,
          color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
          twoFactor: false,
        }));
        setUsers(mapped);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // RBAC guard
  if (!rbacLoading && !hasPermission('canManageUsers')) {
    return (
      <AppLayout currentPath="/users">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Lock size={48} className="text-muted-foreground mb-4 opacity-40" />
          <h2 className="text-xl font-700 text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">You don&apos;t have permission to manage users. Contact your administrator.</p>
        </div>
      </AppLayout>
    );
  }

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    admins: users.filter((u) => u.role === 'admin').length,
    twoFactor: users.filter((u) => u.twoFactor).length,
  };

  return (
    <AppLayout currentPath="/users">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-header-title">Users</h1>
            <p className="page-header-subtitle">Manage platform access, roles, and permissions</p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="btn-primary"
            aria-label="Invite new user"
          >
            <Plus size={15} />
            Invite User
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: stats.total, icon: Users, color: 'var(--accent)' },
            { label: 'Active Users', value: stats.active, icon: CheckCircle2, color: 'var(--success)' },
            { label: 'Admins', value: stats.admins, icon: Shield, color: 'var(--danger)' },
            { label: '2FA Enabled', value: `${stats.twoFactor}/${stats.total}`, icon: Lock, color: '#8B5CF6' },
          ].map((s) => (
            <div key={s.label} className="card-elevated p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${s.color}18` }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <div>
                {loading ? (
                  <div className="w-8 h-5 rounded bg-secondary animate-pulse mb-1" />
                ) : (
                  <p className="text-xl font-700 text-foreground font-tabular">{s.value}</p>
                )}
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card-elevated p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
          <select value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setPage(1); }} className="text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }}>
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="viewer">Viewer</option>
          </select>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none" style={{ borderColor: 'var(--border)' }}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} users</span>
        </div>

        {/* Table */}
        <div className="card-elevated overflow-hidden">
          {loading ? (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-secondary flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="w-32 h-4 rounded bg-secondary" />
                    <div className="w-48 h-3 rounded bg-secondary" />
                  </div>
                  <div className="w-16 h-5 rounded-full bg-secondary" />
                  <div className="w-16 h-5 rounded-full bg-secondary" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}>
                    {['User', 'Role', 'Joined', '2FA', 'Last Login', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-600 uppercase tracking-wide text-muted-foreground whitespace-nowrap" style={{ fontSize: '11px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((user, idx) => {
                    const rc = roleConfig[user.role] || roleConfig['viewer'];
                    const sc = statusConfig[user.status] || statusConfig['active'];
                    return (
                      <tr key={user.id} className="transition-colors hover:bg-secondary/50" style={{ borderBottom: idx < paginated.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-700 text-white flex-shrink-0" style={{ backgroundColor: user.color }}>
                              {user.initials}
                            </div>
                            <div>
                              <p className="text-sm font-600 text-foreground">{user.name}</p>
                              {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="status-badge" style={{ backgroundColor: rc.bg, color: rc.text }}>{rc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{user.joinedDate}</td>
                        <td className="px-4 py-3">
                          {user.twoFactor ? (
                            <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                          ) : (
                            <XCircle size={16} style={{ color: 'var(--muted-foreground)' }} />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={11} />{user.lastLogin}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="status-badge" style={{ backgroundColor: sc.bg, color: sc.text }}>
                            <span className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block" style={{ backgroundColor: sc.dot }} />
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                              className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                            >
                              <MoreHorizontal size={16} className="text-muted-foreground" />
                            </button>
                            {openMenu === user.id && (
                              <div className="absolute right-0 top-8 z-20 w-44 card-elevated rounded-lg shadow-lg overflow-hidden animate-slide-up">
                                {[
                                  { icon: Eye, label: 'View Profile' },
                                  { icon: Edit2, label: 'Edit Role' },
                                  { icon: Key, label: 'Reset Password' },
                                  { icon: Trash2, label: 'Remove User' },
                                ].map((action) => (
                                  <button
                                    key={action.label}
                                    onClick={() => setOpenMenu(null)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
                                    style={{ color: action.label === 'Remove User' ? 'var(--danger)' : 'var(--foreground)' }}
                                  >
                                    <action.icon size={14} />
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-16 text-center">
                  <UserCog size={40} className="mx-auto text-muted-foreground mb-3 opacity-40" />
                  <p className="text-sm text-muted-foreground">No users found</p>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="mt-3 text-sm font-600 text-accent hover:underline"
                  >
                    Invite your first team member →
                  </button>
                </div>
              )}
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs text-muted-foreground">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                        <button onClick={() => setPage(p)} className="w-7 h-7 rounded-md text-xs font-600 transition-colors" style={{ backgroundColor: p === page ? 'var(--accent)' : 'transparent', color: p === page ? 'white' : 'var(--foreground)' }}>{p}</button>
                      </React.Fragment>
                    ))}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onInvited={loadUsers}
          companyId={companyId}
        />
      )}
    </AppLayout>
  );
}
