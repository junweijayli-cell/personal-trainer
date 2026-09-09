// Public product prices only. Stripe credentials and approved Price IDs stay in server secrets.
export const GLOBAL_PLANS = {
  daily: { currency: 'usd', unitAmount: 100, interval: 'day' },
  monthly: { currency: 'usd', unitAmount: 1000, interval: 'month' },
  annual: { currency: 'usd', unitAmount: 6000, interval: 'year' },
} as const;

export type BillingPlan = keyof typeof GLOBAL_PLANS;
export const ANNUAL_SAVING_PERCENT = Math.round(
  (1 - GLOBAL_PLANS.annual.unitAmount / (GLOBAL_PLANS.monthly.unitAmount * 12)) * 100,
);

type ConfiguredPrice = {
  active: boolean;
  currency: string;
  unit_amount: number | null;
  type: string;
  billing_scheme: string;
  custom_unit_amount?: unknown;
  transform_quantity?: unknown;
  recurring: { interval: string; interval_count: number; usage_type: string } | null;
};

export function assertApprovedPrice(price: ConfiguredPrice, plan: BillingPlan, market: 'global' | 'cn') {
  if (!price.active || price.billing_scheme !== 'per_unit' || price.custom_unit_amount || price.transform_quantity
    || !Number.isInteger(price.unit_amount) || Number(price.unit_amount) <= 0) {
    throw new Error('This billing price is unavailable. Please contact support.');
  }
  if (market === 'cn') {
    // Mainland currency and amount require separate approval; never convert the global USD prices here.
    if (plan !== 'annual' || price.type !== 'one_time' || price.recurring) {
      throw new Error('Mainland access requires an approved annual prepaid price.');
    }
    return;
  }
  const approved = GLOBAL_PLANS[plan];
  if (price.currency !== approved.currency || price.unit_amount !== approved.unitAmount
    || price.type !== 'recurring' || price.recurring?.interval !== approved.interval
    || price.recurring.interval_count !== 1 || price.recurring.usage_type !== 'licensed') {
    throw new Error('This billing price does not match the published TrainWell plan. Please contact support.');
  }
}
