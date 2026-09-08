import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { openCheckout } from '../supabase/functions/_shared/checkout';
import { reconcileBilling } from '../supabase/functions/_shared/reconcile-billing';
import { invoiceSubscription, subscriptionPatch } from '../supabase/functions/_shared/billing-state';

const userId='11111111-1111-4111-8111-111111111111';
const user={id:userId,email:'fixture@example.com',email_confirmed_at:'2026-09-01T00:00:00Z',user_metadata:{}};
let db: PGlite;
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create function extensions.gen_random_uuid() returns uuid language sql as 'select gen_random_uuid()';
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    grant usage on schema auth to authenticated,service_role;`);
  await db.exec(read('supabase/migrations/202609020001_production_foundation.sql').replace('create extension if not exists pgcrypto with schema extensions;',''));
  await db.exec(read('supabase/migrations/202609070001_safe_test_billing.sql'));
  await db.exec(read('supabase/migrations/202609090001_live_daily_billing.sql'));
},30000);
beforeEach(async()=>{
  await db.exec(`reset role; truncate auth.users cascade; truncate public.billing_events,public.billing_audit_log;
    update public.billing_runtime set mode='test',checkout_enabled=true;`);
  await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,'fixture@example.com',now())`,[userId]);
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[userId]);
});
afterAll(async()=>{await db?.close();});

// Real PostgreSQL functions behind the small Supabase transport adapter.
const adapter={
  from(table:string){
    if(!['memberships','billing_checkout_operations','billing_events','billing_runtime','billing_test_users'].includes(table)) throw Error('Unexpected table');
    let columns='*', field='', value:unknown;
    const builder={
      select(c:string){columns=c;return builder;},
      eq(f:string,v:unknown){field=f;value=v;return builder;},
      async maybeSingle(){return builder.single();},
      async single(){
        const rows=(await db.query(`select ${columns} from public.${table}${field?` where ${field}=$1`:''}`,field?[value]:[])).rows;
        return {data:rows[0]??null,error:null};
      },
    };return builder;
  },
  async rpc(name:string,args:Record<string,unknown>){
    if(!['claim_billing_lock','release_billing_lock','apply_billing_state'].includes(name)) throw Error('Unexpected RPC');
    const keys=Object.keys(args),values=Object.values(args).map(v=>v&&typeof v==='object'?JSON.stringify(v):v);
    try {
      const result=await db.query<{value: unknown}>(`select public.${name}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')}) as value`,values);
      return {data:result.rows[0].value,error:null};
    } catch(error){return {data:null,error};}
  },
} as unknown as SupabaseClient;

function subscription(status='active',price='price_month',sid='sub_1') {
  return {id:sid,livemode:false,status,customer:'cus_1',metadata:{supabase_user_id:userId},cancel_at_period_end:false,
    items:{data:[{quantity:1,price:{id:price},current_period_start:1788220800,current_period_end:1893456000}]}};
}
function fakeStripe(live = false){
  const sessions=new Map<string,Record<string,unknown>>();
  const subscriptions=new Map<string,ReturnType<typeof subscription>>();
  let creates=0,customers=0,loseResponse=false;
  const api={
    customers:{async create(){customers++;return {id:'cus_1',livemode:live};}},
    subscriptions:{async retrieve(id:string){const s=subscriptions.get(id);if(!s)throw Error('Missing subscription');return s;},
      async list(){return {data:[...subscriptions.values()],has_more:false};}},
    checkout:{sessions:{
      async create(params:Record<string,unknown>,options:{idempotencyKey:string}){
        let session=sessions.get(options.idempotencyKey);
        if(!session){creates++;session={id:`cs_${creates}`,livemode:live,status:'open',url:`https://checkout.stripe.com/c/pay/cs_${creates}`, ...params};sessions.set(options.idempotencyKey,session);}
        if(loseResponse){loseResponse=false;throw Error('Network response lost');}return session;
      },
      async retrieve(id:string){const s=[...sessions.values()].find(s=>s.id===id);if(!s)throw Error('Missing session');return s;},
      async expire(id:string){const s=await api.checkout.sessions.retrieve(id);s.status='expired';return s;},
    }},
  };
  return {api:api as unknown as Stripe,sessions,subscriptions,created:()=>creates,customers:()=>customers,loseNextResponse:()=>{loseResponse=true;}};
}
async function member(){return (await db.query<Record<string,unknown>>('select * from public.memberships where user_id=$1',[userId])).rows[0];}
const checkout=(s:Stripe,p:'daily'|'monthly'|'annual'='monthly')=>openCheckout(adapter,s,user,p,p==='daily'?'price_day':p==='monthly'?'price_month':'price_year','https://trainwell.win');
const event=(id:string,type:string,object:unknown)=>({id,type,livemode:false,data:{object}} as Stripe.Event);
const reconcile=(s:Stripe,e:Stripe.Event)=>reconcileBilling(adapter,s,e,['price_month','price_old_month'],['price_year','price_old_year'],['price_day']);

describe('serialized Checkout with real PostgreSQL leases',()=>{
  it('allows only selected test accounts to validate before public rollout', async()=>{
    const s=fakeStripe();
    await db.exec('update billing_runtime set checkout_enabled=false');
    await expect(checkout(s.api)).rejects.toThrow('not available');
    await db.query('insert into billing_test_users(user_id) values($1)',[userId]);
    expect(await checkout(s.api)).toContain('cs_1');
    expect((await db.query<{checkout_enabled:boolean}>('select checkout_enabled from billing_runtime')).rows[0].checkout_enabled).toBe(false);
  });
  it('two tabs and retries create only one open checkout',async()=>{
    const s=fakeStripe();
    const results=await Promise.allSettled([checkout(s.api),checkout(s.api)]);
    expect(results.some(r=>r.status==='fulfilled')).toBe(true);
    const again=await checkout(s.api);
    expect(again).toContain('cs_1');expect(s.created()).toBe(1);expect(s.customers()).toBe(1);
  });
  it('recovers a lost response under the original key before switching plans',async()=>{
    const s=fakeStripe();s.loseNextResponse();
    await expect(checkout(s.api)).rejects.toThrow('lost');
    expect(await checkout(s.api)).toContain('cs_1');expect(s.created()).toBe(1);
    expect(await checkout(s.api,'annual')).toContain('cs_2');expect([...s.sessions.values()][0].status).toBe('expired');
  });
  it('refuses ambiguous attempts older than the Stripe key retention window',async()=>{
    const s=fakeStripe();s.loseNextResponse();await expect(checkout(s.api)).rejects.toThrow();
    await db.exec(`update public.billing_checkout_operations set operation=jsonb_set(operation,'{createdAt}','0');`);
    await expect(checkout(s.api)).rejects.toThrow('reconciliation');expect(s.created()).toBe(1);
  });
  it.each(['active','past_due','unpaid','incomplete','paused','trialing'])('routes %s subscriptions to billing management',async status=>{
    const s=fakeStripe();s.subscriptions.set('sub_1',subscription(status));
    await db.exec(`update public.memberships set stripe_customer_id='cus_1',stripe_subscription_id='sub_1',billing_mode='test';`);
    await expect(checkout(s.api)).rejects.toThrow('Manage billing');expect(s.created()).toBe(0);
  });
  it('allows resubscription only after the prior subscription is terminal',async()=>{
    const s=fakeStripe();await checkout(s.api);
    Object.assign([...s.sessions.values()][0],{status:'complete',subscription:'sub_1'});
    s.subscriptions.set('sub_1',subscription('canceled'));
    await db.exec(`update public.memberships set stripe_subscription_id='sub_1';`);
    expect(await checkout(s.api,'annual')).toContain('cs_2');
  });
  it('fails closed when disabled, unverified, or attached to live billing',async()=>{
    const s=fakeStripe();await db.exec('update public.billing_runtime set checkout_enabled=false');
    await expect(checkout(s.api)).rejects.toThrow();
    await db.exec('update public.billing_runtime set checkout_enabled=true');
    await expect(openCheckout(adapter,s.api,{...user,email_confirmed_at:undefined},'monthly','price_month','https://trainwell.win')).rejects.toThrow('Verify');
    await db.exec(`update public.memberships set billing_mode='live';`);
    await expect(checkout(s.api)).rejects.toThrow();expect(s.created()).toBe(0);
  });
});

describe('authoritative event reconciliation',()=>{
  it('recognizes Portal cancel_at and caps access at an earlier scheduled cancellation',()=>{
    const sub=subscription();
    const end=sub.items.data[0].current_period_end;
    const scheduled=subscriptionPatch({...sub,cancel_at:end},['price_month'],['price_year']);
    expect(scheduled.cancel_at_period_end).toBe(true);
    expect(scheduled.status).toBe('active');
    const earlier=subscriptionPatch({...sub,cancel_at:end-86400},['price_month'],['price_year']);
    expect(earlier.current_period_end).toBe(new Date((end-86400)*1000).toISOString());
    expect(subscriptionPatch({...sub,cancel_at:end+86400},['price_month'],['price_year']).cancel_at_period_end).toBe(false);
  });
  beforeEach(async()=>{await db.exec(`update public.memberships set stripe_customer_id='cus_1',stripe_subscription_id='sub_1',billing_mode='test';`);});
  it('an invoice arriving first populates the complete subscription period',async()=>{
    const s=fakeStripe();s.subscriptions.set('sub_1',subscription());
    await reconcile(s.api,event('evt_invoice','invoice.paid',{customer:'cus_1',parent:{type:'subscription_details',subscription_details:{subscription:'sub_1'}}}));
    expect((await member()).status).toBe('active');expect((await member()).current_period_end).not.toBeNull();
    const stale=subscription('past_due');await reconcile(s.api,event('evt_old','customer.subscription.updated',stale));
    expect((await member()).status).toBe('active');
  });
  it('handles duplicates atomically and retries concurrent deliveries',async()=>{
    const s=fakeStripe();s.subscriptions.set('sub_1',subscription());
    const e=event('evt_1','customer.subscription.updated',subscription());
    await Promise.allSettled([reconcile(s.api,e),reconcile(s.api,e)]);await reconcile(s.api,e);
    expect((await db.query<{n:number}>('select count(*)::int as n from billing_audit_log')).rows[0].n).toBe(1);
  });
  it('ignores unrelated invoices and rejects unknown subscriptions or owners',async()=>{
    const s=fakeStripe();await reconcile(s.api,event('evt_1','invoice.paid',{customer:'cus_1'}));
    expect((await member()).status).toBe('trial');
    s.subscriptions.set('sub_other',subscription('active','price_year','sub_other'));
    await expect(reconcile(s.api,event('evt_2','invoice.paid',{customer:'cus_1',subscription:'sub_other'}))).rejects.toThrow('Unexpected');
    s.subscriptions.set('sub_1',{...subscription(),customer:'cus_other'});
    await expect(reconcile(s.api,event('evt_3','customer.subscription.updated',subscription()))).rejects.toThrow('ownership');
  });
  it('acknowledges events for deleted or unrelated customers without changing membership',async()=>{
    const s=fakeStripe();
    const before=await member();
    await reconcile(s.api,event('evt_unrelated','invoice.paid',{customer:'cus_unrelated',subscription:'sub_unrelated'}));
    expect(await member()).toEqual(before);
    expect((await db.query('select * from billing_events')).rows).toHaveLength(0);
  });
  it('unknown prices and missing periods cannot leave active access',async()=>{
    const s=fakeStripe();s.subscriptions.set('sub_1',subscription('active','price_unknown'));
    await db.exec(`update memberships set status='active',plan='monthly',current_period_end=now()+interval '30 days';`);
    await reconcile(s.api,event('evt_1','customer.subscription.updated',subscription()));
    expect((await member()).status).toBe('expired');
    const broken=subscription();delete (broken.items.data[0] as {current_period_end?:number}).current_period_end;
    s.subscriptions.set('sub_1',broken);await reconcile(s.api,event('evt_2','customer.subscription.updated',broken));
    expect((await member()).status).toBe('expired');
  });
  it('failure revokes access, recovery restores it, cancellation keeps access only through the valid period',async()=>{
    const s=fakeStripe();s.subscriptions.set('sub_1',subscription('past_due'));
    await reconcile(s.api,event('evt_fail','invoice.payment_failed',{customer:'cus_1',subscription:'sub_1'}));expect((await member()).status).toBe('past_due');
    s.subscriptions.set('sub_1',{...subscription(),cancel_at_period_end:true});
    await reconcile(s.api,event('evt_paid','invoice.paid',{customer:'cus_1',subscription:'sub_1'}));expect((await member()).status).toBe('active');expect((await member()).cancel_at_period_end).toBe(true);
    s.subscriptions.set('sub_1',subscription('canceled'));
    await reconcile(s.api,event('evt_end','customer.subscription.deleted',subscription('canceled')));expect((await member()).status).toBe('canceled');
  });
});

describe('database entitlement and fencing',()=>{
  it('requires finite current access in the matching mode, while preserving trial timing',async()=>{
    expect((await db.query<{has_access:boolean}>('select * from get_my_entitlement()')).rows[0].has_access).toBe(true);
    await db.exec(`update memberships set status='active',plan='monthly',billing_mode='test';`);
    expect((await db.query<{has_access:boolean}>('select * from get_my_entitlement()')).rows[0].has_access).toBe(false);
    await db.exec(`update memberships set current_period_end=now()+interval '30 days';`);
    expect((await db.query<{has_access:boolean}>('select * from get_my_entitlement()')).rows[0].has_access).toBe(true);
    await db.exec(`update billing_runtime set mode='live';`);
    expect((await db.query<{has_access:boolean}>('select * from get_my_entitlement()')).rows[0].has_access).toBe(false);
  });
  it('blocks stale writers and rolls back state when the event transaction fails',async()=>{
    const first=crypto.randomUUID(),second=crypto.randomUUID();
    await db.query('select claim_billing_lock($1,$2)',[userId,first]);
    await db.exec(`update billing_locks set expires_at=now()-interval '1 second';`);
    expect((await db.query<{renew_billing_lock:boolean}>('select renew_billing_lock($1,$2)',[userId,first])).rows[0].renew_billing_lock).toBe(false);
    await db.query('select claim_billing_lock($1,$2)',[userId,second]);
    expect((await db.query<{renew_billing_lock:boolean}>('select renew_billing_lock($1,$2)',[userId,second])).rows[0].renew_billing_lock).toBe(true);
    await expect(db.query('select apply_billing_state($1,$2,$3)',[userId,first,'{"status":"expired"}'])).rejects.toThrow('expired');
    await expect(db.query('select apply_billing_state($1,$2,$3,null,$4)',[userId,second,'{"status":"expired"}','{"id":"evt_live","type":"invoice.paid","livemode":true}'])).rejects.toThrow('Live');
    expect((await member()).status).toBe('trial');
  });
  it('prevents members from changing billing switches, leases or entitlements',async()=>{
    await db.exec('set role authenticated');
    for(const sql of ['select * from billing_runtime','select * from billing_checkout_operations',`select claim_billing_lock('${userId}',gen_random_uuid())`,`update memberships set status='active'`]) {
      await expect(db.exec(sql)).rejects.toThrow('permission denied');
    }
    expect((await db.query<{has_access:boolean}>('select * from get_my_entitlement()')).rows).toHaveLength(1);
  });
});

it('supports legacy invoice IDs, rejects an unrelated modern parent, and maps historical prices explicitly',()=>{
  expect(invoiceSubscription({subscription:'sub_legacy'})).toBe('sub_legacy');
  expect(invoiceSubscription({parent:{type:'quote_details'},subscription:'sub_legacy'})).toBeNull();
  expect(subscriptionPatch(subscription('active','old_month'),['old_month'],['old_year']).plan).toBe('monthly');
  expect(()=>subscriptionPatch({...subscription(),livemode:true},['price_month'],['price_year'])).toThrow('Live');
});


describe('live daily billing', () => {
  it('uses live idempotency keys and charges the daily plan only once across retries', async () => {
    await db.exec("update billing_runtime set mode='live'");
    const s = fakeStripe(true);
    s.loseNextResponse();
    await expect(checkout(s.api, 'daily')).rejects.toThrow('lost');
    await checkout(s.api, 'daily');
    expect(s.created()).toBe(1);
    expect([...s.sessions.keys()][0]).toContain('trainwell:live:checkout:');
    expect((await member()).billing_mode).toBe('live');
    const session = [...s.sessions.values()][0];
    expect(JSON.stringify(session)).toContain('renews automatically');
    expect(JSON.stringify(session)).not.toContain('No real money');
    expect(session.line_items).toEqual([{price:'price_day',quantity:1}]);
    await checkout(s.api, 'monthly');
    expect(session.status).toBe('expired');
  });
  it('refuses test objects in live checkout', async () => {
    await db.exec("update billing_runtime set mode='live'");
    await expect(checkout(fakeStripe().api, 'daily')).rejects.toThrow('mismatch');
    expect((await member()).stripe_customer_id).toBeNull();
  });
  it('keeps daily live entitlement through its paid boundary and records a live audit', async () => {
    await db.exec("update billing_runtime set mode='live'");
    const s=fakeStripe(true);
    await checkout(s.api,'daily');
    const operation=(await db.query<{operation:{id:string}}>('select operation from billing_checkout_operations')).rows[0].operation;
    const sub={...subscription('active','price_day'),livemode:true,
      metadata:{supabase_user_id:userId,billing_operation:operation.id},
      items:{data:[{quantity:1,price:{id:'price_day'},current_period_start:Math.floor(Date.now()/1000),current_period_end:Math.floor(Date.now()/1000)+86400}]}};
    s.subscriptions.set('sub_1',sub);
    await reconcile(s.api,{...event('evt_live','customer.subscription.created',sub),livemode:true});
    expect((await member()).plan).toBe('daily');
    expect((await member()).billing_mode).toBe('live');
    expect((await db.query<{has_access:boolean}>('select * from get_my_entitlement()')).rows[0].has_access).toBe(true);
    expect((await db.query<{livemode:boolean}>('select livemode from billing_events')).rows[0].livemode).toBe(true);
    await expect(reconcile(s.api,event('evt_test','customer.subscription.updated',sub))).rejects.toThrow('mismatch');
    await db.exec("update memberships set current_period_end=now()-interval '1 second'");
    expect((await db.query<{has_access:boolean}>('select * from get_my_entitlement()')).rows[0].has_access).toBe(false);
  });
  it('archives demo identities and operations without extending the original trial', async () => {
    const s=fakeStripe(); await checkout(s.api);
    const before=await member();
    await db.exec("update memberships set plan='monthly',status='active',current_period_end=now()+interval '1 year'; update billing_runtime set checkout_enabled=false;");
    await db.exec('select activate_live_billing()');
    const after=await member();
    expect(after.trial_ends_at).toEqual(before.trial_ends_at);
    expect(after.plan).toBe('trial');expect(after.stripe_customer_id).toBeNull();
    expect((await db.query('select * from billing_mode_archive')).rows).toHaveLength(1);
    expect((await db.query('select * from billing_checkout_operations')).rows).toHaveLength(0);
    expect((await db.query<{checkout_enabled:boolean}>('select * from billing_runtime')).rows[0].checkout_enabled).toBe(false);
    await db.exec('select activate_live_billing()');
  });
});
