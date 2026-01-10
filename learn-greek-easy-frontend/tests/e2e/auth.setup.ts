/**
 * Authentication Setup for Playwright
 *
 * This file runs ONCE before all tests to authenticate each user role
 * and save their browser state (cookies, localStorage) to JSON files.
 *
 * Tests then use these saved states via storageState config, eliminating
 * the need for per-test authentication and Zustand race condition workarounds.
 *
 * Authentication Modes:
 * - Auth0 Mode: When AUTH0_E2E_TEST_PASSWORD is set, authenticates via Auth0 login UI
 * - Legacy Mode: Uses test seed endpoint for token generation (default)
 *
 * @see https://playwright.dev/docs/auth
 */

import { test as setup, expect, request } from '@playwright/test';
import { SEED_USERS, verifySeedUsers, waitForAPIReady } from './helpers/auth-helpers';
import { isAuth0Enabled, AUTH0_TEST_USERS } from './helpers/auth0-helpers';
import * as fs from 'fs';
import * as path from 'path';

// Storage state file paths
const STORAGE_STATE_DIR = 'playwright/.auth';

// Ensure auth directory exists
if (!fs.existsSync(STORAGE_STATE_DIR)) {
  fs.mkdirSync(STORAGE_STATE_DIR, { recursive: true });
}

/**
 * Get API base URL from environment
 */
function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

/**
 * Verify backend is ready before running auth setup
 */
setup.beforeAll(async () => {
  const apiBaseUrl = getApiBaseUrl();
  console.log(`[SETUP] Verifying backend readiness at ${apiBaseUrl}`);

  const apiRequest = await request.newContext({ baseURL: apiBaseUrl });

  try {
    // Check /health/ready endpoint
    console.log('[SETUP] Checking /health/ready...');
    const healthResponse = await apiRequest.get('/health/ready');
    if (!healthResponse.ok()) {
      const text = await healthResponse.text();
      throw new Error(`Backend health check failed: ${healthResponse.status()} - ${text}`);
    }
    console.log('[SETUP] Backend health check passed');

    // Check seed status and verify users can login
    console.log('[SETUP] Verifying seed users exist and can login...');
    await verifySeedUsers(apiRequest);
    console.log('[SETUP] Seed users verified successfully');
  } catch (error) {
    console.error('[SETUP] Backend verification failed:', error);
    throw error;
  } finally {
    await apiRequest.dispose();
  }
});

/**
 * Authenticate a user via Auth0 login UI
 *
 * This method is used when AUTH0_E2E_TEST_PASSWORD is set, indicating
 * we should test against the real Auth0 tenant.
 *
 * Flow:
 * 1. Navigate to /login
 * 2. Fill in email/password
 * 3. Submit the form
 * 4. Wait for successful redirect to dashboard
 * 5. Save storage state
 */
async function authenticateViaAuth0(
  page: import('@playwright/test').Page,
  user: { email: string; password: string; name: string },
  storageStatePath: string
): Promise<void> {
  console.log(`[SETUP] Starting Auth0 authentication for ${user.email}`);

  // Step 1: Navigate to login page
  await page.goto('/login');

  // Step 2: Wait for the login form to be visible
  await page.waitForSelector('[data-testid="login-form"]', {
    state: 'visible',
    timeout: 10000,
  });

  console.log(`[SETUP] Login form visible, filling credentials for ${user.email}`);

  // Step 3: Fill in the credentials
  await page.getByTestId('email-input').fill(user.email);
  await page.getByTestId('password-input').fill(user.password);

  // Step 4: Check "Remember me" to persist auth state to localStorage
  // This is critical - without it, auth is stored only in sessionStorage
  // which doesn't persist across storageState saves
  const rememberMeCheckbox = page.locator('#remember');
  await rememberMeCheckbox.check();

  // Step 5: Submit the form
  await page.getByTestId('login-submit').click();

  // Step 6: Wait for successful authentication - should redirect away from login
  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
  } catch (error) {
    // Check if there's an error message on the page
    const errorElement = page.getByTestId('form-error');
    const hasError = await errorElement.isVisible().catch(() => false);
    if (hasError) {
      const errorText = await errorElement.textContent();
      throw new Error(
        `[SETUP] Auth0 login failed for ${user.email}: ${errorText}`
      );
    }
    throw new Error(
      `[SETUP] Auth0 login timeout for ${user.email}. Still on login page after 30s.`
    );
  }

  console.log(`[SETUP] Auth0 login successful for ${user.email}`);

  // Step 7: Wait for app to be ready
  try {
    await page.waitForSelector('[data-app-ready="true"]', {
      timeout: 30000,
      state: 'attached',
    });
  } catch {
    console.warn(`[SETUP] Warning: data-app-ready not found for ${user.email}`);
  }

  // Step 8: Save storage state
  await page.context().storageState({ path: storageStatePath });

  console.log(`[SETUP] Saved Auth0 auth state for ${user.email} to ${storageStatePath}`);
}

/**
 * Authenticate a user via test seed API and save storage state
 *
 * This is the legacy method used when AUTH0_E2E_TEST_PASSWORD is not set.
 * It uses the test seed endpoint to get tokens without going through Auth0.
 *
 * Flow:
 * 1. Get auth tokens from the test seed endpoint
 * 2. Set up localStorage with the auth state
 * 3. Navigate to verify the auth works
 * 4. Save the browser state
 */
async function authenticateViaSeedAPI(
  page: import('@playwright/test').Page,
  user: { email: string; password: string; name: string },
  storageStatePath: string
): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  console.log(`[SETUP] Starting seed API authentication for ${user.email}`);
  console.log(`[SETUP] API Base URL: ${apiBaseUrl}`);

  // Step 1: Get auth tokens from test seed endpoint
  const apiRequest = await request.newContext({ baseURL: apiBaseUrl });
  let authResponse;
  try {
    authResponse = await apiRequest.post('/api/v1/test/seed/auth', {
      data: { email: user.email },
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    await apiRequest.dispose();
    throw new Error(
      `[SETUP] Failed to reach test auth endpoint for ${user.email}: ${error}`
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
    await apiRequest.dispose();
    throw new Error(
      `[SETUP] Test auth endpoint failed for ${user.email}. ` +
      `Status: ${authResponse.status()}, Body: ${errorBody}`
    );
  }

  const authData = await authResponse.json();
  await apiRequest.dispose();

  console.log(`[SETUP] Got auth tokens for ${user.email}, setting up localStorage...`);

  // Step 2: Navigate to the app first (required for localStorage)
  await page.goto('/');

  // Step 3: Set up localStorage with auth state matching Zustand store format
  // The User type requires: id, email, name, role, preferences, stats, createdAt, updatedAt
  await page.evaluate(({ tokens, userEmail, userName }) => {
    const now = new Date().toISOString();

    // Create a complete User object matching the frontend's User type
    const user = {
      id: tokens.user_id,
      email: userEmail,
      name: userName,  // Frontend uses 'name', not 'full_name'
      role: userEmail.includes('admin') ? 'admin' : 'free',
      preferences: {
        language: 'en',
        dailyGoal: 20,
        notifications: true,
        theme: 'light',
      },
      stats: {
        streak: 0,
        wordsLearned: 0,
        totalXP: 0,
        joinedDate: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    // Set up the auth-storage in the format expected by useAuthStore
    const authState = {
      state: {
        user,
        token: tokens.access_token,
        refreshToken: tokens.refresh_token,
        isAuthenticated: true,
        rememberMe: true,
        error: null,
      },
      version: 0,
    };
    localStorage.setItem('auth-storage', JSON.stringify(authState));
  }, { tokens: authData, userEmail: user.email, userName: user.name });

  // Step 4: Reload to pick up the localStorage state
  await page.reload();

  // Step 5: Wait for app to be ready and verify we're authenticated
  try {
    await page.waitForSelector('[data-app-ready="true"]', {
      timeout: 30000,
      state: 'attached'
    });
  } catch {
    console.warn(`[SETUP] Warning: data-app-ready not found for ${user.email}`);
  }

  // Verify we're not on the login page
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    const screenshotPath = path.join(STORAGE_STATE_DIR, `login-error-${user.email.replace('@', '_at_')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    throw new Error(
      `[SETUP] Authentication failed for ${user.email}. ` +
      `Still on login page after setting localStorage. Screenshot: ${screenshotPath}`
    );
  }

  // Small delay to ensure state is fully set
  await page.waitForTimeout(500);

  // Save storage state to file
  await page.context().storageState({ path: storageStatePath });

  console.log(`[SETUP] Saved auth state for ${user.email} to ${storageStatePath}`);
}

/**
 * Authenticate a user and save storage state
 *
 * Routes to either Auth0 or seed API authentication based on environment.
 */
async function authenticateAndSave(
  page: import('@playwright/test').Page,
  user: { email: string; password: string; name: string },
  storageStatePath: string
): Promise<void> {
  if (isAuth0Enabled()) {
    // Use Auth0 login UI - get the Auth0 user credentials
    const auth0User = user.email.includes('admin')
      ? AUTH0_TEST_USERS.ADMIN
      : AUTH0_TEST_USERS.LEARNER;
    await authenticateViaAuth0(page, auth0User, storageStatePath);
  } else {
    // Use seed API for token generation
    await authenticateViaSeedAPI(page, user, storageStatePath);
  }
}

// Setup test for LEARNER user (primary test user with progress)
setup('authenticate as learner', async ({ page }) => {
  await authenticateAndSave(
    page,
    SEED_USERS.LEARNER,
    `${STORAGE_STATE_DIR}/learner.json`
  );
});

// Setup test for BEGINNER user (new user with no progress)
setup('authenticate as beginner', async ({ page }) => {
  await authenticateAndSave(
    page,
    SEED_USERS.BEGINNER,
    `${STORAGE_STATE_DIR}/beginner.json`
  );
});

// Setup test for ADVANCED user (user with more progress)
setup('authenticate as advanced', async ({ page }) => {
  await authenticateAndSave(
    page,
    SEED_USERS.ADVANCED,
    `${STORAGE_STATE_DIR}/advanced.json`
  );
});

// Setup test for ADMIN user
setup('authenticate as admin', async ({ page }) => {
  await authenticateAndSave(
    page,
    SEED_USERS.ADMIN,
    `${STORAGE_STATE_DIR}/admin.json`
  );
});
