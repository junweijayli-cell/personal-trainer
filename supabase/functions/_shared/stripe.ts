import Stripe from 'npm:stripe@19.0.0';
import { assertApprovedPrice, type BillingPlan } from './billing-policy.ts';

export function stripeClient() {
  const secret = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!secret || !/^(sk|rk)_test_/.test(secret)) throw new Error('A Stripe test key is required. Live payments are disabled.');
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

export function priceId(plan: 'monthly' | 'annual') {
  const market = appMarket();
  const name = market === 'cn'
    ? 'STRIPE_PRICE_CN_ANNUAL'
    : plan === 'monthly' ? 'STRIPE_PRICE_MONTHLY' : 'STRIPE_PRICE_ANNUAL';
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  if (market === 'cn' && plan !== 'annual') throw new Error('Mainland TrainWell currently offers annual prepaid access only.');
  return value;
}

export async function approvedStripePrice(stripe: Stripe, plan: BillingPlan) {
  const price = await stripe.prices.retrieve(priceId(plan));
  if (price.livemode || appMarket() !== 'global') throw new Error('Only global test subscriptions are enabled.');
  assertApprovedPrice(price, plan, appMarket());
  return price;
}

export function recognizedPrices(plan: 'monthly' | 'annual') {
  const history = Deno.env.get(plan === 'monthly' ? 'STRIPE_HISTORICAL_MONTHLY' : 'STRIPE_HISTORICAL_ANNUAL') ?? '';
  return [priceId(plan), ...history.split(',').map((value) => value.trim()).filter(Boolean)];
}
