export type BillingMode = 'test' | 'live';

export function assertBillingMode(livemode: boolean, mode: BillingMode) {
  if (livemode !== (mode === 'live')) throw new Error('Live/test billing mode mismatch.');
}

export function assertStripeKey(secret: string | undefined, mode: BillingMode) {
  if (!secret || !new RegExp(`^(sk|rk)_${mode}_`).test(secret)) {
    throw new Error(`A matching Stripe ${mode} key is required.`);
  }
  return secret;
}
