import Stripe from 'npm:stripe@19.0.0';
import { assertBillingMode, assertStripeKey, type BillingMode } from './billing-mode.ts';
import { assertApprovedPrice, type BillingPlan } from './billing-policy.ts';

export function stripeClient(mode: BillingMode = 'test') {
  const secret = assertStripeKey(Deno.env.get(mode === 'live' ? 'STRIPE_LIVE_SECRET_KEY' : 'STRIPE_SECRET_KEY')?.trim(), mode);
  return new Stripe(secret, { apiVersion: '2025-09-30.clover', httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 0, timeout: 10000 });
}

export function appMarket() {
  return Deno.env.get('APP_MARKET') === 'cn' ? 'cn' : 'global';
}

export function appUrl() {
  const value = Deno.env.get('APP_URL');
  if (!value) throw new Error('APP_URL is not configured.');
  return value.replace(/\/$/, '');
}

export function priceId(plan: BillingPlan, mode: BillingMode = 'test') {
  const market = appMarket();
  const name = market === 'cn' ? 'STRIPE_PRICE_CN_ANNUAL'
    : `STRIPE_${mode === 'live' ? 'LIVE_' : ''}PRICE_${plan.toUpperCase()}`;
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  if (market === 'cn' && plan !== 'annual') throw new Error('Mainland TrainWell currently offers annual prepaid access only.');
  return value;
}

export async function approvedStripePrice(stripe: Stripe, plan: BillingPlan, mode: BillingMode = 'test') {
  const price = await stripe.prices.retrieve(priceId(plan, mode));
  assertBillingMode(price.livemode, mode);
  if (appMarket() !== 'global') throw new Error('Only global subscriptions are enabled.');
  assertApprovedPrice(price, plan, appMarket());
  return price;
}

export function recognizedPrices(plan: BillingPlan, mode: BillingMode = 'test') {
  const history = Deno.env.get(`STRIPE_${mode === 'live' ? 'LIVE_' : ''}HISTORICAL_${plan.toUpperCase()}`) ?? '';
  // The original demo environment has only monthly and annual Prices.
  if (mode === 'test' && plan === 'daily' && !Deno.env.get('STRIPE_PRICE_DAILY')) return [];
  return [priceId(plan, mode), ...history.split(',').map(value => value.trim()).filter(Boolean)];
}

export function configuredPlans(mode: BillingMode): BillingPlan[] {
  if (appMarket() === 'cn') return ['annual'];
  return mode === 'live' || Deno.env.get('STRIPE_PRICE_DAILY')
    ? ['daily', 'monthly', 'annual'] : ['monthly', 'annual'];
}
