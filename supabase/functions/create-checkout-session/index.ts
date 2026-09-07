import { handleOptions } from '../_shared/cors.ts';
import { authenticatedUser } from '../_shared/auth.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { appUrl, approvedStripePrice, stripeClient } from '../_shared/stripe.ts';
import { openCheckout } from '../_shared/checkout.ts';
Deno.serve(async (request) => {
  const options=handleOptions(request); if(options) return options;
  if(request.method!=='POST') return json(request,{error:'Method not allowed.'},405);
  try {
    const {user,admin}=await authenticatedUser(request);
    const {plan}=await request.json();
    if(plan!=='monthly' && plan!=='annual') throw new Error('Choose monthly or annual access.');
    const stripe=stripeClient();
    const price=await approvedStripePrice(stripe,plan);
    const url=await openCheckout(admin,stripe,user,plan,price.id,appUrl());
    return json(request,{url,mode:'test'});
  } catch(error) { return errorResponse(request,error,409); }
});
