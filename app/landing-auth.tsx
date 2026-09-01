'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  createDemoMember,
  generateVerificationCode,
  getStoredMember,
  signInDemoMember,
  type DemoMember,
} from './demo-auth';

export type Language = 'en' | 'zh';
type AuthMode = 'closed' | 'signup' | 'signin' | 'verify';

const copy = {
  en: {
    navHow: 'How it works', navBenefits: 'What you get', navPricing: 'Pricing', signIn: 'Sign in', cta: 'Start 7-day free trial',
    eyebrow: 'YOUR NEXT RIGHT MOVE', heroA: 'Train with clarity.', heroB: 'Move with confidence.',
    heroCopy: 'A complete workout for today, clear human movement guides, equipment-aware plans, and private camera coaching—all in your pocket.',
    noCharge: 'No charge today · Cancel anytime when pricing launches', stat1: '3-step guides', stat2: 'Private camera', stat3: 'Your weekly plan',
    phoneKicker: 'TODAY · LEGS', phoneTitle: 'Strong legs. Zero guesswork.', phoneMeta: '20 MIN · 5 MOVES · BARBELL + BENCH', phoneButton: 'Start workout',
    howKicker: 'BUILT FOR REAL LIFE', howTitle: 'Open. Choose. Train.',
    step1: 'Tell Relay what you have', step1c: 'Pick your focus, available equipment, and time.',
    step2: 'See every movement clearly', step2c: 'Follow setup, movement, and finish photos without cropped limbs.',
    step3: 'Build momentum', step3c: 'Log workouts, wellness, and your weekly schedule in one account.',
    trialKicker: 'MEMBERSHIP', trialTitle: 'Seven days to feel the difference.', trialCopy: 'Explore the complete product free. After your trial, choose monthly or annual access. Final prices will be announced before billing begins.',
    monthly: 'Monthly', annual: 'Annual', bestValue: 'BEST VALUE', priceTbd: 'Price coming soon', planMonthly: 'Flexible month-to-month access', planAnnual: 'Best value for consistent training', startTrial: 'Start free trial',
    footer: 'TRAIN WITH CLARITY', private: 'PRIVATE BY DESIGN',
    createTitle: 'Create your Relay account', createCopy: 'Your seven-day trial starts after your email is verified.', name: 'Name', email: 'Email address', password: 'Create password', confirm: 'Confirm password',
    passwordHelp: 'Use at least 8 characters with a letter and a number.', consent: 'I agree to the Terms and Privacy Policy.', continue: 'Send verification code', haveAccount: 'Already have an account?', signInTitle: 'Welcome back', signInCopy: 'Sign in to continue your training plan.', noAccount: 'New to Relay?', createAccount: 'Create account',
    verifyTitle: 'Check your email', verifyCopy: 'Enter the six-digit verification code for', code: 'Verification code', verify: 'Verify & start trial', resend: 'Send a new code', editEmail: 'Use another email',
    demoLabel: 'GITHUB DEMO', demoCopy: 'Email delivery needs a secure auth provider. For this static demo, use the code below:',
    required: 'Please complete every field.', invalidEmail: 'Enter a valid email address.', weakPassword: 'Use at least 8 characters with a letter and a number.', mismatch: 'Passwords do not match.', agree: 'Please accept the terms to continue.', exists: 'An account already exists for this email. Sign in instead.', badCode: 'That code is not correct. Try the demo code shown below.', badLogin: 'Email or password is incorrect.',
  },
  zh: {
    navHow: '使用方法', navBenefits: '产品功能', navPricing: '价格', signIn: '登录', cta: '开始 7 天免费试用',
    eyebrow: '找到今天最正确的一步', heroA: '清晰训练。', heroB: '自信行动。',
    heroCopy: '每天完整训练计划、清楚真人动作示范、器械定制与本地隐私摄像指导，全部放在你的手机里。',
    noCharge: '今天不收费 · 正式定价后可随时取消', stat1: '三步动作指导', stat2: '隐私摄像指导', stat3: '每周训练计划',
    phoneKicker: '今天 · 腿部', phoneTitle: '练强双腿。无需猜测。', phoneMeta: '20 分钟 · 5 个动作 · 杠铃 + 训练凳', phoneButton: '开始训练',
    howKicker: '为真实生活而设计', howTitle: '打开。选择。训练。',
    step1: '告诉 Relay 你有什么', step1c: '选择训练部位、可用器械与时间。',
    step2: '看清每一个动作', step2c: '按照准备、动作、完成三张全身图片练习。',
    step3: '持续积累进步', step3c: '用一个账户记录训练、健康状态与每周安排。',
    trialKicker: '会员方案', trialTitle: '七天，感受真正的改变。', trialCopy: '免费体验完整产品。试用结束后，可选择月付或年付。正式收费前会公布最终价格。',
    monthly: '月付', annual: '年付', bestValue: '最超值', priceTbd: '价格即将公布', planMonthly: '灵活的按月使用方式', planAnnual: '长期坚持训练的最佳价值', startTrial: '开始免费试用',
    footer: '清晰训练', private: '隐私优先设计',
    createTitle: '创建 Relay 账户', createCopy: '邮箱验证后即开始七天免费试用。', name: '姓名', email: '邮箱地址', password: '创建密码', confirm: '确认密码',
    passwordHelp: '至少 8 个字符，并包含字母和数字。', consent: '我同意《使用条款》和《隐私政策》。', continue: '发送验证码', haveAccount: '已经有账户？', signInTitle: '欢迎回来', signInCopy: '登录后继续你的训练计划。', noAccount: '第一次使用 Relay？', createAccount: '创建账户',
    verifyTitle: '查看你的邮箱', verifyCopy: '输入发送到以下邮箱的六位验证码：', code: '验证码', verify: '验证并开始试用', resend: '重新发送验证码', editEmail: '更换邮箱',
    demoLabel: 'GITHUB 演示', demoCopy: '真实邮件发送需要安全的身份验证服务。此静态演示请使用下方验证码：',
    required: '请完整填写所有字段。', invalidEmail: '请输入有效的邮箱地址。', weakPassword: '密码至少 8 个字符，并包含字母和数字。', mismatch: '两次输入的密码不一致。', agree: '请先同意条款与隐私政策。', exists: '此邮箱已经有账户，请直接登录。', badCode: '验证码不正确，请使用下方演示验证码。', badLogin: '邮箱或密码不正确。',
  },
};

const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;

export default function LandingAuth({ language, onLanguageChange, onAuthenticated }: {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onAuthenticated: (member: DemoMember) => void;
}) {
  const text = copy[language];
  const [mode, setMode] = useState<AuthMode>('closed');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const emailValid = /^\S+@\S+\.\S+$/.test(email);
  const passwordValid = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
  const passwordScore = useMemo(() => [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length, [password]);

  function openAuth(next: 'signup' | 'signin') {
    setMode(next); setError(''); setEnteredCode('');
  }

  function startSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!name || !email || !password || !confirmPassword) return setError(text.required);
    if (!emailValid) return setError(text.invalidEmail);
    if (!passwordValid) return setError(text.weakPassword);
    if (password !== confirmPassword) return setError(text.mismatch);
    if (!accepted) return setError(text.agree);
    if (getStoredMember(email)) return setError(text.exists);
    setVerificationCode(generateVerificationCode());
    setEnteredCode(''); setError(''); setMode('verify');
  }

  async function verifySignup(event: React.FormEvent) {
    event.preventDefault();
    if (enteredCode !== verificationCode) return setError(text.badCode);
    setBusy(true);
    try { onAuthenticated(await createDemoMember(email, password, name)); }
    finally { setBusy(false); }
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const member = await signInDemoMember(email, password);
      if (!member) return setError(text.badLogin);
      onAuthenticated(member);
    } finally { setBusy(false); }
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
        <div className="hero-device" aria-label="Relay workout preview"><div className="device-top"><span>9:41</span><b>RELAY</b><i>●</i></div><div className="device-copy"><small>{text.phoneKicker}</small><h2>{text.phoneTitle}</h2><p>{text.phoneMeta}</p></div><div className="device-image"><Image src={asset('/exercises/phase-guides/barbell-squat-middle.webp')} alt="Full-body barbell squat coach" fill sizes="(max-width: 760px) 88vw, 420px" /></div><button type="button" onClick={() => openAuth('signup')}>{text.phoneButton}<span>→</span></button></div>
      </section>

      <section className="landing-steps" id="how"><div className="landing-section-title"><p className="kicker">{text.howKicker}</p><h2>{text.howTitle}</h2></div><div className="step-cards" id="benefits"><article><b>01</b><h3>{text.step1}</h3><p>{text.step1c}</p></article><article><b>02</b><h3>{text.step2}</h3><p>{text.step2c}</p></article><article><b>03</b><h3>{text.step3}</h3><p>{text.step3c}</p></article></div></section>

      <section className="landing-pricing" id="pricing"><div><p className="kicker">{text.trialKicker}</p><h2>{text.trialTitle}</h2><p>{text.trialCopy}</p><button type="button" onClick={() => openAuth('signup')}>{text.startTrial}<span>→</span></button></div><div className="price-options"><article><span>{text.monthly}</span><strong>{text.priceTbd}</strong><p>{text.planMonthly}</p></article><article className="annual"><small>{text.bestValue}</small><span>{text.annual}</span><strong>{text.priceTbd}</strong><p>{text.planAnnual}</p></article></div></section>
      <footer className="landing-footer"><span>RELAY / {text.footer}</span><span>{text.private}</span></footer>

      {mode !== 'closed' && <div className="auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMode('closed'); }}><section className="auth-card" role="dialog" aria-modal="true" aria-label={mode === 'signin' ? text.signInTitle : mode === 'verify' ? text.verifyTitle : text.createTitle}><button className="auth-close" type="button" onClick={() => setMode('closed')} aria-label="Close">×</button><div className="auth-brand"><span>R</span><b>RELAY</b><LanguageSwitch language={language} onChange={onLanguageChange} /></div>
        {mode === 'signup' && <form onSubmit={startSignup}><p className="kicker">7-DAY FREE TRIAL</p><h2>{text.createTitle}</h2><p>{text.createCopy}</p><label><span>{text.name}</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>{text.email}</span><input autoComplete="email" inputMode="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span>{text.password}</span><input autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><div className="password-meter" aria-label="Password strength">{[1,2,3,4].map((level) => <i className={passwordScore >= level ? 'active' : ''} key={level} />)}</div><small className="field-help">{text.passwordHelp}</small><label><span>{text.confirm}</span><input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><label className="consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>{text.consent}</span></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit">{text.continue}<span>→</span></button><p className="auth-switch">{text.haveAccount} <button type="button" onClick={() => openAuth('signin')}>{text.signIn}</button></p></form>}
        {mode === 'signin' && <form onSubmit={signIn}><p className="kicker">RELAY MEMBER</p><h2>{text.signInTitle}</h2><p>{text.signInCopy}</p><label><span>{text.email}</span><input autoComplete="email" inputMode="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span>{language === 'zh' ? '密码' : 'Password'}</span><input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={busy}>{text.signIn}<span>→</span></button><p className="auth-switch">{text.noAccount} <button type="button" onClick={() => openAuth('signup')}>{text.createAccount}</button></p></form>}
        {mode === 'verify' && <form onSubmit={verifySignup}><p className="kicker">EMAIL VERIFICATION</p><h2>{text.verifyTitle}</h2><p>{text.verifyCopy}<br /><strong>{email}</strong></p><label><span>{text.code}</span><input className="code-input" autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={enteredCode} onChange={(event) => setEnteredCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><div className="demo-code"><small>{text.demoLabel}</small><p>{text.demoCopy}</p><strong>{verificationCode}</strong></div>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={busy}>{text.verify}<span>→</span></button><div className="verify-actions"><button type="button" onClick={() => { setVerificationCode(generateVerificationCode()); setEnteredCode(''); setError(''); }}>{text.resend}</button><button type="button" onClick={() => setMode('signup')}>{text.editEmail}</button></div></form>}
      </section></div>}
    </main>
  );
}

export function LanguageSwitch({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return <div className="language-switch" role="group" aria-label="Language"><button className={language === 'en' ? 'active' : ''} type="button" onClick={() => onChange('en')}>EN</button><button className={language === 'zh' ? 'active' : ''} type="button" onClick={() => onChange('zh')}>中文</button></div>;
}
