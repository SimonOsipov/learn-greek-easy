/**
 * Auth0-specific E2E Test Helpers
 *
 * Provides utilities for testing Auth0 authentication flows including:
 * - Feature flag checking (isAuth0Enabled)
 * - API mocking for Auth0 responses
 * - Test user credentials
 *
 * These helpers enable deterministic testing of Auth0 UI without requiring
 * a real Auth0 tenant or network calls.
 */

import { Page } from '@playwright/test';

/**
 * Check if Auth0 is enabled for the current environment.
 * Tests should skip if Auth0 is not enabled.
 */
export function isAuth0Enabled(): boolean {
  return process.env.VITE_AUTH0_ENABLED === 'true';
}

/**
 * Test users for Auth0 authentication tests
 * These match the seed users in the backend
 */
export const AUTH0_TEST_USERS = {
  LEARNER: {
    email: 'e2e_learner@test.com',
    password: 'TestPassword123!',
    name: 'E2E Learner',
  },
  ADMIN: {
    email: 'e2e_admin@test.com',
    password: 'TestPassword123!',
    name: 'E2E Admin',
  },
};

/**
 * Auth0 error codes that can be simulated
 */
export type Auth0ErrorCode =
  | 'invalid_grant' // Invalid credentials
  | 'too_many_attempts' // Account locked
  | 'access_denied' // Access denied
  | 'unauthorized' // Not authorized
  | 'user_exists' // Email already registered
  | 'password_strength_error' // Password too weak
  | 'invalid_signup' // Signup validation failed
  | 'network_error'; // Network failure

/**
 * Mock successful Auth0 login API response.
 * Intercepts the Auth0 authentication request and returns success.
 *
 * @param page - Playwright page object
 */
export async function mockAuth0LoginSuccess(page: Page): Promise<void> {
  // Mock the Auth0 oauth/token endpoint
  await page.route('**/oauth/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock_access_token_12345',
        refresh_token: 'mock_refresh_token_12345',
        id_token: 'mock_id_token_12345',
        token_type: 'Bearer',
        expires_in: 86400,
      }),
    });
  });

  // Mock the Auth0 userinfo endpoint
  await page.route('**/userinfo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sub: 'auth0|mock_user_id',
        email: AUTH0_TEST_USERS.LEARNER.email,
        email_verified: true,
        name: AUTH0_TEST_USERS.LEARNER.name,
        picture: 'https://example.com/avatar.png',
      }),
    });
  });
}

/**
 * Mock Auth0 login error response.
 * Intercepts the Auth0 authentication request and returns an error.
 *
 * @param page - Playwright page object
 * @param errorCode - The Auth0 error code to simulate
 */
export async function mockAuth0LoginError(
  page: Page,
  errorCode: Auth0ErrorCode
): Promise<void> {
  const errorResponses: Record<Auth0ErrorCode, { status: number; error: string; description: string }> = {
    invalid_grant: {
      status: 401,
      error: 'invalid_grant',
      description: 'Wrong email or password.',
    },
    too_many_attempts: {
      status: 429,
      error: 'too_many_attempts',
      description: 'Your account has been blocked after multiple consecutive login attempts.',
    },
    access_denied: {
      status: 403,
      error: 'access_denied',
      description: 'Access denied.',
    },
    unauthorized: {
      status: 401,
      error: 'unauthorized',
      description: 'Unauthorized.',
    },
    user_exists: {
      status: 400,
      error: 'user_exists',
      description: 'The user already exists.',
    },
    password_strength_error: {
      status: 400,
      error: 'password_strength_error',
      description: 'Password is too weak.',
    },
    invalid_signup: {
      status: 400,
      error: 'invalid_signup',
      description: 'Invalid sign up.',
    },
    network_error: {
      status: 500,
      error: 'server_error',
      description: 'Network error occurred.',
    },
  };

  const response = errorResponses[errorCode];

  await page.route('**/oauth/token', async (route) => {
    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body: JSON.stringify({
        error: response.error,
        error_description: response.description,
      }),
    });
  });

  // Also mock the dbconnections endpoint for signup errors
  await page.route('**/dbconnections/signup', async (route) => {
    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body: JSON.stringify({
        code: response.error,
        description: response.description,
        name: response.error,
        statusCode: response.status,
      }),
    });
  });
}

/**
 * Mock successful Auth0 signup API response.
 * Intercepts the Auth0 signup request and returns success.
 *
 * @param page - Playwright page object
 * @param email - The email address for the new user (optional)
 */
export async function mockAuth0SignupSuccess(page: Page, email?: string): Promise<void> {
  await page.route('**/dbconnections/signup', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        _id: 'mock_user_id_12345',
        email: email || 'newuser@test.com',
        email_verified: false,
        family_name: '',
        given_name: 'Test',
        name: 'Test User',
      }),
    });
  });
}

/**
 * Mock Auth0 signup error for existing email.
 *
 * @param page - Playwright page object
 */
export async function mockAuth0SignupEmailExists(page: Page): Promise<void> {
  await page.route('**/dbconnections/signup', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'user_exists',
        description: 'The user already exists.',
        name: 'BadRequestError',
        statusCode: 400,
      }),
    });
  });
}

/**
 * Mock successful Auth0 password reset (change password) API response.
 *
 * @param page - Playwright page object
 */
export async function mockAuth0PasswordResetSuccess(page: Page): Promise<void> {
  await page.route('**/dbconnections/change_password', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: "We've just sent you an email to reset your password.",
      }),
    });
  });
}

/**
 * Mock Auth0 password reset error.
 *
 * @param page - Playwright page object
 */
export async function mockAuth0PasswordResetError(page: Page): Promise<void> {
  await page.route('**/dbconnections/change_password', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'server_error',
        description: 'Something went wrong. Please try again later.',
      }),
    });
  });
}

/**
 * Wait for Auth0 form to be fully loaded and interactive.
 *
 * @param page - Playwright page object
 * @param formTestId - The test ID of the form element (e.g., 'login-form')
 */
export async function waitForAuth0Form(page: Page, formTestId: string): Promise<void> {
  // Wait for the form to be visible
  await page.waitForSelector(`[data-testid="${formTestId}"]`, {
    state: 'visible',
    timeout: 10000,
  });

  // Wait for the email input to be ready for interaction
  await page.waitForSelector('[data-testid="email-input"]', {
    state: 'visible',
    timeout: 5000,
  });
}

/**
 * Fill the Auth0 login form with credentials.
 *
 * @param page - Playwright page object
 * @param email - Email address
 * @param password - Password
 */
export async function fillAuth0LoginForm(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
}

/**
 * Fill the Auth0 registration form with user details.
 *
 * @param page - Playwright page object
 * @param name - User's name
 * @param email - Email address
 * @param password - Password
 * @param acceptTerms - Whether to check the terms checkbox
 */
export async function fillAuth0RegisterForm(
  page: Page,
  name: string,
  email: string,
  password: string,
  acceptTerms: boolean = true
): Promise<void> {
  await page.getByTestId('name-input').fill(name);
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('confirm-password-input').fill(password);

  if (acceptTerms) {
    await page.locator('#terms').check();
  }
}

/**
 * Clear all Auth0 routes/mocks from the page.
 * Call this in afterEach to ensure clean state between tests.
 *
 * @param page - Playwright page object
 */
export async function clearAuth0Mocks(page: Page): Promise<void> {
  await page.unroute('**/oauth/token');
  await page.unroute('**/userinfo');
  await page.unroute('**/dbconnections/signup');
  await page.unroute('**/dbconnections/change_password');
}
