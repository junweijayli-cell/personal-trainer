import { expect, test } from '@playwright/test';

test('landing and secure signup are usable on a phone', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Train with clarity/i })).toBeVisible();
  await page.getByRole('button', { name: /Start 7-day free trial/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Create your Relay account/i })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByText(/seven-day trial starts after your email is verified/i)).toBeVisible();
});

test('Chinese language covers the landing and account entry flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '中文' }).first().click();
  await expect(page.getByRole('heading', { name: /清晰训练/ })).toBeVisible();
  await page.getByRole('button', { name: /开始 7 天免费试用/ }).first().click();
  await expect(page.getByRole('heading', { name: '创建 Relay 账户' })).toBeVisible();
  await expect(page.getByText(/邮箱验证后即开始七天免费试用/)).toBeVisible();
});

test('a deployment without backend credentials fails safely', async ({ page }) => {
  test.skip(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), 'Only applies to an unconfigured local build.');
  await page.goto('/');
  await expect(page.getByText(/Secure accounts are being connected/i)).toBeVisible();
});
