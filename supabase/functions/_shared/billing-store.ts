import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { BillingMode } from './billing-mode.ts';
import type { CheckoutOperation } from './billing-state.ts';
export type BillingRow = { user_id: string; status: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; billing_mode: string | null };
export async function runtime(admin: SupabaseClient) {
  const { data, error } = await admin.from('billing_runtime').select('mode,checkout_enabled').single();
  if (error || !['test', 'live'].includes(data?.mode)) throw new Error('Billing is unavailable.');
  return data as { mode: BillingMode; checkout_enabled: boolean };
}
export async function withBillingLock<T>(admin: SupabaseClient, userId: string, action: (token: string) => Promise<T>): Promise<T> {
  const token = crypto.randomUUID();
  const { data, error } = await admin.rpc('claim_billing_lock', { p_user: userId, p_token: token });
  if (error || !data) throw new Error('Billing is processing another request. Please retry shortly.');
  try { return await action(token); }
  finally { await admin.rpc('release_billing_lock', { p_user: userId, p_token: token }); }
}
export async function checkoutAvailable(admin: SupabaseClient, userId?: string) {
  const config = await runtime(admin);
  if (config.checkout_enabled) return true;
  if (!userId) return false;
  const { data, error } = await admin.from('billing_test_users').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('Checkout is unavailable.');
  return Boolean(data);
}
export async function billingRow(admin: SupabaseClient, userId: string): Promise<BillingRow> {
  const { data, error } = await admin.from('memberships').select('*').eq('user_id',userId).single();
  if (error) throw new Error('Membership is unavailable.');
  return data;
}
export async function renewBillingLock(admin: SupabaseClient, userId: string, token: string) {
  const { data, error } = await admin.rpc('renew_billing_lock', { p_user: userId, p_token: token });
  if (error || !data) throw new Error('Billing lock expired. Please retry.');
}
export async function checkoutOperation(admin: SupabaseClient, userId: string): Promise<CheckoutOperation | null> {
  const { data, error } = await admin.from('billing_checkout_operations').select('operation').eq('user_id',userId).maybeSingle();
  if (error) throw new Error('Checkout state is unavailable.');
  return data?.operation ?? null;
}
export async function applyState(admin: SupabaseClient, userId: string, token: string, patch: Record<string, unknown> = {}, operation: CheckoutOperation | null = null, event: { id: string; type: string; livemode: boolean } | null = null) {
  const { error } = await admin.rpc('apply_billing_state', { p_user:userId, p_token:token, p_patch:patch, p_operation:operation, p_event:event && { id:event.id,type:event.type,livemode:event.livemode } });
  if (error) throw new Error('Could not commit billing state.');
}
