import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const videos: Record<string, string> = JSON.parse(readFileSync(
  new URL('../../app/exercise-videos.json', import.meta.url), 'utf8'));

for (const [id, src] of Object.entries(videos)) {
  test(`${id} asset decodes and advances`, async ({ page, baseURL }) => {
    const response = await page.goto(`${baseURL}${src}`);
    expect(response?.ok()).toBe(true);
    expect(response?.headers()['content-type']).toContain('video/mp4');
    const video = page.locator('video');
    await video.evaluate((element: HTMLVideoElement) => {
      element.muted = true;
      element.playsInline = true;
      return element.play();
    });
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0.3);
    const media = await video.evaluate((element: HTMLVideoElement) => ({
      error: element.error?.message, width: element.videoWidth, height: element.videoHeight,
      duration: element.duration,
    }));
    expect(media.error).toBeUndefined();
    expect(media.width / media.height).toBeCloseTo(0.75, 2);
    expect(media.duration).toBeGreaterThanOrEqual(5);
    expect(media.duration).toBeLessThanOrEqual(8.1);
  });
}

// This also exercises deployed frontend assets without creating a real account:
// all backend requests are fulfilled locally and other external requests blocked.
async function memberFixture(page: Page, baseURL: string) {
  const site = new URL(baseURL).origin;
  const user = { id: '11111111-1111-4111-8111-111111111113', aud: 'authenticated',
    role: 'authenticated', email: 'media-review@example.invalid', app_metadata: {}, user_metadata: {} };
  await page.clock.setFixedTime(new Date('2026-09-07T04:00:00Z'));
  await page.addInitScript((user) => {
    localStorage.setItem('relay-language', 'en');
    localStorage.setItem('relay-audio', 'off');
    localStorage.setItem('relay-auth-global', JSON.stringify({
      access_token: 'media-only-access-token', refresh_token: 'media-only-refresh-token',
      token_type: 'bearer', expires_at: 4102444800, user,
    }));
  }, user);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === site) return route.fallback();
    if (!url.hostname.endsWith('.supabase.co')) return route.abort();
    const endpoint = url.pathname.replace('/rest/v1/', '');
    let body: unknown;
    if (url.pathname === '/auth/v1/user') body = user;
    else if (endpoint === 'profiles') body = { display_name: 'Media review', locale: 'en', market: 'global' };
    else if (endpoint === 'rpc/get_my_entitlement') body = [{ status: 'trial', plan: 'trial',
      trial_started_at: '2026-09-07T00:00:00Z', trial_ends_at: '2026-09-14T00:00:00Z',
      server_now: '2026-09-07T04:00:00Z', has_access: true }];
    else if (endpoint === 'training_preferences') body = { equipment: [], preferred_focus: [] };
    else if (endpoint === 'wellness_logs') body = null;
    else if (endpoint === 'workout_sessions' || endpoint === 'scheduled_workouts') body = [];
    else throw new Error(`Unexpected isolated account request: ${url.pathname}`);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${baseURL}/`);
  await expect(page.locator('.today-head h1')).toBeVisible();
}

async function openGluteGuide(page: Page, baseURL: string) {
  await memberFixture(page, baseURL);
  await page.getByRole('button', { name: /Glute bridge/i }).click();
  await expect(page.getByRole('dialog', { name: /Glute bridge movement guide/ })).toBeVisible();
}

test('new video plays inside the workout guide with its complete frame and controls visible', async ({ page, baseURL }) => {
  await openGluteGuide(page, baseURL!);
  const video = page.getByRole('dialog').locator('video');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.3);
  expect(await video.evaluate((v: HTMLVideoElement) => v.playsInline && v.controls)).toBe(true);
  expect(await video.evaluate((v) => getComputedStyle(v).objectFit)).toBe('contain');
  const frame = await video.boundingBox();
  const container = await page.getByRole('dialog').locator('.preview-visual').boundingBox();
  expect(frame!.y + frame!.height).toBeLessThanOrEqual(container!.y + container!.height + 1);
  await page.getByRole('button', { name: 'Close movement guide' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('failed video falls back to the three-position photo demonstration', async ({ page, baseURL }) => {
  await page.route('**/exercises/videos/glute-bridge.mp4*', (route) => route.abort());
  await openGluteGuide(page, baseURL!);
  const guide = page.getByRole('dialog').locator('.phase-guide');
  await expect(guide).toHaveAttribute('data-guide-mode', 'photos');
  await expect(guide.locator('.phase-subject')).toHaveCount(3);
  await expect(guide.locator('.phase-subject.active')).toBeVisible();
  const initial = await guide.locator('.phase-subject.active').getAttribute('alt');
  await expect.poll(() => guide.locator('.phase-subject.active').getAttribute('alt')).not.toBe(initial);
});

test('switching previews selects the new video and clears the previous playback failure', async ({ page, baseURL }) => {
  await page.route('**/exercises/videos/glute-bridge.mp4*', (route) => route.abort());
  await openGluteGuide(page, baseURL!);
  await expect(page.getByRole('dialog').locator('.phase-guide')).toHaveAttribute('data-guide-mode', 'photos');
  await page.getByRole('button', { name: 'Close movement guide' }).click();
  await page.getByRole('button', { name: /Forearm plank/i }).click();
  const video = page.getByRole('dialog').locator('video');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.3);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toContain('/forearm-plank.mp4?v=20260907-approved-motion');
});
