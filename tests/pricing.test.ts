import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { annualSavingLabel, globalPriceLabel } from '../app/pricing';
import { ANNUAL_SAVING_PERCENT, GLOBAL_PLANS, assertApprovedPrice } from '../supabase/functions/_shared/billing-policy';

const monthlyPrice = {
  active: true, currency: 'usd', unit_amount: 1000, type: 'recurring', billing_scheme: 'per_unit',
  custom_unit_amount: null, transform_quantity: null,
  recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
};
const annualPrice = { ...monthlyPrice, unit_amount: 6000, recurring: { ...monthlyPrice.recurring, interval: 'year' } };

describe('approved TrainWell prices', () => {
  it('quotes ten US dollars monthly and sixty US dollars annually, saving exactly half', () => {
    expect(GLOBAL_PLANS.monthly.unitAmount).toBe(1000);
    expect(GLOBAL_PLANS.annual.unitAmount).toBe(6000);
    expect(GLOBAL_PLANS.monthly.currency).toBe('usd');
    expect(GLOBAL_PLANS.annual.currency).toBe('usd');
    expect(ANNUAL_SAVING_PERCENT).toBe(50);
    expect(globalPriceLabel('monthly', 'en')).toBe('US$10 / month');
    expect(globalPriceLabel('annual', 'en')).toBe('US$60 / year');
    expect(globalPriceLabel('monthly', 'zh')).toBe('US$10 / 月');
    expect(globalPriceLabel('annual', 'zh')).toBe('US$60 / 年');
    expect(annualSavingLabel('en')).toBe('Save 50% vs monthly');
    expect(annualSavingLabel('zh')).toBe('比按月付费省 50%');
  });

  it('accepts only the two approved global recurring offers', () => {
    expect(() => assertApprovedPrice(monthlyPrice, 'monthly', 'global')).not.toThrow();
    expect(() => assertApprovedPrice(annualPrice, 'annual', 'global')).not.toThrow();
    expect(() => assertApprovedPrice(monthlyPrice, 'annual', 'global')).toThrow();
    expect(() => assertApprovedPrice(annualPrice, 'monthly', 'global')).toThrow();
  });

  it('rejects the superseded five-dollar and thirty-dollar prices', () => {
    expect(() => assertApprovedPrice({ ...monthlyPrice, unit_amount: 500 }, 'monthly', 'global')).toThrow();
    expect(() => assertApprovedPrice({ ...annualPrice, unit_amount: 3000 }, 'annual', 'global')).toThrow();
  });

  it('keeps legal notices on the shared price labels', () => {
    const legal = readFileSync(new URL('../app/legal-notices.tsx', import.meta.url), 'utf8');
    for (const language of ['en', 'zh']) {
      for (const plan of ['monthly', 'annual']) expect(legal).toContain(`globalPriceLabel('${plan}', '${language}')`);
    }
    expect(legal).not.toMatch(/US\$(5|30)\b|每月 5 美元|每年 30 美元/);
  });

  it.each([
    ['wrong amount', { unit_amount: 600 }],
    ['wrong currency', { currency: 'cny' }],
    ['wrong interval', { recurring: { ...monthlyPrice.recurring, interval: 'year' } }],
    ['multiple months', { recurring: { ...monthlyPrice.recurring, interval_count: 2 } }],
    ['metered price', { recurring: { ...monthlyPrice.recurring, usage_type: 'metered' } }],
    ['one-off global price', { type: 'one_time', recurring: null }],
    ['archived price', { active: false }],
    ['tiered price', { billing_scheme: 'tiered' }],
    ['customer-chosen amount', { custom_unit_amount: { enabled: true } }],
    ['transformed quantity', { transform_quantity: { divide_by: 10, round: 'up' } }],
    ['free price', { unit_amount: 0 }],
    ['negative price', { unit_amount: -500 }],
    ['missing amount', { unit_amount: null }],
    ['fractional amount', { unit_amount: 500.5 }],
  ])('rejects %s before checkout', (_name, patch) => {
    expect(() => assertApprovedPrice({ ...monthlyPrice, ...patch }, 'monthly', 'global')).toThrow();
  });

  it('keeps China annual prepaid pricing separate without inventing a currency conversion', () => {
    const configuredChinaPrice = { ...annualPrice, currency: 'cny', unit_amount: 12345, type: 'one_time', recurring: null };
    expect(() => assertApprovedPrice(configuredChinaPrice, 'annual', 'cn')).not.toThrow();
    expect(() => assertApprovedPrice(configuredChinaPrice, 'monthly', 'cn')).toThrow();
    expect(() => assertApprovedPrice(annualPrice, 'annual', 'cn')).toThrow();
    expect(() => assertApprovedPrice(configuredChinaPrice, 'annual', 'global')).toThrow();
  });

  it('validates the server-selected Stripe Price before customer or checkout creation', () => {
    const checkout = readFileSync(new URL('../supabase/functions/create-checkout-session/index.ts', import.meta.url), 'utf8');
    const stripe = readFileSync(new URL('../supabase/functions/_shared/stripe.ts', import.meta.url), 'utf8');
    const catalog = readFileSync(new URL('../supabase/functions/get-billing-catalog/index.ts', import.meta.url), 'utf8');
    expect(stripe).toContain('stripe.prices.retrieve(priceId(plan))');
    expect(stripe).toContain('assertApprovedPrice(price, plan, appMarket())');
    expect(checkout.indexOf('await approvedStripePrice(stripe, plan)')).toBeLessThan(checkout.indexOf('stripe.customers.create'));
    expect(checkout).not.toMatch(/body\.(price|amount|currency|access_days)/);
    expect(checkout).toContain('line_items: [{ price: price.id, quantity: 1 }]');
    expect(catalog).toContain('await approvedStripePrice(stripe, plan)');
  });
});
