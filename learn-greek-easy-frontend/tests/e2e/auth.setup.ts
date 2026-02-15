/**
 * Authentication Setup for Playwright
 *
 * Runs ONCE before all tests to authenticate each seed user via Supabase
 * and save their browser state (cookies, localStorage) to JSON files.
 *
 * Tests then use these saved states via storageState config, eliminating
 * the need for per-test authentication.
 *
 * Flow per user:
 * 1. Navigate to app origin (required for localStorage access)
 * 2. Call GoTrue REST API via page.evaluate() to sign in with password
 * 3. Write Supabase session to localStorage (sb-<ref>-auth-token)
 * 4. Fetch user profile from backend API
 * 5. Write Zustand auth state to localStorage (auth-storage)
 * 6. Save storageState to JSON file
 *
 * @see https://playwright.dev/docs/auth
 */

import { test as setup, request } from '@playwright/test';
import * as fs from 'fs';

import { SEED_USERS, verifySeedUsers } from './helpers/auth-helpers';
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseStorageKey } from './helpers/supabase-test-client';

// Storage state file paths
const STORAGE_STATE_DIR = 'playwright/.auth';

// Ensure auth directory exists
if (!fs.existsSync(STORAGE_STATE_DIR)) {
  fs.mkdirSync(STORAGE_STATE_DIR, { recursive: true });
}

/**
 * Get API base URL from environment.
 */
function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

/**
 * Verify backend and seed users are ready before auth setup.
 */
setup.beforeAll(async () => {
  const apiBaseUrl = getApiBaseUrl();
  console.log(`[SETUP] Verifying backend readiness at ${apiBaseUrl}`);

  const apiRequest = await request.newContext({ baseURL: apiBaseUrl });

  try {
    console.log('[SETUP] Checking /health/ready...');
    const healthResponse = await apiRequest.get('/health/ready');
    if (!healthResponse.ok()) {
      const text = await healthResponse.text();
      throw new Error(`Backend health check failed: ${healthResponse.status()} - ${text}`);
    }
    console.log('[SETUP] Backend health check passed');

    console.log('[SETUP] Verifying seed users can sign in via Supabase...');
    await verifySeedUsers();
    console.log('[SETUP] Seed users verified successfully');
  } catch (error) {
    console.error('[SETUP] Backend verification failed:', error);
    throw error;
  } finally {
    await apiRequest.dispose();
  }
});

/**
 * Authenticate a user via Supabase signInWithPassword and save storage state.
 *
 * Uses the GoTrue REST API inside page.evaluate() to sign in within the
 * browser context, then writes both localStorage keys needed by the app:
 * - sb-<ref>-auth-token: Supabase session (read by supabase.auth.getSession())
 * - auth-storage: Zustand persisted state (read by useAuthStore on hydration)
 */
async function authenticateAndSave(
  page: import('@playwright/test').Page,
  user: { email: string; password: string; name: string },
  storageStatePath: string
): Promise<void> {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const storageKey = getSupabaseStorageKey();
  const apiBaseUrl = getApiBaseUrl();

  console.log(`[SETUP] Authenticating ${user.email} via Supabase GoTrue API`);

  // Step 1: Navigate to app origin (required for localStorage access)
  await page.goto('/');

  // Step 2: Sign in via GoTrue REST API in browser context
  const sessionData = await page.evaluate(
    async ({ url, key, email, password, sbStorageKey }) => {
      const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `GoTrue sign-in failed for ${email}: ${response.status} - ${errorBody}`
        );
      }

      const session = await response.json();

      // Write Supabase session to localStorage (same format as SDK)
      localStorage.setItem(sbStorageKey, JSON.stringify(session));

      return {
        access_token: session.access_token as string,
        user_id: session.user?.id as string,
      };
    },
    {
      url: supabaseUrl,
      key: anonKey,
      email: user.email,
      password: user.password,
      sbStorageKey: storageKey,
    }
  );

  console.log(`[SETUP] GoTrue sign-in successful for ${user.email}`);

  // Step 3: Fetch user profile from backend API
  const apiRequest = await request.newContext({ baseURL: apiBaseUrl });
  let profile: Record<string, unknown>;
  try {
    const profileResponse = await apiRequest.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${sessionData.access_token}` },
    });

    if (!profileResponse.ok()) {
      const text = await profileResponse.text();
      throw new Error(
        `Profile fetch failed for ${user.email}: ${profileResponse.status()} - ${text}`
      );
    }

    profile = await profileResponse.json();
  } finally {
    await apiRequest.dispose();
  }

  console.log(`[SETUP] Profile fetched for ${user.email}`);

  // Step 4: Write auth-storage (Zustand persisted state) to localStorage
  await page.evaluate(
    ({ prof, email }) => {
      const now = new Date().toISOString();
      const authState = {
        state: {
          user: {
            id: prof.id || prof.supabase_id,
            email: prof.email || email,
            name: (prof.full_name as string) || email.split('@')[0],
            role: prof.is_superuser ? 'admin' : 'free',
            preferences: {
              language: 'en',
              dailyGoal:
                (prof.settings as Record<string, unknown>)?.daily_goal || 20,
              notifications:
                (prof.settings as Record<string, unknown>)
                  ?.email_notifications ?? true,
              theme:
                (prof.settings as Record<string, unknown>)?.theme || 'light',
            },
            stats: {
              streak: 0,
              wordsLearned: 0,
              totalXP: 0,
              joinedDate: now,
            },
            createdAt: now,
            updatedAt: now,
            authProvider: (prof.auth_provider as string) ?? undefined,
          },
          isAuthenticated: true,
        },
        version: 0,
      };

      localStorage.setItem('auth-storage', JSON.stringify(authState));
    },
    { prof: profile, email: user.email }
  );

  // Step 5: Save storage state to file
  await page.context().storageState({ path: storageStatePath });

  console.log(`[SETUP] Saved auth state for ${user.email} to ${storageStatePath}`);
}

// Setup tests for each seed user role

setup('authenticate as learner', async ({ page }) => {
  await authenticateAndSave(page, SEED_USERS.LEARNER, `${STORAGE_STATE_DIR}/learner.json`);
});

setup('authenticate as beginner', async ({ page }) => {
  await authenticateAndSave(page, SEED_USERS.BEGINNER, `${STORAGE_STATE_DIR}/beginner.json`);
});

setup('authenticate as advanced', async ({ page }) => {
  await authenticateAndSave(page, SEED_USERS.ADVANCED, `${STORAGE_STATE_DIR}/advanced.json`);
});

setup('authenticate as admin', async ({ page }) => {
  await authenticateAndSave(page, SEED_USERS.ADMIN, `${STORAGE_STATE_DIR}/admin.json`);
});
