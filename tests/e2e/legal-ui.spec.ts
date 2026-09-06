import { expect, test } from '@playwright/test';

test.skip(process.env.E2E_LEGAL_MOCKS !== 'true', 'Only run with isolated legal-ui.playwright.config.ts fixtures.');

for (const language of ['en', 'zh'] as const) {
  test(`legal notices are readable, keyboard accessible, and preserve signup (${language})`, async ({ page }, testInfo) => {
    let signupRequests = 0;
    // All requests outside this isolated server are intercepted. No account or email is created.
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:3014') return route.continue();
      if (url.origin === 'https://trainwell-legal-test.supabase.co' && url.pathname === '/auth/v1/signup') {
        signupRequests += 1;
        return route.fulfill({ json: {
          id: '11111111-1111-4111-8111-111111111113', aud: 'authenticated', role: 'authenticated',
          email: 'legal-review@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-09-06T00:00:00Z',
        } });
      }
      return route.abort();
    });
    await page.addInitScript((locale) => localStorage.setItem('relay-language', locale), language);
    await page.goto('/');
    const terms = language === 'en' ? 'Terms of use' : '使用条款';
    const privacy = language === 'en' ? 'Privacy notice' : '隐私说明';
    const legalDialog = page.locator('dialog.legal-dialog');

    for (const label of [terms, privacy]) {
      const trigger = page.locator('.landing-footer').getByRole('button', { name: label, exact: true });
      await trigger.click();
      await expect(legalDialog).toBeVisible();
      await expect(legalDialog.getByRole('heading', { name: label, exact: true })).toBeFocused();
      await expect(legalDialog.getByText(language === 'en' ? /Operator review required/ : /收费上线前需运营方审核/)).toBeVisible();
      expect(await legalDialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await legalDialog.locator('.legal-content').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await legalDialog.locator('.legal-dialog-actions button').focus();
      await page.keyboard.press('Tab');
      await expect(legalDialog.getByRole('button', { name: 'EN', exact: true })).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath(`${language}-${label === terms ? 'terms' : 'privacy'}.png`) });
      await page.keyboard.press('Escape');
      await expect(legalDialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }

    await page.locator('.landing-hero .hero-copy > button').click();
    const signup = page.locator('.auth-card');
    await signup.getByLabel(language === 'en' ? 'Name' : '姓名', { exact: true }).fill('Legal Review');
    await signup.getByLabel(language === 'en' ? 'Email address' : '邮箱地址', { exact: true }).fill('legal-review@example.invalid');
    await signup.getByLabel(language === 'en' ? 'Create password' : '创建密码', { exact: true }).fill('TestOnlyPassword123!');
    await signup.getByLabel(language === 'en' ? 'Confirm password' : '确认密码', { exact: true }).fill('TestOnlyPassword123!');
    const checkbox = signup.getByRole('checkbox');
    await expect(checkbox).not.toBeChecked();
    const termsTrigger = signup.getByRole('button', { name: terms, exact: true });
    await termsTrigger.click();
    await expect(legalDialog).toBeVisible();
    await legalDialog.locator('.legal-dialog-actions button').click();
    await expect(termsTrigger).toBeFocused();
    await expect(signup.getByLabel(language === 'en' ? 'Name' : '姓名', { exact: true })).toHaveValue('Legal Review');
    await expect(signup.getByLabel(language === 'en' ? 'Create password' : '创建密码', { exact: true })).toHaveValue('TestOnlyPassword123!');
    await expect(checkbox).not.toBeChecked();
    await signup.getByRole('button', { name: language === 'en' ? /Send verification code/ : /发送验证码/ }).click();
    expect(signupRequests).toBe(0);
    expect(await checkbox.evaluate((element) => (element as HTMLInputElement).validity.valueMissing)).toBe(true);
    await checkbox.check();
    await signup.getByRole('button', { name: language === 'en' ? /Send verification code/ : /发送验证码/ }).focus();
    await page.screenshot({ path: testInfo.outputPath(`${language}-signup-consent.png`) });
    await signup.getByRole('button', { name: language === 'en' ? /Send verification code/ : /发送验证码/ }).click();
    await expect(signup.getByRole('heading', { name: language === 'en' ? 'Check your email' : '查看你的邮箱' })).toBeVisible();
    expect(signupRequests).toBe(1);
  });
}
