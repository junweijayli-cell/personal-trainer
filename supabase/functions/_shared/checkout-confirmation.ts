import type Stripe from 'npm:stripe@19.0.0';
import { assertBillingMode, type BillingMode } from './billing-mode.ts';
import { objectId, recognizedPlan } from './billing-state.ts';

// Read-only proof of payment. Membership access still comes from webhook reconciliation.
export function checkoutConfirmation(session: Stripe.Checkout.Session, userId: string, customerId: string | null,
  mode: BillingMode, monthly: string[], annual: string[], daily: string[]) {
  assertBillingMode(session.livemode, mode);
  if (!customerId || objectId(session.customer) !== customerId || session.client_reference_id !== userId
    || session.metadata?.supabase_user_id !== userId || session.mode !== 'subscription') {
    throw new Error('This checkout cannot be verified for your account.');
  }
  if (session.status !== 'complete' || session.payment_status !== 'paid') return { status: 'pending' as const, mode };
  const items = session.line_items;
  const item = items?.data[0];
  if (!objectId(session.subscription) || !items || items.has_more || items.data.length !== 1 || item?.quantity !== 1 || !item.price) {
    throw new Error('Payment details could not be verified.');
  }
  assertBillingMode(item.price.livemode, mode);
  const plan = recognizedPlan(item.price.id, monthly, annual, daily);
  if (session.currency !== 'usd' || !Number.isSafeInteger(session.amount_total) || Number(session.amount_total) < 0) {
    throw new Error('Payment amount could not be verified.');
  }
  return { status: 'confirmed' as const, mode, plan, amount: session.amount_total!, currency: session.currency };
}
