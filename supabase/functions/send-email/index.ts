// @ts-nocheck — Deno Edge Function. Type-checked by `deno check`, not by the
// Next.js tsconfig (which excludes supabase/functions).
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Innovion transactional email dispatcher
 * ===========================================================================
 *
 * DEFECTS REMEDIATED — this function was an open, unauthenticated mail relay
 * that would render attacker-supplied HTML.
 *
 * 1. NO AUTHENTICATION (P0). The handler was
 *        serve(async (req) => { ... })
 *    with `Access-Control-Allow-Origin: *`, no token check of any kind, and no
 *    authorisation on the recipient. Anyone who could reach the function URL
 *    could POST `{ type, to, data }` and have Innovion send mail, from
 *    Innovion's sender, to ANY address on the internet, with content they
 *    chose. That is a phishing platform operating under the product's identity
 *    and reputation. Even behind Supabase's default JWT verification, any
 *    authenticated user of any tenant could do the same to any address.
 *
 * 2. HTML INJECTION INTO EVERY TEMPLATE (P0). Every value was interpolated
 *    raw:  `Hi ${name},`  `<a href="${resetLink}">`  `${message}`  `${item.title}`
 *    `name` is `user_metadata.full_name`, which the end user writes directly
 *    via `supabase.auth.updateUser({ data: { full_name: ... } })`. Setting it to
 *    `<a href="https://evil.example">Verify your account</a>` produced a
 *    convincing phishing link inside genuine Innovion mail. `resetLink` was
 *    placed straight into an `href`, so a caller chose where a "Reset
 *    Password" button pointed. Every interpolation is now escaped, and hrefs
 *    are restricted to vetted absolute URLs.
 *
 * 3. CALLER-SUPPLIED PASSWORD-RESET LINK (P0). The `password_reset` type is
 *    REMOVED. Supabase Auth (`resetPasswordForEmail`) issues recovery mail
 *    itself with a link it mints; accepting a `resetLink` from a client can
 *    only ever be a way to send an Innovion-branded link to somewhere else.
 *    `src/lib/emailService.ts` no longer offers it either.
 *
 * 4. UNRESTRICTED RECIPIENT (P0). `to` was used verbatim. Each type now
 *    constrains the recipient:
 *      welcome           — the authenticated caller's own address only
 *      job_assignment    — a contractor or employee of the caller's tenant
 *      compliance_expiry — a member of the caller's tenant
 *      contact_form      — the configured support inbox, never the caller's `to`
 *    Tenant membership is read from `public.user_roles`, never from metadata.
 *
 * 5. SENDER ON A SANDBOX DOMAIN. `from` was hard-coded to
 *    `Innovion <onboarding@resend.dev>` — Resend's shared testing domain, which
 *    carries no SPF/DKIM/DMARC alignment for innovion.app. Now read from
 *    EMAIL_FROM, and the function refuses to start without it rather than
 *    silently sending unauthenticated mail.
 *
 * 6. SYNTAX ERROR. `declare const Deno: ...` appeared inside the request
 *    handler's function body, which is not a legal position for a declaration
 *    (TS1184). Moved to module scope.
 *
 * 7. INTERNAL ERRORS RETURNED TO THE CALLER. `{ error: message }` echoed
 *    provider messages and internal failure detail. Callers now receive a
 *    generic message; detail is logged.
 *
 * REMAINING VERIFICATION REQUIRED IN A LIVE ENVIRONMENT (not claimed here):
 *   this function has not been executed — Deno and a Supabase project are
 *   required. Its correctness is argued from the code, not demonstrated.
 */

declare const Deno: { env: { get(key: string): string | undefined } };

// ── Configuration ──────────────────────────────────────────────────────────
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const EMAIL_FROM = Deno.env.get('EMAIL_FROM');
const SUPPORT_INBOX = Deno.env.get('SUPPORT_INBOX') ?? 'support@innovion.app';
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://innovion.app';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? SITE_URL;

const corsHeaders = {
  // Previously '*'. Restricted to the application's own origin.
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  Vary: 'Origin',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// ── HTML escaping ──────────────────────────────────────────────────────────
/** Escape a value for interpolation into HTML text or an attribute. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape, then convert newlines to <br> — for free-text blocks only. */
function escMultiline(value: unknown): string {
  return esc(value).replace(/\r?\n/g, '<br>');
}

// ── Validation ─────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

/**
 * A single, syntactically valid address. Rejects header-injection attempts
 * (newlines, commas, angle brackets) rather than passing them to the provider.
 */
function validEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > 254) return null;
  if (/[\r\n\t]/.test(trimmed)) return null;
  return EMAIL_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

// ── Per-isolate rate limiting ──────────────────────────────────────────────
// Best effort only: each Edge isolate keeps its own counter. It raises the cost
// of abuse; it does not bound it. A shared limiter is required for a hard cap.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const rateStore = new Map<string, { count: number; windowStart: number }>();

function withinRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateStore.get(userId);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    rateStore.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

// ── Handler ────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Configuration must be complete. Refuse rather than send unauthenticated
  // mail from a sandbox domain.
  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY || !EMAIL_FROM) {
    console.error('[send-email] Missing configuration', {
      resend: Boolean(RESEND_API_KEY),
      supabaseUrl: Boolean(SUPABASE_URL),
      serviceRole: Boolean(SERVICE_ROLE_KEY),
      emailFrom: Boolean(EMAIL_FROM),
    });
    return json({ error: 'Email service is not configured' }, 503);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { type?: string; to?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const type = typeof body.type === 'string' ? body.type : '';
  const data = (body.data ?? {}) as Record<string, unknown>;
  const requestedTo = validEmail(body.to);

  /**
   * ── 1. Authenticate the caller ─────────────────────────────────────────
   *
   * `contact_form` is the one deliberately UNAUTHENTICATED type: it is
   * submitted from the public marketing site by prospects who have no account.
   * That is safe here only because its recipient is pinned to SUPPORT_INBOX and
   * cannot be influenced by the request — the worst an anonymous caller can do
   * is send mail to Innovion's own support inbox, rate-limited by network
   * identity. That is categorically different from the previous behaviour,
   * where an anonymous caller chose the recipient.
   */
  const isPublicType = type === 'contact_form';

  let caller: { id: string; email?: string } | null = null;
  let companyIds: string[] = [];

  if (isPublicType) {
    const networkId =
      (req.headers.get('x-forwarded-for') ?? '').split(',').pop()?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    if (!withinRateLimit(`anon:${networkId}`)) {
      return json({ error: 'Too many requests' }, 429);
    }
  } else {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const accessToken = authHeader.slice(7).trim();

    const { data: userResult, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !userResult?.user) {
      return json({ error: 'Unauthorized' }, 401);
    }
    caller = userResult.user;

    if (!withinRateLimit(caller.id)) {
      return json({ error: 'Too many requests' }, 429);
    }

    // ── 2. Resolve the caller's authoritative tenants ──────────────────────
    const { data: memberships } = await admin
      .from('user_roles')
      .select('company_id, role')
      .eq('user_id', caller.id)
      .not('company_id', 'is', null);

    companyIds = (memberships ?? []).map((m: { company_id: string }) => m.company_id);
  }

  /** Is `address` a person inside one of the caller's tenants? */
  async function recipientIsInTenant(address: string): Promise<boolean> {
    if (companyIds.length === 0) return false;

    for (const table of ['contractors', 'employees']) {
      const { data: rows } = await admin
        .from(table)
        .select('id')
        .in('company_id', companyIds)
        .ilike('email', address)
        .limit(1);
      if (rows && rows.length > 0) return true;
    }

    // A platform user who shares a tenant with the caller.
    const { data: peers } = await admin
      .from('user_roles')
      .select('user_id')
      .in('company_id', companyIds);
    for (const peer of peers ?? []) {
      const { data: peerUser } = await admin.auth.admin.getUserById(peer.user_id);
      if (peerUser?.user?.email?.toLowerCase() === address) return true;
    }
    return false;
  }

  const shell = (heading: string, subheading: string, inner: string) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: #0F1C2E; padding: 40px 32px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; font-size: 26px; font-weight: 700; margin: 0;">${esc(heading)}</h1>
        ${subheading ? `<p style="color: #94a3b8; margin: 8px 0 0;">${esc(subheading)}</p>` : ''}
      </div>
      <div style="padding: 40px 32px; background: #f8fafc; border-radius: 0 0 12px 12px;">
        ${inner}
        <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 24px 0 0;">Innovion · ${esc(SUPPORT_INBOX)}</p>
      </div>
    </div>`;

  // Call-to-action links are built from SITE_URL and a fixed path — never from
  // request data.
  const cta = (path: string, label: string) => `
    <div style="text-align: center;">
      <a href="${esc(SITE_URL)}${esc(path)}" style="display: inline-block; background: #2563EB; color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none;">${esc(label)} →</a>
    </div>`;

  let recipient: string;
  let subject: string;
  let html: string;

  try {
    switch (type) {
      // ── welcome: the caller's own address, or someone they have invited ──
      case 'welcome': {
        const own = validEmail(caller!.email);

        if (requestedTo && requestedTo !== own) {
          // The user-invitation flow (src/app/users/page.tsx) writes a
          // pending_invites row and then sends this mail to the invitee, who
          // has no account yet. Permitted only when such an invitation really
          // exists in one of the CALLER's authoritative tenants — so a member
          // of tenant A cannot mail an address invited by tenant B, and cannot
          // mail an address nobody invited.
          if (companyIds.length === 0) {
            return json({ error: 'Recipient not permitted' }, 403);
          }
          const { data: invites } = await admin
            .from('pending_invites')
            .select('id')
            .in('company_id', companyIds)
            .ilike('email', requestedTo)
            .limit(1);
          if (!invites || invites.length === 0) {
            return json({ error: 'Recipient not permitted' }, 403);
          }
          recipient = requestedTo;
        } else {
          if (!own) return json({ error: 'Recipient not permitted' }, 403);
          recipient = own;
        }
        subject = `Welcome to Innovion, ${String(data.name ?? '').slice(0, 60) || 'there'}!`;
        html = shell(
          'Welcome to Innovion',
          'Your workforce management platform',
          `<p style="color: #1e293b; font-size: 16px; margin: 0 0 16px;">Hi ${esc(data.name) || 'there'},</p>
           <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
             Your workspace for <strong>${esc(data.companyName)}</strong> is ready. You are on the <strong>${esc(data.plan)}</strong> plan.
           </p>
           <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:24px;margin:0 0 24px;">
             <h3 style="color:#0F1C2E;font-size:15px;font-weight:600;margin:0 0 12px;">Get started in 3 steps:</h3>
             <ol style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
               <li>Complete your company profile in Settings</li>
               <li>Add your contractors and employees</li>
               <li>Create your first job or schedule</li>
             </ol>
           </div>
           ${cta('/dashboard', 'Go to Dashboard')}`
        );
        break;
      }

      // ── compliance_expiry: a member of the caller's tenant ───────────────
      case 'compliance_expiry': {
        if (!requestedTo || !(await recipientIsInTenant(requestedTo))) {
          return json({ error: 'Recipient not permitted' }, 403);
        }
        recipient = requestedTo;

        const items = Array.isArray(data.items)
          ? (data.items as Array<Record<string, unknown>>).slice(0, 100)
          : [];
        const rows = items
          .map(
            (item) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:14px;">${esc(item.title)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:14px;">${esc(item.assignedTo)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:14px;">${esc(item.expiryDate)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">
              <span style="background:${item.status === 'expired' ? '#fee2e2' : '#fef3c7'};color:${item.status === 'expired' ? '#dc2626' : '#d97706'};padding:2px 8px;border-radius:20px;font-weight:600;">${item.status === 'expired' ? 'Expired' : 'Expiring Soon'}</span>
            </td>
          </tr>`
          )
          .join('');

        subject = `Compliance alert: ${items.length} item${items.length === 1 ? '' : 's'} require attention`;
        html = shell(
          'Compliance Alert',
          'Action required on your compliance items',
          `<p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Hi ${esc(data.recipientName) || 'there'},</p>
           <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">The following compliance items require your attention:</p>
           <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:0 0 24px;">
             <table style="width:100%;border-collapse:collapse;">
               <thead><tr style="background:#f1f5f9;">
                 <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;">Item</th>
                 <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;">Assigned To</th>
                 <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;">Expiry</th>
                 <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;">Status</th>
               </tr></thead>
               <tbody>${rows}</tbody>
             </table>
           </div>
           ${cta('/compliance', 'View Compliance')}`
        );
        break;
      }

      // ── job_assignment: a worker in the caller's tenant ──────────────────
      case 'job_assignment': {
        if (!requestedTo || !(await recipientIsInTenant(requestedTo))) {
          return json({ error: 'Recipient not permitted' }, 403);
        }
        recipient = requestedTo;
        subject = `New job assigned: ${String(data.jobTitle ?? '').slice(0, 120)}`;

        const row = (label: string, value: unknown) =>
          value
            ? `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;width:120px;">${esc(label)}</td><td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;">${esc(value)}</td></tr>`
            : '';

        html = shell(
          'New Job Assigned',
          '',
          `<p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Hi ${esc(data.contractorName) || 'there'},</p>
           <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">You have been assigned a new job:</p>
           <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:24px;margin:0 0 24px;">
             <h2 style="color:#0F1C2E;font-size:18px;font-weight:700;margin:0 0 16px;">${esc(data.jobTitle)}</h2>
             <table style="width:100%;border-collapse:collapse;">
               ${row('Client', data.client)}
               ${row('Site', data.site)}
               ${row('Date', data.scheduledDate)}
               ${row('Time', data.scheduledTime)}
               ${data.notes ? `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;vertical-align:top;">Notes</td><td style="padding:8px 0;color:#475569;font-size:14px;">${escMultiline(data.notes)}</td></tr>` : ''}
             </table>
           </div>
           ${cta('/jobs', 'View Job Details')}`
        );
        break;
      }

      // ── contact_form: always to the support inbox ────────────────────────
      case 'contact_form': {
        // The caller's `to` is ignored entirely: this type existed to reach
        // Innovion support, and accepting a recipient made it a relay.
        recipient = SUPPORT_INBOX;
        const senderEmail = validEmail(data.senderEmail);
        subject = `Contact form submission from ${String(data.senderName ?? 'unknown').slice(0, 80)}`;
        html = shell(
          'New Contact Form Submission',
          '',
          `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:24px;margin:0 0 24px;">
             <table style="width:100%;border-collapse:collapse;">
               <tr><td style="padding:8px 0;color:#64748b;font-size:14px;width:100px;vertical-align:top;">Name</td><td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;">${esc(data.senderName)}</td></tr>
               <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Email</td><td style="padding:8px 0;font-size:14px;">${
                 senderEmail
                   ? `<a href="mailto:${esc(senderEmail)}" style="color:#2563EB;">${esc(senderEmail)}</a>`
                   : '<span style="color:#94a3b8;">not supplied or invalid</span>'
               }</td></tr>
               ${data.company ? `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Company</td><td style="padding:8px 0;color:#1e293b;font-size:14px;">${esc(data.company)}</td></tr>` : ''}
               ${data.industry ? `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Industry</td><td style="padding:8px 0;color:#1e293b;font-size:14px;">${esc(data.industry)}</td></tr>` : ''}
               <tr><td style="padding:8px 0;color:#64748b;font-size:14px;vertical-align:top;">Message</td><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.6;">${escMultiline(String(data.message ?? '').slice(0, 5000))}</td></tr>
             </table>
           </div>`
        );
        break;
      }

      // `password_reset` is deliberately absent — see the header.
      default:
        return json({ error: 'Unsupported email type' }, 400);
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [recipient], subject, html }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Provider detail is logged, never returned: it can disclose account and
      // domain configuration.
      console.error('[send-email] Provider rejected the message', {
        type,
        status: response.status,
        providerMessage: result?.message,
      });
      return json({ error: 'Unable to send email' }, 502);
    }

    return json({ success: true, id: result.id });
  } catch (error) {
    console.error('[send-email] Unexpected error', {
      type,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return json({ error: 'Unable to send email' }, 500);
  }
});
