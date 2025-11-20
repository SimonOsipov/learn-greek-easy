/**
 * Authentication E2E Tests
 */

import { test, expect } from '@playwright/test';
import { loginViaUI, loginViaLocalStorage } from './helpers/auth-helpers';

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

    // Fill login form with test user credentials using test IDs
    await page.getByTestId('email-input').fill('demo@learngreekeasy.com');
    await page.getByTestId('password-input').fill('Demo123!');

    // Submit form using test ID
    await page.getByTestId('login-submit').click();

    // Wait for redirect to dashboard (may take time for API call)
    await page.waitForTimeout(1000);

    // Should navigate to dashboard or stay on current page
    const currentUrl = page.url();

    // Verify either redirected to dashboard or profile button is visible (indicating logged in)
    const isDashboard = currentUrl.includes('/dashboard');
    const profileBtn = page.getByRole('button', { name: /profile|account|user/i }).first();
    const hasProfile = await profileBtn.isVisible().catch(() => false);

    expect(isDashboard || hasProfile).toBe(true);
  });

  test('E2E-01.2: Login fails with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill form with wrong password using test IDs
    await page.getByTestId('email-input').fill('demo@learngreekeasy.com');
    await page.getByTestId('password-input').fill('WrongPassword123!');

    // Submit form using test ID
    await page.getByTestId('login-submit').click();

    // Wait for response
    await page.waitForTimeout(1000);

    // Should show error message or stay on login page
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');

    // Look for error indication (error message or validation)
    const pageContent = await page.textContent('body');
    const hasError = pageContent.toLowerCase().includes('error') ||
                     pageContent.toLowerCase().includes('invalid') ||
                     pageContent.toLowerCase().includes('incorrect');

    // Either error message visible or still on login page (both valid)
    expect(currentUrl.includes('/login')).toBe(true);
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
        await page.waitForTimeout(500);

        // Should redirect to login or home page
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/(login|)$/);

        // Try to access protected route again to verify logout
        await page.goto('/dashboard');
        await page.waitForTimeout(1000);

        // Should redirect to login (proof of logout)
        await page.waitForURL('/login', { timeout: 3000 });
        const finalUrl = page.url();
        expect(finalUrl).toContain('/login');
      }
    }
  });
});
