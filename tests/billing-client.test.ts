import { describe,expect,it } from 'vitest';
import { approvedCatalogPlans,readBillingReturn,refreshBillingMembership,runBillingAction,secureStripeUrl } from '../app/billing-client';
import type { MemberAccount } from '../app/account-types';
const member={userId:'one',membership:{status:'active',plan:'monthly',billingMode:'test',hasAccess:true,currentPeriodEnd:'2030-01-01T00:00:00Z',serverNow:'2026-09-07T00:00:00Z'}} as MemberAccount;
describe('billing client boundaries',()=>{
  it('rejects unsafe redirects and ambiguous return parameters',()=>{
    for(const url of ['http://checkout.stripe.com/x','https://checkout.stripe.com.evil.test/x','https://evil.test','https://user@checkout.stripe.com/x']) expect(()=>secureStripeUrl(url,'checkout')).toThrow();
    expect(secureStripeUrl('https://checkout.stripe.com/c/pay/test','checkout')).toContain('stripe.com');
    expect(readBillingReturn('?billing=success&billing=canceled')).toBeNull();
    expect(readBillingReturn('?billing=success')).toBe('success');
  });
  it('only exposes enabled, correctly priced test plans',()=>{
    const catalog={market:'global',mode:'test',enabled:true,plans:[{plan:'monthly',currency:'usd',unitAmount:1000,recurring:'month'}]};
    expect(approvedCatalogPlans(catalog,'global')).toEqual(['monthly']);
    expect(approvedCatalogPlans({...catalog,mode:'live',plans:[{plan:'daily',currency:'usd',unitAmount:100,recurring:'day'}]},'global')).toEqual(['daily']);
    for(const patch of [{mode:'unknown'},{enabled:false},{plans:[{...catalog.plans[0],unitAmount:500}]}]) expect(()=>approvedCatalogPlans({...catalog,...patch},'global')).toThrow();
  });
  it('keeps a new account action locked when an old account request settles',async()=>{
    const lock={current:false,generation:0};let finish!:()=>void;
    const first=runBillingAction(lock,()=>new Promise<void>(resolve=>{finish=resolve;}));
    expect(await runBillingAction(lock,async()=>undefined)).toBe(false);
    lock.generation++;lock.current=false;
    await runBillingAction(lock,async()=>'redirecting');finish();await first;
    expect(lock.current).toBe(true);
  });
  it('never confirms a different account or an unconfirmed server entitlement',async()=>{
    const signal=new AbortController().signal;
    await expect(refreshBillingMembership('other',async()=>member,()=>{throw Error('must not publish');},{signal,requirePaid:true})).rejects.toThrow('changed');
    expect(await refreshBillingMembership('one',async()=>({...member,membership:{...member.membership,hasAccess:false}}),()=>undefined,{signal,requirePaid:true,attempts:1})).toBe('unconfirmed');
    expect(await refreshBillingMembership('one',async()=>member,()=>undefined,{signal,requirePaid:true})).toBe('confirmed');
  });
  it('aborts late membership responses without publishing them',async()=>{
    const controller=new AbortController();let finish!:(value:MemberAccount)=>void;let published=false;
    const waiting=refreshBillingMembership('one',()=>new Promise<MemberAccount>(resolve=>{finish=resolve;}),()=>{published=true;},{signal:controller.signal});
    controller.abort();finish(member);expect(await waiting).toBe('aborted');expect(published).toBe(false);
  });
});
