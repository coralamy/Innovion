import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import {
  checkRateLimit,
  getRequestIdentifier,
  RATE_LIMIT_CONFIGS,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from '@/lib/rateLimit';

/**
 * GET /api/dashboard/summary
 *
 * Batches ALL dashboard queries server-side into a single round-trip.
 * Replaces 8–10 independent client-side Supabase queries with one API call.
 *
 * Returns:
 *   - metrics:          KPI counts (jobs, contractors, incidents, compliance, revenue)
 *   - upcomingJobs:     today's scheduled/in-progress jobs (max 5)
 *   - recentActivity:   last 16 activity log entries
 *   - weeklyJobsData:   7-day job completion breakdown (replaces WeeklyJobsChart query)
 *   - serviceTypeData:  job counts by type (replaces RevenueByServiceChart query)
 *   - contractorStatus: top 5 contractors with utilisation (replaces ContractorAvailability query)
 */
export async function GET(req: NextRequest) {
  const identifier = getRequestIdentifier(req);
  const rlResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.dashboard);
  if (!rlResult.success) return rateLimitExceededResponse(rlResult);

  try {
    const supabase = await createClient();

    // Resolve the authenticated user's company_id for strict tenant scoping.
    // This ensures all queries below are filtered to the exact tenant — not relying
    // on the permissive RLS policy (company_id IS NULL OR company_id = ...) which
    // would expose legacy NULL-company_id seed rows to every tenant.
    const { data: { user } } = await supabase.auth.getUser();
    const companyId: string | null = user?.user_metadata?.company_id ?? null;

    // Compute week boundaries server-side (avoids client timezone drift)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = sunday.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    // Run ALL dashboard queries in parallel — single server round-trip
    const [
      jobsRes,
      contractorsRes,
      incidentsRes,
      complianceRes,
      upcomingJobsRes,
      activityRes,
      revenueRes,
      weeklyJobsRes,
      allJobTypesRes,
    ] = await Promise.all([
      // KPI: job counts
      supabase
        .from('jobs')
        .select('job_status, scheduled_date')
        .eq('company_id', companyId ?? '')
        .order('created_at', { ascending: false }),

      // KPI: active contractors
      supabase
        .from('contractors')
        .select('id, name, initials, availability, hours_this_week')
        .eq('company_id', companyId ?? '')
        .in('availability', ['available', 'on-job'])
        .order('name', { ascending: true })
        .limit(5),

      // KPI: open incidents
      supabase
        .from('incidents')
        .select('inc_status')
        .eq('company_id', companyId ?? '')
        .in('inc_status', ['open', 'investigating']),

      // KPI: compliance issues
      supabase
        .from('compliance_items')
        .select('comp_status, days_until_expiry')
        .eq('company_id', companyId ?? '')
        .in('comp_status', ['expired', 'expiring']),

      // Upcoming jobs widget
      supabase
        .from('jobs')
        .select('id, job_number, site, assigned_to, scheduled_time, job_status')
        .eq('company_id', companyId ?? '')
        .in('job_status', ['scheduled', 'in-progress'])
        .eq('scheduled_date', todayStr)
        .order('scheduled_time', { ascending: true })
        .limit(5),

      // Activity feed
      supabase
        .from('activity_log')
        .select('id, action, entity_type, description, created_at, user_id, metadata')
        .eq('company_id', companyId ?? '')
        .order('created_at', { ascending: false })
        .limit(16),

      // Revenue: paid/submitted invoices this week
      supabase
        .from('contractor_invoices')
        .select('total')
        .eq('company_id', companyId ?? '')
        .in('inv_status', ['submitted', 'paid'])
        .gte('work_date', weekStart),

      // Weekly jobs chart: scheduled_date + status for current week
      supabase
        .from('jobs')
        .select('scheduled_date, job_status')
        .eq('company_id', companyId ?? '')
        .gte('scheduled_date', weekStart)
        .lte('scheduled_date', weekEnd),

      // Service type breakdown: all jobs by type
      supabase
        .from('jobs')
        .select('type, job_status')
        .eq('company_id', companyId ?? ''),
    ]);

    // ── KPI metrics ──────────────────────────────────────────────────────────
    const jobs = jobsRes.data ?? [];
    const contractors = contractorsRes.data ?? [];
    const incidents = incidentsRes.data ?? [];
    const compliance = complianceRes.data ?? [];

    const todayJobs = jobs.filter((j) => j.scheduled_date === todayStr).length;
    const unassignedJobs = jobs.filter((j) => j.job_status === 'scheduled').length;
    const completedJobs = jobs.filter((j) => j.job_status === 'completed').length;
    const totalJobs = jobs.length;
    const activeContractors = contractors.length;
    const openIncidents = incidents.length;
    const expiredCompliance = compliance.filter((c) => c.comp_status === 'expired').length;
    const expiringCompliance = compliance.filter((c) => c.comp_status === 'expiring').length;
    const weeklyRevenue = (revenueRes.data ?? []).reduce(
      (sum: number, r: { total: number }) => sum + (Number(r.total) || 0),
      0
    );

    // ── Weekly jobs chart data ────────────────────────────────────────────────
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayMap: Record<string, { day: string; scheduled: number; completed: number; issues: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      dayMap[dateStr] = { day: DAY_LABELS[d.getDay()], scheduled: 0, completed: 0, issues: 0 };
    }
    (weeklyJobsRes.data ?? []).forEach((row: { scheduled_date: string; job_status: string }) => {
      const entry = dayMap[row.scheduled_date];
      if (!entry) return;
      entry.scheduled++;
      if (row.job_status === 'completed') entry.completed++;
      if (row.job_status === 'overdue' || row.job_status === 'cancelled') entry.issues++;
    });
    const weeklyJobsData = Object.values(dayMap);
    const weekLabel = `${monday.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;

    // ── Service type breakdown ────────────────────────────────────────────────
    const typeMap: Record<string, number> = {};
    (allJobTypesRes.data ?? []).forEach((row: { type: string }) => {
      const key = row.type || 'Other';
      typeMap[key] = (typeMap[key] || 0) + 1;
    });
    const serviceTypeData = Object.entries(typeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    // ── Contractor status (for ContractorAvailability widget) ─────────────────
    const contractorStatus = contractors.map((row: {
      id: string; name: string; initials: string; availability: string; hours_this_week: number | null;
    }) => ({
      id: row.id,
      name: row.name,
      initials: row.initials || row.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      status: row.availability,
      utilization: Math.min(Math.round(((row.hours_this_week ?? 0) / 40) * 100), 100),
    }));

    const response = NextResponse.json({
      data: {
        metrics: {
          todayJobs: todayJobs || totalJobs,
          unassignedJobs,
          completedJobs,
          totalJobs,
          activeContractors,
          openIncidents,
          expiredCompliance,
          expiringCompliance,
          weeklyRevenue,
        },
        upcomingJobs: upcomingJobsRes.data ?? [],
        recentActivity: activityRes.data ?? [],
        weeklyJobsData,
        weekLabel,
        serviceTypeData,
        contractorStatus,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        queryCount: 9,
      },
    });

    // Cache for 30 seconds — stale-while-revalidate for 60s
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

    return addRateLimitHeaders(response, rlResult);
  } catch (err) {
    logger.error('api/dashboard/summary', 'Failed to fetch dashboard summary', {}, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
