import { ANNUAL_SAVING_PERCENT, GLOBAL_PLANS, type BillingPlan } from '../supabase/functions/_shared/billing-policy';

export { ANNUAL_SAVING_PERCENT };

export function globalPriceLabel(plan: BillingPlan, language: 'en' | 'zh') {
  const amount = GLOBAL_PLANS[plan].unitAmount / 100;
  const period = language === 'zh'
    ? (plan === 'daily' ? '天' : plan === 'monthly' ? '月' : '年')
    : (plan === 'daily' ? 'day' : plan === 'monthly' ? 'month' : 'year');
  return `US$${amount} / ${period}`;
}

export function annualSavingLabel(language: 'en' | 'zh') {
  return language === 'zh' ? `比按月付费省 ${ANNUAL_SAVING_PERCENT}%` : `Save ${ANNUAL_SAVING_PERCENT}% vs monthly`;
}
