import Stripe from 'npm:stripe@19.0.0';
import { adminClient } from '../_shared/auth.ts';
import { json } from '../_shared/response.ts';
import { recognizedPrices, stripeClient } from '../_shared/stripe.ts';
import { reconcileBilling } from '../_shared/reconcile-billing.ts';
Deno.serve(async request=>{
  if(request.method!=='POST') return json(request,{error:'Method not allowed.'},405);
  const signature=request.headers.get('Stripe-Signature');
  const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if(!signature || !secret) return json(request,{error:'Webhook signature required.'},400);
  let event: Stripe.Event;
  let stripe: Stripe;
  try {
    stripe=stripeClient();
    event=await stripe.webhooks.constructEventAsync(await request.text(),signature,secret,undefined,Stripe.createSubtleCryptoProvider());
  } catch { return json(request,{error:'Invalid webhook signature or configuration.'},400); }
  if(event.livemode) return json(request,{error:'Live events disabled.'},400);
  try {
    await reconcileBilling(adminClient(),stripe,event,recognizedPrices('monthly'),recognizedPrices('annual'));
    return json(request,{received:true});
  } catch {
    console.error('Billing reconciliation must be retried:',event.id,event.type);
    return json(request,{error:'Reconciliation pending. Retry this event.'},503);
  }
});
