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
 * Authenticate a user via UI and save storage state
 */
async function authenticateAndSave(
  page: import('@playwright/test').Page,
  user: { email: string; password: string; name: string },
  storageStatePath: string
): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  console.log(`[SETUP] Starting authentication for ${user.email}`);
  console.log(`[SETUP] API Base URL: ${apiBaseUrl}`);

  // Navigate to login page
  await page.goto('/login');

  // Wait for login form to be ready
  await page.waitForSelector('[data-testid="login-card"]', { timeout: 15000 });

  // Fill login form
  await page.getByTestId('email-input').fill(user.email);
  await page.getByTestId('password-input').fill(user.password);

  // Check "Remember Me" to persist auth state in localStorage
  // Note: Using click() instead of check() because Radix UI renders
  // <button role="checkbox"> not native <input>, and check() times out
  await page.locator('#remember').click();

  // Set up response interception BEFORE clicking submit
  const responsePromise = page.waitForResponse(
    response =>
      response.url().includes('/api/v1/auth/login') &&
      response.request().method() === 'POST',
    { timeout: 20000 }
  );

  // Click submit
  await page.getByTestId('login-submit').click();

  // Wait for API response and capture details
  let response;
  try {
    response = await responsePromise;
  } catch (error) {
    // Take screenshot on timeout
    const screenshotPath = path.join(STORAGE_STATE_DIR, `login-error-timeout-${user.email.replace('@', '_at_')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(`[SETUP] Screenshot saved to ${screenshotPath}`);

    throw new Error(
      `[SETUP] Login API request timed out for ${user.email}. ` +
      `This may indicate the frontend is not correctly configured to call ${apiBaseUrl}. ` +
      `Screenshot saved to ${screenshotPath}`
    );
  }

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

    // Check for error alert on page
    const errorAlert = page.locator('[role="alert"]');
    const hasErrorAlert = await errorAlert.isVisible().catch(() => false);
    let pageError = '';
    if (hasErrorAlert) {
      pageError = await errorAlert.textContent() || '';
    }

    // Take screenshot on API error
    const screenshotPath = path.join(STORAGE_STATE_DIR, `login-error-api-${user.email.replace('@', '_at_')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(`[SETUP] Screenshot saved to ${screenshotPath}`);

    throw new Error(
      `[SETUP] Login API failed for ${user.email}. ` +
      `Status: ${response.status()}, Body: ${errorBody}` +
      (pageError ? ` | Page error: ${pageError}` : '') +
      ` | Screenshot: ${screenshotPath}`
    );
  }

  console.log(`[SETUP] Login API succeeded for ${user.email}, waiting for navigation...`);

  // Wait for successful login - verify we navigated away from login page
  try {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  } catch (navError) {
    // Check for error alert on page
    const errorAlert = page.locator('[role="alert"]');
    const hasErrorAlert = await errorAlert.isVisible().catch(() => false);
    let pageError = '';
    if (hasErrorAlert) {
      pageError = await errorAlert.textContent() || '';
    }

    // Take screenshot on navigation failure
    const screenshotPath = path.join(STORAGE_STATE_DIR, `login-error-nav-${user.email.replace('@', '_at_')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(`[SETUP] Screenshot saved to ${screenshotPath}`);

    throw new Error(
      `[SETUP] Login API succeeded but navigation failed for ${user.email}. ` +
      `Current URL: ${page.url()}` +
      (pageError ? ` | Page error: ${pageError}` : '') +
      ` | Screenshot: ${screenshotPath}`
    );
  }

  // Wait for authenticated content to ensure state is fully set
  try {
    await page.waitForSelector(
      '[data-testid="dashboard"], [data-testid="user-menu"], h1:has-text("Dashboard"), h1:has-text("Welcome"), nav[aria-label="Main navigation"]',
      { timeout: 10000 }
    );
  } catch (contentError) {
    // Take screenshot if authenticated content not found
    const screenshotPath = path.join(STORAGE_STATE_DIR, `login-error-content-${user.email.replace('@', '_at_')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(`[SETUP] Screenshot saved to ${screenshotPath}`);

    console.warn(
      `[SETUP] Warning: Could not find authenticated content for ${user.email}. ` +
      `URL: ${page.url()}. Proceeding anyway. Screenshot: ${screenshotPath}`
    );
  }

  // Small delay to ensure localStorage is fully persisted
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
