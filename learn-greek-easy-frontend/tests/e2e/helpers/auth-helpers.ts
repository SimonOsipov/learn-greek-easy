/**
 * Authentication Helpers for E2E Tests
 *
 * With the storageState pattern, most authentication is handled automatically:
 * - Setup project (auth.setup.ts) authenticates users ONCE
 * - Browser projects load saved auth state from JSON files
 * - Tests run with pre-authenticated browser context
 *
 * This file now contains:
 * - SEED_USERS: Test user credentials (used by auth.setup.ts)
 * - loginViaUI: For testing the login form itself
 * - logout: For testing logout functionality
 * - isLoggedIn, clearAuthState: Utility functions
 * - waitForAPIReady, seedDatabase: Test setup helpers
 *
 * DEPRECATED functions (kept for backwards compatibility):
 * - loginViaLocalStorage: Now a no-op, use storageState instead
 * - loginViaAPI: Now a no-op, use storageState instead
 */

import { Page, APIRequestContext, expect } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

// Legacy test user for backwards compatibility
export const TEST_USER: TestUser = {
  email: 'demo@learngreekeasy.com',
  password: 'Demo123!',
  name: 'Demo User',
};

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
 * Get the API base URL from environment or default
 */
function getApiBaseUrl(): string {
  // Check for E2E-specific API URL first, then fall back to VITE_API_URL
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

/**
 * Wait for the application to be fully loaded and ready for interaction.
 *
 * This handles three scenarios:
 * 1. Fast (local): Loading never appears - we fall through after short timeout
 * 2. Normal: Loading appears quickly - we wait for it to disappear
 * 3. Slow (CI): Loading appears after a delay - waitFor catches it within timeout
 *
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait (default: 30000ms for CI environments)
 */
export async function waitForAppFullyLoaded(page: Page, timeout = 30000): Promise<void> {
  // Step 1: Wait for React to hydrate and auth check to complete
  await page.waitForSelector('[data-app-ready="true"]', {
    timeout,
    state: 'attached'
  });

  // Step 2: Wait for PageLoader Suspense fallback to resolve (if visible)
  const pageLoader = page.locator('[data-testid="page-loader"]');
  try {
    await pageLoader.waitFor({ state: 'visible', timeout: 1000 });
    await pageLoader.waitFor({ state: 'hidden', timeout: 15000 });
  } catch {
    // PageLoader never appeared (fast load) - fine
  }
}

/**
 * @deprecated Legacy login via UI is no longer supported.
 *
 * With Auth0 as the only authentication method, the login page now redirects
 * to Auth0 for authentication. This function is kept for backwards compatibility
 * but will throw an error explaining the new authentication flow.
 *
 * For E2E tests that need authentication:
 * - Use the storageState pattern (automatic with config)
 * - Auth setup (auth.setup.ts) uses test seed endpoint to get tokens
 *
 * @param page - Playwright page object
 * @param user - User credentials (no longer used)
 */
export async function loginViaUI(
  page: Page,
  _user: TestUser = SEED_USERS.LEARNER
): Promise<void> {
  throw new Error(
    'loginViaUI is deprecated. Auth0 is now the only authentication method. ' +
    'Use storageState pattern for authenticated tests. ' +
    'The auth.setup.ts file handles authentication via the test seed endpoint.'
  );
}

/**
 * @deprecated Use storageState pattern instead. This function now just navigates.
 *
 * With storageState pattern:
 * - Auth state is loaded from JSON file before test starts
 * - No need to call any login function
 * - Just navigate directly to your target page
 *
 * For unauthenticated tests, use:
 *   test.use({ storageState: { cookies: [], origins: [] } })
 */
export async function loginViaLocalStorage(
  page: Page,
  targetPath: string = '/',
  _user: TestUser = SEED_USERS.LEARNER
): Promise<void> {
  console.warn(
    '[DEPRECATED] loginViaLocalStorage is deprecated. ' +
    'Auth is now handled via storageState pattern. ' +
    'Just navigate directly to your target page.'
  );
  // Just navigate - storageState handles auth
  await page.goto(targetPath);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * @deprecated Use storageState pattern instead. This function now just navigates.
 *
 * With storageState pattern:
 * - Auth state is loaded from JSON file before test starts
 * - No need to call any login function
 * - Just navigate directly to your target page
 */
export async function loginViaAPI(
  page: Page,
  _user: TestUser = SEED_USERS.LEARNER,
  targetPath: string = '/'
): Promise<void> {
  console.warn(
    '[DEPRECATED] loginViaAPI is deprecated. ' +
    'Auth is now handled via storageState pattern. ' +
    'Just navigate directly to your target page.'
  );
  // Just navigate - storageState handles auth
  await page.goto(targetPath);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Logout via API and clear state
 * @param page - Playwright page object
 */
export async function logoutViaAPI(page: Page): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  try {
    // Get current token from localStorage
    const authStorage = await page.evaluate(() => {
      return localStorage.getItem('auth-storage');
    });

    if (authStorage) {
      const authState = JSON.parse(authStorage);
      const refreshToken = authState.state?.refreshToken;

      if (refreshToken) {
        // Call logout API
        await page.request.post(`${apiBaseUrl}/api/v1/auth/logout`, {
          data: { refresh_token: refreshToken },
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.state?.token}`,
          },
        });
      }
    }
  } catch (error) {
    console.warn('[TEST] API logout failed (may be expected):', error);
  }

  // Clear storage regardless of API result
  await clearAuthState(page);
}

/**
 * Logout via UI
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Open user menu dropdown
  const userMenuButton = page.getByTestId('user-menu-trigger');
  await userMenuButton.click();

  // Click logout using test ID
  const logoutButton = page.getByTestId('logout-button');
  await logoutButton.click();

  // Wait for dialog and confirm
  const dialog = page.getByTestId('logout-dialog');
  await dialog.waitFor({ state: 'visible', timeout: 5000 });

  const confirmButton = page.getByTestId('logout-confirm-button');
  await confirmButton.click();

  // Wait for redirect to login
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Check if user is logged in
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
 * Clear all storage and auth state
 * Call this in beforeEach hooks to ensure test isolation
 * @param page - Playwright page object
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  console.log('[TEST] Storage cleared for test isolation');
}

/**
 * Wait for API to be ready (useful for test setup)
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
 * Seed the database for E2E tests
 * @param request - Playwright APIRequestContext
 */
export async function seedDatabase(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  // Check if seeding is available
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

  // Perform seeding
  const seedResponse = await request.post(`${apiBaseUrl}/api/v1/test/seed/all`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!seedResponse.ok()) {
    const errorText = await seedResponse.text();
    throw new Error(`Database seeding failed: ${seedResponse.status()} - ${errorText}`);
  }

  console.log('[TEST] Database seeded successfully');
}

/**
 * Verify that seed users exist and can authenticate
 * This is useful for debugging auth setup failures
 * @param request - Playwright APIRequestContext
 * @throws Error if seeding is not enabled or users cannot login
 */
export async function verifySeedUsers(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  console.log('[TEST] Verifying seed users...');
  console.log(`[TEST] API Base URL: ${apiBaseUrl}`);

  // Step 1: Check seed status endpoint
  let statusResponse;
  try {
    statusResponse = await request.get(`${apiBaseUrl}/api/v1/test/seed/status`);
  } catch (error) {
    throw new Error(
      `[VERIFY] Failed to reach seed status endpoint at ${apiBaseUrl}/api/v1/test/seed/status: ${error}`
    );
  }

  if (!statusResponse.ok()) {
    throw new Error(
      `[VERIFY] Seed status endpoint returned ${statusResponse.status()}. ` +
      `Seeding may not be available. Response: ${await statusResponse.text()}`
    );
  }

  const status = await statusResponse.json();
  console.log('[TEST] Seed status:', JSON.stringify(status));

  if (!status.enabled) {
    throw new Error(
      '[VERIFY] TEST_SEED_ENABLED is not true on backend. ' +
      'Seed users will not exist. Set TEST_SEED_ENABLED=true in environment.'
    );
  }

  // Step 2: Try to get auth tokens for the primary test user via test seed endpoint
  const testUser = SEED_USERS.LEARNER;
  console.log(`[TEST] Attempting to authenticate ${testUser.email} via test seed endpoint...`);

  let authResponse;
  try {
    authResponse = await request.post(`${apiBaseUrl}/api/v1/test/seed/auth`, {
      data: {
        email: testUser.email,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    throw new Error(
      `[VERIFY] Failed to reach test auth endpoint at ${apiBaseUrl}/api/v1/test/seed/auth: ${error}`
    );
  }

  if (!authResponse.ok()) {
    let errorBody = 'Unknown error';
    try {
      const jsonBody = await authResponse.json();
      errorBody = jsonBody.detail || jsonBody.message || JSON.stringify(jsonBody);
    } catch {
      try {
        errorBody = await authResponse.text();
      } catch {
        // Keep default error message
      }
    }

    throw new Error(
      `[VERIFY] Seed user ${testUser.email} cannot authenticate. ` +
      `Status: ${authResponse.status()}, Error: ${errorBody}. ` +
      `This likely means the database was not seeded properly.`
    );
  }

  console.log(`[TEST] Successfully verified seed user ${testUser.email} can authenticate`);
}

/**
 * Verify authentication succeeded after navigation
 * Use in beforeEach hooks for protected page tests
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
        `  3. The token in storageState has expired\n` +
        `Current URL: ${currentUrl}`
    );
  }
}

/**
 * Wait for the application to be fully ready for interaction.
 *
 * This is the PREFERRED method for E2E tests - it's deterministic and doesn't
 * rely on timing assumptions.
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
 * Wait for RouteGuard auth check to complete after navigation
 *
 * RouteGuard shows "Loading your experience..." while verifying the auth token.
 * This loading state can appear AFTER page.goto() returns due to React hydration timing.
 *
 * The fix handles three scenarios:
 * 1. Fast (local): Loading never appears - we fall through after short timeout
 * 2. Normal: Loading appears quickly - we wait for it to disappear
 * 3. Slow (CI): Loading appears after a delay - waitFor catches it within timeout
 *
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait for loading to complete (default: 15000ms)
 */
export async function waitForAuthCheck(page: Page, timeout = 15000): Promise<void> {
  const loadingIndicator = page.getByTestId('auth-loading');

  try {
    // First try the new deterministic approach
    await page.waitForSelector('[data-app-ready="true"]', {
      state: 'attached',
      timeout: 5000,
    });
  } catch {
    // Fall back to waiting for loading to be hidden
    await expect(loadingIndicator).toBeHidden({ timeout });
  }
}
