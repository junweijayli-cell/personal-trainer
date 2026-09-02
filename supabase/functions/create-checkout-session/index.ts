import { handleOptions } from '../_shared/cors.ts';
import { authenticatedUser } from '../_shared/auth.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { appMarket, appUrl, priceId, stripeClient } from '../_shared/stripe.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const { user, admin } = await authenticatedUser(request);
    const body = await request.json().catch(() => ({})) as { plan?: string };
    if (body.plan !== 'monthly' && body.plan !== 'annual') throw new Error('Choose monthly or annual access.');
    const plan = body.plan;
    const market = appMarket();
    const { data: membership, error: membershipError } = await admin
      .from('memberships')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (membershipError) throw new Error(membershipError.message);
    if (market === 'global' && membership.stripe_subscription_id && membership.status === 'active') {
      throw new Error('You already have an active subscription. Use Manage billing instead.');
    }

    const stripe = stripeClient();
    let customerId = membership.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: String(user.user_metadata?.display_name ?? ''),
        metadata: { supabase_user_id: user.id, market },
      });
      customerId = customer.id;
      const { error } = await admin.from('memberships').update({ stripe_customer_id: customerId }).eq('user_id', user.id);
      if (error) throw new Error(error.message);
    }

    const base = appUrl();
    const metadata = { supabase_user_id: user.id, market, plan };
    const session = market === 'cn'
      ? await stripe.checkout.sessions.create({
          mode: 'payment',
          customer: customerId,
          line_items: [{ price: priceId('annual'), quantity: 1 }],
          payment_method_types: ['card', 'alipay'],
          client_reference_id: user.id,
          metadata: { ...metadata, access_days: '365' },
          success_url: `${base}/?billing=success`,
          cancel_url: `${base}/?billing=canceled`,
        })
      : await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer: customerId,
          line_items: [{ price: priceId(plan), quantity: 1 }],
          client_reference_id: user.id,
          metadata,
          subscription_data: { metadata },
          allow_promotion_codes: true,
          success_url: `${base}/?billing=success`,
          cancel_url: `${base}/?billing=canceled`,
        });
    if (!session.url) throw new Error('Stripe did not create a checkout URL.');
    return json(request, { url: session.url });
  } catch (error) {
    return errorResponse(request, error, error instanceof Error && error.message.includes('Authentication') ? 401 : 400);
  }
});
