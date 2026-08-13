'use client';
import React from 'react';
import { Users } from 'lucide-react';

interface ContractorStatus {
  id: string;
  name: string;
  initials: string;
  status: string;
  utilization: number;
}

interface ContractorAvailabilityProps {
  /** Pre-fetched data from /api/dashboard/summary */
  contractors?: ContractorStatus[];
  loading?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  'on-job':      { label: 'On Job',      color: 'var(--success)',          dot: 'bg-success' },
  available:     { label: 'Available',   color: 'var(--accent)',           dot: 'bg-accent' },
  unavailable:   { label: 'Unavailable', color: 'var(--muted-foreground)', dot: 'bg-muted-foreground' },
  'on-leave':    { label: 'On Leave',    color: 'var(--warning)',          dot: 'bg-warning' },
};

function ContractorSkeleton() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-secondary flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="h-3 w-28 rounded bg-secondary" />
          <div className="h-3 w-14 rounded bg-secondary" />
        </div>
        <div className="h-1.5 rounded-full bg-secondary" />
      </div>
    </div>
  );
}

export default function ContractorAvailability({ contractors = [], loading }: ContractorAvailabilityProps) {
  const activeCount = contractors.filter((c) => c.status === 'on-job' || c.status === 'available').length;

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-600 text-foreground">Contractor Status</h3>
        {loading ? (
          <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
        ) : (
          <span className="text-xs font-600 text-success">{activeCount} active now</span>
        )}
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <ContractorSkeleton key={i} />)}
        </div>
      ) : contractors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-3">
            <Users size={18} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-600 text-foreground">No contractors yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add contractors to see their status here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contractors.map((c) => {
            const cfg = statusConfig[c.status] ?? statusConfig['available'];
            return (
              <div key={c.id} className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-700" style={{ backgroundColor: 'var(--accent)' }}>
                    {c.initials}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${cfg.dot}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-500 text-foreground truncate">{c.name}</p>
                    <span className="text-xs font-500 flex-shrink-0" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  {c.status !== 'on-leave' && (
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${c.utilization}%`,
                          backgroundColor: c.utilization > 85 ? 'var(--warning)' : 'var(--success)',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}