import { authenticatedUser } from '../_shared/auth.ts';
import { billingRow, checkoutOperation, runtime } from '../_shared/billing-store.ts';
import { checkoutConfirmation } from '../_shared/checkout-confirmation.ts';
import { handleOptions } from '../_shared/cors.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { recognizedPrices, stripeClient } from '../_shared/stripe.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const { user, admin } = await authenticatedUser(request);
    const body = await request.json();
    // Older Checkout links returned without an ID; resolve only this member's saved operation.
    const sessionId = body.sessionId ?? (await checkoutOperation(admin, user.id))?.sessionId;
    if (typeof sessionId !== 'string' || !/^cs_[a-zA-Z0-9_]{1,240}$/.test(sessionId)) throw new Error('No checkout was found for this return.');
    const { mode } = await runtime(admin);
    const member = await billingRow(admin, user.id);
    const session = await stripeClient(mode).checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
    return json(request, checkoutConfirmation(session, user.id, member.stripe_customer_id, mode,
      recognizedPrices('monthly', mode), recognizedPrices('annual', mode), recognizedPrices('daily', mode)));
  } catch (error) { return errorResponse(request, error, 400); }
});
