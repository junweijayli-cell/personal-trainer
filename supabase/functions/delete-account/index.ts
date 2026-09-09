import { handleOptions } from '../_shared/cors.ts';
import { authenticatedUser } from '../_shared/auth.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { stripeClient } from '../_shared/stripe.ts';
import { billingRow, renewBillingLock, withBillingLock } from '../_shared/billing-store.ts';
import { isTerminalSubscription } from '../_shared/billing-state.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const { user, admin } = await authenticatedUser(request);
    await withBillingLock(admin, user.id, async (token) => {
      const membership = await billingRow(admin, user.id);
      if (membership.stripe_customer_id || membership.stripe_subscription_id) {
        if (!['test','live'].includes(membership.billing_mode ?? '')) throw new Error('Billing must be reconciled before deleting this account.');
        const stripe = stripeClient(membership.billing_mode as 'test' | 'live');
        if (!membership.stripe_customer_id) throw new Error('Billing customer must be reconciled.');
        const sessions = await stripe.checkout.sessions.list({ customer: membership.stripe_customer_id, status: 'open', limit: 100 });
        const subscriptions = await stripe.subscriptions.list({ customer: membership.stripe_customer_id, status: 'all', limit: 100 });
        if (sessions.has_more || subscriptions.has_more) throw new Error('Billing must be reconciled before deletion.');
        for (const session of sessions.data) {
          await renewBillingLock(admin, user.id, token);
          await stripe.checkout.sessions.expire(session.id);
        }
        for (const sub of subscriptions.data) if (!isTerminalSubscription(sub.status)) {
          await renewBillingLock(admin, user.id, token);
          await stripe.subscriptions.cancel(sub.id);
        }
      }
      await renewBillingLock(admin, user.id, token);
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw new Error(error.message);
    });
    return json(request, { deleted: true });
  } catch (error) { return errorResponse(request, error, 400); }
});
