import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2';

function pepper() {
  const value = Deno.env.get('PROMO_CODE_PEPPER')?.trim();
  if (!value) throw new Error('Promotion code service is not configured.');
  return value;
}

export function normalizePromoCode(value: unknown) {
  if (typeof value !== 'string') throw new Error('Enter an access code.');
  const normalized = value.toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-F0-9]{32}$/.test(normalized)) throw new Error('This access code is invalid or unavailable.');
  return normalized;
}

export async function promoDigest(value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function requirePromoOperator(admin: SupabaseClient, user: User) {
  const { data, error } = await admin.from('promo_operators').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error || !data) throw new Error('Promotion access is restricted.');
}

export function randomPromoCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const raw = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return raw.match(/.{1,4}/g)!.join('-');
}
