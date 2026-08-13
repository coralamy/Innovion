'use client';
import React from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, List, Grid3X3, User, MapPin, RefreshCw } from 'lucide-react';
import type { ViewMode } from './SchedulingModule';
import Icon from '@/components/ui/AppIcon';


interface ScheduleHeaderProps {
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  onNewJob: () => void;
}

const views: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: 'day', label: 'Day', icon: Calendar },
  { id: 'week', label: 'Week', icon: Grid3X3 },
  { id: 'month', label: 'Month', icon: Calendar },
  { id: 'agenda', label: 'Agenda', icon: List },
  { id: 'contractor', label: 'Contractor', icon: User },
  { id: 'site', label: 'Site', icon: MapPin },
];

/**
 * Compute the week label from the current real date + offset.
 * Uses the same Monday-anchored logic as getWeekDates() in SchedulingModule.
 */
function getWeekLabel(offset: number): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Monday-anchored: if Sunday (0) treat as 7 so we go back 6 days
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()} – ${sunday.getDate()} ${months[monday.getMonth()]} ${monday.getFullYear()}`;
  }
  return `${monday.getDate()} ${months[monday.getMonth()]} – ${sunday.getDate()} ${months[sunday.getMonth()]} ${sunday.getFullYear()}`;
}

export default function ScheduleHeader({ viewMode, onViewChange, weekOffset, onWeekChange, onNewJob }: ScheduleHeaderProps) {
  return (
    <div className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 xl:px-8 2xl:px-10 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Title + nav */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-700 text-foreground">Schedule</h1>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => onWeekChange(weekOffset - 1)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-600 text-foreground min-w-[200px] text-center">
              {getWeekLabel(weekOffset)}
            </span>
            <button
              onClick={() => onWeekChange(weekOffset + 1)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => onWeekChange(0)}
              className="ml-1 px-2.5 py-1.5 rounded-lg text-xs font-600 border border-border hover:bg-muted transition-colors text-muted-foreground"
            >
              Today
            </button>
          </div>
        </div>

        {/* View tabs */}
        <div className="flex items-center bg-muted rounded-xl p-1 gap-0.5 ml-auto">
          {views.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={`view-${v.id}`}
                onClick={() => onViewChange(v.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all duration-150"
                style={{
                  backgroundColor: viewMode === v.id ? 'var(--card)' : 'transparent',
                  color: viewMode === v.id ? 'var(--foreground)' : 'var(--muted-foreground)',
                  boxShadow: viewMode === v.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Refresh schedule">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={onNewJob}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-700 text-white transition-all duration-150 active:scale-95"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Job</span>
          </button>
        </div>
      </div>
    </div>
  );
}