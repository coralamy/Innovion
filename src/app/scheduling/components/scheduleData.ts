// scheduleData.ts — shared constants for the scheduling module.
// Mock arrays (contractors, weekJobs) have been removed; live data is loaded
// from Supabase via scheduleService and contractorService.

// Legacy Job interface kept for reference — use ScheduledJob from scheduleService for live data.
export interface Job {
  id: string;
  jobNum: string;
  site: string;
  client: string;
  contractorId: string;
  contractorName: string;
  contractorInitials: string;
  dayIndex: number;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'issue' | 'unassigned';
  type: 'recurring' | 'one-off' | 'emergency' | 'inspection' | 'maintenance';
  priority: 'high' | 'medium' | 'low';
  hasConflict?: boolean;
  isRecurring?: boolean;
  region: string;
}

export interface Contractor {
  id: string;
  name: string;
  initials: string;
  role: string;
  region: string;
  color: string;
}

export const statusColors: Record<string, { bg: string; border: string; text: string; darkBg: string }> = {
  scheduled: { bg: 'rgba(37,99,235,0.12)', border: '#2563EB', text: '#1D4ED8', darkBg: 'rgba(37,99,235,0.2)' },
  'in-progress': { bg: 'rgba(16,185,129,0.12)', border: '#10B981', text: '#047857', darkBg: 'rgba(16,185,129,0.2)' },
  completed: { bg: 'rgba(148,163,184,0.15)', border: '#94A3B8', text: '#64748B', darkBg: 'rgba(148,163,184,0.2)' },
  issue: { bg: 'rgba(239,68,68,0.12)', border: '#EF4444', text: '#DC2626', darkBg: 'rgba(239,68,68,0.2)' },
  unassigned: { bg: 'rgba(245,158,11,0.12)', border: '#F59E0B', text: '#D97706', darkBg: 'rgba(245,158,11,0.2)' },
};