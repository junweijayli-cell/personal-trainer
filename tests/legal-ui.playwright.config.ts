import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const chromePath = process.env.LAYOUT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
process.env.E2E_LEGAL_MOCKS = 'true';

export default defineConfig({
  testDir: './e2e', testMatch: 'legal-ui.spec.ts', workers: 1,
  timeout: 45_000, expect: { timeout: 10_000 }, reporter: 'list',
  outputDir: '../test-results/legal-ui',
  use: {
    baseURL: 'http://127.0.0.1:3014',
    launchOptions: existsSync(chromePath) ? { executablePath: chromePath } : undefined,
    serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3014',
    url: 'http://127.0.0.1:3014', timeout: 120_000,
    env: {
      DEPLOY_TARGET: 'local', NEXT_PUBLIC_SUPABASE_URL: 'https://trainwell-legal-test.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'legal-test-public-key',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '', NEXT_PUBLIC_MARKET: 'global', NEXT_PUBLIC_SIGNUP_ENABLED: 'true',
    },
  },
  projects: [360, 390, 430].map((width) => ({
    name: `mobile-${width}`, use: { viewport: { width, height: 844 }, isMobile: true, hasTouch: true },
  })),
});
