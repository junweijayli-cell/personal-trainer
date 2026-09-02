import { handleOptions } from '../_shared/cors.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { appMarket, priceId, stripeClient } from '../_shared/stripe.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'GET' && request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const market = appMarket();
    const stripe = stripeClient();
    const plans = market === 'cn' ? ['annual'] as const : ['monthly', 'annual'] as const;
    const catalog = await Promise.all(plans.map(async (plan) => {
      const price = await stripe.prices.retrieve(priceId(plan));
      return { plan, currency: price.currency, unitAmount: price.unit_amount, recurring: price.recurring?.interval ?? null };
    }));
    return json(request, { market, plans: catalog }, 200);
  } catch (error) { return errorResponse(request, error, 503); }
});
