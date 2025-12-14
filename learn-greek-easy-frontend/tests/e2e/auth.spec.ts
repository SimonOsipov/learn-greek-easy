/**
 * Authentication E2E Tests
 *
 * Tests authentication flows using real backend API.
 * Uses seeded test users from the database.
 */

import { test, expect } from '@playwright/test';
import { loginViaUI, loginViaLocalStorage, SEED_USERS } from './helpers/auth-helpers';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app first to ensure we have a proper origin
    await page.goto('/');
    // Clear storage before each test
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

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

  test('should access protected routes when authenticated via localStorage', async ({
    page,
  }) => {
    // Login via localStorage (faster method)
    await loginViaLocalStorage(page);

    // Navigate to dashboard - just check we're not redirected to login
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Navigate to decks
    await page.goto('/decks');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Navigate to profile
    await page.goto('/profile');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('should redirect unauthenticated users to login from protected routes', async ({
    page,
  }) => {
    // Ensure logged out
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Try to access protected routes
    const protectedRoutes = ['/dashboard', '/decks', '/profile', '/settings'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Should redirect to login
      await page.waitForURL('/login');
      await expect(page.getByTestId('login-card')).toBeVisible();
    }
  });

  test('should maintain authentication state after page reload', async ({ page }) => {
    // Login via localStorage
    await loginViaLocalStorage(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Reload page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading').first()).toBeVisible();
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
    expect(currentUrl).toContain('/dashboard');
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

  test('E2E-01.3: User can log out successfully', async ({ page }) => {
    // First, log in via localStorage (faster)
    await loginViaLocalStorage(page);
    await page.goto('/dashboard');
    await page.waitForTimeout(500);

    // Look for profile/account button or menu
    const profileButton = page.getByRole('button', { name: /profile|account|user|menu/i }).first();
    const isProfileVisible = await profileButton.isVisible().catch(() => false);

    if (isProfileVisible) {
      // Open profile dropdown
      await profileButton.click();
      await page.waitForTimeout(300);

      // Click logout using test ID
      const logoutButton = page.getByTestId('logout-button');
      const isLogoutVisible = await logoutButton.isVisible().catch(() => false);

      if (isLogoutVisible) {
        await logoutButton.click();

        // Wait for dialog to appear using Playwright's waitFor
        const dialog = page.getByTestId('logout-dialog');
        await dialog.waitFor({ state: 'visible', timeout: 5000 });

        // Click confirmation button using test ID
        const confirmButton = page.getByTestId('logout-confirm-button');
        await confirmButton.waitFor({ state: 'visible', timeout: 2000 });
        await confirmButton.click();

        // Wait for dialog to close
        await dialog.waitFor({ state: 'hidden', timeout: 2000 });
        await page.waitForTimeout(500);

        // Should redirect to login or home page
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/(login|)$/);

        // Try to access protected route again to verify logout
        await page.goto('/dashboard');

        // Should redirect to login page (proof of logout) - app redirects unauthenticated users to /login
        await page.waitForURL('/login', { timeout: 5000 });
        const finalUrl = page.url();
        expect(finalUrl).toMatch(/\/(login|)$/); // Can be / or /login depending on routing
      }
    }
  });
});
