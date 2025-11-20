/**
 * Sample E2E Test - Validates Playwright Setup
 */

import { test, expect } from '@playwright/test';
import { loginViaLocalStorage } from './helpers/auth-helpers';

test.describe('Playwright Setup Validation', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Learn Greek Easy/i);
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/login');
    await expect(page.getByTestId('login-card')).toBeVisible();

    // Check title - app uses Greek text "Καλώς ήρθατε!" (Welcome!)
    await expect(page.getByTestId('login-title')).toBeVisible();
    await expect(page.getByTestId('login-title')).toHaveText('Καλώς ήρθατε!');

    // Check form fields exist
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByTestId('password-input')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should access dashboard when authenticated', async ({ page }) => {
    // Login via localStorage (faster than UI login)
    // Note: loginViaLocalStorage goes to '/' which shows dashboard content when authenticated
    await loginViaLocalStorage(page);

    // Verify dashboard content is visible (dashboard is shown at '/' for authenticated users)
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /your progress/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /active decks/i })).toBeVisible();
  });

  test('should redirect to login when accessing protected route unauthenticated', async ({
    page,
  }) => {
    // Navigate first to ensure we have a proper origin
    await page.goto('/');
    // Clear storage (ensure logged out)
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Try to access protected route
    await page.goto('/dashboard');

    // Wait for redirect to complete
    await page.waitForURL('/login', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
    await expect(page.getByTestId('login-card')).toBeVisible();
    await expect(page.getByTestId('login-title')).toBeVisible();
    await expect(page.getByTestId('login-title')).toHaveText('Καλώς ήρθατε!');
  });
});
