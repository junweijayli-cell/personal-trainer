// Bounded operator check. Credentials stay in memory; no verification email is sent.
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseKeys } from './smtp-email-smoke.mjs';

const ref = 'yvcdlrnjhhafywawuknj';
const url = `https://${ref}.supabase.co`;
const [action, id, plan] = process.argv.slice(2);
if (!['create', 'status', 'checkout', 'portal', 'cleanup'].includes(action) ||
  (action !== 'create' && !/^[a-f0-9-]{36}$/.test(id ?? '')) ||
  (action === 'checkout' && !['monthly', 'annual'].includes(plan))) throw Error('Invalid operator check arguments.');
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  '--yes', '--registry=https://registry.npmjs.org', 'supabase@2.76.15', 'projects', 'api-keys', '--project-ref', ref, '--output', 'json',
], { encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true, timeout: 90000, stdio: ['ignore','pipe','pipe'] });
if (result.status !== 0) throw Error('Official Supabase authentication failed; output suppressed.');
const keys = parseKeys(result.stdout); result.stdout = ''; result.stderr = '';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, keys.service, options);
function checked(response, label) {
  if (response.error) throw Error(`${label} failed (${response.error.status ?? response.error.code ?? 'remote error'}).`);
  return response.data;
}
async function invoke(client, name, options) {
  const response = await client.functions.invoke(name, options);
  if (response.error) {
    const context = response.error.context;
    let detail = '';
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => ({}));
      const message = String(payload.error ?? payload.message ?? '');
      detail = /(?:sk|rk|pk)_(?:live|test)|whsec_|Bearer /i.test(message)
        ? 'Credential rejected (details suppressed)' : message.slice(0,250);
    }
    throw Error(`${name} failed (${context?.status ?? 'network'}): ${detail}`);
  }
  return response.data;
}
async function privateTestSession(user) {
  const link = checked(await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email }), 'Generate private test session');
  const client = createClient(url, keys.anon, options);
  checked(await client.auth.verifyOtp({ email: user.email, token: link.properties.email_otp, type: 'magiclink' }), 'Verify private test session');
  return client;
}
try {
  if (action === 'create') {
    const marker = randomUUID();
    const { user } = checked(await admin.auth.admin.createUser({
      email: `trainwell-billing-${marker}@example.invalid`, password: randomBytes(32).toString('base64url'), email_confirm: true,
      app_metadata: { trainwell_demo_validation: true }, user_metadata: { display_name: 'Demo payment check', locale: 'en', market: 'global' },
    }), 'Create temporary user');
    checked(await admin.from('billing_test_users').insert({ user_id: user.id }), 'Allow operator checkout');
    console.log(JSON.stringify({ created: user.id }));
  } else {
    const { user } = checked(await admin.auth.admin.getUserById(id), 'Read temporary user');
    if (!user?.app_metadata.trainwell_demo_validation || !/^trainwell-billing-[a-f0-9-]+@example\.invalid$/.test(user.email ?? '')) throw Error('Only this workflow’s disposable accounts may be used.');
    if (action === 'status') {
      const member = checked(await admin.from('memberships').select('status,plan,billing_mode,current_period_end,stripe_customer_id,stripe_subscription_id').eq('user_id', id).single(), 'Read membership');
      const runtime = checked(await admin.from('billing_runtime').select('mode,checkout_enabled').single(), 'Read billing switch');
      const client = await privateTestSession(user);
      const entitlement = checked(await client.rpc('get_my_entitlement'), 'Read authenticated entitlement');
      console.log(JSON.stringify({ userId: id, membership: member, runtime, entitlement }));
    } else {
      const client = await privateTestSession(user);
      if (action === 'checkout') {
        const catalog = await invoke(client, 'get-billing-catalog', { method: 'GET' });
        if (catalog.mode !== 'test' || !catalog.enabled || !catalog.plans.some(p => p.plan === plan && p.currency === 'usd' && p.unitAmount === (plan === 'monthly' ? 1000 : 6000))) throw Error('Approved test price is unavailable.');
        const checkout = await invoke(client, 'create-checkout-session', { body: { plan } });
        if (checkout.mode !== 'test' || !checkout.url?.startsWith('https://checkout.stripe.com/')) throw Error('Unexpected checkout response.');
        console.log(JSON.stringify({ userId: id, plan, checkout: checkout.url }));
      } else if (action === 'portal') {
        const portal = await invoke(client, 'create-customer-portal-session', { body: {} });
        if (!portal.url?.startsWith('https://billing.stripe.com/')) throw Error('Unexpected portal response.');
        console.log(JSON.stringify({ userId: id, portal: portal.url }));
      } else {
        const removed = await invoke(client, 'delete-account', { body: {} });
        if (!removed.deleted) throw Error('Deletion was not confirmed.');
        console.log(JSON.stringify({ deleted: id }));
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Operator check failed.'); process.exitCode = 1;
}
