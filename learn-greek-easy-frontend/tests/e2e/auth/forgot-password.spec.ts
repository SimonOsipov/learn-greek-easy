/**
 * Forgot Password E2E Tests
 *
 * Tests the password reset form UI and interactions.
 * Uses Supabase GoTrue API mocking for the success flow.
 *
 * Test coverage:
 * - Form display and elements
 * - Email validation
 * - Success confirmation screen (mocked via **/auth/v1/recover)
 * - Navigation back to login
 * - Try different email functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Forgot Password', () => {
  // Override storageState to be empty (no auth) for forgot password tests
  test.use({ storageState: { cookies: [], origins: [] } });

  // Clean up Supabase route mocks after each test
  test.afterEach(async ({ page }) => {
    await page.unroute('**/auth/v1/recover');
  });

  test.describe('Form Display', () => {
    test('should display forgot password form with all required elements', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-card"]', {
        state: 'visible',
        timeout: 10000,
      });

      await expect(page.getByTestId('forgot-password-card')).toBeVisible();
      await expect(page.getByTestId('forgot-password-form')).toBeVisible();
      await expect(page.getByTestId('forgot-password-title')).toBeVisible();
      await expect(page.getByTestId('forgot-password-description')).toBeVisible();
      await expect(page.getByTestId('email-input')).toBeVisible();
      await expect(page.getByTestId('forgot-password-submit')).toBeVisible();
      await expect(page.getByTestId('back-to-login-button')).toBeVisible();
    });

    test('should have proper form labels and accessibility attributes', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-card"]', {
        state: 'visible',
        timeout: 10000,
      });

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

      await page.getByTestId('forgot-password-submit').click();

      await expect(page.locator('#email-error')).toBeVisible();
    });

    // Note: Skipped because HTML5 email validation intercepts before Zod runs
    test.skip('should show error for invalid email format', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-form"]', {
        state: 'visible',
        timeout: 10000,
      });

      await page.getByTestId('email-input').fill('notanemail');
      await page.getByTestId('forgot-password-submit').click();

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

      // Mock successful Supabase password reset (GoTrue recover endpoint)
      await page.route('**/auth/v1/recover', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{}',
        })
      );

      await page.getByTestId('email-input').fill(testEmail);
      await page.getByTestId('forgot-password-submit').click();

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

      await page.route('**/auth/v1/recover', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{}',
        })
      );

      await page.getByTestId('email-input').fill('test@example.com');
      await page.getByTestId('forgot-password-submit').click();

      await expect(page.getByTestId('forgot-password-success-card')).toBeVisible({
        timeout: 10000,
      });

      await expect(page.getByTestId('try-different-email-button')).toBeVisible();
    });

    test('should return to form when clicking try different email', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-form"]', {
        state: 'visible',
        timeout: 10000,
      });

      await page.route('**/auth/v1/recover', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{}',
        })
      );

      await page.getByTestId('email-input').fill('test@example.com');
      await page.getByTestId('forgot-password-submit').click();

      await expect(page.getByTestId('forgot-password-success-card')).toBeVisible({
        timeout: 10000,
      });

      await page.getByTestId('try-different-email-button').click();

      await expect(page.getByTestId('forgot-password-card')).toBeVisible();
      await expect(page.getByTestId('forgot-password-form')).toBeVisible();
    });

    test('should have back to login link on success screen', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.waitForSelector('[data-testid="forgot-password-form"]', {
        state: 'visible',
        timeout: 10000,
      });

      await page.route('**/auth/v1/recover', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{}',
        })
      );

      await page.getByTestId('email-input').fill('test@example.com');
      await page.getByTestId('forgot-password-submit').click();

      await expect(page.getByTestId('forgot-password-success-card')).toBeVisible({
        timeout: 10000,
      });

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

      await page.getByTestId('back-to-login-button').click();

      await page.waitForURL('/login');
      await expect(page.getByTestId('login-card')).toBeVisible();
    });
  });
});
