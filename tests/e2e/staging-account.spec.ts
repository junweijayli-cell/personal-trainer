import { expect, test } from '@playwright/test';

const email = process.env.E2E_ACCOUNT_EMAIL;
const password = process.env.E2E_ACCOUNT_PASSWORD;

test('verified staging member can sign in and reach a server-backed account', async ({ page }) => {
  test.skip(!email || !password, 'Set E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD for staging account coverage.');
  await page.goto('/');
  await page.getByRole('button', { name: /^Sign in$/ }).first().click();
  await page.getByLabel('Email address').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: /^Sign in/ }).last().click();
  await expect(page.getByText(/your progress is saved/i)).toBeVisible();
  await page.getByRole('button', { name: /My plan/i }).click();
  await expect(page.getByText(/You control your data/i)).toBeVisible();
});
