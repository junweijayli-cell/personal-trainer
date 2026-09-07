import type Stripe from 'npm:stripe@19.0.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { invoiceSubscription, isTerminalSubscription, objectId, subscriptionPatch } from './billing-state.ts';
import { applyState, billingRow, checkoutOperation, runtime, withBillingLock } from './billing-store.ts';

export async function reconcileBilling(admin: SupabaseClient, stripe: Stripe, event: Stripe.Event, monthly: string[], annual: string[]) {
  if(event.livemode) throw new Error('Live events disabled.');
  await runtime(admin);
  let subscriptionId: string | null=null;
  let expectedCustomer: string | null=null;
  if(event.type.startsWith('customer.subscription.')) {
    const sub=event.data.object as Stripe.Subscription;
    subscriptionId=sub.id; expectedCustomer=objectId(sub.customer);
  } else if(event.type==='invoice.paid' || event.type==='invoice.payment_failed') {
    const invoice=event.data.object as Stripe.Invoice;
    subscriptionId=invoiceSubscription(invoice); expectedCustomer=objectId(invoice.customer);
    if(!subscriptionId) return; // A standalone customer invoice never changes membership.
  } else if(event.type==='checkout.session.completed') {
    const session=event.data.object as Stripe.Checkout.Session;
    if(session.mode!=='subscription') throw new Error('Unsupported Checkout mode.');
    subscriptionId=objectId(session.subscription); expectedCustomer=objectId(session.customer);
  } else return;
  if(!subscriptionId || !expectedCustomer) throw new Error('Subscription identity is missing.');
  // Locate by a trusted existing customer link, then validate all other identities.
  const {data:match,error}=await admin.from('memberships').select('user_id').eq('stripe_customer_id',expectedCustomer).maybeSingle();
  if(error) throw new Error('Membership lookup failed.');
  if(!match) throw new Error('No matching billing account.');
  await withBillingLock(admin,match.user_id,async token=>{
    const {data:receipt,error:receiptError}=await admin.from('billing_events').select('status').eq('stripe_event_id',event.id).maybeSingle();
    if(receiptError) throw new Error('Event lookup failed.');
    if(receipt?.status==='processed') return;
    const member=await billingRow(admin,match.user_id);
    // Fetch AFTER acquiring the lock. Old event payloads never overwrite newer
    // subscription state, including invoices that arrive before period updates.
    const sub=await stripe.subscriptions.retrieve(subscriptionId!);
    if(sub.livemode || objectId(sub.customer)!==member.stripe_customer_id ||
      sub.metadata.supabase_user_id!==member.user_id || (member.billing_mode && member.billing_mode!=='test')) {
      throw new Error('Subscription ownership or mode mismatch.');
    }
    const operation=await checkoutOperation(admin,member.user_id);
    if(member.stripe_subscription_id!==sub.id) {
      if (isTerminalSubscription(sub.status) && operation && sub.metadata.billing_operation !== operation.id) {
        await applyState(admin,member.user_id,token,{},null,event); return;
      }
      if(!operation || sub.metadata.billing_operation!==operation.id) throw new Error('Unexpected subscription.');
      if(member.stripe_subscription_id) {
        const previous=await stripe.subscriptions.retrieve(member.stripe_subscription_id);
        if(!isTerminalSubscription(previous.status)) throw new Error('An existing subscription must be resolved first.');
      }
    } else if(operation && sub.metadata.billing_operation && sub.metadata.billing_operation!==operation.id) {
      // A terminal old subscription event must not replace a newer Checkout.
      if(isTerminalSubscription(sub.status)) {
        await applyState(admin,member.user_id,token,{},null,event); return;
      }
    }
    let patch: Record<string,unknown>;
    try { patch=subscriptionPatch(sub,monthly,annual); }
    catch(error) {
      // Unknown prices/items must revoke stale access before surfacing for review.
      await applyState(admin,member.user_id,token,{status:'expired',current_period_start:null,current_period_end:null},null,event);
      console.error('Billing subscription requires operator review:',event.id);
      if(!(error instanceof Error)) throw error;
      return;
    }
    await applyState(admin,member.user_id,token,patch,null,event);
  });
}
