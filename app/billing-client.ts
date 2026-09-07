import type { MemberAccount, Market } from './account-types';
import { GLOBAL_PLANS, type BillingPlan } from '../supabase/functions/_shared/billing-policy';
import { membershipHasAccess } from './membership';

export type BillingReturn = 'success' | 'canceled' | 'return';
export type BillingNotice = 'none' | 'pending' | 'confirmed' | 'canceled' | 'unconfirmed' | 'refreshed' | 'error';

export function readBillingReturn(search: string): BillingReturn | null {
  const values = new URLSearchParams(search).getAll('billing');
  return values.length === 1 && ['success', 'canceled', 'return'].includes(values[0]) ? values[0] as BillingReturn : null;
}

export function secureStripeUrl(value: unknown, kind: 'checkout' | 'portal') {
  if (typeof value !== 'string') throw new Error('Unsafe billing link.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Unsafe billing link.'); }
  const hostname = kind === 'checkout' ? 'checkout.stripe.com' : 'billing.stripe.com';
  if (url.protocol !== 'https:' || url.hostname !== hostname || url.username || url.password || url.port) {
    throw new Error('Unsafe billing link.');
  }
  return url.href;
}

export function approvedCatalogPlans(value: unknown, expectedMarket: Market): BillingPlan[] {
  const catalog = value as { market?: unknown; plans?: unknown; mode?: unknown; enabled?: unknown } | null;
  if (!catalog || catalog.mode !== 'test' || catalog.enabled !== true || catalog.market !== expectedMarket || !Array.isArray(catalog.plans)) throw new Error('Billing is unavailable.');
  const plans: BillingPlan[] = [];
  for (const item of catalog.plans) {
    if (!item || typeof item !== 'object' || !('plan' in item)) continue;
    const row = item as { plan: unknown; currency: unknown; unitAmount: unknown; recurring: unknown };
    if (row.plan !== 'monthly' && row.plan !== 'annual') continue;
    if (expectedMarket === 'global') {
      const approved = GLOBAL_PLANS[row.plan];
      if (row.currency !== approved.currency || row.unitAmount !== approved.unitAmount || row.recurring !== approved.interval) continue;
    } else if (row.plan !== 'annual' || row.recurring !== null || typeof row.currency !== 'string'
      || !/^[a-z]{3}$/.test(row.currency) || !Number.isSafeInteger(row.unitAmount) || Number(row.unitAmount) <= 0) continue;
    if (!plans.includes(row.plan)) plans.push(row.plan);
  }
  if (!plans.length) throw new Error('Billing is unavailable.');
  return plans;
}

/** Locks synchronously, before React can render disabled buttons. */
export async function runBillingAction(lock: { current: boolean; generation?: number }, action: () => Promise<'redirecting' | void>) {
  if (lock.current) return false;
  lock.current = true;
  const generation = lock.generation;
  let redirecting = false;
  try { redirecting = await action() === 'redirecting'; return true; } finally { if (!redirecting && generation === lock.generation) lock.current = false; }
}

export function billingNoticeText(notice: BillingNotice, language: 'en' | 'zh') {
  const messages: Record<BillingNotice, [string, string]> = {
    none: ['', ''],
    pending: ['Checking your membership with our payment server. Please do not pay again.', '正在向支付服务器确认会员状态，请勿重复付款。'],
    confirmed: ['Your demo membership is confirmed. No real money was charged. You can continue training.', '已确认你的演示会员权限，未收取真实款项，可以继续训练。'],
    canceled: ['Checkout was closed. Your membership has not been changed by this page.', '支付页面已关闭，此页面未更改你的会员权限。'],
    unconfirmed: ['Payment confirmation is still pending. Please do not pay again. Refresh this page shortly, or contact support if it does not update.', '付款仍待确认，请勿重复付款。请稍后刷新页面；若状态仍未更新，请联系支持。'],
    refreshed: ['Your latest membership status has been loaded securely.', '已安全更新你的最新会员状态。'],
    error: ['We could not confirm your membership yet. Please do not pay again; refresh this page to retry.', '暂时无法确认会员状态，请勿重复付款。请刷新页面重试。'],
  };
  return messages[notice][language === 'zh' ? 1 : 0];
}

/** Only backend entitlement responses can confirm access; never a return URL. */
export async function refreshBillingMembership(
  userId: string,
  fetchMember: () => Promise<MemberAccount>,
  onMember: (member: MemberAccount) => void,
  options: { signal: AbortSignal; attempts?: number; delayMs?: number; timeoutMs?: number; requirePaid?: boolean },
): Promise<'confirmed' | 'unconfirmed' | 'aborted' | 'refreshed'> {
  const attempts = Math.min(6, Math.max(1, options.attempts ?? 6));
  const delayMs = options.delayMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 6000;
  const aborted = Symbol('aborted');
  async function bounded<T>(action: () => Promise<T>, timeout: number): Promise<T | typeof aborted> {
    if (options.signal.aborted) return aborted;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: () => void = () => undefined;
    try {
      return await Promise.race([
        action(),
        new Promise<typeof aborted>((resolve, reject) => {
          onAbort = () => resolve(aborted);
          options.signal.addEventListener('abort', onAbort, { once: true });
          timer = setTimeout(() => reject(new Error('Membership refresh timed out.')), timeout);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      options.signal.removeEventListener('abort', onAbort);
    }
  }
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const member = await bounded(fetchMember, timeoutMs);
    if (member === aborted || options.signal.aborted) return 'aborted';
    if (member.userId !== userId) throw new Error('Your account session changed.');
    onMember(member);
    if (!options.requirePaid) return 'refreshed';
    if (member.membership.plan !== 'trial' && membershipHasAccess(member.membership)) return 'confirmed';
    if (attempt < attempts - 1) {
      const waiting = await bounded(() => new Promise<void>((resolve) => setTimeout(resolve, delayMs)), delayMs + 1000);
      if (waiting === aborted) return 'aborted';
    }
  }
  return 'unconfirmed';
}
