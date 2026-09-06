import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('TrainWell custom-domain deployment', () => {
  it('builds Cloudflare assets at the root even when built by GitHub Actions', async () => {
    vi.stubEnv('DEPLOY_TARGET', 'cloudflare-pages');
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    const { default: config } = await import('../next.config');
    expect(config.output).toBe('export');
    expect(config.basePath).toBe('');
    expect(config.assetPrefix).toBeUndefined();
    expect(config.env?.NEXT_PUBLIC_BASE_PATH).toBe('');
  });

  it('retains the legacy GitHub build path for rollback', async () => {
    vi.stubEnv('DEPLOY_TARGET', 'github-pages');
    vi.stubEnv('GITHUB_REPOSITORY', 'junweijayli-cell/personal-trainer');
    const { default: config } = await import('../next.config');
    expect(config.basePath).toBe('/personal-trainer');
    expect(config.env?.NEXT_PUBLIC_BASE_PATH).toBe('/personal-trainer');
  });

  it('uses the custom domain for canonical and sharing links', () => {
    const layout = source('app/layout.tsx');
    expect(layout).toContain('NEXT_PUBLIC_SITE_URL');
    expect(layout).toContain('https://trainwell.win');
    expect(layout).toContain('alternates: { canonical:');
    expect(layout).not.toContain('github.io');
  });

  it('preserves relative installable-app assets and on-device camera access', () => {
    const manifest = JSON.parse(source('public/manifest.webmanifest'));
    expect(manifest.start_url).toBe('./');
    expect(manifest.icons.every((icon: { src: string }) => icon.src.startsWith('./'))).toBe(true);
    expect(source('public/_headers')).toContain('camera=(self)');
    const redirects = source('public/_redirects').split('\n').filter((line) => line.trim() && !line.startsWith('#'));
    expect(redirects.every((line) => line.startsWith('/'))).toBe(true);
    expect(source('public/_redirects')).toContain('/personal-trainer/ / 301');
  });

  it('includes exact production recovery redirects without a wildcard production host', () => {
    const auth = source('supabase/config.toml');
    expect(auth).toContain('site_url = "https://trainwell.win/"');
    expect(auth).toContain('"https://trainwell.win/?reset=1"');
    expect(auth).not.toContain('https://*.trainwell.win');
    expect(source('.env.example')).toContain('NEXT_PUBLIC_SIGNUP_ENABLED=false');
  });

  it('keeps public assets below the Cloudflare Pages 25 MiB per-file limit', () => {
    const oversized: string[] = [];
    function scan(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) scan(path);
        else if (statSync(path).size > 25 * 1024 * 1024) oversized.push(path);
      }
    }
    scan(fileURLToPath(new URL('public/', root)));
    expect(oversized).toEqual([]);
  });
});
