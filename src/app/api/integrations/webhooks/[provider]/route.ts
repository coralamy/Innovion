/**
 * Webhook Ingestion Endpoint
 * POST /api/integrations/webhooks/[provider]
 *
 * Receives inbound webhook events from external providers.
 * Validates provider-specific signatures BEFORE processing any payload.
 * Each provider uses its own validation method — not generic HMAC.
 *
 * Provider-specific validation:
 *   Xero:      HMAC-SHA256 of raw body using webhook key (x-xero-signature header)
 *              Intention-to-receive: empty events array — respond 200 immediately.
 *   Microsoft: Subscription validation token (GET) + clientState validation (POST)
 *              + lifecycle notification handling (reauthorizationRequired,
 *                subscriptionRemoved, missed)
 *   Stripe:    HMAC-SHA256 with timestamp replay protection (stripe-signature header)
 *
 * Registered webhook URLs use innovion.app domain:
 *   https://innovion.app/api/integrations/webhooks/{provider}
 *
 * Processing is asynchronous — events are persisted and processed out-of-band.
 * Idempotency: duplicate events (same external_event_id) are silently dropped.
 * Event Bus: validated events are published to integration_event_bus_outbox.
 * No secrets, tokens, or sensitive payload data are logged.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdapter } from '@/lib/services/integrationFrameworkService';
// Register all provider adapters before any adapter lookup
import '@/lib/integrations/adapters';

// Service role client for webhook writes (bypasses RLS — server-side only)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase service role credentials not configured');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

// ── Microsoft Graph notification types ───────────────────────────────────────

interface MicrosoftChangeNotification {
  id?: string;
  subscriptionId: string;
  subscriptionExpirationDateTime?: string;
  clientState?: string;
  changeType?: string;
  resource?: string;
  resourceData?: Record<string, unknown>;
  lifecycleEvent?: 'reauthorizationRequired' | 'subscriptionRemoved' | 'missed';
  tenantId?: string;
}

interface MicrosoftNotificationPayload {
  value: MicrosoftChangeNotification[];
}

/**
 * Validate Microsoft Graph change notifications.
 *
 * Per Microsoft Graph documentation (current specification):
 * 1. Every notification includes a `clientState` property.
 * 2. The receiver MUST compare clientState against the value stored when
 *    the subscription was created. A mismatch means the notification did
 *    not originate from Microsoft Graph — reject with 401.
 * 3. Lifecycle notifications (reauthorizationRequired, subscriptionRemoved,
 *    missed) arrive in the same payload structure with a `lifecycleEvent` field.
 *
 * Returns: { valid: boolean, notifications: MicrosoftChangeNotification[], lifecycleEvents: MicrosoftChangeNotification[] }
 */
async function validateMicrosoftNotifications(
  payload: MicrosoftNotificationPayload,
  supabase: ReturnType<typeof getServiceClient>
): Promise<{
  valid: boolean;
  invalidSubscriptionIds: string[];
  changeNotifications: MicrosoftChangeNotification[];
  lifecycleEvents: MicrosoftChangeNotification[];
}> {
  const notifications = payload.value ?? [];
  const invalidSubscriptionIds: string[] = [];
  const changeNotifications: MicrosoftChangeNotification[] = [];
  const lifecycleEvents: MicrosoftChangeNotification[] = [];

  for (const notification of notifications) {
    const { subscriptionId, clientState, lifecycleEvent } = notification;

    // Retrieve the stored clientState for this subscription
    const { data: webhookRecord } = await supabase
      .from('integration_webhooks')
      .select('client_state, company_id, provider_slug, is_active')
      .eq('external_webhook_id', subscriptionId)
      .eq('provider_slug', 'microsoft')
      .single();

    if (!webhookRecord) {
      console.warn(`[Webhook/Microsoft] Unknown subscriptionId: ${subscriptionId}`);
      invalidSubscriptionIds.push(subscriptionId);
      continue;
    }

    if (!webhookRecord.is_active) {
      console.warn(`[Webhook/Microsoft] Inactive subscription: ${subscriptionId}`);
      invalidSubscriptionIds.push(subscriptionId);
      continue;
    }

    // clientState validation — REQUIRED per Microsoft Graph specification
    if (webhookRecord.client_state) {
      if (clientState !== webhookRecord.client_state) {
        console.warn(
          `[Webhook/Microsoft] clientState mismatch for subscription ${subscriptionId}. ` +
          `Expected stored value, received: ${clientState ? '[present but mismatched]' : '[missing]'}`
        );
        invalidSubscriptionIds.push(subscriptionId);
        continue;
      }
    }

    if (lifecycleEvent) {
      lifecycleEvents.push(notification);
    } else {
      changeNotifications.push(notification);
    }
  }

  return {
    valid: invalidSubscriptionIds.length === 0,
    invalidSubscriptionIds,
    changeNotifications,
    lifecycleEvents,
  };
}

/**
 * Handle Microsoft Graph lifecycle notifications.
 */
async function handleMicrosoftLifecycleEvents(
  lifecycleEvents: MicrosoftChangeNotification[],
  supabase: ReturnType<typeof getServiceClient>
): Promise<void> {
  for (const event of lifecycleEvents) {
    const { subscriptionId, lifecycleEvent, tenantId } = event;

    const { data: webhookRecord } = await supabase
      .from('integration_webhooks')
      .select('company_id, provider_slug')
      .eq('external_webhook_id', subscriptionId)
      .eq('provider_slug', 'microsoft')
      .single();

    if (!webhookRecord) {
      console.warn(`[Webhook/Microsoft] Lifecycle event for unknown subscription: ${subscriptionId}`);
      continue;
    }

    const { company_id, provider_slug } = webhookRecord;

    switch (lifecycleEvent) {
      case 'reauthorizationRequired':
        await supabase
          .from('provider_integrations')
          .update({ reauth_required: true, updated_at: new Date().toISOString() })
          .eq('company_id', company_id)
          .eq('provider_slug', provider_slug);

        await supabase.from('integration_audit_log').insert({
          company_id,
          provider_slug,
          action: 'reauthorised',
          details: {
            event: 'reauthorizationRequired',
            subscription_id: subscriptionId,
            tenant_id: tenantId ?? null,
            message: 'Microsoft Graph subscription requires reauthorisation. User must reconnect.',
          },
        });
        console.info(`[Webhook/Microsoft] reauthorizationRequired for company ${company_id}, subscription ${subscriptionId}`);
        break;

      case 'subscriptionRemoved':
        await supabase
          .from('integration_webhooks')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('external_webhook_id', subscriptionId)
          .eq('provider_slug', 'microsoft');

        await supabase
          .from('provider_integrations')
          .update({ reauth_required: true, updated_at: new Date().toISOString() })
          .eq('company_id', company_id)
          .eq('provider_slug', provider_slug);

        await supabase.from('integration_audit_log').insert({
          company_id,
          provider_slug,
          action: 'error',
          details: {
            event: 'subscriptionRemoved',
            subscription_id: subscriptionId,
            tenant_id: tenantId ?? null,
            message: 'Microsoft Graph subscription was removed. Resubscription required.',
          },
        });
        console.info(`[Webhook/Microsoft] subscriptionRemoved for company ${company_id}, subscription ${subscriptionId}`);
        break;

      case 'missed': await supabase.from('integration_sync_jobs').insert({
          company_id,
          provider_slug,
          sync_type: 'incremental',
          status: 'pending',
          idempotency_key: `missed-reconcile-${subscriptionId}-${Date.now()}`,
          last_error: null,
          retry_count: 0,
        });

        await supabase.from('integration_audit_log').insert({
          company_id,
          provider_slug,
          action: 'sync_started',
          details: {
            event: 'missed',
            subscription_id: subscriptionId,
            tenant_id: tenantId ?? null,
            message: 'Microsoft Graph missed notifications — reconciliation sync queued.',
          },
        });
        console.info(`[Webhook/Microsoft] missed notifications for company ${company_id}, subscription ${subscriptionId} — reconciliation sync queued`);
        break;

      default:
        console.warn(`[Webhook/Microsoft] Unknown lifecycle event: ${lifecycleEvent}`);
    }
  }
}

/**
 * Publish a validated webhook event to the Platform Event Bus outbox.
 * No secrets, tokens, or sensitive data in the payload.
 */
async function publishWebhookEventToEventBus(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string,
  providerSlug: string,
  eventType: string,
  eventId: string | null,
  correlationId?: string
): Promise<void> {
  try {
    await supabase.from('integration_event_bus_outbox').insert({
      company_id: companyId,
      event_type: `integration.webhook.${providerSlug}.${eventType}`,
      event_source: 'integration_framework',
      provider_slug: providerSlug,
      payload: {
        event_type: eventType,
        external_event_id: eventId,
        provider_slug: providerSlug,
        // No token values, no raw webhook payload — metadata only
      },
      correlation_id: correlationId ?? eventId ?? undefined,
      schema_version: 'v1',
      status: 'pending',
    });
  } catch (err) {
    // Non-fatal — event bus publishing must not block webhook acknowledgement
    console.warn(`[Webhook] Failed to publish event to outbox for ${providerSlug}:`, err instanceof Error ? err.message : 'Unknown');
  }
}

// ── GET handler ───────────────────────────────────────────────────────────────

/**
 * GET handler:
 *   Microsoft: echoes validationToken for subscription validation
 *   All providers: returns 200 health check
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { provider } = params;

  if (provider === 'microsoft') {
    const validationToken = request.nextUrl.searchParams.get('validationToken');
    if (validationToken) {
      // Microsoft requires the token echoed back as plain text with 200
      // Content-Type must be text/plain — not application/json
      return new NextResponse(validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }

  return NextResponse.json({ status: 'webhook endpoint active', provider }, { status: 200 });
}

// ── POST handler ──────────────────────────────────────────────────────────────

/**
 * Inbound webhook event handler.
 * Validates signature/clientState, persists event, publishes to Event Bus outbox.
 * Returns 200 immediately — processing is asynchronous.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { provider } = params;

  // Read raw body for signature validation — must happen before any parsing
  const rawBody = Buffer.from(await request.arrayBuffer());
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

  const adapter = getAdapter(provider);

  let companyId: string | null = null;
  let externalEventId: string | null = null;
  let eventType: string | null = null;
  let signatureValid = false;
  let signingSecret: string | null = null;

  try {
    if (provider === 'stripe') {
      signingSecret = process.env.STRIPE_WEBHOOK_SECRET ?? null;
    } else if (provider === 'xero') {
      signingSecret = process.env.XERO_WEBHOOK_KEY ?? null;
    }

    // ── Microsoft Graph: clientState validation + lifecycle handling ──────────
    if (provider === 'microsoft') {
      let payload: MicrosoftNotificationPayload;
      try {
        payload = JSON.parse(rawBody.toString('utf-8')) as MicrosoftNotificationPayload;
      } catch {
        console.warn('[Webhook/Microsoft] Failed to parse notification payload');
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
      }

      if (!payload.value || !Array.isArray(payload.value) || payload.value.length === 0) {
        return NextResponse.json({ error: 'Empty notification payload' }, { status: 400 });
      }

      const supabase = getServiceClient();

      const validationResult = await validateMicrosoftNotifications(payload, supabase);

      if (!validationResult.valid) {
        console.warn(
          `[Webhook/Microsoft] clientState validation failed for subscriptions: ` +
          validationResult.invalidSubscriptionIds.join(', ')
        );
        return NextResponse.json({ error: 'clientState validation failed' }, { status: 401 });
      }

      if (validationResult.lifecycleEvents.length > 0) {
        await handleMicrosoftLifecycleEvents(validationResult.lifecycleEvents, supabase);
      }

      for (const notification of validationResult.changeNotifications) {
        const notifEventId = notification.id ?? notification.subscriptionId;
        const notifEventType = notification.changeType ?? 'change';

        const { data: webhookRecord } = await supabase
          .from('integration_webhooks')
          .select('company_id')
          .eq('external_webhook_id', notification.subscriptionId)
          .eq('provider_slug', 'microsoft')
          .single();

        // Idempotency check
        if (notifEventId) {
          const { data: existing } = await supabase
            .from('integration_webhook_events')
            .select('id')
            .eq('provider_slug', 'microsoft')
            .eq('external_event_id', notifEventId)
            .single();

          if (existing) continue;
        }

        await supabase.from('integration_webhook_events').insert({
          company_id: webhookRecord?.company_id ?? null,
          provider_slug: 'microsoft',
          external_event_id: notifEventId,
          event_type: notifEventType,
          payload: notification as unknown as Record<string, unknown>,
          status: 'received',
          received_at: new Date().toISOString(),
          signature_valid: true,
        });

        // Publish to Event Bus outbox
        if (webhookRecord?.company_id) {
          await publishWebhookEventToEventBus(
            supabase,
            webhookRecord.company_id,
            'microsoft',
            notifEventType,
            notifEventId ?? null
          );
        }
      }

      // Microsoft requires 202 Accepted for successful notification receipt
      return new NextResponse(null, { status: 202 });
    }

    // ── Xero: HMAC-SHA256 signature validation ────────────────────────────────
    if (provider === 'xero') {
      if (!signingSecret) {
        console.error('[Webhook/Xero] XERO_WEBHOOK_KEY is not configured');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
      }

      if (!adapter) {
        console.error('[Webhook/Xero] Xero adapter not registered');
        return NextResponse.json({ error: 'Adapter not registered' }, { status: 503 });
      }

      const validationResult = await adapter.validateWebhook(headers, rawBody, signingSecret);

      if (!validationResult.isValid) {
        // Xero requires HTTP 401 for invalid signatures
        // This is also used during the intention-to-receive handshake validation
        console.warn('[Webhook/Xero] Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }

      signatureValid = true;
      externalEventId = validationResult.externalEventId ?? null;
      eventType = validationResult.eventType ?? null;

      // Intention-to-receive: Xero sends an empty events array to validate the endpoint.
      // Signature is valid, events array is empty — respond 200 immediately.
      // This is Xero's webhook validation handshake.
      if (eventType === 'xero.validation') {
        console.info('[Webhook/Xero] Intention-to-receive validation handshake — responding 200');
        return NextResponse.json({ received: true, type: 'validation' }, { status: 200 });
      }

      // Resolve company from Xero tenant ID
      if (validationResult.externalTenantId) {
        const supabase = getServiceClient();
        const { data: org } = await supabase
          .from('integration_external_orgs')
          .select('company_id')
          .eq('provider_slug', 'xero')
          .eq('external_tenant_id', validationResult.externalTenantId)
          .single();
        companyId = org?.company_id ?? null;
      }

      // Parse full payload for batch event processing
      let xeroPayload: {
        events?: Array<{
          eventId?: string;
          eventType?: string;
          eventDateUtc?: string;
          resourceId?: string;
          resourceUrl?: string;
          tenantId?: string;
          tenantType?: string;
        }>;
        lastEventSequence?: number;
        firstEventSequence?: number;
        entropy?: string;
      };

      try {
        xeroPayload = JSON.parse(rawBody.toString('utf-8'));
      } catch {
        xeroPayload = {};
      }

      const xeroEvents = xeroPayload.events ?? [];
      const supabase = getServiceClient();

      for (const xeroEvent of xeroEvents) {
        const evtId = xeroEvent.eventId ?? null;
        const evtType = xeroEvent.eventType ?? 'xero.event';

        // Idempotency: skip duplicate events
        if (evtId) {
          const { data: existing } = await supabase
            .from('integration_webhook_events')
            .select('id')
            .eq('provider_slug', 'xero')
            .eq('external_event_id', evtId)
            .single();

          if (existing) {
            console.info(`[Webhook/Xero] Duplicate event skipped: ${evtId}`);
            continue;
          }
        }

        // Resolve company from per-event tenantId if not already resolved
        let evtCompanyId = companyId;
        if (!evtCompanyId && xeroEvent.tenantId) {
          const { data: org } = await supabase
            .from('integration_external_orgs')
            .select('company_id')
            .eq('provider_slug', 'xero')
            .eq('external_tenant_id', xeroEvent.tenantId)
            .single();
          evtCompanyId = org?.company_id ?? null;
        }

        // Persist event — no sensitive data in payload (resourceUrl is safe metadata)
        await supabase.from('integration_webhook_events').insert({
          company_id: evtCompanyId,
          provider_slug: 'xero',
          external_event_id: evtId,
          event_type: evtType,
          payload: {
            eventType: xeroEvent.eventType,
            eventDateUtc: xeroEvent.eventDateUtc,
            resourceId: xeroEvent.resourceId,
            resourceUrl: xeroEvent.resourceUrl,
            tenantId: xeroEvent.tenantId,
            tenantType: xeroEvent.tenantType,
            // Note: no access tokens, no contact PII — metadata only
          },
          status: 'received',
          received_at: new Date().toISOString(),
          signature_valid: true,
        });

        // Publish to Platform Event Bus outbox
        if (evtCompanyId) {
          await publishWebhookEventToEventBus(
            supabase,
            evtCompanyId,
            'xero',
            evtType,
            evtId,
            xeroPayload.entropy ?? undefined
          );
        }
      }

      return NextResponse.json({ received: true });
    }

    // ── Stripe: HMAC-SHA256 with timestamp replay protection ──────────────────
    if (adapter && signingSecret) {
      const validationResult = await adapter.validateWebhook(headers, rawBody, signingSecret);
      signatureValid = validationResult.isValid;
      externalEventId = validationResult.externalEventId ?? null;
      eventType = validationResult.eventType ?? null;

      if (!signatureValid) {
        console.warn(`[Webhook] Invalid signature for provider ${provider}`);
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }

      if (validationResult.externalTenantId) {
        const supabase = getServiceClient();
        const { data: org } = await supabase
          .from('integration_external_orgs')
          .select('company_id')
          .eq('provider_slug', provider)
          .eq('external_tenant_id', validationResult.externalTenantId)
          .single();
        companyId = org?.company_id ?? null;
      }
    } else if (!adapter) {
      console.warn(`[Webhook] No adapter for provider '${provider}' — event not processed`);
      return NextResponse.json({ received: true, processed: false, reason: 'adapter_not_registered' });
    } else {
      console.error(`[Webhook] No signing secret configured for provider '${provider}'`);
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }
  } catch (validationErr) {
    console.error(`[Webhook] Validation error for ${provider}:`, validationErr instanceof Error ? validationErr.message : 'Unknown');
    return NextResponse.json({ error: 'Webhook validation failed' }, { status: 500 });
  }

  // Parse payload for storage (after signature validation — Stripe/other providers)
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    payload = { raw: rawBody.toString('base64') };
  }

  // Persist event for async processing
  try {
    const supabase = getServiceClient();

    if (externalEventId) {
      const { data: existing } = await supabase
        .from('integration_webhook_events')
        .select('id, status')
        .eq('provider_slug', provider)
        .eq('external_event_id', externalEventId)
        .single();

      if (existing) {
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

    await supabase.from('integration_webhook_events').insert({
      company_id: companyId,
      provider_slug: provider,
      external_event_id: externalEventId,
      event_type: eventType,
      payload,
      status: 'received',
      received_at: new Date().toISOString(),
      signature_valid: signatureValid,
    });

    // Publish to Event Bus outbox
    if (companyId && eventType) {
      await publishWebhookEventToEventBus(supabase, companyId, provider, eventType, externalEventId);
    }
  } catch (persistErr) {
    console.error(`[Webhook] Failed to persist event for ${provider}:`, persistErr instanceof Error ? persistErr.message : 'Unknown');
    return NextResponse.json({ error: 'Failed to persist webhook event' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
