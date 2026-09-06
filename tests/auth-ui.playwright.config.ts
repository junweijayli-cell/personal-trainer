import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const chromePath = process.env.LAYOUT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// These tests intercept all Auth calls and use a local imitation of the CAPTCHA.
// No Supabase account is created and no verification email is sent.
process.env.E2E_AUTH_UI_MOCKS = 'true';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'auth-ui.spec.ts',
  timeout: 30_000,
  expect: { timeout: 7_500 },
  fullyParallel: true,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3011',
    viewport: { width: 390, height: 844 },
    launchOptions: existsSync(chromePath) ? { executablePath: chromePath } : undefined,
    trace: 'retain-on-failure',
  },
  outputDir: '../test-results/auth-ui',
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3011',
    url: 'http://127.0.0.1:3011',
    timeout: 120_000,
    env: {
      DEPLOY_TARGET: 'local',
      NEXT_PUBLIC_SUPABASE_URL: 'https://relay-auth-test.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'relay-test-public-key',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'relay-test-captcha-site-key',
      NEXT_PUBLIC_MARKET: 'global',
      NEXT_PUBLIC_SIGNUP_ENABLED: process.env.E2E_SIGNUP_DISABLED === 'true' ? 'false' : 'true',
    },
  },
});
