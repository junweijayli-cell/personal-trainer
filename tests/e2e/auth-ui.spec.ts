import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.E2E_AUTH_UI_MOCKS !== 'true', 'Run with tests/auth-ui.playwright.config.ts and its isolated mock services.');

const fakeUser = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'relay-ui-test@example.com',
  app_metadata: {},
  user_metadata: { display_name: 'Relay UI test' },
  created_at: '2026-09-01T00:00:00.000Z',
};

async function mockCaptcha(page: Page, behavior: { failFirst?: boolean; controls?: boolean; missing?: boolean } = {}) {
  let scriptRequests = 0;
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) => {
    scriptRequests += 1;
    if (behavior.failFirst && scriptRequests === 1) return route.abort();
    return route.fulfill({
    contentType: 'application/javascript',
    body: behavior.missing ? '' : `
      let sequence = 0;
      const widgets = new Map();
      window.turnstile = {
        render(element, options) {
          const id = String(++sequence);
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Complete security check';
          button.onclick = () => { options.callback('captcha-' + id); button.remove(); };
          element.appendChild(button);
          if (${Boolean(behavior.controls)}) {
            const expire = document.createElement('button');
            expire.type = 'button';
            expire.textContent = 'Expire security check';
            expire.onclick = () => options['expired-callback']();
            element.appendChild(expire);
            const fail = document.createElement('button');
            fail.type = 'button';
            fail.textContent = 'Fail security check';
            fail.onclick = () => options['timeout-callback']();
            element.appendChild(fail);
          }
          widgets.set(id, element);
          return id;
        },
        remove(id) { widgets.get(id)?.replaceChildren(); widgets.delete(id); }
      };
    `,
    });
  });
}

for (const language of ['en', 'zh'] as const) {
  test(`password reset returns to sign-in with cleared password (${language})`, async ({ page }) => {
    let updatedPassword = '';
    await mockCaptcha(page);
    await page.route('https://relay-auth-test.supabase.co/auth/v1/**', async (route) => {
      if (route.request().method() === 'PUT' && route.request().url().endsWith('/user')) {
        updatedPassword = route.request().postDataJSON().password;
        return route.fulfill({ json: fakeUser });
      }
      return route.fulfill({ json: fakeUser });
    });
    await page.addInitScript(({ user, locale }) => {
      localStorage.setItem('relay-language', locale);
      localStorage.setItem('relay-auth-global', JSON.stringify({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        user,
      }));
    }, { user: fakeUser, locale: language });
    await page.goto('/?reset=1');
    if (language === 'zh') await page.getByRole('dialog').getByRole('button', { name: '中文' }).click();
    await expect(page.getByRole('heading', { name: language === 'en' ? 'Choose a new password' : '设置新密码' })).toBeVisible();
    await page.getByLabel(language === 'en' ? 'Create password' : '创建密码', { exact: true }).fill('UpdatedPassword123!');
    await page.getByLabel(language === 'en' ? 'Confirm password' : '确认密码', { exact: true }).fill('UpdatedPassword123!');
    await page.getByRole('button', { name: language === 'en' ? /Save new password/ : /保存新密码/ }).click();
    await expect(page.getByRole('heading', { name: language === 'en' ? 'Welcome back' : '欢迎回来' })).toBeVisible();
    expect(updatedPassword).toBe('UpdatedPassword123!');
    await expect(page.getByRole('status')).toHaveText(language === 'en' ? 'Password updated. Sign in with your new password.' : '密码已更新，请使用新密码登录。');
    await expect(page.getByLabel(language === 'en' ? 'Password' : '密码', { exact: true })).toHaveValue('');
    await expect(page).toHaveURL('http://127.0.0.1:3011/');
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  });
}

test('signup and every resend require a fresh challenge after the 60-second wait', async ({ page }) => {
  test.skip(process.env.E2E_SIGNUP_DISABLED === 'true', 'The signup-disabled deployment has its own coverage.');
  const tokens: string[] = [];
  await page.clock.install();
  await mockCaptcha(page);
  await page.route('https://relay-auth-test.supabase.co/auth/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/signup') || path.endsWith('/resend')) {
      tokens.push(route.request().postDataJSON().gotrue_meta_security.captcha_token);
      return route.fulfill({ json: path.endsWith('/signup') ? fakeUser : {} });
    }
    return route.fulfill({ status: 400, json: { message: 'Unexpected mocked auth request' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Start 7-day free trial/ }).first().click();
  await page.getByLabel('Name', { exact: true }).fill('Relay UI test');
  await page.getByLabel('Email address', { exact: true }).fill(fakeUser.email);
  await page.getByLabel('Create password', { exact: true }).fill('TestPassword123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('TestPassword123!');
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: /Send verification code/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Complete security check' }).click();
  await page.getByRole('button', { name: /Send verification code/ }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  for (let index = 0; index < 2; index += 1) {
    await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
    await page.clock.fastForward(59_000);
    await expect(page.getByRole('button', { name: 'Resend in 1s' })).toBeDisabled();
    expect(tokens).toHaveLength(index + 1);
    await page.clock.fastForward(1000);
    const resend = page.getByRole('button', { name: 'Send a new code' });
    await expect(resend).toBeDisabled();
    await page.getByRole('button', { name: 'Complete security check' }).click();
    await expect(resend).toBeEnabled();
    // The development toolbar overlaps this button at phone width; keyboard
    // activation exercises the same enabled user control without that overlay.
    await resend.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('A new code was sent. Please allow up to one minute.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
  }
  expect(tokens).toHaveLength(3);
  expect(new Set(tokens).size).toBe(3);
  expect(tokens.every(Boolean)).toBe(true);
});

test('disabled email signup explains availability in both languages and keeps sign-in usable', async ({ page }) => {
  test.skip(process.env.E2E_SIGNUP_DISABLED !== 'true', 'Run with E2E_SIGNUP_DISABLED=true.');
  let signupRequests = 0;
  await mockCaptcha(page);
  await page.route('https://relay-auth-test.supabase.co/auth/v1/**', (route) => {
    signupRequests += 1;
    return route.fulfill({ status: 400, json: { message: 'No signup should be attempted.' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Start 7-day free trial/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Email signup is being configured. Please check back shortly.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Send verification code/ })).toBeDisabled();
  await dialog.getByRole('button', { name: '中文' }).click();
  await expect(dialog.getByText('邮箱注册正在配置中，请稍后再试。')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /发送验证码/ })).toBeDisabled();
  await dialog.getByRole('button', { name: '登录', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(dialog.getByLabel('邮箱地址')).toBeEditable();
  await expect(dialog.getByLabel('密码', { exact: true })).toBeEditable();
  await expect(dialog.getByRole('button', { name: /^登录/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Complete security check' }).click();
  await expect(dialog.getByRole('button', { name: /^登录/ })).toBeEnabled();
  expect(signupRequests).toBe(0);
});

for (const language of ['en', 'zh'] as const) {
  test(`signin and reset require security checks; reset delivery errors remain honest (${language})`, async ({ page }) => {
    let resetRequests = 0;
    await mockCaptcha(page);
    await page.route('https://relay-auth-test.supabase.co/auth/v1/**', (route) => {
      if (new URL(route.request().url()).pathname.endsWith('/recover')) {
        resetRequests += 1;
        return resetRequests === 1
          ? route.fulfill({ status: 500, json: { message: 'SMTP provider internal detail', code: 'unexpected_failure' } })
          : route.fulfill({ json: {} });
      }
      return route.fulfill({ status: 400, json: { message: 'Unexpected mocked auth request' } });
    });
    await page.addInitScript((locale) => localStorage.setItem('relay-language', locale), language);
    await page.goto('/');
    await page.locator('.landing-actions').getByRole('button', { name: language === 'en' ? 'Sign in' : '登录', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.auth-submit')).toBeDisabled();
    await dialog.getByRole('button', { name: 'Complete security check' }).click();
    await expect(dialog.locator('.auth-submit')).toBeEnabled();
    await dialog.getByRole('button', { name: language === 'en' ? 'Forgot password?' : '忘记密码？' }).click();
    await dialog.getByLabel(language === 'en' ? 'Email address' : '邮箱地址').fill('reset-test@example.invalid');
    await expect(dialog.locator('.auth-submit')).toBeDisabled();
    // Even programmatic form submission must not bypass the handler's token guard.
    await dialog.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());
    expect(resetRequests).toBe(0);
    await expect(dialog.getByRole('alert')).toHaveText(language === 'en' ? 'Please complete the security check before continuing.' : '请先完成安全验证再继续。');
    await dialog.getByRole('button', { name: 'Complete security check' }).click();
    await dialog.locator('.auth-submit').click();
    await expect(dialog.getByRole('alert')).toContainText(language === 'en' ? 'We could not request an email right now.' : '暂时无法请求发送邮件。');
    await expect(dialog).not.toContainText('SMTP provider internal detail');
    await expect(dialog.getByRole('status')).toHaveCount(0);
    expect(resetRequests).toBe(1);
    await expect(dialog.locator('.auth-submit')).toBeDisabled();
    await dialog.getByRole('button', { name: 'Complete security check' }).click();
    await dialog.locator('.auth-submit').click();
    await expect(dialog.getByRole('status')).toHaveText(language === 'en' ? 'If that address has an account, a reset email is on its way.' : '如果此邮箱存在账户，重置邮件正在发送。');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    expect(resetRequests).toBe(2);
  });

  test(`security script failure can be retried and expired tokens disable submission (${language})`, async ({ page }) => {
    await mockCaptcha(page, { failFirst: true, controls: true });
    await page.addInitScript((locale) => localStorage.setItem('relay-language', locale), language);
    await page.goto('/');
    await page.locator('.landing-actions').getByRole('button', { name: language === 'en' ? 'Sign in' : '登录', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const retry = dialog.getByRole('button', { name: language === 'en' ? 'Retry security check' : '重试安全验证' });
    await expect(retry).toBeVisible();
    await expect(dialog.locator('.auth-submit')).toBeDisabled();
    await retry.click();
    await dialog.getByRole('button', { name: 'Complete security check' }).click();
    await expect(dialog.locator('.auth-submit')).toBeEnabled();
    await dialog.getByRole('button', { name: 'Expire security check' }).click();
    await expect(dialog.locator('.auth-submit')).toBeDisabled();
    await dialog.getByRole('button', { name: 'Fail security check' }).click();
    await expect(retry).toBeVisible();
    await retry.click();
    await dialog.getByRole('button', { name: 'Complete security check' }).click();
    await expect(dialog.locator('.auth-submit')).toBeEnabled();
  });
}

test('a security script that never initializes times out with a retry action', async ({ page }) => {
  await page.clock.install();
  await mockCaptcha(page, { missing: true });
  await page.goto('/');
  await page.locator('.landing-actions').getByRole('button', { name: 'Sign in', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.auth-submit')).toBeDisabled();
  await page.clock.fastForward(16000);
  await expect(dialog.getByRole('button', { name: 'Retry security check' })).toBeVisible();
  await expect(dialog.locator('.auth-submit')).toBeDisabled();
});
