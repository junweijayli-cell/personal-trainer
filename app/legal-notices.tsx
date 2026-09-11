'use client';

import { useEffect, useRef } from 'react';
import { globalPriceLabel } from './pricing';

export type LegalDocument = 'terms' | 'privacy';
type Locale = 'en' | 'zh';

const notices = {
  en: {
    terms: {
      title: 'Terms of use',
      introduction: 'Please read these service terms before creating a TrainWell account.',
      sections: [
        ['About this release', 'TrainWell / 悦练 provides fitness guidance, personalized workout plans and training records. These terms apply to your account and the membership plan you select. For service, billing or refund questions, contact trainwell.win@gmail.com.'],
        ['Train safely', 'TrainWell provides general exercise guidance, not medical diagnosis, treatment, or emergency care. Choose movements and equipment appropriate for your ability. Automated camera feedback may be inaccurate and cannot replace professional supervision. Stop if an exercise causes pain, dizziness, or unusual discomfort; seek qualified help when needed.'],
        ['Your account', 'Provide an email address you control, verify it, and keep your password private. You are responsible for the information you enter and for using the service lawfully. Do not use the service to access other people’s accounts or interfere with the system.'],
        ['Trial and subscriptions', `The seven-day free trial begins after email verification, using server time, with no card required. Global subscriptions cost ${globalPriceLabel('daily', 'en')}, ${globalPriceLabel('monthly', 'en')} or ${globalPriceLabel('annual', 'en')}. A paid subscription starts immediately when purchased, including during a free trial. The daily plan charges US$1 every day, the monthly plan US$10 every month, and the annual plan US$60 every year until canceled. Cancel renewal through Account → Manage billing before the next renewal; access remains through the paid period. Checkout displays the amount and any applicable tax before you confirm payment. Creating an account alone does not charge you. Contact trainwell.win@gmail.com for billing or refund questions; applicable consumer rights remain unaffected.`],
        ['After the trial', 'When access expires, new workouts may be locked, but your stored history is retained. Account export and deletion remain available. No subscription or payment is created automatically at the end of the free trial.'],
        ['Availability and regions', 'Internet access is required for account services and synchronization. Availability can vary by network or region. This global service does not promise dependable mainland-China access, a mainland-hosted service, or automatic cross-border account migration.'],
        ['Questions and updates', 'Contact trainwell.win@gmail.com about your account or these notices. Material changes to service or payment terms should be presented before they apply. These notices do not remove rights that applicable law gives you.'],
      ],
    },
    privacy: {
      title: 'Privacy notice',
      introduction: 'This explains what TrainWell uses to provide your account and training features.',
      sections: [
        ['Account and training information', 'Email, display name, language, account verification, membership status, equipment, training preferences, schedules, and workout history are used to operate your account and personalize training. Account authentication and saved account data are handled through Supabase. Your password is not stored in the website’s source code.'],
        ['Optional health information', 'Health-related details such as limitations, body weight, sleep, recovery, meals, and hydration are optional. Saving wellness logs requires a separate health-data consent in the application. The optional training-limitations field is saved with your profile; avoid entering medical diagnoses or other sensitive medical records there. Accepting these account terms is not consent to upload camera footage or a requirement to provide optional health details.'],
        ['Camera privacy', 'Camera access is optional and requires your browser permission. Movement analysis runs on your device; TrainWell does not upload or store raw camera video. Workout summaries may record your use of camera coaching. Do not submit video to support unless you intentionally choose to share it.'],
        ['Where information is stored', 'Saved global account information currently uses the project’s Supabase region in Mumbai. Browser storage is used for your sign-in session and harmless device preferences; account records remain server-backed. No mainland-China data mirror or automatic cross-border synchronization is enabled.'],
        ['Service providers and security', 'Cloudflare provides website hosting and delivery. Cloudflare Turnstile checks browser and technical signals to help prevent automated abuse during account requests. Supabase provides account and database services. The configured Gmail (Google) sender delivers account verification and recovery messages; these are transactional emails, not a marketing subscription.'],
        ['Payment information', 'Stripe hosts secure checkout and billing management. Stripe collects your email, card billing address and payment details, and saves the billing address to your Stripe customer record. TrainWell stores customer, subscription, event and membership records, but does not store your card details or billing address in the app database. Real payments use live Checkout. Any separately labeled sandbox transactions are tests and do not grant live paid membership.'],
        ['Your controls', 'You may update account information, decline optional health collection, deny camera permission, and use the account’s export and deletion controls. Deletion removes the app account and its stored records; provider backups can follow their own retention schedules. Contact support for help with access, export or deletion requests.'],
        ['Privacy contact', 'For access, correction, deletion, or privacy questions, email trainwell.win@gmail.com. Include the email address associated with your account, but do not send your password or card details.'],
      ],
    },
  },
  zh: {
    terms: {
      title: '使用条款',
      introduction: '创建悦练账户前，请阅读以下服务条款。',
      sections: [
        ['关于当前版本', 'TrainWell / 悦练提供健身指导、个性化训练计划及训练记录。本条款适用于你的账户及所选会员方案。服务、账单或退款问题请联系 trainwell.win@gmail.com。'],
        ['安全训练', '悦练提供一般健身指导，不提供医疗诊断、治疗或急救服务。请选择符合自身能力的动作和器械。自动摄像指导可能不准确，不能代替专业人员监督。若出现疼痛、头晕或异常不适，请停止训练，并在需要时寻求合格专业人员帮助。'],
        ['你的账户', '请使用你本人能够控制的邮箱，完成验证并妥善保管密码。你需要对自己填写的信息及合法使用服务负责。请勿访问他人账户或干扰系统运行。'],
        ['试用与订阅', `七天免费试用在邮箱验证成功后开始，以服务器时间计算，无需绑卡。全球版价格为 ${globalPriceLabel('daily', 'zh')}、${globalPriceLabel('monthly', 'zh')} 或 ${globalPriceLabel('annual', 'zh')}。购买后付费周期立即开始，试用期间购买也同样如此。日付每天扣款 US$1，月付每月扣款 US$10，年付每年扣款 US$60，直至取消。请在下次续费前通过账户的管理账单取消续订；使用权限保留至已付费周期结束。支付页面在确认付款前展示金额及适用税费。仅创建账户不会扣款。账单或退款问题请联系 trainwell.win@gmail.com，适用的消费者权利不受影响。`],
        ['试用结束后', '使用权限到期后，新的训练可能会被锁定，但已保存的历史记录会保留。你仍可导出数据或删除账户。免费试用结束时不会自动创建订阅或扣款。'],
        ['可用性与地区', '账户服务与数据同步需要联网。不同网络或地区的可用性可能不同。当前全球预览版不承诺中国大陆网络的稳定访问、本地托管服务或自动跨境账户迁移。'],
        ['咨询与更新', '如有账户或条款问题，请联系 trainwell.win@gmail.com。服务或付款条款的重要变更应在生效前向你说明。本说明不排除适用法律赋予你的权利。'],
      ],
    },
    privacy: {
      title: '隐私说明',
      introduction: '以下说明悦练如何使用信息来提供账户及训练功能。',
      sections: [
        ['账户与训练信息', '邮箱、显示名称、语言、验证信息、会员状态、器械、训练偏好、计划与训练历史，用于提供账户服务和个性化训练。账户身份验证及已保存的账户数据通过 Supabase 处理。你的密码不会存放在网站源代码中。'],
        ['可选健康信息', '身体限制、体重、睡眠、恢复、饮食与饮水等健康信息均为可选。保存健康日志需要在应用中另行同意健康数据处理。可选的训练限制字段会随个人资料保存，请勿在该字段填写医疗诊断或其他敏感病历。接受账户条款不代表同意上传摄像视频，也不代表必须提供可选健康信息。'],
        ['摄像隐私', '摄像功能可自由选择，并需要浏览器权限。动作分析在你的设备上运行；悦练不会上传或保存原始摄像视频。训练摘要可能记录你使用摄像指导的情况。除非你主动选择分享，否则请勿向支持人员发送视频。'],
        ['信息存储位置', '全球账户信息目前存储于该项目的 Supabase 孟买区域。浏览器存储用于登录会话和非敏感设备偏好；账户记录仍以服务器为准。目前未启用中国大陆数据镜像或自动跨境同步。'],
        ['服务提供商与安全', 'Cloudflare 提供网站托管与分发。Cloudflare Turnstile 会检查浏览器及相关技术信号，以防止账户请求遭到自动化滥用。Supabase 提供账户和数据库服务。已配置的 Gmail（Google）发件服务发送账户验证与恢复邮件；这些邮件用于账户事务，不是营销订阅。'],
        ['支付信息', 'Stripe 托管安全支付和账单管理，收集邮箱、银行卡账单地址及支付信息，并将账单地址保存至你的 Stripe 客户记录。悦练保存客户、订阅、事件和会员记录，但不在应用数据库中保存银行卡信息或账单地址。真实付款通过正式支付页面完成，另行标注的沙盒交易属于测试，不会授予正式付费会员权限。'],
        ['你的控制权', '你可以更新账户信息、拒绝可选健康数据收集、拒绝摄像权限，并使用账户中的导出及删除功能。删除操作会移除应用账户和已保存的记录；服务商备份可能遵循其自身保留计划。如需访问、导出或删除数据方面的帮助，请联系支持邮箱。'],
        ['隐私联系方式', '如需访问、更正或删除数据，或有隐私问题，请发送邮件至 trainwell.win@gmail.com。请提供账户关联的邮箱地址，但不要发送密码或银行卡信息。'],
      ],
    },
  },
} as const;

export default function LegalNotices({ document, language, onLanguageChange, onClose }: {
  document: LegalDocument;
  language: Locale;
  onLanguageChange: (language: Locale) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const notice = notices[language][document];
  const closeLabel = language === 'zh' ? '关闭并返回' : 'Close and return';

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = window.document.activeElement as HTMLElement | null;
    if (!dialog) return;
    dialog.showModal();
    titleRef.current?.focus();
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      window.document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="legal-dialog" aria-labelledby="legal-title" aria-describedby="legal-introduction"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <header className="legal-dialog-header">
        <strong>TrainWell</strong>
        <div className="language-switch" role="group" aria-label="Language">
          <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => onLanguageChange('en')}>EN</button>
          <button type="button" className={language === 'zh' ? 'active' : ''} onClick={() => onLanguageChange('zh')}>中文</button>
        </div>
        <button className="legal-close" type="button" aria-label={closeLabel} onClick={onClose}>×</button>
      </header>
      <div className="legal-content">
        <p className="legal-review-note">{language === 'zh' ? '账户、会员与隐私说明' : 'Account, membership and privacy information'}</p>
        <h2 id="legal-title" tabIndex={-1} ref={titleRef}>{notice.title}</h2>
        <p id="legal-introduction">{notice.introduction}</p>
        {notice.sections.map(([heading, body]) => <section key={heading}><h3>{heading}</h3><p>{body}</p></section>)}
        <p><a href="mailto:trainwell.win@gmail.com">trainwell.win@gmail.com</a></p>
      </div>
      <div className="legal-dialog-actions"><button type="button" onClick={onClose}>{closeLabel}</button></div>
    </dialog>
  );
}
