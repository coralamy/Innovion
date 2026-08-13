'use client';
import React, { useEffect, useState } from 'react';
import { Clock, User, Briefcase } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UpcomingJob {
  id: string;
  job_number: string;
  site: string;
  assigned_to: string;
  scheduled_time: string;
  job_status: string;
}

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
  'in-progress': { label: 'In Progress', bg: 'var(--success-bg)', color: 'var(--success)' },
  'scheduled': { label: 'Scheduled', bg: 'var(--info-bg)', color: 'var(--info)' },
  'unassigned': { label: 'Unassigned', bg: 'var(--warning-bg)', color: 'var(--warning)' },
};

function JobSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg animate-pulse">
      <div className="w-0.5 self-stretch rounded-full bg-secondary mt-1" style={{ minHeight: '36px' }} />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="h-3 w-28 rounded bg-secondary" />
          <div className="h-5 w-16 rounded-full bg-secondary" />
        </div>
        <div className="flex gap-3">
          <div className="h-2 w-12 rounded bg-secondary" />
          <div className="h-2 w-20 rounded bg-secondary" />
        </div>
      </div>
    </div>
  );
}

export default function UpcomingJobs() {
  const { companyId } = useAuth();
  const [jobs, setJobs] = useState<UpcomingJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    // Use actual today's date string (YYYY-MM-DD) for the query
    const todayStr = new Date().toISOString().split('T')[0];
    let query = supabase
      .from('jobs')
      .select('id, job_number, site, assigned_to, scheduled_time, job_status')
      .in('job_status', ['scheduled', 'in-progress'])
      .eq('scheduled_date', todayStr)
      .order('scheduled_time', { ascending: true })
      .limit(5);
    if (companyId) query = query.eq('company_id', companyId);
    query.then(({ data }) => {
      setJobs((data as UpcomingJob[]) || []);
      setLoading(false);
    });
  }, [companyId]);

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-600 text-foreground">Upcoming Jobs</h3>
        <span className="text-xs text-muted-foreground">Today</span>
      </div>

      {loading ? (
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => <JobSkeleton key={i} />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-3">
            <Briefcase size={18} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-600 text-foreground">No jobs scheduled today</p>
          <p className="text-xs text-muted-foreground mt-1">Jobs assigned for today will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const statusKey = job.job_status === 'in-progress' ? 'in-progress' : job.assigned_to ? 'scheduled' : 'unassigned';
            const cfg = statusConfig[statusKey] || statusConfig['scheduled'];
            return (
              <div key={job.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                <div className="flex-shrink-0 self-stretch rounded-full mt-1" style={{ backgroundColor: cfg.color, minHeight: '36px', width: '3px' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-600 text-foreground truncate">{job.site}</p>
                    <span className="status-badge flex-shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={11} />{job.scheduled_time}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><User size={11} />{job.assigned_to || '—'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}