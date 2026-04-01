/**
 * @fileoverview Supabase client initialization with resilient network handling.
 * Configures auth persistence via AsyncStorage and provides a resilient fetch
 * wrapper that gracefully handles network failures on mobile.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

if (!isSupabaseConfigured) {
}

const safeUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key';

const originalFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : fetch;

const resilientFetch: typeof fetch = async (input, init) => {
  try {
    return await originalFetch(input, init);
  } catch (err) {
    if (err instanceof TypeError && (err.message === 'Failed to fetch' || err.message === 'Network request failed')) {
      return new Response(JSON.stringify({ error: 'Network unavailable' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw err;
  }
};

/** Singleton Supabase client used across all services and data contexts */
export const supabase: SupabaseClient = createClient(safeUrl, safeKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: {
    fetch: resilientFetch,
  },
});

/**
 * Returns the appropriate OAuth redirect URL based on the current platform.
 * @returns Redirect URL string for auth callbacks
 */
export function getRedirectUrl(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location.origin) {
      return window.location.origin;
    }
    return 'https://hazione.com';
  }
  return 'https://hazione.com';
}

