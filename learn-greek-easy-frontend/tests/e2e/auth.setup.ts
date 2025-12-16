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

import { test as setup, expect } from '@playwright/test';
import { SEED_USERS } from './helpers/auth-helpers';

// Storage state file paths
const STORAGE_STATE_DIR = 'playwright/.auth';

/**
 * Authenticate a user via UI and save storage state
 */
async function authenticateAndSave(
  page: import('@playwright/test').Page,
  user: { email: string; password: string; name: string },
  storageStatePath: string
): Promise<void> {
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

  // Click submit and wait for navigation
  await page.getByTestId('login-submit').click();

  // Wait for successful login - verify we navigated away from login page
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

  // Wait for authenticated content to ensure state is fully set
  await page.waitForSelector(
    '[data-testid="dashboard"], [data-testid="user-menu"], h1:has-text("Dashboard"), h1:has-text("Welcome"), nav[aria-label="Main navigation"]',
    { timeout: 10000 }
  );

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
