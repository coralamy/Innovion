'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import AppLayout from '@/components/AppLayout';
import { Key, Plus, Copy, Check, AlertTriangle, X, Loader2, CheckCircle2, XCircle, Code2 } from 'lucide-react';
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  AVAILABLE_SCOPES,
  type PlatformApiKey,
} from '@/lib/services/platformApiKeyService';

export default function PlatformApiPage() {
  const { user, companyId } = useAuth();
  const { hasPermission } = useRBAC();
  const canManage = hasPermission('canManageCompany');

  const [keys, setKeys] = useState<PlatformApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newScopes, setNewScopes] = useState<string[]>(['localisation:read', 'business-rules:read']);
  const [newExpiry, setNewExpiry] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const loadKeys = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await listApiKeys(companyId);
      setKeys(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleCreate = async () => {
    if (!companyId || !user?.id || !newLabel.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { rawKey, record } = await createApiKey({
        companyId,
        createdBy: user.id,
        label: newLabel.trim(),
        scopes: newScopes,
        expiresAt: newExpiry || null,
      });
      setKeys((prev) => [record, ...prev]);
      setRevealedKey(rawKey);
      setShowCreate(false);
      setNewLabel('');
      setNewScopes(['localisation:read', 'business-rules:read']);
      setNewExpiry('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await revokeApiKey(keyId);
      setKeys((prev) => prev.map((k) => k.id === keyId ? { ...k, isActive: false } : k));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const copyKey = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setNewScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <AppLayout currentPath="/platform-api">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[1.375rem] font-800 tracking-tight" style={{ color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              Platform API Keys
            </h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Manage secure API keys for the Innovion Platform API — consumed by Workforce and partner applications
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary"
              aria-label="Create new API key"
            >
              <Plus size={15} />
              New API Key
            </button>
          )}
        </div>

        {/* Endpoint Reference */}
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
              <Code2 size={14} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="text-sm font-700 text-foreground">Available Platform Endpoints</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { method: 'GET', path: '/api/platform/localisation',   scope: 'localisation:read' },
              { method: 'GET', path: '/api/platform/country-config',  scope: 'country-config:read' },
              { method: 'GET', path: '/api/platform/business-rules',  scope: 'business-rules:read' },
              { method: 'GET', path: '/api/platform/tenancy',         scope: 'tenancy:read' },
              { method: 'GET', path: '/api/platform/partner-config',  scope: 'partner-config:read' },
              { method: 'GET', path: '/api/platform/translations',    scope: 'translations:read' },
            ].map((ep) => (
              <div key={ep.path} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-mono" style={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--border)' }}>
                <span className="font-700 flex-shrink-0" style={{ color: 'var(--success)' }}>{ep.method}</span>
                <span className="flex-1 truncate" style={{ color: 'var(--foreground)' }}>{ep.path}</span>
                <span className="flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>{ep.scope}</span>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--muted-foreground)' }}>
            All requests must include:{' '}
            <code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ backgroundColor: 'var(--secondary)', color: 'var(--foreground)' }}>
              Authorization: Bearer &lt;api_key&gt;
            </code>
          </p>
        </div>

        {/* Revealed Key Banner */}
        {revealedKey && (
          <div className="card-elevated p-4 animate-slide-up" style={{ borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.06)' }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />
              <p className="text-sm font-700" style={{ color: 'var(--warning)' }}>
                Copy your API key now — it will not be shown again.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <code className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm font-mono break-all" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                {revealedKey}
              </code>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={copyKey} className="btn-primary py-2 px-3 text-xs">
                  {copiedKey ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                </button>
                <button onClick={() => setRevealedKey(null)} className="btn-secondary py-2 px-3 text-xs">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg text-sm" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        {/* Create Form */}
        {showCreate && (
          <div className="card-elevated p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-700 text-foreground">Create New API Key</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-md btn-ghost">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide" style={{ fontSize: '11px' }}>Label</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Workforce Mobile App"
                  className="input-field"
                  aria-label="API key label"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-2 uppercase tracking-wide" style={{ fontSize: '11px' }}>Scopes</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_SCOPES.map((s) => (
                    <label key={s.value} className="flex items-center gap-2.5 text-sm cursor-pointer p-2.5 rounded-lg transition-colors hover:bg-secondary" style={{ border: '1px solid var(--border)' }}>
                      <input
                        type="checkbox"
                        checked={newScopes.includes(s.value)}
                        onChange={() => toggleScope(s.value)}
                        className="rounded"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span className="text-foreground font-500">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-600 text-muted-foreground mb-1.5 uppercase tracking-wide" style={{ fontSize: '11px' }}>
                  Expiry Date <span className="normal-case font-400">(optional)</span>
                </label>
                <input
                  type="date"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  className="input-field"
                  style={{ width: 'auto' }}
                  aria-label="API key expiry date"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newLabel.trim() || newScopes.length === 0}
                  className="btn-primary disabled:opacity-50"
                  aria-label="Create API key"
                >
                  {creating ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Key size={14} /> Create Key</>}
                </button>
                <button onClick={() => setShowCreate(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keys Table */}
        <div className="card-elevated overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : keys.length === 0 ? (
            <div className="empty-state">
              <Key size={40} className="empty-state-icon" />
              <p className="empty-state-title">No API keys yet</p>
              <p className="empty-state-desc">{canManage ? 'Create one above to get started.' : 'Contact your administrator to create API keys.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    {['Label', 'Key Prefix', 'Scopes', 'Status', 'Last Used', 'Expires', ...(canManage ? [''] : [])].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-600 uppercase tracking-wide" style={{ color: 'var(--muted-foreground)', fontSize: '11px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id} className="table-row">
                      <td className="px-4 py-3 font-600 text-foreground">{key.label}</td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{key.keyPrefix}…</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.map((s) => (
                            <span key={s} className="px-2 py-0.5 rounded text-xs font-500" style={{ backgroundColor: 'rgba(37,99,235,0.08)', color: 'var(--accent)' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600"
                          style={{
                            backgroundColor: key.isActive ? 'var(--success-bg)' : 'var(--secondary)',
                            color: key.isActive ? 'var(--success)' : 'var(--muted-foreground)',
                          }}
                        >
                          {key.isActive ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          {key.isActive ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>{formatDate(key.lastUsedAt)}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>{formatDate(key.expiresAt)}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          {key.isActive && (
                            <button
                              onClick={() => handleRevoke(key.id)}
                              className="text-xs font-600 transition-colors hover:opacity-80"
                              style={{ color: 'var(--danger)' }}
                              aria-label={`Revoke API key ${key.label}`}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
