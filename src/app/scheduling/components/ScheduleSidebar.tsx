'use client';
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import type { ScheduledJob } from '@/lib/services/scheduleService';
import type { Contractor } from '@/lib/services/contractorService';

interface ScheduleSidebarProps {
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  jobs: ScheduledJob[];
  contractors: Contractor[];
  todayDateStr: string;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const SHORT_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function ScheduleSidebar({
  weekOffset,
  onWeekChange,
  jobs,
  contractors,
  todayDateStr,
}: ScheduleSidebarProps) {
  const today = new Date();
  const [miniCalYear, setMiniCalYear] = useState(today.getFullYear());
  const [miniCalMonth, setMiniCalMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(miniCalYear, miniCalMonth);
  const firstDay = getFirstDayOfMonth(miniCalYear, miniCalMonth);
  const calCells = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1;
    return dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null;
  });

  // Derive today's date parts for calendar highlighting
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  // Week job summary for sidebar — use live jobs filtered by today's date
  const todayJobs = jobs.filter((j) => j.scheduledDate === todayDateStr);
  const conflictJobs = jobs.filter((j) => j.hasConflict);
  const lateJobs = jobs.filter((j) => j.status === 'issue');

  return (
    <div className="hidden xl:flex flex-col w-64 2xl:w-72 flex-shrink-0 border-l border-border bg-card overflow-y-auto scrollbar-thin">
      {/* Mini calendar */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              if (miniCalMonth === 0) {
                setMiniCalMonth(11);
                setMiniCalYear((y) => y - 1);
              } else setMiniCalMonth((m) => m - 1);
            }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <p className="text-sm font-700 text-foreground">
            {MONTHS[miniCalMonth]} {miniCalYear}
          </p>
          <button
            onClick={() => {
              if (miniCalMonth === 11) {
                setMiniCalMonth(0);
                setMiniCalYear((y) => y + 1);
              } else setMiniCalMonth((m) => m + 1);
            }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {SHORT_DAYS.map((d) => (
            <div
              key={`sh-${d}`}
              className="text-center text-xs font-600 text-muted-foreground py-1"
              style={{ fontSize: '10px' }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {calCells.map((dayNum, i) => {
            const isToday =
              dayNum === todayDay && miniCalMonth === todayMonth && miniCalYear === todayYear;
            // Highlight current week: compute week start/end for weekOffset
            const now = new Date();
            const dow = now.getDay();
            const monday = new Date(now);
            monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            const cellDate = dayNum ? new Date(miniCalYear, miniCalMonth, dayNum) : null;
            const isWeekDay = cellDate ? cellDate >= monday && cellDate <= sunday : false;

            return (
              <button
                key={`cal-cell-${i}`}
                className="aspect-square flex items-center justify-center rounded-full text-xs font-500 transition-all hover:bg-muted"
                style={{
                  fontSize: '11px',
                  backgroundColor: isToday
                    ? 'var(--accent)'
                    : isWeekDay
                      ? 'rgba(37,99,235,0.1)'
                      : 'transparent',
                  color: isToday
                    ? 'white'
                    : isWeekDay
                      ? 'var(--accent)'
                      : dayNum
                        ? 'var(--foreground)'
                        : 'transparent',
                  fontWeight: isToday || isWeekDay ? 700 : 400,
                  cursor: dayNum ? 'pointer' : 'default',
                }}
                disabled={!dayNum}
              >
                {dayNum ?? ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick stats */}
      <div className="p-4 border-b border-border space-y-3">
        <p
          className="text-xs font-700 uppercase tracking-widest text-muted-foreground"
          style={{ fontSize: '10px' }}
        >
          Today at a Glance
        </p>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Jobs today</span>
          <span className="text-sm font-700 text-foreground font-tabular">{todayJobs.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Completed</span>
          <span className="text-sm font-700 text-success font-tabular">
            {todayJobs.filter((j) => j.status === 'completed').length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">In progress</span>
          <span className="text-sm font-700 font-tabular" style={{ color: 'var(--info)' }}>
            {todayJobs.filter((j) => j.status === 'in-progress').length}
          </span>
        </div>

        {conflictJobs.length > 0 && (
          <div
            className="flex items-center gap-2 p-2.5 rounded-lg border"
            style={{ backgroundColor: 'var(--danger-bg)', borderColor: 'rgba(239,68,68,0.25)' }}
          >
            <AlertTriangle size={13} className="text-danger flex-shrink-0" />
            <div>
              <p className="text-xs font-700 text-danger">
                {conflictJobs.length} conflict{conflictJobs.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-danger/80">Requires resolution</p>
            </div>
          </div>
        )}

        {lateJobs.length > 0 && (
          <div
            className="flex items-center gap-2 p-2.5 rounded-lg border"
            style={{ backgroundColor: 'var(--warning-bg)', borderColor: 'rgba(245,158,11,0.25)' }}
          >
            <Clock size={13} className="text-warning flex-shrink-0" />
            <div>
              <p className="text-xs font-700 text-warning">
                {lateJobs.length} issue{lateJobs.length > 1 ? 's' : ''} flagged
              </p>
              <p className="text-xs text-warning/80">Action required</p>
            </div>
          </div>
        )}
      </div>

      {/* Contractor availability */}
      <div className="p-4">
        <p
          className="text-xs font-700 uppercase tracking-widest text-muted-foreground mb-3"
          style={{ fontSize: '10px' }}
        >
          Contractor Status
        </p>
        {contractors.length === 0 ? (
          <p className="text-xs text-muted-foreground">No contractors found.</p>
        ) : (
          <div className="space-y-2.5">
            {contractors.map((c) => {
              const todayJobsForContractor = todayJobs.filter((j) => j.contractorId === c.id);
              const activeJob = todayJobsForContractor.find((j) => j.status === 'in-progress');
              const totalJobs = todayJobsForContractor.length;

              return (
                <div key={c.id} className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-700 flex-shrink-0"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-600 text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {activeJob
                        ? `On job · ${activeJob.site.split(' ')[0]}`
                        : totalJobs > 0
                          ? `${totalJobs} job${totalJobs > 1 ? 's' : ''} today`
                          : 'No jobs today'}
                    </p>
                  </div>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: activeJob
                        ? 'var(--success)'
                        : totalJobs > 0
                          ? 'var(--accent)'
                          : 'var(--muted-foreground)',
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
