'use client';
import React, { useEffect, useRef } from 'react';
import { X, MapPin, User, Clock, AlertTriangle, RotateCcw, ExternalLink } from 'lucide-react';
import type { ScheduledJob } from '@/lib/services/scheduleService';
import { statusColors } from './scheduleData';

interface JobDetailPopoverProps {
  job: ScheduledJob;
  position: { x: number; y: number };
  onClose: () => void;
}

const statusLabels: Record<string, string> = {
  scheduled: 'Scheduled',
  'in-progress': 'In Progress',
  completed: 'Completed',
  issue: 'Issue',
  unassigned: 'Unassigned',
};

const typeLabels: Record<string, string> = {
  recurring: 'Recurring',
  'one-off': 'One-off',
  emergency: 'Emergency',
  inspection: 'Inspection',
  maintenance: 'Maintenance',
};

function computeTimeRange(startTime: string, durationMinutes: number): string {
  const [startH, startM] = startTime.split(':').map(Number);
  const totalEndMinutes = startH * 60 + startM + durationMinutes;
  const endH = Math.floor(totalEndMinutes / 60);
  const endM = totalEndMinutes % 60;
  return `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')} – ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export default function JobDetailPopover({ job, position, onClose }: JobDetailPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const colors = statusColors[job.status] || statusColors['scheduled'];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const timeRange = computeTimeRange(job.startTime, job.durationMinutes);

  // Clamp to viewport
  const left = Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - 320 : position.x);
  const top = Math.min(position.y, typeof window !== 'undefined' ? window.innerHeight - 320 : position.y);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-72 bg-card border border-border rounded-2xl shadow-card-lg animate-slide-up overflow-hidden"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2" style={{ backgroundColor: colors.bg }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-700 font-tabular" style={{ color: colors.text }}>{job.jobNum}</span>
            <span className="status-badge" style={{ backgroundColor: colors.darkBg, color: colors.text }}>
              {statusLabels[job.status]}
            </span>
            {job.isRecurring && (
              <span className="flex items-center gap-1 text-xs font-500" style={{ color: colors.text, opacity: 0.8 }}>
                <RotateCcw size={10} />
                Recurring
              </span>
            )}
          </div>
          <p className="text-sm font-700 text-foreground mt-1 truncate">{job.site}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/10 text-muted-foreground transition-colors flex-shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        {job.hasConflict && (
          <div className="flex items-center gap-2 p-2 rounded-lg border" style={{ backgroundColor: 'var(--danger-bg)', borderColor: 'rgba(239,68,68,0.3)' }}>
            <AlertTriangle size={13} className="text-danger flex-shrink-0" />
            <p className="text-xs font-600 text-danger">Scheduling conflict detected</p>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <MapPin size={14} className="text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-600 text-foreground truncate">{job.site}</p>
            <p className="text-xs text-muted-foreground">{job.client}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <User size={14} className="text-muted-foreground flex-shrink-0" />
          <p className="text-sm font-500 text-foreground">{job.contractorName}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <Clock size={14} className="text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-sm font-500 text-foreground">{timeRange}</p>
            <p className="text-xs text-muted-foreground">{job.durationMinutes} minutes · {typeLabels[job.type]}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="status-badge" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
            {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)} Priority
          </span>
          <span className="status-badge" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
            {job.region}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border flex items-center gap-2">
        <button className="flex-1 py-2 rounded-lg text-xs font-700 text-white transition-all active:scale-95" style={{ backgroundColor: 'var(--accent)' }}>
          Edit Job
        </button>
        <button className="px-3 py-2 rounded-lg text-xs font-600 border border-border text-muted-foreground hover:bg-muted transition-colors">
          Reassign
        </button>
        <button className="p-2 rounded-lg text-xs font-600 border border-border text-muted-foreground hover:bg-muted transition-colors" title="Open full job detail">
          <ExternalLink size={13} />
        </button>
      </div>
    </div>
  );
}