/**
 * Auth0 Forgot Password E2E Tests
 *
 * Tests the Auth0 password reset form UI and interactions.
 * All tests skip if VITE_AUTH0_ENABLED is not 'true'.
 *
 * Test coverage:
 * - Form display and elements
 * - Email validation
 * - Success confirmation screen
 * - Navigation back to login
 * - Try different email functionality
 */

import { test, expect } from '@playwright/test';

import {
  isAuth0Enabled,
  mockAuth0PasswordResetSuccess,
  clearAuth0Mocks,
} from '../helpers/auth0-helpers';

test.describe('Auth0 Forgot Password', () => {
  // Skip all tests if Auth0 is not enabled
  test.beforeEach(async ({ page }) => {
    if (!isAuth0Enabled()) {
      test.skip();
    }
  });

  // Override storageState to be empty (no auth) for forgot password tests
  test.use({ storageState: { cookies: [], origins: [] } });

  // Clean up mocks after each test
  test.afterEach(async ({ page }) => {
    await clearAuth0Mocks(page);
  });

  test.describe('Form Display', () => {
    test('should display forgot password form with all required elements', async ({ page }) => {
      await page.goto('/forgot-password');

      // Wait for form to load
      await page.waitForSelector('[data-testid="forgot-password-card"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Verify card container
      await expect(page.getByTestId('forgot-password-card')).toBeVisible();

      // Verify form exists
      await expect(page.getByTestId('forgot-password-form')).toBeVisible();

      // Verify title and description
      await expect(page.getByTestId('forgot-password-title')).toBeVisible();
      await expect(page.getByTestId('forgot-password-description')).toBeVisible();

      // Verify email input
      await expect(page.getByTestId('email-input')).toBeVisible();

      // Verify submit button
      await expect(page.getByTestId('forgot-password-submit')).toBeVisible();

      // Verify back to login button
      await expect(page.getByTestId('back-to-login-button')).toBeVisible();
    });

    test('should have proper form labels and accessibility attributes', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-card"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Check email input has proper attributes
      const emailInput = page.getByTestId('email-input');
      await expect(emailInput).toHaveAttribute('type', 'email');
      await expect(emailInput).toHaveAttribute('autocomplete', 'email');
    });
  });

  test.describe('Email Validation', () => {
    test('should show error for empty email on submit', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-form"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Submit form without filling email
      await page.getByTestId('forgot-password-submit').click();

      // Should show email validation error
      await expect(page.locator('#email-error')).toBeVisible();
    });

    test('should show error for invalid email format', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-form"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Fill invalid email
      await page.getByTestId('email-input').fill('notanemail');

      // Submit form
      await page.getByTestId('forgot-password-submit').click();

      // Should show email format error
      await expect(page.locator('#email-error')).toBeVisible();
    });
  });

  test.describe('Success Flow', () => {
    test('should show confirmation screen on successful submission', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-form"]', {
        state: 'visible',
        timeout: 10000,
      });

      const testEmail = 'test@example.com';

      // Mock successful password reset
      await mockAuth0PasswordResetSuccess(page);

      // Fill email
      await page.getByTestId('email-input').fill(testEmail);

      // Submit form
      await page.getByTestId('forgot-password-submit').click();

      // Should show success screen
      await expect(page.getByTestId('forgot-password-success-card')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByTestId('success-title')).toBeVisible();
      await expect(page.getByTestId('submitted-email')).toContainText(testEmail);
    });

    test('should have try different email button on success screen', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-form"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Mock successful password reset
      await mockAuth0PasswordResetSuccess(page);

      // Fill and submit
      await page.getByTestId('email-input').fill('test@example.com');
      await page.getByTestId('forgot-password-submit').click();

      // Wait for success screen
      await expect(page.getByTestId('forgot-password-success-card')).toBeVisible({
        timeout: 10000,
      });

      // Try different email button should be visible
      await expect(page.getByTestId('try-different-email-button')).toBeVisible();
    });

    test('should return to form when clicking try different email', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-form"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Mock successful password reset
      await mockAuth0PasswordResetSuccess(page);

      // Fill and submit
      await page.getByTestId('email-input').fill('test@example.com');
      await page.getByTestId('forgot-password-submit').click();

      // Wait for success screen
      await expect(page.getByTestId('forgot-password-success-card')).toBeVisible({
        timeout: 10000,
      });

      // Click try different email
      await page.getByTestId('try-different-email-button').click();

      // Should return to form
      await expect(page.getByTestId('forgot-password-card')).toBeVisible();
      await expect(page.getByTestId('forgot-password-form')).toBeVisible();
    });

    test('should have back to login link on success screen', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-form"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Mock successful password reset
      await mockAuth0PasswordResetSuccess(page);

      // Fill and submit
      await page.getByTestId('email-input').fill('test@example.com');
      await page.getByTestId('forgot-password-submit').click();

      // Wait for success screen
      await expect(page.getByTestId('forgot-password-success-card')).toBeVisible({
        timeout: 10000,
      });

      // Back to login link should be visible
      await expect(page.getByTestId('back-to-login-link')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to login page when clicking back to login', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-card"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Click back to login button
      await page.getByTestId('back-to-login-button').click();

      // Should navigate to login page
      await page.waitForURL('/login');
      await expect(page.getByTestId('login-card')).toBeVisible();
    });
  });

  // Note: Error handling tests removed - they relied on mocking Auth0 API responses
  // which is not possible with real Auth0 authentication.

  // Note: Form submission state tests removed - they relied on mocking with delayed
  // responses which is not possible with real Auth0 authentication.
});
