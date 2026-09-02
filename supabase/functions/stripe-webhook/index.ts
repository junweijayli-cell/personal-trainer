import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@19.0.0';
import { adminClient } from '../_shared/auth.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { stripeClient } from '../_shared/stripe.ts';

type MembershipRow = {
  user_id: string;
  status: string;
  plan: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  last_stripe_event_created: number;
  last_stripe_event_id: string | null;
  [key: string]: unknown;
};

function id(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id ?? null;
}

function isoFromUnix(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function subscriptionPeriod(subscription: Stripe.Subscription & Record<string, unknown>) {
  const firstItem = subscription.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number }) | undefined;
  return {
    start: isoFromUnix((subscription.current_period_start as number | undefined) ?? firstItem?.current_period_start),
    end: isoFromUnix((subscription.current_period_end as number | undefined) ?? firstItem?.current_period_end),
  };
}

function membershipStatus(status: Stripe.Subscription.Status) {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due';
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled';
  return 'expired';
}

function planForPrice(price: string | null) {
  if (price && price === Deno.env.get('STRIPE_PRICE_MONTHLY')) return 'monthly';
  return 'annual';
}

async function findMembership(admin: SupabaseClient, input: { userId?: string | null; customerId?: string | null; subscriptionId?: string | null }) {
  if (input.userId) {
    const { data } = await admin.from('memberships').select('*').eq('user_id', input.userId).maybeSingle();
    if (data) return data as MembershipRow;
  }
  if (input.subscriptionId) {
    const { data } = await admin.from('memberships').select('*').eq('stripe_subscription_id', input.subscriptionId).maybeSingle();
    if (data) return data as MembershipRow;
  }
  if (input.customerId) {
    const { data } = await admin.from('memberships').select('*').eq('stripe_customer_id', input.customerId).maybeSingle();
    if (data) return data as MembershipRow;
  }
  return null;
}

async function updateMembership(admin: SupabaseClient, event: Stripe.Event, membership: MembershipRow, patch: Record<string, unknown>, action: string) {
  if (membership.last_stripe_event_id === event.id) return;
  if (event.created < Number(membership.last_stripe_event_created || 0)) return;
  const guardedPatch = { ...patch, last_stripe_event_created: event.created, last_stripe_event_id: event.id };
  const nextState = { ...membership, ...guardedPatch };
  const { error } = await admin.from('memberships').update(guardedPatch).eq('user_id', membership.user_id);
  if (error) throw new Error(error.message);
  const { error: auditError } = await admin.from('billing_audit_log').insert({
    user_id: membership.user_id,
    stripe_event_id: event.id,
    action,
    previous_state: membership,
    next_state: nextState,
  });
  if (auditError) throw new Error(auditError.message);
}

async function handleCheckout(admin: SupabaseClient, event: Stripe.Event, session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id ?? session.client_reference_id;
  const customerId = id(session.customer);
  const subscriptionId = id(session.subscription);
  const membership = await findMembership(admin, { userId, customerId, subscriptionId });
  if (!membership) throw new Error('No Relay membership matches this Checkout Session.');

  if (session.mode === 'payment') {
    if (session.payment_status !== 'paid' && event.type !== 'checkout.session.async_payment_succeeded') return;
    const now = Date.now();
    const existingEnd = membership.current_period_end ? new Date(membership.current_period_end).getTime() : 0;
    const start = Math.max(now, existingEnd);
    const end = new Date(start + 365 * 24 * 60 * 60 * 1000).toISOString();
    await updateMembership(admin, event, membership, {
      status: 'active',
      plan: 'annual',
      current_period_start: new Date(start).toISOString(),
      current_period_end: end,
      cancel_at_period_end: false,
      stripe_customer_id: customerId,
      stripe_price_id: Deno.env.get('STRIPE_PRICE_CN_ANNUAL') ?? null,
    }, 'annual_prepaid_granted');
    return;
  }

  await updateMembership(admin, event, membership, {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
  }, 'checkout_subscription_linked');
}

async function handleSubscription(admin: SupabaseClient, event: Stripe.Event, subscription: Stripe.Subscription & Record<string, unknown>) {
  const customerId = id(subscription.customer);
  const userId = subscription.metadata?.supabase_user_id ?? null;
  const membership = await findMembership(admin, { userId, customerId, subscriptionId: subscription.id });
  if (!membership) throw new Error('No Relay membership matches this subscription.');
  if (membership.stripe_subscription_id && membership.stripe_subscription_id !== subscription.id && subscription.status !== 'active' && subscription.status !== 'trialing') return;
  const firstItem = subscription.items.data[0];
  const price = firstItem?.price?.id ?? null;
  const period = subscriptionPeriod(subscription);
  await updateMembership(admin, event, membership, {
    status: membershipStatus(subscription.status),
    plan: planForPrice(price),
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: price,
  }, `subscription_${subscription.status}`);
}

async function handleInvoice(admin: SupabaseClient, event: Stripe.Event, invoice: Stripe.Invoice, paid: boolean) {
  const rawInvoice = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  const subscriptionId = id(rawInvoice.subscription);
  const membership = await findMembership(admin, { customerId: id(invoice.customer), subscriptionId });
  if (!membership) return;
  if (subscriptionId && membership.stripe_subscription_id && membership.stripe_subscription_id !== subscriptionId) return;
  await updateMembership(admin, event, membership, {
    status: paid ? 'active' : 'past_due',
    stripe_customer_id: id(invoice.customer),
    stripe_subscription_id: subscriptionId ?? membership.stripe_subscription_id,
  }, paid ? 'invoice_paid' : 'invoice_payment_failed');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  const admin = adminClient();
  let event: Stripe.Event | null = null;
  try {
    const signature = request.headers.get('Stripe-Signature');
    const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!signature || !secret) throw new Error('Webhook signature configuration is missing.');
    const payload = await request.text();
    event = await stripeClient().webhooks.constructEventAsync(
      payload,
      signature,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );

    const { data: existing } = await admin.from('billing_events').select('status,attempts').eq('stripe_event_id', event.id).maybeSingle();
    if (existing?.status === 'processed') return json(request, { received: true, duplicate: true });
    if (existing) {
      await admin.from('billing_events').update({ status: 'received', attempts: Number(existing.attempts) + 1, error_message: null }).eq('stripe_event_id', event.id);
    } else {
      const { error } = await admin.from('billing_events').insert({
        stripe_event_id: event.id,
        event_type: event.type,
        livemode: event.livemode,
        status: 'received',
      });
      if (error) throw new Error(error.message);
    }

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await handleCheckout(admin, event, event.data.object as Stripe.Checkout.Session);
    } else if (event.type === 'checkout.session.async_payment_failed') {
      // Access remains unchanged; the failed event is retained for support visibility.
    } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused' || event.type === 'customer.subscription.resumed') {
      await handleSubscription(admin, event, event.data.object as Stripe.Subscription & Record<string, unknown>);
    } else if (event.type === 'invoice.paid') {
      await handleInvoice(admin, event, event.data.object as Stripe.Invoice, true);
    } else if (event.type === 'invoice.payment_failed') {
      await handleInvoice(admin, event, event.data.object as Stripe.Invoice, false);
    }

    const { error: completeError } = await admin.from('billing_events').update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      error_message: null,
    }).eq('stripe_event_id', event.id);
    if (completeError) throw new Error(completeError.message);
    return json(request, { received: true });
  } catch (error) {
    if (event) {
      await admin.from('billing_events').update({
        status: 'failed',
        error_message: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown webhook error',
      }).eq('stripe_event_id', event.id);
    }
    return errorResponse(request, error, 400);
  }
});
