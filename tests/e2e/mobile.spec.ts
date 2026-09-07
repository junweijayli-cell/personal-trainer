import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // These are visual entry-flow checks, never live signup or email tests.
  await page.route('**/auth/v1/**', (route) => route.abort());
  await page.route('https://challenges.cloudflare.com/turnstile/**', (route) => route.fulfill({
    contentType: 'application/javascript', body: '',
  }));
});

async function expectReadableTrainWellSurface(page: Page) {
  await expect(page).toHaveTitle(/TrainWell|悦练/);
  expect(await page.locator('body').innerText()).not.toMatch(/\bRelay\b/i);
  const dimensions = await page.evaluate(() => ({
    content: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.content, 'The page must not scroll sideways at this viewport').toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('landing and secure signup are usable on a phone', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Train with clarity/i })).toBeVisible();
  await expect(page.locator('.landing-nav .wordmark')).toContainText('TrainWell');
  await expectReadableTrainWellSurface(page);
  const previewVideo = page.getByLabel('Full-body barbell squat movement video');
  await expect(previewVideo).toBeVisible();
  await expect.poll(() => previewVideo.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThan(0);
  const videoBox = await previewVideo.boundingBox();
  expect(videoBox?.width).toBeGreaterThan(250);
  expect(videoBox?.height).toBeGreaterThan(300);
  await page.getByRole('button', { name: /Start 7-day free trial/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Create your TrainWell account/i })).toBeVisible();
  await expect(page.getByRole('dialog').locator('.auth-brand b')).toHaveText('TrainWell');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByText(/seven-day trial starts after your email is verified/i)).toBeVisible();
  await expectReadableTrainWellSurface(page);
});

test('Chinese language covers the landing and account entry flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '中文' }).first().click();
  await expect(page.getByRole('heading', { name: /清晰训练/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('relay-language'))).toBe('zh');
  await page.reload();
  await expect(page.getByRole('heading', { name: /清晰训练/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('.landing-nav .wordmark')).toContainText('悦练');
  await expectReadableTrainWellSurface(page);
  await page.getByRole('button', { name: /开始 7 天免费试用/ }).first().click();
  await expect(page.getByRole('heading', { name: '创建悦练账户' })).toBeVisible();
  await expect(page.getByRole('dialog').locator('.auth-brand b')).toHaveText('悦练');
  await expect(page.getByText(/邮箱验证后即开始七天免费试用/)).toBeVisible();
  await expectReadableTrainWellSurface(page);
});

test('a deployment without backend credentials fails safely', async ({ page }) => {
  test.skip(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), 'Only applies to an unconfigured local build.');
  await page.goto('/');
  await expect(page.getByText(/Secure accounts are being connected/i)).toBeVisible();
});
