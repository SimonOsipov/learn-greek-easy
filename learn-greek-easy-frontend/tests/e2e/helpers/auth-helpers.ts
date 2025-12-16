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
};

/**
 * Get the API base URL from environment or default
 */
function getApiBaseUrl(): string {
  // Check for E2E-specific API URL first, then fall back to VITE_API_URL
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

/**
 * Login via UI with robust error handling
 *
 * Use this for:
 * - Testing the login form UI itself
 * - Tests that specifically verify login functionality
 *
 * For other tests, use storageState pattern (automatic with config)
 *
 * @param page - Playwright page object
 * @param user - User credentials (defaults to SEED_USERS.LEARNER for real backend)
 */
export async function loginViaUI(
  page: Page,
  user: TestUser = SEED_USERS.LEARNER
): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Wait for login form to be ready
  await page.waitForSelector('[data-testid="login-card"]', { timeout: 10000 });

  // Fill login form
  await page.getByTestId('email-input').fill(user.email);
  await page.getByTestId('password-input').fill(user.password);

  // Set up response interception BEFORE clicking submit
  const responsePromise = page.waitForResponse(
    response =>
      response.url().includes('/api/v1/auth/login') &&
      response.request().method() === 'POST',
    { timeout: 15000 }
  );

  // Click submit
  await page.getByTestId('login-submit').click();

  // Wait for API response
  const response = await responsePromise;

  // Check if API succeeded
  if (!response.ok()) {
    // Get error details from response body
    let errorBody = 'Unknown error';
    try {
      const jsonBody = await response.json();
      errorBody = jsonBody.detail || jsonBody.message || JSON.stringify(jsonBody);
    } catch {
      try {
        errorBody = await response.text();
      } catch {
        // Keep default error message
      }
    }

    // Also check if error message appeared on page
    const errorAlert = page.locator('[role="alert"]');
    const hasErrorAlert = await errorAlert.isVisible().catch(() => false);
    let pageError = '';
    if (hasErrorAlert) {
      pageError = await errorAlert.textContent() || '';
    }

    throw new Error(
      `Login API failed with status ${response.status()}: ${errorBody}` +
      (pageError ? ` | Page error: ${pageError}` : '')
    );
  }

  // API succeeded, wait for navigation away from login page
  try {
    // Wait until we're no longer on /login
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 10000 });
  } catch (navError) {
    const currentUrl = page.url();

    // Check for error message on page
    const errorAlert = page.locator('[role="alert"]');
    const hasErrorAlert = await errorAlert.isVisible().catch(() => false);

    if (hasErrorAlert) {
      const errorText = await errorAlert.textContent() || 'Unknown error';
      throw new Error(`Login navigation failed - error on page: ${errorText}`);
    }

    throw new Error(
      `Login succeeded but navigation failed. ` +
      `Current URL: ${currentUrl}. `
    );
  }

  // Verify we're no longer on login page (dashboard is at /)
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    throw new Error(
      `Expected to be on dashboard (/) but still on: ${currentUrl}`
    );
  }

  console.log('[TEST] loginViaUI: Successfully logged in and navigated to dashboard');
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
  // Open profile dropdown
  const profileButton = page.getByRole('button', { name: /profile|account|user|menu/i }).first();
  await profileButton.click();

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

  // Step 2: Try to login as the primary test user
  const testUser = SEED_USERS.LEARNER;
  console.log(`[TEST] Attempting to login as ${testUser.email}...`);

  let loginResponse;
  try {
    loginResponse = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
      data: {
        email: testUser.email,
        password: testUser.password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    throw new Error(
      `[VERIFY] Failed to reach login endpoint at ${apiBaseUrl}/api/v1/auth/login: ${error}`
    );
  }

  if (!loginResponse.ok()) {
    let errorBody = 'Unknown error';
    try {
      const jsonBody = await loginResponse.json();
      errorBody = jsonBody.detail || jsonBody.message || JSON.stringify(jsonBody);
    } catch {
      try {
        errorBody = await loginResponse.text();
      } catch {
        // Keep default error message
      }
    }

    throw new Error(
      `[VERIFY] Seed user ${testUser.email} cannot login. ` +
      `Status: ${loginResponse.status()}, Error: ${errorBody}. ` +
      `This likely means the database was not seeded properly.`
    );
  }

  console.log(`[TEST] Successfully verified seed user ${testUser.email} can login`);
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

// TODO: Remove after debugging - Debug helper functions

/**
 * Capture browser console messages filtered by E2E-DEBUG prefix
 * Sets up a listener that logs all E2E-DEBUG messages from the browser
 *
 * @param page - Playwright page object
 * @returns Cleanup function to remove the listener
 */
export function captureConsoleMessages(page: Page): () => void {
  const handler = (msg: import('@playwright/test').ConsoleMessage) => {
    const text = msg.text();
    if (text.includes('[E2E-DEBUG]')) {
      console.log(`[BROWSER] ${text}`);
    }
  };

  page.on('console', handler);

  return () => {
    page.off('console', handler);
  };
}

/**
 * Enhanced version of waitForAppReady with detailed timeout state logging
 *
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait (default: 30000ms)
 */
export async function waitForAppReadyWithDebug(page: Page, timeout = 30000): Promise<void> {
  const startTime = Date.now();

  console.log(`[E2E-DEBUG-TEST] waitForAppReadyWithDebug START | timeout=${timeout}ms`);

  try {
    await page.waitForSelector('[data-app-ready="true"]', {
      state: 'attached',
      timeout,
    });
    console.log(`[E2E-DEBUG-TEST] waitForAppReadyWithDebug SUCCESS | elapsed=${Date.now() - startTime}ms`);
  } catch (error) {
    // On timeout, log the current state
    const elapsed = Date.now() - startTime;
    console.log(`[E2E-DEBUG-TEST] waitForAppReadyWithDebug TIMEOUT | elapsed=${elapsed}ms`);

    // Try to get current app-ready state
    try {
      const appReadyAttr = await page.getAttribute('[data-app-ready]', 'data-app-ready');
      console.log(`[E2E-DEBUG-TEST] data-app-ready attribute value: ${appReadyAttr}`);
    } catch {
      console.log(`[E2E-DEBUG-TEST] data-app-ready element not found`);
    }

    // Check for auth-loading indicator
    const authLoading = page.getByTestId('auth-loading');
    const isAuthLoadingVisible = await authLoading.isVisible().catch(() => false);
    console.log(`[E2E-DEBUG-TEST] auth-loading visible: ${isAuthLoadingVisible}`);

    // Check current URL
    console.log(`[E2E-DEBUG-TEST] current URL: ${page.url()}`);

    throw error;
  }
}
