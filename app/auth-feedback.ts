type AuthAction = 'signin' | 'email' | 'reset';

const messages = {
  en: {
    unavailable: 'TrainWell account services are temporarily unavailable. Please try again shortly. If this continues, contact trainwell.win@gmail.com.',
    network: 'Unable to reach TrainWell account services. Check your connection and try again. If this continues, contact trainwell.win@gmail.com.',
    credentials: 'The email or password is incorrect. Try again or use Forgot password.',
    captcha: 'The security check expired or failed. Complete the new security check and try again.',
    rate: 'Too many attempts. Please wait at least 60 seconds before trying again.',
    expired: 'This reset link has expired or is unavailable. Request a new reset email and open its link in the same browser.',
    email: 'We could not request an email right now. Please try again shortly or contact trainwell.win@gmail.com.',
    signin: 'We could not complete sign-in. Please try again or contact trainwell.win@gmail.com.',
    reset: 'We could not update your password. Please try again or request a new reset email.',
  },
  zh: {
    unavailable: '悦练账户服务暂时不可用，请稍后重试。如果问题持续，请联系 trainwell.win@gmail.com。',
    network: '无法连接悦练账户服务，请检查网络后重试。如果问题持续，请联系 trainwell.win@gmail.com。',
    credentials: '邮箱或密码不正确，请重试或选择“忘记密码”。',
    captcha: '安全验证已过期或失败，请完成新的安全验证后重试。',
    rate: '尝试次数过多，请至少等待 60 秒后重试。',
    expired: '重置链接已过期或不可用，请重新申请重置邮件，并在同一浏览器中打开链接。',
    email: '暂时无法请求发送邮件。请稍后重试或联系 trainwell.win@gmail.com。',
    signin: '暂时无法完成登录，请重试或联系 trainwell.win@gmail.com。',
    reset: '暂时无法更新密码，请重试或重新申请重置邮件。',
  },
};

// Preserve provider error codes, but never show raw provider details or disclose
// whether a password-reset email belongs to an existing account.
export function authFeedback(error: unknown, language: 'en' | 'zh', action: AuthAction): string {
  const text = messages[language];
  const value = error && typeof error === 'object' ? error as { code?: string; status?: number; name?: string } : {};
  if (value.code === 'captcha_failed') return text.captcha;
  if (value.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(value.code ?? '')) return text.rate;
  if (action === 'signin' && value.code === 'invalid_credentials') return text.credentials;
  if (action === 'reset' && ['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'bad_code_verifier', 'session_not_found'].includes(value.code ?? '')) return text.expired;
  if (value.name === 'AuthSessionMissingError' && action === 'reset') return text.expired;
  if ((value.status ?? 0) >= 500) return action === 'email' ? text.email : text.unavailable;
  if (value.name === 'AuthRetryableFetchError' || value.name === 'TypeError' || value.name === 'TimeoutError' || value.name === 'AbortError' || value.status === 0) return text.network;
  return text[action];
}
