/**
 * Authentication Helpers for E2E Tests
 *
 * Uses real backend API for authentication when available.
 * Falls back to localStorage injection for mock scenarios.
 */

import { Page, APIRequestContext } from '@playwright/test';
import { enableTestDiagnostics, logAuthState } from './diagnostics';

/**
 * Retry helper for flaky network requests
 */
async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  context: string = 'request'
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message || String(lastError);

      const isRetryable =
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('socket hang up') ||
        errorMessage.includes('network') ||
        errorMessage.includes('timeout');

      if (!isRetryable || attempt === maxRetries) {
        console.error(`[TEST] ${context} failed after ${attempt} attempt(s):`, errorMessage);
        throw lastError;
      }

      console.log(`[TEST] ${context} attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Verify auth state is correctly set in localStorage
 * Returns true if authenticated, false if auth was cleared by Zustand
 */
async function verifyAuthStateInLocalStorage(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return false;
    try {
      const parsed = JSON.parse(stored);
      return parsed.state?.isAuthenticated === true && parsed.state?.token !== null;
    } catch {
      return false;
    }
  });
}

/**
 * Re-inject auth data directly into localStorage via page.evaluate
 * Used when addInitScript injection was overwritten by Zustand persist
 */
async function reinjectAuthState(page: Page, authData: object): Promise<void> {
  await page.evaluate((data) => {
    localStorage.setItem('auth-storage', JSON.stringify(data));
    sessionStorage.setItem('auth-token', (data as any).state.token);
    console.log('[TEST] Auth data re-injected via page.evaluate (Zustand overwrote)');
  }, authData);
}

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
 * Login via real backend API and inject tokens
 * This is the preferred method for E2E tests with a real backend
 *
 * CRITICAL: Uses addInitScript to inject localStorage BEFORE React loads.
 * This prevents Zustand's persist middleware from overwriting auth state
 * during hydration.
 *
 * Flow:
 * 1. Get tokens via API (before any navigation)
 * 2. Register addInitScript to set localStorage on page load
 * 3. Navigate to target path
 * 4. localStorage is set BEFORE React/Zustand initializes
 * 5. Zustand rehydrates from existing localStorage correctly
 *
 * @param page - Playwright page object
 * @param user - User credentials (defaults to SEED_USERS.LEARNER)
 * @param targetPath - Path to navigate to after login (defaults to '/dashboard')
 */
export async function loginViaAPI(
  page: Page,
  user: TestUser = SEED_USERS.LEARNER,
  targetPath: string = '/dashboard'
): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  // Enable diagnostics for debugging
  await enableTestDiagnostics(page);

  try {
    // 1. Get tokens via API FIRST (before any navigation) - with retry for flaky connections
    const tokenData = await retryRequest(
      async () => {
        const loginResponse = await page.request.post(`${apiBaseUrl}/api/v1/auth/login`, {
          data: { email: user.email, password: user.password },
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });
        if (!loginResponse.ok()) {
          const errorText = await loginResponse.text();
          throw new Error(`Login API failed: ${loginResponse.status()} - ${errorText}`);
        }
        return await loginResponse.json();
      },
      3,
      1000,
      'Login API'
    );

    // 2. Fetch user profile - with retry for flaky connections
    const profileData = await retryRequest(
      async () => {
        const profileResponse = await page.request.get(`${apiBaseUrl}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
          timeout: 10000,
        });
        if (!profileResponse.ok()) {
          throw new Error(`Profile API failed: ${profileResponse.status()}`);
        }
        return await profileResponse.json();
      },
      3,
      1000,
      'Profile API'
    );
    // Handle wrapped response (data field) or direct response
    const userData = profileData.data || profileData;

    // 3. Build auth data matching Zustand store structure
    const authData = {
      state: {
        user: {
          id: userData.id,
          email: userData.email,
          displayName: userData.display_name || userData.displayName || userData.email.split('@')[0],
          nativeLanguage: userData.native_language || userData.nativeLanguage || 'en',
          createdAt: userData.created_at || userData.createdAt || new Date().toISOString(),
        },
        token: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        isAuthenticated: true,
        rememberMe: true,
        isLoading: false,
        error: null,
      },
      version: 0,
    };

    // 4. Use addInitScript to set localStorage BEFORE React loads
    // This runs on every navigation, ensuring auth state persists
    await page.addInitScript((data) => {
      // Set auth storage before any JavaScript runs
      localStorage.setItem('auth-storage', JSON.stringify(data));
      // Also set session storage token as backup
      sessionStorage.setItem('auth-token', data.state.token);
      console.log('[TEST] Auth data injected via addInitScript (before React)');
    }, authData);

    // 5. Navigate directly to target path - localStorage is set BEFORE React initializes
    await page.goto(targetPath);
    await page.waitForLoadState('domcontentloaded');

    // 6. CRITICAL: Verify auth state wasn't overwritten by Zustand's persist middleware
    // This is a Chromium-specific race condition where Zustand can initialize
    // before addInitScript completes, causing it to read empty state and overwrite our auth
    const authStateValid = await verifyAuthStateInLocalStorage(page);

    if (!authStateValid) {
      console.log('[TEST] Auth state was overwritten by Zustand - re-injecting and reloading');

      // Re-inject auth state directly via page.evaluate
      await reinjectAuthState(page, authData);

      // Reload the page to pick up the corrected auth state
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // Give React a moment to hydrate with correct state
      await page.waitForTimeout(100);

      // Verify again after reload
      const authStateValidAfterReload = await verifyAuthStateInLocalStorage(page);
      if (!authStateValidAfterReload) {
        await logAuthState(page);
        throw new Error('Auth state still invalid after re-injection - this indicates a deeper issue');
      }

      console.log('[TEST] Auth state successfully re-injected and verified');
    }

    // 7. Wait for authenticated content to appear
    try {
      await page.waitForSelector(
        '[data-testid="dashboard"], [data-testid="user-menu"], h1:has-text("Dashboard"), h1:has-text("Welcome"), nav[aria-label="Main navigation"]',
        { timeout: 10000 }
      );
    } catch {
      // Log diagnostic info if wait fails
      console.log('[TEST] Auth verification failed, checking state...');
      const currentUrl = page.url();
      console.log(`[TEST] Current URL: ${currentUrl}`);

      // Log auth state for debugging
      await logAuthState(page);

      throw new Error(`Authentication failed - page did not show authenticated content. URL: ${currentUrl}`);
    }

    // 8. Log final auth state for debugging
    await logAuthState(page);
  } catch (error) {
    console.error('[TEST] API login failed:', error);
    throw error;
  }
}

/**
 * Login via UI with robust error handling
 *
 * This function:
 * 1. Sets up API response interception before clicking submit
 * 2. Checks if the login API succeeded or failed
 * 3. Detects error messages displayed on the login page
 * 4. Uses Promise.race for efficient success/failure detection
 *
 * @param page - Playwright page object
 * @param user - User credentials (defaults to SEED_USERS.LEARNER for real backend)
 */
export async function loginViaUI(
  page: Page,
  user: TestUser = SEED_USERS.LEARNER
): Promise<void> {
  // Enable diagnostics for debugging
  await enableTestDiagnostics(page);

  // Navigate to login page
  await page.goto('/login');

  // Wait for login form to be ready
  await page.waitForSelector('[data-testid="login-card"]', { timeout: 10000 });

  // Fill login form
  await page.getByTestId('email-input').fill(user.email);
  await page.getByTestId('password-input').fill(user.password);

  // Set up response interception BEFORE clicking submit
  // This ensures we don't miss the response due to timing
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

    // Log auth state for debugging
    await logAuthState(page);

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

  // API succeeded, now wait for navigation to dashboard
  // This should be quick since the API already succeeded
  try {
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  } catch (navError) {
    // Navigation failed - check current state
    const currentUrl = page.url();

    // Check for error message on page
    const errorAlert = page.locator('[role="alert"]');
    const hasErrorAlert = await errorAlert.isVisible().catch(() => false);

    if (hasErrorAlert) {
      const errorText = await errorAlert.textContent() || 'Unknown error';
      await logAuthState(page);
      throw new Error(`Login navigation failed - error on page: ${errorText}`);
    }

    // Log auth state for debugging
    await logAuthState(page);

    throw new Error(
      `Login succeeded but navigation to dashboard failed. ` +
      `Current URL: ${currentUrl}. ` +
      `This may indicate a routing issue or slow state update.`
    );
  }

  // Verify we're actually on the dashboard
  const currentUrl = page.url();
  if (!currentUrl.includes('/dashboard')) {
    await logAuthState(page);
    throw new Error(
      `Expected to be on /dashboard but got: ${currentUrl}`
    );
  }

  // Log success for debugging
  console.log('[TEST] loginViaUI: Successfully logged in and navigated to dashboard');
  await logAuthState(page);
}

/**
 * Login via localStorage (now uses UI login for reliability)
 *
 * Previously used addInitScript to inject auth state directly, but this
 * caused race conditions with Zustand's persist middleware in Chromium.
 *
 * Now uses loginViaUI which is slower but 100% reliable since it goes
 * through the app's real login flow.
 *
 * @param page - Playwright page object
 * @param targetPath - Path to navigate to after login (defaults to '/dashboard')
 * @param user - User credentials (defaults to SEED_USERS.LEARNER)
 */
export async function loginViaLocalStorage(
  page: Page,
  targetPath: string = '/dashboard',
  user: TestUser = SEED_USERS.LEARNER
): Promise<void> {
  // Use the real login flow - no race conditions with Zustand persist
  await loginViaUI(page, user);

  // Navigate to target path if different from dashboard
  // loginViaUI always ends up on /dashboard after successful login
  if (targetPath !== '/dashboard' && targetPath !== '/') {
    await page.goto(targetPath);
    await page.waitForLoadState('domcontentloaded');
  }
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
