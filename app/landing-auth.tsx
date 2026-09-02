'use client';

import { useMemo, useState } from 'react';
import type { MemberAccount } from './account-types';
import {
  isSecureBackendConfigured,
  requestPasswordReset,
  resendSignupCode,
  signInAccount,
  signUpAccount,
  updatePassword,
  verifySignup,
} from './account-service';
import Turnstile from './turnstile';
import { market } from './supabase-client';

export type Language = 'en' | 'zh';
type AuthMode = 'closed' | 'signup' | 'signin' | 'verify' | 'forgot' | 'reset';

const copy = {
  en: {
    navHow: 'How it works', navBenefits: 'What you get', navPricing: 'Pricing', signIn: 'Sign in', cta: 'Start 7-day free trial',
    eyebrow: 'YOUR NEXT RIGHT MOVE', heroA: 'Train with clarity.', heroB: 'Move with confidence.',
    heroCopy: 'A complete workout for today, clear human movement guides, equipment-aware plans, and private camera coaching—all in your pocket.',
    noCharge: 'No card today · Choose a plan after your trial', stat1: '3-step guides', stat2: 'Private camera', stat3: 'Your weekly plan',
    phoneKicker: 'TODAY · LEGS', phoneTitle: 'Strong legs. Zero guesswork.', phoneMeta: '20 MIN · 5 MOVES · BARBELL + BENCH', phoneButton: 'Start workout',
    howKicker: 'BUILT FOR REAL LIFE', howTitle: 'Open. Choose. Train.',
    step1: 'Tell Relay what you have', step1c: 'Pick your focus, available equipment, and time.',
    step2: 'See every movement clearly', step2c: 'Watch a consistent full-body coach video, then inspect the three key positions.',
    step3: 'Build momentum', step3c: 'Log workouts, wellness, and your weekly schedule in one secure account.',
    trialKicker: 'MEMBERSHIP', trialTitle: 'Seven days to feel the difference.', trialCopy: 'Explore the complete product free. After your trial, choose monthly or annual access. No card is required to begin.',
    monthly: 'Monthly', annual: 'Annual', bestValue: 'BEST VALUE', priceTbd: 'Price coming soon', planMonthly: 'Flexible month-to-month access', planAnnual: 'Best value for consistent training', startTrial: 'Start free trial',
    footer: 'TRAIN WITH CLARITY', private: 'PRIVATE BY DESIGN',
    createTitle: 'Create your Relay account', createCopy: 'Your seven-day trial starts after your email is verified.', name: 'Name', email: 'Email address', password: 'Create password', confirm: 'Confirm password',
    passwordHelp: 'Use 10+ characters with upper and lowercase letters and a number.', consent: 'I agree to the Terms, Privacy Policy, and processing of my training data.', continue: 'Send verification code', haveAccount: 'Already have an account?', signInTitle: 'Welcome back', signInCopy: 'Sign in to continue your training plan.', noAccount: 'New to Relay?', createAccount: 'Create account',
    verifyTitle: 'Check your email', verifyCopy: 'Enter the six-digit verification code sent to', code: 'Verification code', verify: 'Verify & start trial', resend: 'Send a new code', editEmail: 'Use another email', sentAgain: 'A new code was sent. Please allow up to one minute.',
    required: 'Please complete every field.', invalidEmail: 'Enter a valid email address.', weakPassword: 'Use 10+ characters with upper and lowercase letters and a number.', mismatch: 'Passwords do not match.', agree: 'Please accept the terms and privacy notice.', badLogin: 'Email or password is incorrect.', genericError: 'Something went wrong. Please try again.',
    forgot: 'Forgot password?', forgotTitle: 'Reset your password', forgotCopy: 'Enter your account email. If it exists, Relay will send a secure reset link.', sendReset: 'Send reset email', resetSent: 'If that address has an account, a reset email is on its way.', resetTitle: 'Choose a new password', resetCopy: 'Create a new password for your Relay account.', savePassword: 'Save new password', resetDone: 'Password updated. You can now continue securely.',
    unavailableTitle: 'Secure accounts are being connected', unavailableCopy: 'This deployment has not been linked to its Supabase project yet. Training previews remain available, but creating an account is temporarily disabled.',
  },
  zh: {
    navHow: '使用方法', navBenefits: '产品功能', navPricing: '价格', signIn: '登录', cta: '开始 7 天免费试用',
    eyebrow: '找到今天最正确的一步', heroA: '清晰训练。', heroB: '自信行动。',
    heroCopy: '每天完整训练计划、清楚真人动作示范、器械定制与本地隐私摄像指导，全部放在你的手机里。',
    noCharge: '今天无需绑卡 · 试用结束后再选择方案', stat1: '三步动作指导', stat2: '隐私摄像指导', stat3: '每周训练计划',
    phoneKicker: '今天 · 腿部', phoneTitle: '练强双腿。无需猜测。', phoneMeta: '20 分钟 · 5 个动作 · 杠铃 + 训练凳', phoneButton: '开始训练',
    howKicker: '为真实生活而设计', howTitle: '打开。选择。训练。',
    step1: '告诉 Relay 你有什么', step1c: '选择训练部位、可用器械与时间。',
    step2: '看清每一个动作', step2c: '先看完整全身动作视频，再查看准备、动作与完成三个关键姿势。',
    step3: '持续积累进步', step3c: '用一个安全账户记录训练、健康状态与每周安排。',
    trialKicker: '会员方案', trialTitle: '七天，感受真正的改变。', trialCopy: '免费体验完整产品。试用结束后可选择月付或年付，开始试用无需绑卡。',
    monthly: '月付', annual: '年付', bestValue: '最超值', priceTbd: '价格即将公布', planMonthly: '灵活的按月使用方式', planAnnual: '长期坚持训练的最佳价值', startTrial: '开始免费试用',
    footer: '清晰训练', private: '隐私优先设计',
    createTitle: '创建 Relay 账户', createCopy: '邮箱验证后即开始七天免费试用。', name: '姓名', email: '邮箱地址', password: '创建密码', confirm: '确认密码',
    passwordHelp: '至少 10 个字符，并包含大小写字母和数字。', consent: '我同意《使用条款》《隐私政策》及处理我的训练数据。', continue: '发送验证码', haveAccount: '已经有账户？', signInTitle: '欢迎回来', signInCopy: '登录后继续你的训练计划。', noAccount: '第一次使用 Relay？', createAccount: '创建账户',
    verifyTitle: '查看你的邮箱', verifyCopy: '输入发送到以下邮箱的六位验证码：', code: '验证码', verify: '验证并开始试用', resend: '重新发送验证码', editEmail: '更换邮箱', sentAgain: '新的验证码已发送，请等待最多一分钟。',
    required: '请完整填写所有字段。', invalidEmail: '请输入有效的邮箱地址。', weakPassword: '密码至少 10 个字符，并包含大小写字母和数字。', mismatch: '两次输入的密码不一致。', agree: '请先同意条款与隐私说明。', badLogin: '邮箱或密码不正确。', genericError: '出现问题，请重试。',
    forgot: '忘记密码？', forgotTitle: '重置密码', forgotCopy: '输入账户邮箱。如果账户存在，Relay 会发送安全重置链接。', sendReset: '发送重置邮件', resetSent: '如果此邮箱存在账户，重置邮件正在发送。', resetTitle: '设置新密码', resetCopy: '为你的 Relay 账户创建新密码。', savePassword: '保存新密码', resetDone: '密码已更新，你现在可以安全继续使用。',
    unavailableTitle: '安全账户服务正在连接', unavailableCopy: '此部署尚未连接 Supabase 项目。你仍可查看训练介绍，但暂时无法创建账户。',
  },
};

const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;

export default function LandingAuth({ language, onLanguageChange, onAuthenticated, initialMode }: {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onAuthenticated: (member: MemberAccount) => void;
  initialMode?: 'reset';
}) {
  const text = copy[language];
  const [mode, setMode] = useState<AuthMode>(initialMode ?? 'closed');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const configured = isSecureBackendConfigured();
  const emailValid = /^\S+@\S+\.\S+$/.test(email);
  const passwordValid = password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
  const passwordScore = useMemo(() => [password.length >= 10, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length, [password]);

  function openAuth(next: 'signup' | 'signin' | 'forgot') {
    setMode(next); setError(''); setNotice(''); setEnteredCode(''); setCaptchaToken('');
  }

  async function startSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!name || !email || !password || !confirmPassword) return setError(text.required);
    if (!emailValid) return setError(text.invalidEmail);
    if (!passwordValid) return setError(text.weakPassword);
    if (password !== confirmPassword) return setError(text.mismatch);
    if (!accepted) return setError(text.agree);
    if (!configured) return setError(text.unavailableCopy);
    setBusy(true); setError('');
    try {
      await signUpAccount({ email, password, displayName: name, locale: language, captchaToken: captchaToken || undefined });
      setEnteredCode(''); setMode('verify');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : text.genericError);
    } finally { setBusy(false); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (enteredCode.length !== 6) return setError(text.required);
    setBusy(true); setError('');
    try { onAuthenticated(await verifySignup(email, enteredCode)); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : text.genericError); }
    finally { setBusy(false); }
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!email || !password) return setError(text.required);
    if (!configured) return setError(text.unavailableCopy);
    setBusy(true); setError('');
    try { onAuthenticated(await signInAccount(email, password, captchaToken || undefined)); }
    catch { setError(text.badLogin); }
    finally { setBusy(false); }
  }

  async function forgotPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!emailValid) return setError(text.invalidEmail);
    setBusy(true); setError('');
    try { await requestPasswordReset(email, captchaToken || undefined); }
    catch { /* Keep account existence private. */ }
    finally { setNotice(text.resetSent); setBusy(false); }
  }

  async function saveNewPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordValid) return setError(text.weakPassword);
    if (password !== confirmPassword) return setError(text.mismatch);
    setBusy(true); setError('');
    try {
      await updatePassword(password);
      setNotice(text.resetDone);
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : text.genericError); }
    finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true); setError('');
    try {
      await resendSignupCode(email, captchaToken || undefined);
      setNotice(text.sentAgain);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : text.genericError); }
    finally { setBusy(false); }
  }

  return (
    <main className="landing-shell">
      <header className="landing-nav">
        <button className="wordmark" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span>R</span>RELAY</button>
        <nav><a href="#how">{text.navHow}</a><a href="#benefits">{text.navBenefits}</a><a href="#pricing">{text.navPricing}</a></nav>
        <div className="landing-actions"><LanguageSwitch language={language} onChange={onLanguageChange} /><button className="text-button" type="button" onClick={() => openAuth('signin')}>{text.signIn}</button><button className="mini-cta" type="button" onClick={() => openAuth('signup')}>{text.cta}</button></div>
      </header>

      <section className="landing-hero">
        <div className="hero-copy"><p className="kicker"><i /> {text.eyebrow}</p><h1>{text.heroA}<br /><em>{text.heroB}</em></h1><p>{text.heroCopy}</p><button type="button" onClick={() => openAuth('signup')}>{text.cta}<span>→</span></button><small>✓ {text.noCharge}</small><div className="hero-stats"><span><b>01</b>{text.stat1}</span><span><b>02</b>{text.stat2}</span><span><b>03</b>{text.stat3}</span></div></div>
        <div className="hero-device" aria-label="Relay workout preview"><div className="device-top"><span>9:41</span><b>RELAY</b><i>●</i></div><div className="device-copy"><small>{text.phoneKicker}</small><h2>{text.phoneTitle}</h2><p>{text.phoneMeta}</p></div><div className="device-image"><video autoPlay muted loop playsInline controls preload="metadata" poster={asset('/exercises/phase-guides/barbell-squat-middle.webp')} aria-label={language === 'zh' ? '杠铃深蹲完整动作视频' : 'Full-body barbell squat movement video'}><source src={asset('/exercises/videos/barbell-squat.mp4')} type="video/mp4" />{language === 'zh' ? '你的浏览器无法播放此视频。' : 'Your browser cannot play this video.'}</video></div><button type="button" onClick={() => openAuth('signup')}>{text.phoneButton}<span>→</span></button></div>
      </section>

      <section className="landing-steps" id="how"><div className="landing-section-title"><p className="kicker">{text.howKicker}</p><h2>{text.howTitle}</h2></div><div className="step-cards" id="benefits"><article><b>01</b><h3>{text.step1}</h3><p>{text.step1c}</p></article><article><b>02</b><h3>{text.step2}</h3><p>{text.step2c}</p></article><article><b>03</b><h3>{text.step3}</h3><p>{text.step3c}</p></article></div></section>

      <section className="landing-pricing" id="pricing"><div><p className="kicker">{text.trialKicker}</p><h2>{text.trialTitle}</h2><p>{market === 'cn' ? (language === 'zh' ? '免费体验完整产品。试用结束后可选择一次年付获得 365 天使用权限，不会自动续费。' : 'Explore the complete product free. After your trial, one prepaid annual payment unlocks 365 days and does not auto-renew.') : text.trialCopy}</p><button type="button" onClick={() => openAuth('signup')}>{text.startTrial}<span>→</span></button></div><div className={`price-options ${market === 'cn' ? 'single-plan' : ''}`}>{market === 'global' && <article><span>{text.monthly}</span><strong>{text.priceTbd}</strong><p>{text.planMonthly}</p></article>}<article className="annual"><small>{text.bestValue}</small><span>{text.annual}</span><strong>{text.priceTbd}</strong><p>{market === 'cn' ? (language === 'zh' ? '一次付款获得 365 天使用权限' : 'One payment for 365 days of access') : text.planAnnual}</p></article></div></section>
      {!configured && <section className="backend-notice" role="status"><strong>{text.unavailableTitle}</strong><p>{text.unavailableCopy}</p></section>}
      <footer className="landing-footer"><span>RELAY / {text.footer}</span><span>{text.private}</span></footer>

      {mode !== 'closed' && <div className="auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && mode !== 'reset') setMode('closed'); }}><section className="auth-card" role="dialog" aria-modal="true" aria-label={mode === 'signin' ? text.signInTitle : mode === 'verify' ? text.verifyTitle : mode === 'forgot' ? text.forgotTitle : mode === 'reset' ? text.resetTitle : text.createTitle}>{mode !== 'reset' && <button className="auth-close" type="button" onClick={() => setMode('closed')} aria-label="Close">×</button>}<div className="auth-brand"><span>R</span><b>RELAY</b><LanguageSwitch language={language} onChange={onLanguageChange} /></div>
        {mode === 'signup' && <form onSubmit={startSignup}><p className="kicker">7-DAY FREE TRIAL</p><h2>{text.createTitle}</h2><p>{text.createCopy}</p><label><span>{text.name}</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>{text.email}</span><input autoComplete="email" inputMode="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span>{text.password}</span><input autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><div className="password-meter" aria-label="Password strength">{[1,2,3,4,5].map((level) => <i className={passwordScore >= level ? 'active' : ''} key={level} />)}</div><small className="field-help">{text.passwordHelp}</small><label><span>{text.confirm}</span><input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><label className="consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>{text.consent}</span></label><Turnstile onToken={setCaptchaToken} />{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={busy}>{busy ? '…' : text.continue}<span>→</span></button><p className="auth-switch">{text.haveAccount} <button type="button" onClick={() => openAuth('signin')}>{text.signIn}</button></p></form>}
        {mode === 'signin' && <form onSubmit={signIn}><p className="kicker">RELAY MEMBER</p><h2>{text.signInTitle}</h2><p>{text.signInCopy}</p><label><span>{text.email}</span><input autoComplete="email" inputMode="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span>{language === 'zh' ? '密码' : 'Password'}</span><input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><Turnstile onToken={setCaptchaToken} />{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={busy}>{busy ? '…' : text.signIn}<span>→</span></button><button className="forgot-link" type="button" onClick={() => openAuth('forgot')}>{text.forgot}</button><p className="auth-switch">{text.noAccount} <button type="button" onClick={() => openAuth('signup')}>{text.createAccount}</button></p></form>}
        {mode === 'verify' && <form onSubmit={verify}><p className="kicker">EMAIL VERIFICATION</p><h2>{text.verifyTitle}</h2><p>{text.verifyCopy}<br /><strong>{email}</strong></p><label><span>{text.code}</span><input className="code-input" autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={enteredCode} onChange={(event) => setEnteredCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>{notice && <p className="auth-notice" role="status">{notice}</p>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={busy}>{busy ? '…' : text.verify}<span>→</span></button><div className="verify-actions"><button type="button" disabled={busy} onClick={resend}>{text.resend}</button><button type="button" onClick={() => setMode('signup')}>{text.editEmail}</button></div></form>}
        {mode === 'forgot' && <form onSubmit={forgotPassword}><p className="kicker">ACCOUNT RECOVERY</p><h2>{text.forgotTitle}</h2><p>{text.forgotCopy}</p><label><span>{text.email}</span><input autoComplete="email" inputMode="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><Turnstile onToken={setCaptchaToken} />{notice && <p className="auth-notice" role="status">{notice}</p>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={busy}>{busy ? '…' : text.sendReset}<span>→</span></button><p className="auth-switch"><button type="button" onClick={() => openAuth('signin')}>← {text.signIn}</button></p></form>}
        {mode === 'reset' && <form onSubmit={saveNewPassword}><p className="kicker">SECURE PASSWORD RESET</p><h2>{text.resetTitle}</h2><p>{text.resetCopy}</p><label><span>{text.password}</span><input autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label><span>{text.confirm}</span><input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{notice && <p className="auth-notice" role="status">{notice}</p>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={busy}>{busy ? '…' : text.savePassword}<span>→</span></button></form>}
      </section></div>}
    </main>
  );
}

export function LanguageSwitch({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return <div className="language-switch" role="group" aria-label="Language"><button className={language === 'en' ? 'active' : ''} type="button" onClick={() => onChange('en')}>EN</button><button className={language === 'zh' ? 'active' : ''} type="button" onClick={() => onChange('zh')}>中文</button></div>;
}
