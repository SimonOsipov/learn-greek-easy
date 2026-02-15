/**
 * Protected Routes E2E Tests
 *
 * Tests route protection and redirection behavior.
 *
 * Test coverage:
 * - Unauthenticated users redirected to login
 * - Public routes accessible without auth
 * - Authenticated users can access protected routes
 */

import { test, expect } from '@playwright/test';

test.describe('Protected Routes', () => {
  test.describe('Unauthenticated Access', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForURL('/login');
      await expect(page.getByTestId('login-card')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Public Routes', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('should allow access to landing page without auth', async ({ page }) => {
      await page.goto('/');

      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible({ timeout: 10000 });

      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/login');
    });

    test('should allow access to login page without auth', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByTestId('login-card')).toBeVisible({ timeout: 10000 });
    });

    test('should allow access to register page without auth', async ({ page }) => {
      await page.goto('/register');

      await expect(page.getByTestId('register-card')).toBeVisible({ timeout: 10000 });
    });

    test('should allow access to forgot password page without auth', async ({ page }) => {
      await page.goto('/forgot-password');

      await expect(page.getByTestId('forgot-password-card')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Authenticated Access', () => {
    // Uses default storageState from config (learner user)

    test('should allow authenticated access to dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page).not.toHaveURL(/\/login/);

      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
        timeout: 15000,
      });
    });

    test('should maintain auth state after page reload', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).not.toHaveURL(/\/login/);

      await page.reload();

      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
        timeout: 15000,
      });
    });
  });
});
