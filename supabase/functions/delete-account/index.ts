import { handleOptions } from '../_shared/cors.ts';
import { authenticatedUser } from '../_shared/auth.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { stripeClient } from '../_shared/stripe.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const { user, admin } = await authenticatedUser(request);
    const { data: membership } = await admin.from('memberships').select('stripe_subscription_id').eq('user_id', user.id).maybeSingle();
    if (membership?.stripe_subscription_id && Deno.env.get('STRIPE_SECRET_KEY')) {
      await stripeClient().subscriptions.cancel(membership.stripe_subscription_id);
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(error.message);
    return json(request, { deleted: true });
  } catch (error) { return errorResponse(request, error, 400); }
});
