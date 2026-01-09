/**
 * Authentication Setup for Playwright
 *
 * This file runs ONCE before all tests to authenticate each user role
 * and save their browser state (cookies, localStorage) to JSON files.
 *
 * Tests then use these saved states via storageState config, eliminating
 * the need for per-test authentication and Zustand race condition workarounds.
 *
 * @see https://playwright.dev/docs/auth
 */

import { test as setup, expect, request } from '@playwright/test';
import { SEED_USERS, verifySeedUsers, waitForAPIReady } from './helpers/auth-helpers';
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
 * Authenticate a user via test seed API and save storage state
 *
 * Since Auth0 is now the only authentication method, we can't use the UI login
 * form (it would redirect to Auth0). Instead, we:
 * 1. Get auth tokens from the test seed endpoint
 * 2. Set up localStorage with the auth state
 * 3. Navigate to verify the auth works
 * 4. Save the browser state
 */
async function authenticateAndSave(
  page: import('@playwright/test').Page,
  user: { email: string; password: string; name: string },
  storageStatePath: string
): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  console.log(`[SETUP] Starting authentication for ${user.email}`);
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
  await page.evaluate(({ tokens, userEmail, userName }) => {
    // Set up the auth-storage in the format expected by useAuthStore
    const authState = {
      state: {
        user: {
          id: tokens.user_id,
          email: userEmail,
          full_name: userName,
        },
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
