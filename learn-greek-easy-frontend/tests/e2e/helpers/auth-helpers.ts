/**
 * Authentication Helpers for E2E Tests
 *
 * With the storageState pattern, most authentication is handled automatically:
 * - Setup project (auth.setup.ts) authenticates users ONCE via Supabase
 * - Browser projects load saved auth state from JSON files
 * - Tests run with pre-authenticated browser context
 *
 * This file contains:
 * - SEED_USERS: Test user credentials (used by auth.setup.ts)
 * - verifySeedUsers: Verify seed users can sign in via Supabase
 * - logout helpers: For testing logout functionality
 * - isLoggedIn, clearAuthState: Utility functions
 * - waitForAPIReady, seedDatabase: Test setup helpers
 */

import { Page, APIRequestContext, expect } from '@playwright/test';

import { createTestSupabaseClient, getSupabaseStorageKey } from './supabase-test-client';

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

// Seed users - available when TEST_SEED_ENABLED=true in environment
// These users have real data (decks, cards, progress, reviews)
export const SEED_USERS = {
  // Regular learner with progress history, card stats, and reviews
  LEARNER: {
    email: 'e2e_learner@test.com',
    password: 'TestPassword123!',
    name: 'E2E Learner',
  } as TestUser,
  // New user with no progress (for new user journey tests)
  BEGINNER: {
    email: 'e2e_beginner@test.com',
    password: 'TestPassword123!',
    name: 'E2E Beginner',
  } as TestUser,
  // Advanced user with more progress
  ADVANCED: {
    email: 'e2e_advanced@test.com',
    password: 'TestPassword123!',
    name: 'E2E Advanced',
  } as TestUser,
  // Admin user
  ADMIN: {
    email: 'e2e_admin@test.com',
    password: 'TestPassword123!',
    name: 'E2E Admin',
  } as TestUser,
  // XP Boundary user - 99 XP, Level 1 (1 XP from level up)
  XP_BOUNDARY: {
    email: 'e2e_xp_boundary@test.com',
    password: 'TestPassword123!',
    name: 'E2E XP Boundary',
  } as TestUser,
  // XP Mid user - 4100 XP, Level 7, with 5 achievements
  XP_MID: {
    email: 'e2e_xp_mid@test.com',
    password: 'TestPassword123!',
    name: 'E2E XP Mid',
  } as TestUser,
  // XP Max user - 100000 XP, Level 15, with all achievements
  XP_MAX: {
    email: 'e2e_xp_max@test.com',
    password: 'TestPassword123!',
    name: 'E2E XP Max',
  } as TestUser,
};

/**
 * Get the API base URL from environment or default.
 */
function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

/**
 * Wait for the application to be fully loaded and ready for interaction.
 *
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait (default: 30000ms for CI environments)
 */
export async function waitForAppFullyLoaded(page: Page, timeout = 30000): Promise<void> {
  await page.waitForSelector('[data-app-ready="true"]', {
    timeout,
    state: 'attached',
  });

  const pageLoader = page.locator('[data-testid="page-loader"]');
  try {
    await pageLoader.waitFor({ state: 'visible', timeout: 1000 });
    await pageLoader.waitFor({ state: 'hidden', timeout: 15000 });
  } catch {
    // PageLoader never appeared (fast load) - fine
  }
}

/**
 * Logout via Supabase signOut API and clear state.
 *
 * Reads the access token from the Supabase session localStorage key.
 *
 * @param page - Playwright page object
 */
export async function logoutViaAPI(page: Page): Promise<void> {
  const storageKey = getSupabaseStorageKey();

  try {
    const sessionJson = await page.evaluate(
      (key) => localStorage.getItem(key),
      storageKey
    );

    if (sessionJson) {
      const session = JSON.parse(sessionJson);
      const accessToken = session?.access_token;

      if (accessToken) {
        const supabaseUrl =
          process.env.VITE_SUPABASE_URL || 'http://localhost:54321';

        await page.request.post(`${supabaseUrl}/auth/v1/logout`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.VITE_SUPABASE_ANON_KEY || '',
          },
        });
      }
    }
  } catch (error) {
    console.warn('[TEST] API logout failed (may be expected):', error);
  }

  await clearAuthState(page);
}

/**
 * Logout via UI.
 *
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  const userMenuButton = page.getByTestId('user-menu-trigger');
  await userMenuButton.click();

  const logoutButton = page.getByTestId('logout-button');
  await logoutButton.click();

  const dialog = page.getByTestId('logout-dialog');
  await dialog.waitFor({ state: 'visible', timeout: 5000 });

  const confirmButton = page.getByTestId('logout-confirm-button');
  await confirmButton.click();

  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Check if user is logged in by reading Zustand persisted state.
 *
 * @param page - Playwright page object
 * @returns True if logged in, false otherwise
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const authStorage = await page.evaluate(() => {
    return localStorage.getItem('auth-storage');
  });

  if (!authStorage) return false;

  const authState = JSON.parse(authStorage);
  return authState.state?.isAuthenticated === true;
}

/**
 * Clear all storage and auth state.
 * Clears both the Supabase session key and Zustand auth-storage.
 *
 * @param page - Playwright page object
 */
export async function clearAuthState(page: Page): Promise<void> {
  const storageKey = getSupabaseStorageKey();

  await page.evaluate(
    (sbKey) => {
      localStorage.removeItem(sbKey);
      localStorage.removeItem('auth-storage');
      sessionStorage.clear();
    },
    storageKey
  );

  console.log('[TEST] Storage cleared for test isolation');
}

/**
 * Wait for API to be ready (useful for test setup).
 *
 * @param request - Playwright APIRequestContext
 * @param maxRetries - Maximum number of retries (default: 30)
 * @param retryInterval - Interval between retries in ms (default: 1000)
 */
export async function waitForAPIReady(
  request: APIRequestContext,
  maxRetries: number = 30,
  retryInterval: number = 1000
): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await request.get(`${apiBaseUrl}/health/ready`);
      if (response.ok()) {
        console.log('[TEST] API is ready');
        return;
      }
    } catch (error) {
      // API not ready yet
    }

    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }
  }

  throw new Error(`API not ready after ${maxRetries} attempts`);
}

/**
 * Seed the database for E2E tests.
 *
 * @param request - Playwright APIRequestContext
 */
export async function seedDatabase(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  const statusResponse = await request.get(`${apiBaseUrl}/api/v1/test/seed/status`);
  if (!statusResponse.ok()) {
    console.warn('[TEST] Seeding not available - running with existing data');
    return;
  }

  const status = await statusResponse.json();
  if (!status.enabled) {
    console.warn('[TEST] Seeding disabled - running with existing data');
    return;
  }

  const seedResponse = await request.post(`${apiBaseUrl}/api/v1/test/seed/all`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!seedResponse.ok()) {
    const errorText = await seedResponse.text();
    throw new Error(`Database seeding failed: ${seedResponse.status()} - ${errorText}`);
  }

  console.log('[TEST] Database seeded successfully');
}

/**
 * Verify that seed users exist and can authenticate via Supabase.
 *
 * Uses the Node.js Supabase test client to sign in the primary test user.
 *
 * @throws Error if sign-in fails (seed users not created or Supabase not configured)
 */
export async function verifySeedUsers(): Promise<void> {
  console.log('[TEST] Verifying seed users via Supabase signInWithPassword...');

  const supabase = createTestSupabaseClient();
  const testUser = SEED_USERS.LEARNER;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: testUser.email,
    password: testUser.password,
  });

  if (error) {
    throw new Error(
      `[VERIFY] Seed user ${testUser.email} cannot sign in via Supabase: ${error.message}. ` +
        'This likely means the database was not seeded properly or Supabase is not configured.'
    );
  }

  if (!data.session) {
    throw new Error(
      `[VERIFY] Seed user ${testUser.email} sign-in returned no session. ` +
        'Check that the user exists in Supabase Auth.'
    );
  }

  console.log(`[TEST] Successfully verified seed user ${testUser.email} can sign in`);
}

/**
 * Verify authentication succeeded after navigation.
 * Use in beforeEach hooks for protected page tests.
 *
 * @param page - Playwright page object
 * @param expectedPath - Expected URL path (e.g., '/settings')
 * @throws Error with clear message if redirected to login
 */
export async function verifyAuthSucceeded(page: Page, expectedPath: string): Promise<void> {
  const currentUrl = page.url();

  if (currentUrl.includes('/login')) {
    throw new Error(
      `Auth verification failed: Expected ${expectedPath} but was redirected to /login. ` +
        `This usually means:\n` +
        `  1. The storageState auth file is missing (playwright/.auth/learner.json)\n` +
        `  2. The auth setup (auth.setup.ts) failed to authenticate\n` +
        `  3. The Supabase session has expired\n` +
        `Current URL: ${currentUrl}`
    );
  }
}

/**
 * Wait for the application to be fully ready for interaction.
 *
 * The app signals readiness via `data-app-ready="true"` attribute when:
 * 1. React has mounted and rendered
 * 2. RouteGuard has completed auth check (success or failure)
 *
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait (default: 30000ms for CI environments)
 */
export async function waitForAppReady(page: Page, timeout = 30000): Promise<void> {
  await page.waitForSelector('[data-app-ready="true"]', {
    state: 'attached',
    timeout,
  });
}

/**
 * Wait for RouteGuard auth check to complete after navigation.
 *
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait for loading to complete (default: 15000ms)
 */
export async function waitForAuthCheck(page: Page, timeout = 15000): Promise<void> {
  const loadingIndicator = page.getByTestId('auth-loading');

  try {
    await page.waitForSelector('[data-app-ready="true"]', {
      state: 'attached',
      timeout: 5000,
    });
  } catch {
    await expect(loadingIndicator).toBeHidden({ timeout });
  }
}
