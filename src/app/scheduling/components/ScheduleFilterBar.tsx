'use client';
import React, { useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import type { ScheduleFilters } from './SchedulingModule';
import type { ScheduledJob } from '@/lib/services/scheduleService';
import type { Contractor } from '@/lib/services/contractorService';

interface ScheduleFilterBarProps {
  filters: ScheduleFilters;
  onFilterChange: (f: ScheduleFilters) => void;
  jobs: ScheduledJob[];
  contractors: Contractor[];
}

const staticStatusOptions = [
  { id: 'fs-all', value: 'all', label: 'All Statuses' },
  { id: 'fs-sched', value: 'scheduled', label: 'Scheduled' },
  { id: 'fs-prog', value: 'in-progress', label: 'In Progress' },
  { id: 'fs-done', value: 'completed', label: 'Completed' },
  { id: 'fs-issue', value: 'issue', label: 'Issue' },
  { id: 'fs-unassigned', value: 'unassigned', label: 'Unassigned' },
];

type FilterKey = 'contractor' | 'region' | 'client' | 'status';

export default function ScheduleFilterBar({
  filters,
  onFilterChange,
  jobs,
  contractors,
}: ScheduleFilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<FilterKey | null>(null);

  // Derive dynamic options from live data
  const contractorOptions = [
    { id: 'fc-all', value: 'all', label: 'All Contractors' },
    ...contractors.map((c) => ({
      id: `fc-${c.id}`,
      value: c.name.toLowerCase().replace(/\s+/g, '-'),
      label: c.name,
    })),
  ];

  const uniqueRegions = Array.from(new Set(jobs.map((j) => j.region).filter(Boolean)));
  const regionOptions = [
    { id: 'fr-all', value: 'all', label: 'All Regions' },
    ...uniqueRegions.map((r) => ({
      id: `fr-${r.toLowerCase().replace(/\s+/g, '')}`,
      value: r.toLowerCase().replace(/\s+/g, ''),
      label: r,
    })),
  ];

  const uniqueClients = Array.from(new Set(jobs.map((j) => j.client).filter(Boolean)));
  const clientOptions = [
    { id: 'fcl-all', value: 'all', label: 'All Clients' },
    ...uniqueClients.map((cl) => ({
      id: `fcl-${cl.toLowerCase().replace(/\s+/g, '')}`,
      value: cl.toLowerCase().replace(/\s+/g, ''),
      label: cl,
    })),
  ];

  const filterOptions: Record<FilterKey, { id: string; value: string; label: string }[]> = {
    contractor: contractorOptions,
    region: regionOptions,
    client: clientOptions,
    status: staticStatusOptions,
  };

  const activeCount = Object.entries(filters).filter(
    ([k, v]) => k !== 'site' && v !== 'all'
  ).length;

  const updateFilter = (key: FilterKey, value: string) => {
    onFilterChange({ ...filters, [key]: value });
    setOpenDropdown(null);
  };

  const clearAll = () => {
    onFilterChange({ contractor: 'all', region: 'all', client: 'all', site: 'all', status: 'all' });
  };

  const getLabelForFilter = (key: FilterKey) => {
    const opts = filterOptions[key];
    const found = opts.find((o) => o.value === filters[key]);
    return found ? found.label : `All ${key.charAt(0).toUpperCase() + key.slice(1)}s`;
  };

  return (
    <div className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 xl:px-8 2xl:px-10 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm font-600 text-muted-foreground">
          <Filter size={14} />
          <span>Filter:</span>
          {activeCount > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-full text-xs font-700 text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {activeCount}
            </span>
          )}
        </div>

        {(Object.keys(filterOptions) as FilterKey[]).map((key) => (
          <div key={`filter-${key}`} className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === key ? null : key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 border transition-all"
              style={{
                borderColor: filters[key] !== 'all' ? 'var(--accent)' : 'var(--border)',
                backgroundColor: filters[key] !== 'all' ? 'var(--info-bg)' : 'var(--card)',
                color: filters[key] !== 'all' ? 'var(--accent)' : 'var(--muted-foreground)',
              }}
            >
              {getLabelForFilter(key)}
              <ChevronDown size={12} />
            </button>

            {openDropdown === key && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-xl shadow-card-md z-50 py-1 animate-fade-in max-h-60 overflow-y-auto scrollbar-thin">
                {filterOptions[key].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateFilter(key, opt.value)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                    style={{
                      color: filters[key] === opt.value ? 'var(--accent)' : 'var(--foreground)',
                      fontWeight: filters[key] === opt.value ? 600 : 400,
                    }}
                  >
                    {opt.label}
                    {filters[key] === opt.value && <span className="text-accent">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-600 text-muted-foreground hover:text-danger hover:bg-danger/5 transition-colors"
          >
            <X size={12} />
            Clear all
          </button>
        )}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3">
          {[
            { id: 'leg-scheduled', color: '#2563EB', label: 'Scheduled' },
            { id: 'leg-inprogress', color: '#10B981', label: 'In Progress' },
            { id: 'leg-completed', color: '#94A3B8', label: 'Completed' },
            { id: 'leg-issue', color: '#EF4444', label: 'Issue' },
            { id: 'leg-unassigned', color: '#F59E0B', label: 'Unassigned' },
          ].map((item) => (
            <div key={item.id} className="hidden lg:flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
