import { handleOptions } from '../_shared/cors.ts';
import { authenticatedUser } from '../_shared/auth.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { appMarket, appUrl, stripeClient } from '../_shared/stripe.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    if (appMarket() === 'cn') throw new Error('Mainland annual access is prepaid and does not auto-renew. Renew from Relay before expiry.');
    const { user, admin } = await authenticatedUser(request);
    const { data: membership, error } = await admin.from('memberships').select('stripe_customer_id').eq('user_id', user.id).single();
    if (error) throw new Error(error.message);
    if (!membership.stripe_customer_id) throw new Error('No billing profile exists for this account.');
    const portal = await stripeClient().billingPortal.sessions.create({
      customer: membership.stripe_customer_id,
      return_url: `${appUrl()}/?billing=return`,
    });
    return json(request, { url: portal.url });
  } catch (error) { return errorResponse(request, error, 400); }
});
