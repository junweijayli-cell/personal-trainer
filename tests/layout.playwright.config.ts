import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const chromePath = process.env.LAYOUT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
process.env.E2E_LAYOUT_MOCKS = 'true';

// Isolated local fixtures: all browser requests outside this server are intercepted.
// This suite never signs up users, sends email, or accesses the real backend.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'layout.spec.ts',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  outputDir: '../test-results/layout',
  use: {
    baseURL: 'http://127.0.0.1:3012',
    launchOptions: existsSync(chromePath) ? { executablePath: chromePath } : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3012',
    url: 'http://127.0.0.1:3012',
    timeout: 120_000,
    env: {
      DEPLOY_TARGET: 'local',
      NEXT_PUBLIC_SUPABASE_URL: 'https://trainwell-layout-test.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'layout-test-public-key',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
      NEXT_PUBLIC_MARKET: 'global',
      NEXT_PUBLIC_SIGNUP_ENABLED: 'true',
    },
  },
  projects: [
    { name: 'mobile-360', use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-430', use: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-1480', use: { viewport: { width: 1480, height: 1000 } } },
  ],
});
