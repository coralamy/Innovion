'use client';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { scheduleService, ScheduledJob } from '@/lib/services/scheduleService';
import { contractorService, Contractor } from '@/lib/services/contractorService';
import { useAuth } from '@/contexts/AuthContext';

interface NewJobFormValues {
  site: string;
  client: string;
  contractorId: string;
  date: string;
  startTime: string;
  duration: string;
  type: string;
  priority: string;
  instructions: string;
  isRecurring: boolean;
}

interface NewJobModalProps {
  onClose: () => void;
  onJobCreated?: (job: ScheduledJob) => void;
  companyId?: string | null;
}

const jobTypes = [
  { id: 'jt-recurring', value: 'recurring', label: 'Recurring' },
  { id: 'jt-oneoff', value: 'one-off', label: 'One-off' },
  { id: 'jt-emergency', value: 'emergency', label: 'Emergency' },
  { id: 'jt-inspection', value: 'inspection', label: 'Inspection' },
  { id: 'jt-maintenance', value: 'maintenance', label: 'Maintenance' },
];

export default function NewJobModal({ onClose, onJobCreated, companyId }: NewJobModalProps) {
  const { companyId: authCompanyId } = useAuth();
  const [step, setStep] = useState(1);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorsLoading, setContractorsLoading] = useState(true);
  const [contractorDropdownOpen, setContractorDropdownOpen] = useState(false);

  const effectiveCompanyId = companyId ?? authCompanyId;

  useEffect(() => {
    const load = async () => {
      setContractorsLoading(true);
      const data = await contractorService.getAll(effectiveCompanyId);
      setContractors(data);
      setContractorsLoading(false);
    };
    load();
  }, [effectiveCompanyId]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NewJobFormValues>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      duration: '120',
      type: 'recurring',
      priority: 'medium',
      isRecurring: false,
      contractorId: '',
    },
  });

  const selectedContractorId = watch('contractorId');
  const selectedContractor = contractors.find((c) => c.id === selectedContractorId);

  const onSubmit = async (data: NewJobFormValues) => {
    const contractor = contractors.find((c) => c.id === data.contractorId);
    const contractorName = contractor?.name || 'Unassigned';
    const contractorInitials =
      contractor?.initials ||
      contractorName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const created = await scheduleService.createJob(
      {
        jobNum: '',
        site: data.site,
        client: data.client,
        contractorId: data.contractorId || null,
        contractorName,
        contractorInitials,
        scheduledDate: data.date,
        startTime: data.startTime,
        durationMinutes: parseInt(data.duration),
        status: 'scheduled',
        type: data.type as ScheduledJob['type'],
        priority: data.priority as ScheduledJob['priority'],
        region: contractor?.location || '',
        isRecurring: data.isRecurring,
        instructions: data.instructions,
      },
      effectiveCompanyId
    );

    if (created) {
      toast.success(`Job scheduled for ${data.date} at ${data.startTime}`);
      onJobCreated?.(created);
    } else {
      toast.error('Failed to create job. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-card rounded-2xl shadow-card-lg border border-border animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-700 text-foreground">Schedule New Job</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Step {step} of 2 · {step === 1 ? 'Job Details' : 'Schedule & Assignment'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {[1, 2].map((s) => (
              <React.Fragment key={`step-${s}`}>
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-700 transition-all"
                  style={{
                    backgroundColor: step >= s ? 'var(--accent)' : 'var(--muted)',
                    color: step >= s ? 'white' : 'var(--muted-foreground)',
                  }}
                >
                  {s}
                </div>
                {s < 2 && (
                  <div
                    className="flex-1 h-px"
                    style={{ backgroundColor: step > s ? 'var(--accent)' : 'var(--border)' }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto scrollbar-thin space-y-4">
            {step === 1 && (
              <>
                <div>
                  <label
                    className="block text-sm font-600 text-foreground mb-1.5"
                    htmlFor="job-site"
                  >
                    Site / Location
                  </label>
                  <input
                    id="job-site"
                    type="text"
                    className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent transition-all placeholder:text-muted-foreground"
                    placeholder="e.g. Westfield Shopping Centre"
                    {...register('site', { required: 'Site is required' })}
                  />
                  {errors.site && (
                    <p className="text-xs text-danger mt-1 font-500">{errors.site.message}</p>
                  )}
                </div>
                <div>
                  <label
                    className="block text-sm font-600 text-foreground mb-1.5"
                    htmlFor="job-client"
                  >
                    Client
                  </label>
                  <input
                    id="job-client"
                    type="text"
                    className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent transition-all placeholder:text-muted-foreground"
                    placeholder="e.g. Westfield Group"
                    {...register('client', { required: 'Client is required' })}
                  />
                  {errors.client && (
                    <p className="text-xs text-danger mt-1 font-500">{errors.client.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Job Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {jobTypes.map((jt) => (
                      <label key={jt.id} className="cursor-pointer">
                        <input
                          type="radio"
                          value={jt.value}
                          className="sr-only"
                          {...register('type')}
                        />
                        <div
                          className="border rounded-xl px-2 py-2.5 text-center transition-all text-xs font-600"
                          style={{
                            borderColor:
                              watch('type') === jt.value ? 'var(--accent)' : 'var(--border)',
                            backgroundColor:
                              watch('type') === jt.value ? 'var(--info-bg)' : 'var(--card)',
                            color:
                              watch('type') === jt.value
                                ? 'var(--accent)'
                                : 'var(--muted-foreground)',
                          }}
                        >
                          {jt.label}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">Priority</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'pri-low', value: 'low', label: 'Low', color: 'var(--success)' },
                      { id: 'pri-med', value: 'medium', label: 'Medium', color: 'var(--warning)' },
                      { id: 'pri-high', value: 'high', label: 'High', color: 'var(--danger)' },
                    ].map((p) => (
                      <label key={p.id} className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          value={p.value}
                          className="sr-only"
                          {...register('priority')}
                        />
                        <div
                          className="border rounded-xl py-2 text-center transition-all text-xs font-700"
                          style={{
                            borderColor: watch('priority') === p.value ? p.color : 'var(--border)',
                            backgroundColor:
                              watch('priority') === p.value ? `${p.color}18` : 'var(--card)',
                            color:
                              watch('priority') === p.value ? p.color : 'var(--muted-foreground)',
                          }}
                        >
                          {p.label}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    className="block text-sm font-600 text-foreground mb-1.5"
                    htmlFor="job-instructions"
                  >
                    Special Instructions{' '}
                    <span className="text-muted-foreground font-400">(optional)</span>
                  </label>
                  <textarea
                    id="job-instructions"
                    rows={3}
                    className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent transition-all resize-none placeholder:text-muted-foreground"
                    placeholder="Access code, parking notes, special requirements…"
                    {...register('instructions')}
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">
                    Assign Contractor
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setContractorDropdownOpen((o) => !o)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    >
                      {contractorsLoading ? (
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" /> Loading contractors…
                        </span>
                      ) : selectedContractor ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-700"
                            style={{ backgroundColor: selectedContractor.color }}
                          >
                            {selectedContractor.initials}
                          </span>
                          <span className="font-500 text-foreground">
                            {selectedContractor.name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            · {selectedContractor.role}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </button>

                    {contractorDropdownOpen && !contractorsLoading && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-card-md z-50 py-1 max-h-52 overflow-y-auto scrollbar-thin animate-fade-in">
                        <button
                          type="button"
                          onClick={() => {
                            setValue('contractorId', '');
                            setContractorDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors text-muted-foreground"
                        >
                          Unassigned
                        </button>
                        {contractors.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setValue('contractorId', c.id);
                              setContractorDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2.5"
                          >
                            <span
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-700 flex-shrink-0"
                              style={{ backgroundColor: c.color }}
                            >
                              {c.initials}
                            </span>
                            <div className="min-w-0">
                              <p className="font-500 text-foreground truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {c.role} · {c.availability}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="hidden" {...register('contractorId')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      className="block text-sm font-600 text-foreground mb-1.5"
                      htmlFor="job-date"
                    >
                      Date
                    </label>
                    <input
                      id="job-date"
                      type="date"
                      className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                      {...register('date', { required: 'Date is required' })}
                    />
                    {errors.date && (
                      <p className="text-xs text-danger mt-1 font-500">{errors.date.message}</p>
                    )}
                  </div>
                  <div>
                    <label
                      className="block text-sm font-600 text-foreground mb-1.5"
                      htmlFor="job-start"
                    >
                      Start Time
                    </label>
                    <input
                      id="job-start"
                      type="time"
                      className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                      {...register('startTime', { required: 'Start time is required' })}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="block text-sm font-600 text-foreground mb-1.5"
                    htmlFor="job-duration"
                  >
                    Duration (minutes)
                  </label>
                  <input
                    id="job-duration"
                    type="number"
                    min="15"
                    step="15"
                    className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent transition-all font-tabular"
                    {...register('duration', { required: true, min: 15 })}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                      {...register('isRecurring')}
                    />
                    <span className="text-sm font-600 text-foreground">Recurring job</span>
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={() => (step > 1 ? setStep(1) : onClose())}
              className="px-4 py-2 rounded-xl text-sm font-600 border transition-all hover:bg-muted"
              style={{ borderColor: 'var(--border)' }}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-xl text-sm font-700 text-white transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-700 text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Schedule Job'
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
