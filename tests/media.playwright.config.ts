import { defineConfig, devices } from '@playwright/test';

const deployed = process.env.E2E_MEDIA_URL?.replace(/\/$/, '');

export default defineConfig({
  testDir: './media',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: deployed ? 3 : 4,
  reporter: 'list',
  outputDir: '../test-results/media',
  use: {
    baseURL: deployed ?? 'http://127.0.0.1:3013',
    channel: process.platform === 'win32' ? 'chrome' : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  webServer: deployed ? undefined : {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3013',
    url: 'http://127.0.0.1:3013',
    timeout: 120_000,
    env: {
      DEPLOY_TARGET: 'local',
      NEXT_PUBLIC_SUPABASE_URL: 'https://trainwell-media-test.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'media-test-public-key',
      NEXT_PUBLIC_MARKET: 'global',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
      NEXT_PUBLIC_SENTRY_DSN: '',
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-360', use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-430', use: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true } },
  ],
});
