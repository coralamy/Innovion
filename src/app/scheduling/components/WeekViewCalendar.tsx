'use client';
import React, { useRef, useState } from 'react';
import { statusColors } from './scheduleData';
import type { ScheduleFilters } from './SchedulingModule';
import type { ScheduledJob } from '@/lib/services/scheduleService';
import { RotateCcw, AlertTriangle, Plus } from 'lucide-react';
import JobDetailPopover from './JobDetailPopover';

interface WeekViewCalendarProps {
  weekOffset: number;
  filters: ScheduleFilters;
  onNewJob: () => void;
  jobs: ScheduledJob[];
  weekDates: string[];
}

const HOUR_HEIGHT = 56;
const START_HOUR = 6;
const END_HOUR = 20;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h}:00`;
  if (h === 12) return '12:00';
  return `${h - 12}:00`;
}

function jobTop(startTime: string): number {
  const [h, m] = startTime.split(':').map(Number);
  return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
}

function jobHeight(durationMinutes: number): number {
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 28);
}

export default function WeekViewCalendar({
  weekOffset,
  filters,
  onNewJob,
  jobs,
  weekDates,
}: WeekViewCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

  const todayDateStr = new Date().toISOString().split('T')[0];

  const filteredJobs = jobs.filter((job) => {
    if (filters.contractor !== 'all') {
      const contractorSlug = job.contractorName.toLowerCase().replace(/\s+/g, '-');
      if (contractorSlug !== filters.contractor) return false;
    }
    if (filters.status !== 'all' && job.status !== filters.status) return false;
    if (filters.region !== 'all' && job.region.toLowerCase().replace(/\s+/g, '') !== filters.region)
      return false;
    if (filters.client !== 'all') {
      const clientSlug = job.client.toLowerCase().replace(/\s+/g, '');
      if (!clientSlug.includes(filters.client.replace(/\s+/g, ''))) return false;
    }
    return true;
  });

  const handleJobClick = (e: React.MouseEvent, job: ScheduledJob) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverPos({ x: rect.right + 8, y: rect.top });
    setSelectedJob(job);
  };

  return (
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
              key={`dayhead-${day}`}
              className="flex-1 text-center py-3 border-l border-border first:border-l-0"
            >
              <p
                className="text-xs font-600 uppercase tracking-wide"
                style={{ color: isToday ? 'var(--accent)' : 'var(--muted-foreground)' }}
              >
                {day}
              </p>
              <div
                className="mx-auto mt-1 w-8 h-8 rounded-full flex items-center justify-center text-sm font-700"
                style={{
                  backgroundColor: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? 'white' : 'var(--foreground)',
                }}
              >
                {dateNum}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin">
        <div className="flex" style={{ minHeight: `${TOTAL_HEIGHT}px`, minWidth: '700px' }}>
          {/* Time gutter */}
          <div className="flex-shrink-0 w-14 relative" style={{ height: `${TOTAL_HEIGHT}px` }}>
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
              <div
                key={`time-${START_HOUR + i}`}
                className="absolute right-2 text-xs text-muted-foreground font-500"
                style={{ top: `${i * HOUR_HEIGHT - 8}px`, fontSize: '10px' }}
              >
                {i < TOTAL_HOURS ? formatHour(START_HOUR + i) : ''}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const dateStr = weekDates[dayIdx];
            const isToday = dateStr === todayDateStr;
            const dayJobs = filteredJobs.filter((j) => j.scheduledDate === dateStr);

            return (
              <div
                key={`daycol-${day}`}
                className="flex-1 relative border-l border-border"
                style={{
                  height: `${TOTAL_HEIGHT}px`,
                  backgroundColor: isToday ? 'rgba(37,99,235,0.02)' : 'transparent',
                  minWidth: '120px',
                }}
                onClick={onNewJob}
              >
                {/* Hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={`hline-${day}-${i}`}
                    className="absolute left-0 right-0 border-t border-border"
                    style={{
                      top: `${i * HOUR_HEIGHT}px`,
                      borderColor: i % 2 === 0 ? 'var(--border)' : 'rgba(226,232,240,0.4)',
                    }}
                  />
                ))}

                {/* Job blocks */}
                {dayJobs.map((job) => {
                  const colors = statusColors[job.status] || statusColors['scheduled'];
                  const top = jobTop(job.startTime);
                  const height = jobHeight(job.durationMinutes);
                  const isShort = height < 48;
                  const [startH, startM] = job.startTime.split(':');

                  return (
                    <div
                      key={job.id}
                      className="job-block"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: colors.bg,
                        borderLeft: `3px solid ${colors.border}`,
                        outline: job.hasConflict ? `2px solid var(--danger)` : 'none',
                        outlineOffset: '1px',
                      }}
                      onClick={(e) => handleJobClick(e, job)}
                      title={`${job.jobNum} · ${job.site}`}
                    >
                      <div className="flex items-start gap-1 h-full overflow-hidden">
                        <div className="flex-1 min-w-0">
                          {!isShort && (
                            <p
                              className="font-700 leading-tight truncate"
                              style={{ color: colors.text, fontSize: '10px' }}
                            >
                              {job.site.length > 18 ? job.site.substring(0, 16) + '…' : job.site}
                            </p>
                          )}
                          <p
                            className="font-500 truncate"
                            style={{ color: colors.text, opacity: 0.85, fontSize: '9px' }}
                          >
                            {isShort
                              ? job.site.substring(0, 12)
                              : `${startH}:${startM} · ${job.contractorInitials}`}
                          </p>
                        </div>
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          {job.isRecurring && (
                            <RotateCcw size={8} style={{ color: colors.text, opacity: 0.7 }} />
                          )}
                          {job.hasConflict && (
                            <AlertTriangle size={8} style={{ color: 'var(--danger)' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add job hint on hover */}
                <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                    <Plus size={12} className="text-accent" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Job detail popover */}
      {selectedJob && (
        <JobDetailPopover
          job={selectedJob}
          position={popoverPos}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}
