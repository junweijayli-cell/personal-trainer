'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Market } from './account-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  || '';

let browserClient: SupabaseClient | null = null;

export const market: Market = process.env.NEXT_PUBLIC_MARKET === 'cn' ? 'cn' : 'global';
export const backendConfigured = Boolean(supabaseUrl && publishableKey);

export function getSupabase(): SupabaseClient {
  if (!backendConfigured) {
    throw new Error('Relay secure account services are not configured for this deployment.');
  }
  browserClient ??= createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: `relay-auth-${market}`,
    },
  });
  return browserClient;
}

export function appUrl(path = '') {
  if (typeof window === 'undefined') return '';
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return `${window.location.origin}${basePath}/${path.replace(/^\//, '')}`;
}
