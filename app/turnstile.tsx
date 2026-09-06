'use client';

import { useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void; 'timeout-callback': () => void; theme: 'light'; size: 'compact' | 'flexible'; language: 'en' | 'zh-CN' }) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';

export default function Turnstile({ onToken, language = 'en' }: { onToken: (token: string) => void; language?: 'en' | 'zh' }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let widgetId = '';
    let cancelled = false;
    const fail = () => {
      if (cancelled) return;
      onToken('');
      setFailed(true);
    };
    const render = () => {
      if (cancelled || !window.turnstile || !container.current || widgetId) return;
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: (token) => { if (!cancelled) { setFailed(false); onToken(token); } },
        'expired-callback': () => onToken(''),
        'error-callback': fail,
        'timeout-callback': fail,
        theme: 'light',
        size: container.current.clientWidth < 300 ? 'compact' : 'flexible',
        language: language === 'zh' ? 'zh-CN' : 'en',
      });
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-relay-turnstile]');
    if (window.turnstile) render();
    else {
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.relayTurnstile = 'true';
        document.head.appendChild(script);
      }
      script.addEventListener('load', render, { once: true });
      script.addEventListener('error', fail, { once: true });
    }
    const timeout = window.setTimeout(() => { if (!widgetId) fail(); }, 15000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      script?.removeEventListener('load', render);
      script?.removeEventListener('error', fail);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken, language, retry]);

  if (!siteKey) return null;
  return <div>
    <div className="turnstile-frame" ref={container} />
    {failed && <div className="auth-error" role="alert">
      <p>{language === 'zh' ? '安全验证未完成。请检查网络连接并重试。' : 'The security check did not finish. Check your connection and try again.'}</p>
      <button type="button" className="text-button" onClick={() => {
        if (!window.turnstile) document.querySelector('script[data-relay-turnstile]')?.remove();
        onToken(''); setFailed(false); setRetry((value) => value + 1);
      }}>{language === 'zh' ? '重试安全验证' : 'Retry security check'}</button>
    </div>}
  </div>;
}
