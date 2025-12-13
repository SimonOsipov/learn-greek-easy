/**
 * Authentication Helpers for E2E Tests
 */

import { Page } from '@playwright/test';
import { logAuthState } from './diagnostics';

// TypeScript declarations for test-mode globals
declare global {
  interface Window {
    playwright?: boolean;
    __REGISTER_TEST_TOKEN__?: { token: string; userId: string };
  }
}

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

// Test user credentials - using actual demo user from mock data
export const TEST_USER: TestUser = {
  email: 'demo@learngreekeasy.com',
  password: 'Demo123!',
  name: 'Demo User',
};

/**
 * Generate a valid mock token that matches the format expected by mockAuthAPI
 * @param userId - User ID to encode in the token
 * @returns A properly formatted mock token
 */
function generateValidMockToken(userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `mock.${btoa(userId)}.${timestamp}.${random}`;
}

/**
 * Login via UI
 * @param page - Playwright page object
 * @param user - User credentials (defaults to TEST_USER)
 */
export async function loginViaUI(
  page: Page,
  user: TestUser = TEST_USER
): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Fill login form
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);

  // Submit form
  await page.getByRole('button', { name: /log in/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard');
}

/**
 * Login via localStorage (faster - bypass UI)
 * Uses a SINGLE atomic addInitScript() to inject auth state BEFORE page loads
 * This prevents timing issues with authentication state
 * @param page - Playwright page object
 */
export async function loginViaLocalStorage(page: Page): Promise<void> {
  const userId = 'user-1';
  const mockToken = generateValidMockToken(userId);

  // CRITICAL: Single atomic init script that:
  // 1. Sets window.playwright FIRST (before ANY other code)
  // 2. Sets auth storage
  // 3. Sets up diagnostics AFTER
  //
  // This ensures window.playwright = true is set before any other code runs.
  // Multiple separate addInitScript calls execute in registration order,
  // which caused timing issues where diagnostics ran before auth was set.
  await page.context().addInitScript((authData) => {
    // STEP 1: Set test mode flag FIRST (before ANY other code in this script)
    // This MUST be the first line to ensure mockAuthAPI.isTestMode() returns true
    window.playwright = true;

    // STEP 2: Clear and set storage
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('auth-storage', JSON.stringify(authData));
    sessionStorage.setItem('auth-token', authData.state.token);

    // STEP 3: Log diagnostics (AFTER window.playwright is set)
    console.log('[TEST] Test mode active, window.playwright =', window.playwright);
    console.log('[TEST] Auth storage initialized');

    // STEP 4: Override localStorage.setItem for diagnostic logging
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key: string, value: string) {
      console.log('[TEST] localStorage.setItem:', key, value.substring(0, 100));
      return originalSetItem.call(this, key, value);
    };

    // Listen for storage events
    window.addEventListener('storage', (e) => {
      console.log('[TEST] Storage event:', e.key);
    });
  }, {
    state: {
      user: {
        id: userId,
        email: 'demo@learngreekeasy.com',
        name: 'Demo User',
        role: 'premium',
        avatar: undefined,
        preferences: {
          language: 'en',
          dailyGoal: 15,
          notifications: true,
        },
        stats: {
          streak: 7,
          wordsLearned: 142,
          totalXP: 1250,
        },
      },
      token: mockToken,
      isAuthenticated: true,
      rememberMe: true,
    },
    version: 0,
  });

  // Set up console capture (doesn't need init script - runs in Node.js)
  page.on('console', msg => {
    if (msg.text().startsWith('[TEST]')) {
      console.log('Browser:', msg.text());
    }
  });

  // Now navigate to the page - auth state will already be present
  await page.goto('/');
  // Use 'domcontentloaded' instead of 'networkidle' - more reliable across browsers
  // Firefox has issues with 'networkidle' in CI environments
  await page.waitForLoadState('domcontentloaded');

  // Wait for the app to be ready by checking for a key element
  // This is more reliable than network-based waits across all browsers
  await page.waitForSelector('[data-testid="app-container"], [data-testid="dashboard"], nav, main', {
    timeout: 10000
  });

  // Log final auth state
  await logAuthState(page);
}

/**
 * Logout
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Open profile dropdown
  await page.getByRole('button', { name: /profile/i }).click();

  // Click logout
  await page.getByRole('menuitem', { name: /logout/i }).click();

  // Wait for redirect to login
  await page.waitForURL('/login');
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
