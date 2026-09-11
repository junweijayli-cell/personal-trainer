'use client';

import { LanguageSwitch, type Language } from './landing-auth';
import type { BillingNotice, CheckoutConfirmation } from './billing-client';

export default function PaymentConfirmation({ language, onLanguageChange, receipt, notice, accessReady, busy, message,
  onRetry, onContinue, onAccount, onManageBilling }: {
  language: Language; onLanguageChange: (language: Language) => void;
  receipt: CheckoutConfirmation | null; notice: BillingNotice; accessReady: boolean; busy: boolean; message: string;
  onRetry: () => void; onContinue: () => void; onAccount: () => void; onManageBilling: () => void;
}) {
  const tr = (en: string, zh: string) => language === 'zh' ? zh : en;
  const paid = receipt?.status === 'confirmed';
  const checking = notice === 'pending' || notice === 'none';
  const demo = receipt?.mode === 'test';
  const plans = { daily: tr('Daily membership', '日付会员'), monthly: tr('Monthly membership', '月付会员'), annual: tr('Annual membership', '年付会员') };
  return <main className="payment-shell">
    <header><button className="wordmark" type="button" onClick={onAccount}><span>T</span>{tr('TrainWell', '悦练')}</button><LanguageSwitch language={language} onChange={onLanguageChange} /></header>
    <section className="payment-card" aria-labelledby="payment-title">
      <div className={`payment-symbol${paid ? ' paid' : ''}`} aria-hidden="true">{paid ? '✓' : checking ? '…' : '↻'}</div>
      <p className="kicker">{demo ? tr('DEMO CHECKOUT', '演示支付') : tr('YOUR MEMBERSHIP', '你的会员')}</p>
      <h1 id="payment-title">{paid ? demo ? tr('Demo payment complete', '演示付款完成') : tr('Thank you for your payment', '感谢你的付款')
        : checking ? tr('Confirming your payment', '正在确认付款') : tr('Let’s check your payment', '请确认付款状态')}</h1>
      <p role="status">{paid ? accessReady
        ? tr('Your membership is ready. Thank you for training with TrainWell.', '你的会员已开通，感谢你选择悦练。')
        : tr('Your payment was received. We’re still updating your membership. Please check again shortly; you don’t need to pay again.', '已收到付款，正在更新会员状态。请稍后再次查看，无需重复付款。')
        : checking ? tr('Please wait while we securely verify your checkout.', '正在安全核实你的付款，请稍候。')
        : tr('We couldn’t confirm a completed payment yet. Check again or contact support before trying another payment.', '暂时无法确认付款已完成。请再次查看，或联系支持后再尝试付款。')}</p>
      {paid && <>
        <dl className="payment-details"><div><dt>{tr('Membership', '会员方案')}</dt><dd>{plans[receipt.plan]}</dd></div>
          <div><dt>{demo ? tr('Demo amount', '演示金额') : tr('Amount paid', '实付金额')}</dt><dd>US${(receipt.amount / 100).toFixed(2)}</dd></div></dl>
        <p className="payment-note">{demo ? tr('Test membership only. No real money was charged.', '仅为测试会员，未收取真实款项。')
          : tr('Your subscription renews automatically until canceled. View invoices or cancel renewal in Manage billing.', '订阅将自动续费，直至取消。可在“管理账单”中查看账单或取消续订。')}</p>
      </>}
      <div className="payment-actions">
        {paid && accessReady ? <button className="payment-primary" type="button" onClick={onContinue}>{tr('Continue training', '开始训练')} <span aria-hidden="true">→</span></button>
          : <button className="payment-primary" type="button" onClick={onRetry} disabled={checking}>{checking ? tr('Checking…', '正在确认…') : tr('Check payment status', '查看付款状态')}</button>}
        {paid && accessReady && <button type="button" disabled={busy} onClick={onManageBilling}>{tr('Manage billing & invoices', '管理账单与发票')}</button>}
        <button type="button" onClick={onAccount}>{tr('Back to account', '返回账户')}</button>
      </div>
      {message && <p role="alert">{message}</p>}
      <p className="payment-support">{tr('Need help?', '需要帮助？')} <a href="mailto:trainwell.win@gmail.com">trainwell.win@gmail.com</a></p>
    </section>
  </main>;
}
