import { expect, test, type Page } from '@playwright/test';
import { auditAndCapture, inspectTextLayout } from '../layout-qa';

test.skip(process.env.E2E_LAYOUT_MOCKS !== 'true', 'Run only with tests/layout.playwright.config.ts and its isolated local fixtures.');

type Locale = 'en' | 'zh';
const fixtureOrigin = 'https://trainwell-layout-test.supabase.co';
const userId = '11111111-1111-4111-8111-111111111112';

test('text audit detects overlapping ink but accepts inline emphasis on the same line', async ({ page }) => {
  await page.setContent('<h1 style="font: bold 40px/0.5 Arial">清晰训练。<br>自信行动。</h1>');
  expect((await inspectTextLayout(page)).collisions).not.toEqual([]);
  await page.setContent('<h1 style="font: bold 40px/1.3 Arial"><span>Train <em>well</em></span>.<br>每天训练</h1>');
  expect((await inspectTextLayout(page)).collisions).toEqual([]);
});

async function isolateBrowser(page: Page, locale: Locale, membership?: 'trial' | 'expired') {
  const user = {
    id: userId, aud: 'authenticated', role: 'authenticated',
    email: 'avery.long.training.member@example.invalid',
    app_metadata: {}, user_metadata: { display_name: 'Alexandra Chen-Williams' },
    created_at: '2026-09-01T00:00:00.000Z',
  };
  const now = new Date();
  const trialStart = new Date(now.getTime() - (membership === 'expired' ? 8 : 1) * 86400000);
  const trialEnd = new Date(trialStart.getTime() + 7 * 86400000);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:3012') return route.continue();
    if (url.origin !== fixtureOrigin) return route.abort();
    const endpoint = url.pathname.replace('/rest/v1/', '');
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
    if (endpoint === 'profiles') return route.fulfill({ json: { user_id: userId, display_name: user.user_metadata.display_name, locale, market: 'global' } });
    if (endpoint === 'rpc/get_my_entitlement') return route.fulfill({ json: [{
      status: membership, plan: 'trial', trial_started_at: trialStart.toISOString(), trial_ends_at: trialEnd.toISOString(),
      current_period_end: null, cancel_at_period_end: false, server_now: now.toISOString(), has_access: membership === 'trial',
    }] });
    if (endpoint === 'training_preferences') {
      if (route.request().method() === 'PATCH') return route.fulfill({ status: 204 });
      return route.fulfill({ json: { user_id: userId, goal: 'Build strength', level: 'Beginner', days_per_week: 5, session_minutes: 24,
        hydration_target_ml: 2500, sleep_target_hours: 8, limitations: '', reminder_time: '18:00', consent_health_data: false,
        equipment: ['dumbbells', 'resistance-band', 'bench'], preferred_focus: ['full-body'] } });
    }
    if (endpoint === 'workout_sessions') return route.fulfill({ json: [{
      id: '22222222-2222-4222-8222-222222222222', user_id: userId, workout_name: 'Full body strength & stability',
      completed_at: '2026-08-30T12:00:00Z', duration_seconds: 1440, sets_completed: 12, movements_completed: 5, camera_sets: 2,
    }] });
    if (endpoint === 'wellness_logs') return route.fulfill({ json: null });
    if (endpoint === 'scheduled_workouts') return route.fulfill({ json: [] });
    // No real signup, email, payment, or data mutation can escape this suite.
    return route.fulfill({ status: 400, json: { message: `Unexpected isolated test endpoint: ${url.pathname}` } });
  });
  await page.addInitScript(({ user, locale, membership }) => {
    localStorage.setItem('relay-language', locale);
    localStorage.setItem('relay-audio', 'off');
    if (membership) localStorage.setItem('relay-auth-global', JSON.stringify({
      access_token: 'layout-only-access-token', refresh_token: 'layout-only-refresh-token', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user,
    }));
  }, { user, locale, membership });
}

for (const locale of ['en', 'zh'] as const) {
  test(`public and account-entry typography (${locale})`, async ({ page }, testInfo) => {
    await isolateBrowser(page, locale);
    await page.goto('/');
    await expect(page.locator('.landing-hero h1')).toBeVisible();
    if (locale === 'zh') await page.locator('.landing-nav').getByRole('button', { name: '中文', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', locale === 'zh' ? 'zh-CN' : 'en');
    await expect(page.locator('.landing-hero h1')).toHaveText(locale === 'zh'
      ? /^\s*清晰训练\s*自信行动\s*$/
      : /^\s*Train with clarity\s*Move with confidence\s*$/);
    await expect(page.locator('.device-copy h2')).toHaveText(locale === 'zh'
      ? /^\s*练强双腿\s*无需猜测\s*$/
      : /^\s*Strong legs\s*Zero guesswork\s*$/);
    await expect(page.locator('.device-copy h2 br')).toHaveCount(1);
    await expect(page.locator('.landing-shell').getByRole('heading').filter({ hasText: /[.。]/ })).toHaveCount(0);
    await expect(page.locator('.price-options')).toContainText(locale === 'zh' ? 'US$10 / 月' : 'US$10 / month');
    await expect(page.locator('.price-options')).toContainText(locale === 'zh' ? 'US$60 / 年' : 'US$60 / year');
    await auditAndCapture(page, testInfo, `${locale}-landing-pricing`);
    await page.locator('.landing-hero .hero-copy > button').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-signup`);
    await page.getByRole('dialog').locator('.auth-switch button').click();
    await expect(page.locator('.forgot-link')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-signin`);
    await page.locator('.forgot-link').click();
    await expect(page.getByRole('heading', { name: locale === 'zh' ? '重置密码' : 'Reset your password' })).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-forgot-password`);
    await page.goto('/?reset=1');
    if (locale === 'zh') await page.getByRole('dialog').getByRole('button', { name: '中文', exact: true }).click();
    await expect(page.getByRole('heading', { name: locale === 'zh' ? '设置新密码' : 'Choose a new password' })).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-new-password`);
  });

  test(`member training and account typography (${locale})`, async ({ page }, testInfo) => {
    await isolateBrowser(page, locale, 'trial');
    await page.goto('/');
    await expect(page.locator('.today-head h1')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-today`);
    await page.locator('.phone-nav button').nth(1).click();
    await expect(page.locator('.history-page h1')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-history`);
    await page.locator('.phone-nav button').nth(2).click();
    await expect(page.locator('.you-page h1')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-account`);
    await page.locator('.phone-nav button').first().click();
    await page.locator('.start-session').click();
    await expect(page.locator('.setup-copy h1')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-setup-focus`);
    await page.locator('.focus-grid button').last().click();
    await page.locator('.setup-next').click();
    await expect(page.locator('.equipment-grid')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-setup-equipment`);
    await page.locator('.setup-next').click();
    await expect(page.locator('.plan-mini-list')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-setup-plan`);
    await page.locator('.setup-next').click();
    await expect(page.locator('.ready-list')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-setup-ready`);
    await page.locator('.start-workout-now').click();
    await expect(page.locator('.guide-copy h1')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-gesture-guide`);
    await page.locator('.guide-visual > button').click();
    await expect(page.locator('.exercise-preview')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-gesture-detail`);
  });

  test(`expired membership typography (${locale})`, async ({ page }, testInfo) => {
    await isolateBrowser(page, locale, 'expired');
    await page.goto('/');
    await expect(page.locator('.paywall-shell h1')).toBeVisible();
    await auditAndCapture(page, testInfo, `${locale}-paywall`);
  });
}
