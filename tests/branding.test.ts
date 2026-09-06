import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('TrainWell branding', () => {
  it('uses TrainWell in the installable app and browser metadata', () => {
    const manifest = JSON.parse(source('public/manifest.webmanifest'));
    expect(manifest.name).toBe('TrainWell');
    expect(manifest.short_name).toBe('TrainWell');
    const layout = source('app/layout.tsx');
    expect(layout).toMatch(/applicationName:\s*['"]TrainWell['"]/);
    expect(layout).toMatch(/title:\s*['"]TrainWell/);
    expect(layout).not.toMatch(/\bRelay\b/i);
  });

  it('brands both auth emails without changing their Supabase verification placeholders', () => {
    const confirmation = source('supabase/templates/confirmation.html');
    const recovery = source('supabase/templates/recovery.html');
    for (const template of [confirmation, recovery]) {
      expect(template).toMatch(/TrainWell/i);
      expect(template).not.toMatch(/\bRelay\b/i);
      expect(template).toMatch(/[\u4e00-\u9fff]/);
    }
    expect(confirmation.match(/\{\{\s*\.Token\s*\}\}/g)).toHaveLength(1);
    expect(recovery.match(/\{\{\s*\.ConfirmationURL\s*\}\}/g)).toHaveLength(1);
    expect(source('supabase/config.toml')).toContain('subject = "TrainWell verification code / TrainWell 验证码"');
    expect(source('supabase/config.toml')).toContain('subject = "Reset your TrainWell password / 重置 TrainWell 密码"');
  });

  it('keeps existing on-device preferences and authenticated sessions available after renaming', () => {
    const page = source('app/page.tsx');
    for (const preference of ['relay-language', 'relay-equipment', 'relay-audio']) {
      expect(page).toContain(`getItem('${preference}')`);
      expect(page).toContain(`setItem('${preference}',`);
    }
    expect(source('app/supabase-client.ts')).toContain('storageKey: `relay-auth-${market}`');
    const account = source('app/account-service.ts');
    expect(account).toContain('getItem(`relay-demo-snapshot:${email.trim().toLowerCase()}`)');
    expect(account).toContain('removeItem(`relay-demo-snapshot:${member.email.trim().toLowerCase()}`)');
  });
});
