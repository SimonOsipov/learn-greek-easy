/**
 * Authentication Helpers for E2E Tests
 *
 * Uses real backend API for authentication when available.
 * Falls back to localStorage injection for mock scenarios.
 */

import { Page, APIRequestContext } from '@playwright/test';
import { enableTestDiagnostics, logAuthState } from './diagnostics';

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

// Legacy test user for backwards compatibility
export const TEST_USER: TestUser = {
  email: 'demo@learngreekeasy.com',
  password: 'Demo123!',
  name: 'Demo User',
};

// Seed users - available when TEST_SEED_ENABLED=true in environment
// These users have real data (decks, cards, progress, reviews)
export const SEED_USERS = {
  // Regular learner with progress history, card stats, and reviews
  LEARNER: {
    email: 'e2e_learner@test.com',
    password: 'TestPassword123!',
    name: 'E2E Learner',
  } as TestUser,
  // New user with no progress (for new user journey tests)
  BEGINNER: {
    email: 'e2e_beginner@test.com',
    password: 'TestPassword123!',
    name: 'E2E Beginner',
  } as TestUser,
  // Advanced user with more progress
  ADVANCED: {
    email: 'e2e_advanced@test.com',
    password: 'TestPassword123!',
    name: 'E2E Advanced',
  } as TestUser,
  // Admin user
  ADMIN: {
    email: 'e2e_admin@test.com',
    password: 'TestPassword123!',
    name: 'E2E Admin',
  } as TestUser,
};

/**
 * Get the API base URL from environment or default
 */
function getApiBaseUrl(): string {
  // Check for E2E-specific API URL first, then fall back to VITE_API_URL
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

/**
 * Login via real backend API and inject tokens
 * This is the preferred method for E2E tests with a real backend
 *
 * @param page - Playwright page object
 * @param user - User credentials (defaults to SEED_USERS.LEARNER)
 * @param targetPath - Path to navigate to after login (defaults to '/dashboard')
 */
export async function loginViaAPI(
  page: Page,
  user: TestUser = SEED_USERS.LEARNER,
  targetPath: string = '/dashboard'
): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  // Enable diagnostics for debugging
  await enableTestDiagnostics(page);

  // First navigate to establish origin context
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  try {
    // Call real backend API to get tokens
    const loginResponse = await page.request.post(`${apiBaseUrl}/api/v1/auth/login`, {
      data: {
        email: user.email,
        password: user.password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!loginResponse.ok()) {
      const errorText = await loginResponse.text();
      throw new Error(`Login API failed: ${loginResponse.status()} - ${errorText}`);
    }

    const tokenData = await loginResponse.json();

    // Fetch user profile
    const profileResponse = await page.request.get(`${apiBaseUrl}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok()) {
      throw new Error(`Profile API failed: ${profileResponse.status()}`);
    }

    const profileData = await profileResponse.json();

    // Build auth data matching Zustand store structure
    const authData = {
      state: {
        user: {
          id: profileData.id,
          email: profileData.email,
          name: profileData.full_name || profileData.email.split('@')[0],
          role: profileData.is_superuser ? 'admin' : 'free',
          preferences: {
            language: 'en',
            dailyGoal: profileData.settings?.daily_goal || 20,
            notifications: profileData.settings?.email_notifications ?? true,
            theme: 'light',
          },
          stats: {
            streak: 0,
            wordsLearned: 0,
            totalXP: 0,
            joinedDate: profileData.created_at,
          },
          createdAt: profileData.created_at,
          updatedAt: profileData.updated_at,
        },
        token: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        isAuthenticated: true,
        rememberMe: true,
      },
      version: 0,
    };

    // Inject auth data into localStorage
    await page.evaluate((data) => {
      localStorage.clear();
      sessionStorage.clear();

      localStorage.setItem('auth-storage', JSON.stringify(data));
      sessionStorage.setItem('auth-token', data.state.token);

      console.log('[TEST] Auth data injected via API login');
    }, authData);

    // Navigate to target page
    await page.goto(targetPath);
    await page.waitForLoadState('domcontentloaded');

    // Wait for app to be ready
    await page.waitForSelector('[data-testid="app-container"], [data-testid="dashboard"], nav, main', {
      timeout: 10000,
    });

    // Log final auth state for debugging
    await logAuthState(page);
  } catch (error) {
    console.error('[TEST] API login failed:', error);
    throw error;
  }
}

/**
 * Login via UI
 * @param page - Playwright page object
 * @param user - User credentials (defaults to SEED_USERS.LEARNER for real backend)
 */
export async function loginViaUI(
  page: Page,
  user: TestUser = SEED_USERS.LEARNER
): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Fill login form
  await page.getByTestId('email-input').fill(user.email);
  await page.getByTestId('password-input').fill(user.password);

  // Submit form
  await page.getByTestId('login-submit').click();

  // Wait for redirect to dashboard (with increased timeout for real API)
  await page.waitForURL('/dashboard', { timeout: 15000 });
}

/**
 * Login via localStorage (faster - bypass UI)
 * Uses API authentication to get real tokens, then injects into localStorage
 *
 * @param page - Playwright page object
 * @param targetPath - Path to navigate to after login (defaults to '/dashboard')
 * @param user - User credentials (defaults to SEED_USERS.LEARNER)
 */
export async function loginViaLocalStorage(
  page: Page,
  targetPath: string = '/dashboard',
  user: TestUser = SEED_USERS.LEARNER
): Promise<void> {
  // Use API-based login which is now the standard approach
  await loginViaAPI(page, user, targetPath);
}

/**
 * Logout via API and clear state
 * @param page - Playwright page object
 */
export async function logoutViaAPI(page: Page): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  try {
    // Get current token from localStorage
    const authStorage = await page.evaluate(() => {
      return localStorage.getItem('auth-storage');
    });

    if (authStorage) {
      const authState = JSON.parse(authStorage);
      const refreshToken = authState.state?.refreshToken;

      if (refreshToken) {
        // Call logout API
        await page.request.post(`${apiBaseUrl}/api/v1/auth/logout`, {
          data: { refresh_token: refreshToken },
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.state?.token}`,
          },
        });
      }
    }
  } catch (error) {
    console.warn('[TEST] API logout failed (may be expected):', error);
  }

  // Clear storage regardless of API result
  await clearAuthState(page);
}

/**
 * Logout via UI
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Open profile dropdown
  const profileButton = page.getByRole('button', { name: /profile|account|user|menu/i }).first();
  await profileButton.click();

  // Click logout using test ID
  const logoutButton = page.getByTestId('logout-button');
  await logoutButton.click();

  // Wait for dialog and confirm
  const dialog = page.getByTestId('logout-dialog');
  await dialog.waitFor({ state: 'visible', timeout: 5000 });

  const confirmButton = page.getByTestId('logout-confirm-button');
  await confirmButton.click();

  // Wait for redirect to login
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Check if user is logged in
 * @param page - Playwright page object
 * @returns True if logged in, false otherwise
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const authStorage = await page.evaluate(() => {
    return localStorage.getItem('auth-storage');
  });

  if (!authStorage) return false;

  const authState = JSON.parse(authStorage);
  return authState.state?.isAuthenticated === true;
}

/**
 * Clear all storage and auth state
 * Call this in beforeEach hooks to ensure test isolation
 * @param page - Playwright page object
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  console.log('[TEST] Storage cleared for test isolation');
}

/**
 * Wait for API to be ready (useful for test setup)
 * @param request - Playwright APIRequestContext
 * @param maxRetries - Maximum number of retries (default: 30)
 * @param retryInterval - Interval between retries in ms (default: 1000)
 */
export async function waitForAPIReady(
  request: APIRequestContext,
  maxRetries: number = 30,
  retryInterval: number = 1000
): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await request.get(`${apiBaseUrl}/health/ready`);
      if (response.ok()) {
        console.log('[TEST] API is ready');
        return;
      }
    } catch (error) {
      // API not ready yet
    }

    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }
  }

  throw new Error(`API not ready after ${maxRetries} attempts`);
}

/**
 * Seed the database for E2E tests
 * @param request - Playwright APIRequestContext
 */
export async function seedDatabase(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  // Check if seeding is available
  const statusResponse = await request.get(`${apiBaseUrl}/api/v1/test/seed/status`);

  if (!statusResponse.ok()) {
    console.warn('[TEST] Seeding not available - running with existing data');
    return;
  }

  const status = await statusResponse.json();
  if (!status.enabled) {
    console.warn('[TEST] Seeding disabled - running with existing data');
    return;
  }

  // Perform seeding
  const seedResponse = await request.post(`${apiBaseUrl}/api/v1/test/seed/all`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!seedResponse.ok()) {
    const errorText = await seedResponse.text();
    throw new Error(`Database seeding failed: ${seedResponse.status()} - ${errorText}`);
  }

  console.log('[TEST] Database seeded successfully');
}
