/**
 * Node.js Supabase client for E2E test infrastructure.
 *
 * Used server-side (in Playwright test runner) for operations like
 * verifying seed users can sign in. NOT used in browser context.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Get Supabase URL from environment.
 */
export function getSupabaseUrl(): string {
  return process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
}

/**
 * Get Supabase anon key from environment.
 */
export function getSupabaseAnonKey(): string {
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY is not set. ' +
        'Set it in your environment or .env file before running E2E tests.'
    );
  }
  return key;
}

/**
 * Extract the project ref from a Supabase URL.
 *
 * Used to derive the localStorage key: `sb-<ref>-auth-token`
 *
 * Examples:
 *   https://abcdefgh.supabase.co -> abcdefgh
 *   http://localhost:54321 -> localhost
 */
export function getProjectRef(supabaseUrl?: string): string {
  const url = supabaseUrl || getSupabaseUrl();
  return new URL(url).hostname.split('.')[0];
}

/**
 * Get the localStorage key used by Supabase SDK to store the auth session.
 */
export function getSupabaseStorageKey(supabaseUrl?: string): string {
  return `sb-${getProjectRef(supabaseUrl)}-auth-token`;
}

/**
 * Create a Supabase client for Node.js test operations.
 *
 * Configured with `persistSession: false` and `autoRefreshToken: false`
 * since the test runner doesn't have localStorage.
 */
export function createTestSupabaseClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
