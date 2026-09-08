import { handleOptions } from '../_shared/cors.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { appMarket, approvedStripePrice, stripeClient } from '../_shared/stripe.ts';
import { adminClient, authenticatedUser } from '../_shared/auth.ts';
import { checkoutAvailable, runtime } from '../_shared/billing-store.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'GET' && request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const market = appMarket();
    const { mode } = await runtime(adminClient());
    let userId: string | undefined;
    if (request.headers.get('Authorization')) {
      try { userId = (await authenticatedUser(request)).user.id; } catch { /* Public catalogs require no session. */ }
    }
    if (!(await checkoutAvailable(adminClient(), userId))) return json(request, { market, mode, enabled: false, plans: [] });
    const stripe = stripeClient(mode);
    const plans = market === 'cn' ? ['annual'] as const : ['daily', 'monthly', 'annual'] as const;
    const catalog = await Promise.all(plans.map(async (plan) => {
      const price = await approvedStripePrice(stripe, plan, mode);
      return { plan, currency: price.currency, unitAmount: price.unit_amount, recurring: price.recurring?.interval ?? null };
    }));
    return json(request, { market, mode, enabled: true, plans: catalog }, 200);
  } catch (error) { return errorResponse(request, error, 503); }
});
