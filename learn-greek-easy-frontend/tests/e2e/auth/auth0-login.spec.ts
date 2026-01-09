/**
 * Auth0 Login E2E Tests
 *
 * Tests the Auth0 login form UI and interactions.
 * All tests skip if VITE_AUTH0_ENABLED is not 'true'.
 *
 * Test coverage:
 * - Form display and elements
 * - Email/password validation
 * - Password visibility toggle
 * - Navigation links (register, forgot password)
 * - Form submission states
 * - Error handling (mocked)
 */

import { test, expect } from '@playwright/test';

import {
  isAuth0Enabled,
  AUTH0_TEST_USERS,
  mockAuth0LoginError,
  waitForAuth0Form,
  fillAuth0LoginForm,
  clearAuth0Mocks,
} from '../helpers/auth0-helpers';

test.describe('Auth0 Login', () => {
  // Skip all tests if Auth0 is not enabled
  test.beforeEach(async ({ page }) => {
    if (!isAuth0Enabled()) {
      test.skip();
    }
  });

  // Override storageState to be empty (no auth) for login tests
  test.use({ storageState: { cookies: [], origins: [] } });

  // Clean up mocks after each test
  test.afterEach(async ({ page }) => {
    await clearAuth0Mocks(page);
  });

  test.describe('Form Display', () => {
    test('should display login form with all required elements', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Verify card container
      await expect(page.getByTestId('login-card')).toBeVisible();

      // Verify form exists
      await expect(page.getByTestId('login-form')).toBeVisible();

      // Verify title and description
      await expect(page.getByTestId('login-title')).toBeVisible();
      await expect(page.getByTestId('login-description')).toBeVisible();

      // Verify form fields
      await expect(page.getByTestId('email-input')).toBeVisible();
      await expect(page.getByTestId('password-input')).toBeVisible();

      // Verify submit button
      await expect(page.getByTestId('login-submit')).toBeVisible();

      // Verify Google login button
      await expect(page.getByTestId('google-login-button')).toBeVisible();

      // Verify navigation links
      await expect(page.getByTestId('register-link')).toBeVisible();
      await expect(page.getByText(/forgot password/i)).toBeVisible();
    });

    test('should have proper form labels and accessibility attributes', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Check email input has associated label
      const emailInput = page.getByTestId('email-input');
      await expect(emailInput).toHaveAttribute('type', 'email');
      await expect(emailInput).toHaveAttribute('autocomplete', 'email');

      // Check password input has associated label
      const passwordInput = page.getByTestId('password-input');
      await expect(passwordInput).toHaveAttribute('type', 'password');
      await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });
  });

  test.describe('Email Validation', () => {
    test('should show error for empty email on submit', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Fill only password
      await page.getByTestId('password-input').fill('TestPassword123!');

      // Submit form
      await page.getByTestId('login-submit').click();

      // Should show email validation error
      await expect(page.locator('#email-error')).toBeVisible();
    });

    test('should show error for invalid email format', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Fill invalid email
      await page.getByTestId('email-input').fill('notanemail');
      await page.getByTestId('password-input').fill('TestPassword123!');

      // Submit form
      await page.getByTestId('login-submit').click();

      // Should show email format error
      await expect(page.locator('#email-error')).toBeVisible();
    });
  });

  test.describe('Password Validation', () => {
    test('should show error for empty password on submit', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Fill only email
      await page.getByTestId('email-input').fill(AUTH0_TEST_USERS.LEARNER.email);

      // Submit form
      await page.getByTestId('login-submit').click();

      // Should show password validation error
      await expect(page.locator('#password-error')).toBeVisible();
    });

    test('should show error for password less than 8 characters', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Fill short password
      await page.getByTestId('email-input').fill(AUTH0_TEST_USERS.LEARNER.email);
      await page.getByTestId('password-input').fill('short');

      // Submit form
      await page.getByTestId('login-submit').click();

      // Should show password length error
      await expect(page.locator('#password-error')).toBeVisible();
    });
  });

  test.describe('Password Visibility Toggle', () => {
    test('should toggle password visibility when clicking eye icon', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      const passwordInput = page.getByTestId('password-input');

      // Initially password should be hidden
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Fill password
      await passwordInput.fill('TestPassword123!');

      // Find and click the toggle button (eye icon)
      const toggleButton = page.locator('button[aria-label*="Show"], button[aria-label*="Hide"]');
      await toggleButton.click();

      // Password should now be visible
      await expect(passwordInput).toHaveAttribute('type', 'text');

      // Click again to hide
      await toggleButton.click();

      // Password should be hidden again
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to register page when clicking register link', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Click register link
      await page.getByTestId('register-link').click();

      // Should navigate to register page
      await page.waitForURL('/register');
      await expect(page.getByTestId('register-card')).toBeVisible();
    });

    test('should navigate to forgot password page when clicking forgot password link', async ({
      page,
    }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Click forgot password link
      await page.getByText(/forgot password/i).click();

      // Should navigate to forgot password page
      await page.waitForURL('/forgot-password');
      await expect(page.getByTestId('forgot-password-card')).toBeVisible();
    });
  });

  test.describe('Form Submission States', () => {
    test('should disable form inputs during submission', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Set up a delayed response to capture the loading state
      await page.route('**/oauth/token', async (route) => {
        // Delay the response to simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Wrong email or password.',
          }),
        });
      });

      // Fill form
      await fillAuth0LoginForm(page, AUTH0_TEST_USERS.LEARNER.email, 'WrongPassword123!');

      // Submit form
      await page.getByTestId('login-submit').click();

      // Check that inputs are disabled during submission
      await expect(page.getByTestId('email-input')).toBeDisabled();
      await expect(page.getByTestId('password-input')).toBeDisabled();

      // Wait for form to be re-enabled
      await expect(page.getByTestId('email-input')).not.toBeDisabled({ timeout: 10000 });
    });
  });

  test.describe('Error Handling', () => {
    test('should show error message for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Mock invalid credentials error
      await mockAuth0LoginError(page, 'invalid_grant');

      // Fill form with credentials
      await fillAuth0LoginForm(page, AUTH0_TEST_USERS.LEARNER.email, 'WrongPassword123!');

      // Submit form
      await page.getByTestId('login-submit').click();

      // Should show error message
      await expect(page.getByTestId('form-error')).toBeVisible({ timeout: 10000 });
    });

    test('should show error message for too many login attempts', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Mock too many attempts error
      await mockAuth0LoginError(page, 'too_many_attempts');

      // Fill form
      await fillAuth0LoginForm(page, AUTH0_TEST_USERS.LEARNER.email, 'SomePassword123!');

      // Submit form
      await page.getByTestId('login-submit').click();

      // Should show error message
      await expect(page.getByTestId('form-error')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Remember Me', () => {
    test('should have remember me checkbox', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      // Find remember me checkbox
      const rememberMeCheckbox = page.locator('#remember');
      await expect(rememberMeCheckbox).toBeVisible();

      // Initially unchecked
      await expect(rememberMeCheckbox).not.toBeChecked();

      // Click to check
      await rememberMeCheckbox.click();

      // Should be checked
      await expect(rememberMeCheckbox).toBeChecked();
    });
  });

  test.describe('Google Login Button', () => {
    test('should have Google login button visible and enabled', async ({ page }) => {
      await page.goto('/login');
      await waitForAuth0Form(page, 'login-form');

      const googleButton = page.getByTestId('google-login-button');

      // Button should be visible
      await expect(googleButton).toBeVisible();

      // Button should be enabled
      await expect(googleButton).not.toBeDisabled();

      // Button should contain Google text
      await expect(googleButton).toContainText(/google/i);
    });
  });
});
