/**
 * Authentication E2E Tests
 *
 * Tests authentication flows using real backend API.
 * Uses Playwright's storageState pattern for efficient authentication.
 *
 * Test Organization:
 * - Unauthenticated tests: Use empty storageState to test login/register forms
 * - Authenticated tests: Use default storageState (learner user) from config
 */

import { test, expect } from '@playwright/test';
import { SEED_USERS } from './helpers/auth-helpers';

/**
 * UNAUTHENTICATED TESTS
 *
 * These tests use empty storageState to ensure no user is logged in.
 * This is required for testing login forms, registration, and
 * authentication redirects.
 */
test.describe('Unauthenticated - Login & Register Forms', () => {
  // Override storageState to be empty (no auth)
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should display login form with all elements', async ({ page }) => {
    await page.goto('/login');

    // Verify page title
    await expect(page).toHaveTitle(/Learn Greek Easy/i);

    // Verify card and form structure using test IDs
    await expect(page.getByTestId('login-card')).toBeVisible();
    await expect(page.getByTestId('login-form')).toBeVisible();

    // Verify form fields using test IDs
    await expect(page.getByTestId('email-input')).toBeVisible();
    await expect(page.getByTestId('password-input')).toBeVisible();

    // Verify submit button using test ID
    await expect(page.getByTestId('login-submit')).toBeVisible();

    // Verify "Don't have an account?" link
    await expect(page.getByText(/don't have an account/i)).toBeVisible();
  });

  test('should navigate to register page from login', async ({ page }) => {
    await page.goto('/login');

    // Click on register link using test ID
    await page.getByTestId('register-link').click();

    // Should navigate to register page
    await page.waitForURL('/register');
    await expect(page.getByTestId('register-card')).toBeVisible();
  });

  test('should display register form with all elements', async ({ page }) => {
    await page.goto('/register');

    // Verify page title
    await expect(page).toHaveTitle(/Learn Greek Easy/i);

    // Verify card and form structure using test IDs
    await expect(page.getByTestId('register-card')).toBeVisible();
    await expect(page.getByTestId('register-form')).toBeVisible();

    // Verify form fields using test IDs
    await expect(page.getByTestId('name-input')).toBeVisible();
    await expect(page.getByTestId('email-input')).toBeVisible();
    await expect(page.getByTestId('password-input')).toBeVisible();
    await expect(page.getByTestId('confirm-password-input')).toBeVisible();

    // Verify submit button using test ID
    await expect(page.getByTestId('register-submit')).toBeVisible();

    // Verify "Already have an account?" link
    await expect(page.getByText(/already have an account/i)).toBeVisible();
  });

  test('should redirect unauthenticated users to login from protected routes', async ({
    page,
  }) => {
    // Try to access protected routes
    const protectedRoutes = ['/dashboard', '/decks', '/profile'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Should redirect to login
      await page.waitForURL('/login');
      await expect(page.getByTestId('login-card')).toBeVisible();
    }
  });

  test('E2E-01.1: User can log in with valid credentials (via UI)', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Verify login form exists using test ID
    await expect(page.getByTestId('login-card')).toBeVisible();

    // Fill login form with seed user credentials
    await page.getByTestId('email-input').fill(SEED_USERS.LEARNER.email);
    await page.getByTestId('password-input').fill(SEED_USERS.LEARNER.password);

    // Submit form using test ID
    await page.getByTestId('login-submit').click();

    // Wait for redirect to dashboard (with increased timeout for real API)
    await page.waitForURL('/dashboard', { timeout: 15000 });

    // Verify we're on dashboard
    const currentUrl = page.url();
    expect(currentUrl.includes('/dashboard')).toBeTruthy();
  });

  test('E2E-01.2: Login fails with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill form with wrong password using test IDs
    await page.getByTestId('email-input').fill(SEED_USERS.LEARNER.email);
    await page.getByTestId('password-input').fill('WrongPassword123!');

    // Submit form using test ID
    await page.getByTestId('login-submit').click();

    // Wait for response (real API call)
    await page.waitForTimeout(2000);

    // Should still be on login page
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');

    // Look for error indication
    const errorMessage = page.getByText(/invalid|incorrect|error|failed/i);
    const hasError = await errorMessage.isVisible().catch(() => false);

    // Either error message visible or still on login page (both valid)
    expect(currentUrl.includes('/login') || hasError).toBe(true);
  });
});

/**
 * AUTHENTICATED TESTS
 *
 * These tests use the default storageState from config (learner user).
 * The storageState is loaded BEFORE the test starts, so the user is
 * already authenticated when the browser opens.
 *
 * This eliminates:
 * - Per-test login overhead
 * - Zustand hydration race conditions
 * - Complex auth injection workarounds
 */
test.describe('Authenticated - Protected Routes & Logout', () => {
  // Uses default storageState from config (learner user)
  // No need to call loginViaLocalStorage or loginViaAPI

  test('should access protected routes when authenticated', async ({ page }) => {
    // Navigate to dashboard - should work with pre-loaded auth
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15000 });

    // Navigate to decks
    await page.goto('/decks');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /decks|flashcard/i })).toBeVisible({ timeout: 15000 });

    // Navigate to profile
    await page.goto('/profile');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible({ timeout: 15000 });
  });

  test('should maintain authentication state after page reload', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15000 });

    // Reload page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15000 });
  });

  test('E2E-01.3: User can log out successfully', async ({ page }) => {
    // Navigate to dashboard (auth state already loaded)
    await page.goto('/dashboard');

    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded');

    // Use data-testid selector for user menu button (from Header.tsx)
    const userMenuButton = page.getByTestId('user-menu-trigger');

    // Wait for user menu button - this confirms Header has rendered
    await userMenuButton.waitFor({ state: 'visible', timeout: 10000 });

    // Click to open user menu dropdown
    await userMenuButton.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(300);

    // Click logout button
    const logoutButton = page.getByTestId('logout-button');
    await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
    await logoutButton.click();

    // Wait for confirmation dialog
    const dialog = page.getByTestId('logout-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    // Click confirm button
    const confirmButton = page.getByTestId('logout-confirm-button');
    await confirmButton.waitFor({ state: 'visible', timeout: 2000 });
    await confirmButton.click();

    // Wait for logout to complete and redirect to main landing page
    // The handleLogout awaits logout() then navigates to /
    await page.waitForURL('/', { timeout: 15000 });

    // Verify we're on the landing page
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 5000 });

    // Final verification: URL should be /
    expect(page.url().endsWith('/') || page.url().endsWith('/#')).toBe(true);
  });
});
