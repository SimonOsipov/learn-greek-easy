/**
 * Reset Password E2E Tests
 *
 * Tests the reset password form UI and interactions.
 * Note: These tests only cover UI rendering since the reset flow
 * requires a valid Supabase recovery token in the URL hash.
 */

import { test, expect } from '@playwright/test';

test.describe('Reset Password', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('Form Display', () => {
    test('should display reset password form with all required elements', async ({ page }) => {
      await page.goto('/reset-password');

      await page.waitForSelector('[data-testid="reset-password-card"]', {
        state: 'visible',
        timeout: 10000,
      });

      await expect(page.getByTestId('reset-password-card')).toBeVisible();
      await expect(page.getByTestId('reset-password-form')).toBeVisible();
      await expect(page.getByTestId('reset-password-title')).toBeVisible();
      await expect(page.getByTestId('reset-password-description')).toBeVisible();
      await expect(page.getByTestId('password-input')).toBeVisible();
      await expect(page.getByTestId('confirm-password-input')).toBeVisible();
      await expect(page.getByTestId('reset-password-submit')).toBeVisible();
    });

    test('should have hidden email input for password managers', async ({ page }) => {
      await page.goto('/reset-password');

      await page.waitForSelector('[data-testid="reset-password-card"]', {
        state: 'visible',
        timeout: 10000,
      });

      const hiddenInput = page.getByTestId('hidden-email-input');
      await expect(hiddenInput).toHaveAttribute('type', 'email');
      await expect(hiddenInput).toHaveAttribute('autocomplete', 'username');
      await expect(hiddenInput).toHaveAttribute('aria-hidden', 'true');
    });

    test('should have back to login button', async ({ page }) => {
      await page.goto('/reset-password');

      await page.waitForSelector('[data-testid="reset-password-card"]', {
        state: 'visible',
        timeout: 10000,
      });

      await expect(page.getByTestId('back-to-login-button')).toBeVisible();
      await page.getByTestId('back-to-login-button').click();
      await page.waitForURL('/login', { timeout: 10000 });
    });

    test('should show password strength indicator when typing', async ({ page }) => {
      await page.goto('/reset-password');

      await page.waitForSelector('[data-testid="reset-password-card"]', {
        state: 'visible',
        timeout: 10000,
      });

      await page.getByTestId('password-input').fill('test');
      await expect(page.getByTestId('password-strength-indicator')).toBeVisible();
    });
  });
});
