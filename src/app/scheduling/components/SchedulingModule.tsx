'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ScheduleHeader from './ScheduleHeader';
import ScheduleFilterBar from './ScheduleFilterBar';
import ScheduleSidebar from './ScheduleSidebar';
import NewJobModal from './NewJobModal';
import { scheduleService, ScheduledJob } from '@/lib/services/scheduleService';
import { contractorService, Contractor } from '@/lib/services/contractorService';
import { logActivity } from '@/lib/activityLogger';
import { Loader2, Plus, AlertTriangle } from 'lucide-react';
import { statusColors } from './scheduleData';

export type ViewMode = 'day' | 'week' | 'month' | 'agenda' | 'contractor' | 'site';

export interface ScheduleFilters {
  contractor: string;
  region: string;
  client: string;
  site: string;
  status: string;
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_HEIGHT = 56;
const START_HOUR = 6;
const END_HOUR = 20;

function getWeekDates(weekOffset: number): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h}:00`;
  if (h === 12) return '12:00';
  return `${h - 12}:00`;
}

/** Detect if two jobs overlap in time on the same day for the same contractor */
function jobsOverlap(a: ScheduledJob, b: ScheduledJob): boolean {
  if (a.contractorId !== b.contractorId || a.scheduledDate !== b.scheduledDate) return false;
  if (!a.contractorId) return false;
  const [ah, am] = a.startTime.split(':').map(Number);
  const [bh, bm] = b.startTime.split(':').map(Number);
  const aStart = ah * 60 + am;
  const aEnd = aStart + a.durationMinutes;
  const bStart = bh * 60 + bm;
  const bEnd = bStart + b.durationMinutes;
  return aStart < bEnd && bStart < aEnd;
}

export default function SchedulingModule() {
  const { user, companyId } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [filters, setFilters] = useState<ScheduleFilters>({
    contractor: 'all',
    region: 'all',
    client: 'all',
    site: 'all',
    status: 'all',
  });
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const weekDates = getWeekDates(selectedWeekOffset);
  const todayDateStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    setLoading(true);
    const [jobsData, contractorsData] = await Promise.all([
      scheduleService.getWeekJobs(weekDates[0], weekDates[6], companyId),
      contractorService.getAll(companyId),
    ]);
    setJobs(jobsData);
    setContractors(contractorsData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekOffset, companyId]);

  const filteredJobs = jobs.filter((job) => {
    if (filters.contractor !== 'all') {
      const contractorSlug = job.contractorName.toLowerCase().replace(/\s+/g, '-');
      if (contractorSlug !== filters.contractor) return false;
    }
    if (filters.status !== 'all' && job.status !== filters.status) return false;
    if (filters.region !== 'all' && job.region.toLowerCase().replace(/\s/g, '') !== filters.region)
      return false;
    if (filters.client !== 'all' && job.client.toLowerCase().replace(/\s+/g, '') !== filters.client)
      return false;
    return true;
  });

  // Compute conflict map from current jobs
  const conflictJobIds = new Set<string>();
  for (let i = 0; i < jobs.length; i++) {
    for (let j = i + 1; j < jobs.length; j++) {
      if (jobsOverlap(jobs[i], jobs[j])) {
        conflictJobIds.add(jobs[i].id);
        conflictJobIds.add(jobs[j].id);
      }
    }
  }

  const conflictCount = conflictJobIds.size;

  const handleJobCreated = async (job: ScheduledJob) => {
    // Check for conflicts with existing jobs
    const conflicting = jobs.filter((j) => jobsOverlap(j, job));
    if (conflicting.length > 0) {
      const names = conflicting.map((j) => j.site).join(', ');
      setConflictWarning(
        `⚠️ Conflict detected: ${job.contractorName} is already scheduled for ${names} at this time.`
      );
      setTimeout(() => setConflictWarning(null), 6000);
    }
    setJobs((prev) => [...prev, { ...job, hasConflict: conflicting.length > 0 }]);
    setShowNewJobModal(false);

    if (user) {
      await logActivity({
        userId: user.id,
        companyId,
        action: 'job_created',
        entityType: 'scheduled_job',
        entityId: job.id,
        description: `Scheduled job created: ${job.site} on ${job.scheduledDate}`,
        metadata: { contractor: job.contractorName, hasConflict: conflicting.length > 0 },
      });
    }
  };

  return (
    <div className="flex flex-col h-full -mx-4 lg:-mx-6 xl:-mx-8 2xl:-mx-10 -mt-6">
      <ScheduleHeader
        viewMode={viewMode}
        onViewChange={setViewMode}
        weekOffset={selectedWeekOffset}
        onWeekChange={setSelectedWeekOffset}
        onNewJob={() => setShowNewJobModal(true)}
        onRefresh={loadData}
      />
      <ScheduleFilterBar
        filters={filters}
        onFilterChange={setFilters}
        jobs={jobs}
        contractors={contractors}
      />

      {/* Conflict warning banner */}
      {conflictWarning && (
        <div
          className="mx-4 mt-2 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-500 animate-slide-up"
          style={{
            backgroundColor: 'var(--warning-bg)',
            color: 'var(--warning)',
            border: '1px solid var(--warning)',
          }}
        >
          <AlertTriangle size={14} />
          {conflictWarning}
        </div>
      )}

      {/* Conflict summary badge */}
      {conflictCount > 0 && !conflictWarning && (
        <div
          className="mx-4 mt-2 px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-500"
          style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}
        >
          <AlertTriangle size={12} />
          {conflictCount} job{conflictCount > 1 ? 's have' : ' has'} scheduling conflicts this week
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="flex-1 overflow-hidden min-w-0 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-accent" />
                <p className="text-sm text-muted-foreground">Loading schedule…</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden bg-background">
              {/* Day headers */}
              <div
                className="flex-shrink-0 flex border-b border-border bg-card"
                style={{ paddingLeft: '56px' }}
              >
                {days.map((day, i) => {
                  const dateStr = weekDates[i];
                  const dateNum = dateStr ? parseInt(dateStr.split('-')[2]) : i + 1;
                  const isToday = dateStr === todayDateStr;
                  return (
                    <div
                      key={day}
                      className="flex-1 px-2 py-2.5 text-center border-r border-border last:border-r-0"
                    >
                      <p className="text-xs font-500 text-muted-foreground">{day}</p>
                      <p
                        className={`text-sm font-700 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center mx-auto ${isToday ? 'bg-accent text-white' : 'text-foreground'}`}
                      >
                        {dateNum}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <div
                  className="relative flex"
                  style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}
                >
                  {/* Hour labels */}
                  <div className="flex-shrink-0 w-14 relative">
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                      <div
                        key={i}
                        className="absolute right-2 text-xs text-muted-foreground"
                        style={{ top: `${i * HOUR_HEIGHT - 8}px`, fontSize: '10px' }}
                      >
                        {formatHour(START_HOUR + i)}
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {days.map((day, dayIdx) => {
                    const dateStr = weekDates[dayIdx];
                    const dayJobs = filteredJobs.filter((j) => j.scheduledDate === dateStr);
                    return (
                      <div
                        key={day}
                        className="flex-1 relative border-r border-border last:border-r-0"
                      >
                        {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                          <div
                            key={i}
                            className="absolute w-full border-t border-border/40"
                            style={{ top: `${i * HOUR_HEIGHT}px` }}
                          />
                        ))}
                        {dayJobs.map((job) => {
                          const [startH, startM] = job.startTime.split(':').map(Number);
                          const top =
                            (startH - START_HOUR) * HOUR_HEIGHT + (startM / 60) * HOUR_HEIGHT;
                          const height = Math.max((job.durationMinutes / 60) * HOUR_HEIGHT, 28);
                          const colors = statusColors[job.status] || statusColors['scheduled'];
                          const hasConflict = conflictJobIds.has(job.id);
                          return (
                            <button
                              key={job.id}
                              onClick={() =>
                                setSelectedJob(selectedJob?.id === job.id ? null : job)
                              }
                              className="absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden transition-all hover:brightness-110 active:scale-95"
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                backgroundColor: hasConflict ? 'rgba(249,115,22,0.15)' : colors.bg,
                                borderLeft: `3px solid ${hasConflict ? '#F97316' : colors.border}`,
                              }}
                            >
                              <p
                                className="text-xs font-700 truncate leading-tight"
                                style={{ color: hasConflict ? '#F97316' : colors.text }}
                              >
                                {job.site}
                              </p>
                              {height > 40 && (
                                <p
                                  className="text-xs truncate opacity-80"
                                  style={{
                                    color: hasConflict ? '#F97316' : colors.text,
                                    fontSize: '10px',
                                  }}
                                >
                                  {job.contractorName}
                                </p>
                              )}
                              {hasConflict && height > 28 && (
                                <AlertTriangle
                                  size={8}
                                  style={{
                                    color: '#F97316',
                                    position: 'absolute',
                                    top: 3,
                                    right: 3,
                                  }}
                                />
                              )}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setShowNewJobModal(true)}
                          className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity shadow-md"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Job detail panel */}
          {selectedJob && (
            <div className="flex-shrink-0 border-t border-border bg-card p-4 animate-slide-up">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-700 text-foreground">
                      {selectedJob.jobNum} · {selectedJob.site}
                    </p>
                    {conflictJobIds.has(selectedJob.id) && (
                      <span
                        className="flex items-center gap-1 text-xs font-600 px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}
                      >
                        <AlertTriangle size={10} /> Conflict
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedJob.client} · {selectedJob.contractorName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedJob.scheduledDate} at {selectedJob.startTime} ·{' '}
                    {selectedJob.durationMinutes} min
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-2 py-1 rounded-full font-600"
                    style={{
                      backgroundColor: statusColors[selectedJob.status]?.bg,
                      color: statusColors[selectedJob.status]?.text,
                    }}
                  >
                    {selectedJob.status}
                  </span>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <ScheduleSidebar
          weekOffset={selectedWeekOffset}
          onWeekChange={setSelectedWeekOffset}
          jobs={jobs}
          contractors={contractors}
          todayDateStr={todayDateStr}
        />
      </div>

      {showNewJobModal && (
        <NewJobModal
          onClose={() => setShowNewJobModal(false)}
          onJobCreated={handleJobCreated}
          companyId={companyId}
        />
      )}
    </div>
  );
}
