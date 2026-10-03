import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { checkoutConfirmation } from '../supabase/functions/_shared/checkout-confirmation';
import { parseCheckoutConfirmation } from '../app/billing-client';

const session = { id: 'cs_live_paid', mode: 'subscription', livemode: true, status: 'complete', payment_status: 'paid',
  customer: 'cus_owner', client_reference_id: 'owner', metadata: { supabase_user_id: 'owner' }, subscription: 'sub_paid',
  currency: 'usd', amount_total: 100, line_items: { has_more: false, data: [{ quantity: 1, price: { id: 'price_day', livemode: true } }] },
} as unknown as Stripe.Checkout.Session;
const confirm = (s: Stripe.Checkout.Session) => checkoutConfirmation(s, 'owner', 'cus_owner', 'live', ['price_month'], ['price_year'], ['price_day']);

describe('server-verified payment confirmation', () => {
  it('returns the verified amount and plan without exposing billing address or card details', () => {
    expect(parseCheckoutConfirmation(confirm(session))).toEqual({ status: 'confirmed', mode: 'live', plan: 'daily', amount: 100, currency: 'usd' });
    expect(confirm({ ...session, amount_total: 75 }).amount).toBe(75);
  });
  it.each([{ customer: 'cus_other' }, { client_reference_id: 'other' }, { metadata: { supabase_user_id: 'other' } }, { livemode: false }, { mode: 'payment' }])('rejects another account, wrong mode or unlinked checkout: %j', (patch) => {
    expect(() => confirm({ ...session, ...patch } as Stripe.Checkout.Session)).toThrow();
  });
  it.each([{ status: 'open' }, { status: 'expired' }, { payment_status: 'unpaid' }, { payment_status: 'no_payment_required' }])('does not call an unpaid or incomplete checkout paid: %j', (patch) => {
    expect(confirm({ ...session, ...patch } as Stripe.Checkout.Session)).toEqual({ status: 'pending', mode: 'live' });
  });
  it('requires an approved price, a subscription and an exact single item', () => {
    for (const patch of [{ subscription: null }, { line_items: undefined }, { currency: 'hkd' }, { amount_total: null }, { amount_total: -1 },
      { line_items: { has_more: false, data: [{ quantity: 1, price: { id: 'unknown', livemode: true } }] } },
      { line_items: { ...session.line_items, has_more: true } },
      { line_items: { has_more: false, data: [{ quantity: 2, price: { id: 'price_day', livemode: true } }] } }]) {
      expect(() => confirm({ ...session, ...patch } as Stripe.Checkout.Session)).toThrow();
    }
  });
  it('keeps demo confirmation explicitly labeled and rejects malformed client responses', () => {
    const demo = { ...session, livemode: false, line_items: { has_more: false, data: [{ quantity: 1, price: { id: 'price_day', livemode: false } }] } } as Stripe.Checkout.Session;
    expect(checkoutConfirmation(demo, 'owner', 'cus_owner', 'test', [], [], ['price_day']).mode).toBe('test');
    for (const value of [null, {}, { status: 'confirmed', mode: 'live' }, { ...confirm(session), amount: '100' }, { ...confirm(session), currency: 'xxx' }]) {
      expect(() => parseCheckoutConfirmation(value)).toThrow();
    }
  });
});
