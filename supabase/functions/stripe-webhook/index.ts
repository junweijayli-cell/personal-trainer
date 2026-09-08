import Stripe from 'npm:stripe@19.0.0';
import { adminClient } from '../_shared/auth.ts';
import { json } from '../_shared/response.ts';
import { recognizedPrices, stripeClient } from '../_shared/stripe.ts';
import { runtime } from '../_shared/billing-store.ts';
import { reconcileBilling } from '../_shared/reconcile-billing.ts';
Deno.serve(async request=>{
  if(request.method!=='POST') return json(request,{error:'Method not allowed.'},405);
  const signature=request.headers.get('Stripe-Signature');
  const body = await request.text();
  let mode: 'test' | 'live';
  try { const raw = JSON.parse(body); if (typeof raw.livemode !== 'boolean') throw new Error(); mode = raw.livemode ? 'live' : 'test'; }
  catch { return json(request,{error:'Invalid event.'},400); }
  // This selects a verifier only; no event data is trusted before signature validation.
  const secret=Deno.env.get(mode === 'live' ? 'STRIPE_LIVE_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET');
  if(!signature || !secret) return json(request,{error:'Webhook signature required.'},400);
  let event: Stripe.Event;
  let stripe: Stripe;
  try {
    stripe=stripeClient(mode);
    event=await stripe.webhooks.constructEventAsync(body,signature,secret,undefined,Stripe.createSubtleCryptoProvider());
  } catch { return json(request,{error:'Invalid webhook signature or configuration.'},400); }

  try {
    const admin = adminClient();
    if ((await runtime(admin)).mode !== mode) return json(request,{received:true,ignored:'inactive billing mode'});
    await reconcileBilling(admin,stripe,event,recognizedPrices('monthly',mode),recognizedPrices('annual',mode),recognizedPrices('daily',mode));
    return json(request,{received:true});
  } catch {
    console.error('Billing reconciliation must be retried:',event.id,event.type);
    return json(request,{error:'Reconciliation pending. Retry this event.'},503);
  }
});
