import { assertBillingMode, type BillingMode } from './billing-mode.ts';
import type { BillingPlan } from './billing-policy.ts';
// Pure lifecycle rules shared by the Edge Functions and regression tests.
export function objectId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id;
  return null;
}
export function invoiceSubscription(invoice: { parent?: { type?: string; subscription_details?: { subscription?: unknown } | null } | null; subscription?: unknown }) {
  if (invoice.parent) return invoice.parent.type === 'subscription_details' ? objectId(invoice.parent.subscription_details?.subscription) : null;
  return objectId(invoice.subscription);
}
export function isTerminalSubscription(status: string) {
  return status === 'canceled' || status === 'incomplete_expired';
}
export function recognizedPlan(price: string, monthly: string[], annual: string[], daily: string[] = []): BillingPlan {
  const matches = (['daily', 'monthly', 'annual'] as const).filter(plan => ({daily, monthly, annual})[plan].includes(price));
  if (matches.length !== 1) throw new Error('Unrecognized subscription price.');
  return matches[0];
}
export function subscriptionPatch(subscription: {
  id: string; livemode: boolean; status: string; customer: unknown; cancel_at_period_end?: boolean; cancel_at?: number | null;
  items: { data: Array<{ quantity?: number; price: { id: string }; current_period_start?: number; current_period_end?: number }> };
  current_period_start?: number; current_period_end?: number;
}, monthly: string[], annual: string[], daily: string[] = [], mode: BillingMode = 'test') {
  assertBillingMode(subscription.livemode, mode);
  if (subscription.items.data.length !== 1 || subscription.items.data[0].quantity !== 1) throw new Error('Unsupported subscription items.');
  const item = subscription.items.data[0];
  const plan = recognizedPlan(item.price.id, monthly, annual, daily);
  const start = item.current_period_start ?? subscription.current_period_start;
  const end = item.current_period_end ?? subscription.current_period_end;
  // Current Portal cancellation can set cancel_at instead of the legacy flag.
  const scheduledEnd = Number.isFinite(subscription.cancel_at) && Number(subscription.cancel_at) > 0
    && Number(subscription.cancel_at) <= Number(end) ? Number(subscription.cancel_at) : null;
  const accessEnd = scheduledEnd ?? end;
  const validPeriod = Number.isFinite(start) && Number.isFinite(accessEnd) && Number(accessEnd) > Number(start);
  const status = subscription.status === 'active' && validPeriod ? 'active'
    : isTerminalSubscription(subscription.status) ? 'canceled'
    : ['past_due','unpaid','incomplete'].includes(subscription.status) ? 'past_due' : 'expired';
  return { status, plan, current_period_start: validPeriod ? new Date(Number(start)*1000).toISOString() : null,
    current_period_end: validPeriod ? new Date(Number(accessEnd)*1000).toISOString() : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end || scheduledEnd), stripe_customer_id: objectId(subscription.customer),
    stripe_subscription_id: subscription.id, stripe_price_id: item.price.id, billing_mode: mode };
}
export type CheckoutOperation = {
  id: string; plan: BillingPlan; mode?: BillingMode; price: string; createdAt: number;
  sessionId?: string; state: 'creating' | 'open' | 'complete' | 'expired';
};
export function canRecoverOperation(operation: CheckoutOperation, now = Date.now()) {
  // Stripe may prune idempotency records after 24h. Ambiguous old attempts need
  // operator reconciliation, never blind recreation under the same/new key.
  return Boolean(operation.sessionId) || now - operation.createdAt < 23 * 60 * 60 * 1000;
}
