import type Stripe from 'npm:stripe@19.0.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { applyState, billingRow, checkoutOperation, checkoutAvailable, withBillingLock } from './billing-store.ts';
import { canRecoverOperation, isTerminalSubscription, type CheckoutOperation } from './billing-state.ts';

export async function openCheckout(admin: SupabaseClient, stripe: Stripe,
  user: { id: string; email?: string; email_confirmed_at?: string; user_metadata: Record<string, unknown> },
  plan: 'monthly' | 'annual', price: string, base: string) {
  if (!user.email_confirmed_at) throw new Error('Verify your email before checkout.');
  if (!(await checkoutAvailable(admin, user.id))) throw new Error('Demo checkout is not available yet.');
  return withBillingLock(admin,user.id,async (token) => {
    if (!(await checkoutAvailable(admin, user.id))) throw new Error('Demo checkout is unavailable.');
    const member = await billingRow(admin,user.id);
    if (member.billing_mode && member.billing_mode !== 'test') throw new Error('This billing account cannot use test checkout.');
    if (member.stripe_subscription_id) {
      const existing = await stripe.subscriptions.retrieve(member.stripe_subscription_id);
      if (existing.livemode || !isTerminalSubscription(existing.status)) throw new Error('A subscription already exists. Use Manage billing.');
    }
    if (member.stripe_customer_id) {
      const subscriptions = await stripe.subscriptions.list({ customer:member.stripe_customer_id, status:'all', limit:100 });
      if (subscriptions.has_more || subscriptions.data.some((s) => !isTerminalSubscription(s.status))) throw new Error('A subscription already exists. Use Manage billing.');
    }
    let op = await checkoutOperation(admin,user.id);
    if (op && ['creating','open','complete'].includes(op.state)) {
      if (!canRecoverOperation(op)) throw new Error('Checkout needs support reconciliation. Do not pay again.');
      // Recover an ambiguous creation with its original parameters before changing plans.
      const recovered = await createOrRetrieve(op);
      if (recovered.status === 'complete') {
        // Terminal old subscriptions can be replaced only after their session is resolved.
        const sid=typeof recovered.subscription === 'string' ? recovered.subscription : recovered.subscription?.id;
        if (!sid || !isTerminalSubscription((await stripe.subscriptions.retrieve(sid)).status)) throw new Error('Payment confirmation is pending. Do not pay again.');
      }
      if (recovered.status === 'open') {
        if (op.plan === plan && op.price === price) return requireUrl(recovered);
        await stripe.checkout.sessions.expire(recovered.id);
      }
      op = { ...op, state:'expired' };
      await applyState(admin,user.id,token,{},op);
    }
    op = { id:crypto.randomUUID(),plan,price,createdAt:Date.now(),state:'creating' };
    await applyState(admin,user.id,token,{},op);
    return requireUrl(await createOrRetrieve(op));

    async function createOrRetrieve(operation: CheckoutOperation) {
      if (operation.sessionId) return stripe.checkout.sessions.retrieve(operation.sessionId);
      let customerId = member.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({ email:user.email, name:String(user.user_metadata.display_name ?? ''),
          metadata:{supabase_user_id:user.id,market:'global'} },{idempotencyKey:`trainwell:test:customer:${operation.id}`});
        if (customer.livemode) throw new Error('Live customer rejected.');
        customerId=customer.id;
        await applyState(admin,user.id,token,{stripe_customer_id:customerId,billing_mode:'test'});
        member.stripe_customer_id=customerId;
      }
      const metadata={supabase_user_id:user.id,market:'global',plan:operation.plan,billing_operation:operation.id};
      const session=await stripe.checkout.sessions.create({mode:'subscription',customer:customerId,
        adaptive_pricing:{enabled:false},
        line_items:[{price:operation.price,quantity:1}],client_reference_id:user.id,metadata,subscription_data:{metadata},
        success_url:`${base}/?view=you&billing=success`,cancel_url:`${base}/?view=membership&billing=canceled`,
        custom_text:{submit:{message:'TrainWell / 悦练 demo · 演示付款：Test membership only. No real money is charged. 仅用于测试会员，不收取真实款项。'}},
      },{idempotencyKey:`trainwell:test:checkout:${operation.id}`});
      if(session.livemode) throw new Error('Live session rejected.');
      await applyState(admin,user.id,token,{}, {...operation,sessionId:session.id,state:session.status === 'complete' ? 'complete' : session.status === 'expired' ? 'expired' : 'open'});
      return session;
    }
  });
}
function requireUrl(session: Stripe.Checkout.Session) {
  if(session.livemode || session.status!=='open' || !session.url) throw new Error('Checkout is not open.');
  return session.url;
}
