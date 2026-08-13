// Compliance alert Edge Function — scheduled via pg_cron or external cron
// Deploy: supabase functions deploy compliance-alerts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Find all compliance items expiring within 30 days or already expired
    const today = new Date()
    const thirtyDaysOut = new Date(today)
    thirtyDaysOut.setDate(today.getDate() + 30)

    const { data: items, error } = await supabase
      .from('compliance_items')
      .select('*, companies(name, email)')
      .in('comp_status', ['expiring', 'expired'])

    if (error) throw error

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ message: 'No compliance alerts needed', count: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Group by company
    const byCompany: Record<string, any[]> = {}
    for (const item of items) {
      const cid = item.company_id || 'unknown'
      if (!byCompany[cid]) byCompany[cid] = []
      byCompany[cid].push(item)
    }

    let emailsSent = 0

    for (const [companyId, companyItems] of Object.entries(byCompany)) {
      // Get company settings email
      const { data: settings } = await supabase
        .from('settings')
        .select('email, company_name')
        .eq('company_id', companyId)
        .single()

      const toEmail = settings?.email
      if (!toEmail) continue

      const expiredItems = companyItems.filter((i) => i.comp_status === 'expired')
      const expiringItems = companyItems.filter((i) => i.comp_status === 'expiring')

      const html = `
        <h2>Compliance Alert — ${settings?.company_name || 'Your Company'}</h2>
        <p>This is your scheduled compliance alert from Innovion Workforce Management.</p>
        ${expiredItems.length > 0 ? `
          <h3 style="color:#EF4444">⚠️ Expired Items (${expiredItems.length})</h3>
          <ul>${expiredItems.map((i) => `<li><strong>${i.title}</strong> — ${i.assigned_to} (expired ${i.expiry_date})</li>`).join('')}</ul>
        ` : ''}
        ${expiringItems.length > 0 ? `
          <h3 style="color:#F59E0B">⏰ Expiring Soon (${expiringItems.length})</h3>
          <ul>${expiringItems.map((i) => `<li><strong>${i.title}</strong> — ${i.assigned_to} (expires ${i.expiry_date}, ${i.days_until_expiry} days)</li>`).join('')}</ul>
        ` : ''}
        <p>Please log in to Innovion to take action on these items.</p>
      `

      // Send via Resend
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Innovion Compliance <compliance@innovion.com.au>',
          to: [toEmail],
          subject: `Compliance Alert: ${expiredItems.length} expired, ${expiringItems.length} expiring soon`,
          html,
        }),
      })

      if (emailRes.ok) {
        emailsSent++
        // Create notification in DB
        await supabase.from('notifications').insert({
          title: 'Scheduled Compliance Alert Sent',
          message: `${expiredItems.length} expired, ${expiringItems.length} expiring soon`,
          notif_type: 'warning',
          category: 'compliance',
          timestamp_label: 'Just now',
          company_id: companyId,
        })
      }
    }

    return new Response(
      JSON.stringify({ message: 'Compliance alerts processed', emailsSent, companiesChecked: Object.keys(byCompany).length }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    // Structured error logging for Deno edge function
    const entry = {
      level: 'error',
      service: 'compliance-alerts',
      message: 'Compliance alert processing failed',
      timestamp: new Date().toISOString(),
      error: err?.message ?? 'Unknown error',
    };
    console.error(JSON.stringify(entry));
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
