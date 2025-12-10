/**
 * Visual Test Helpers
 *
 * Utility functions for Chromatic visual regression tests.
 * These helpers provide authentication, viewport management, and snapshot utilities.
 */

import { Page, TestInfo } from '@playwright/test';
import { takeSnapshot } from '@chromatic-com/playwright';

// Re-export takeSnapshot for convenience
export { takeSnapshot } from '@chromatic-com/playwright';

// Viewport configurations for responsive testing
export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
};

/**
 * Take snapshots at multiple viewports
 * Useful for responsive design visual testing
 *
 * @param page - Playwright page object
 * @param name - Base name for the snapshot
 * @param testInfo - Playwright test info object
 * @param viewports - Array of viewport configurations (defaults to desktop only)
 */
export async function takeResponsiveSnapshots(
  page: Page,
  name: string,
  testInfo: TestInfo,
  viewports = [VIEWPORTS.desktop]
): Promise<void> {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300); // Allow layout to settle
    await takeSnapshot(page, `${name} (${viewport.width}px)`, testInfo);
  }
}

/**
 * Generate a valid mock token for visual tests
 * This token format matches what mockAuthAPI expects
 */
function generateValidMockToken(userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `mock.${btoa(userId)}.${timestamp}.${random}`;
}

/**
 * Login via localStorage for visual tests
 *
 * This sets up authentication state BEFORE page loads using addInitScript.
 * This is faster than UI login and ensures consistent auth state for visual tests.
 *
 * @param page - Playwright page object
 */
export async function loginForVisualTest(page: Page): Promise<void> {
  // Use existing user from mockData.ts - 'visual-test-user' doesn't exist!
  const userId = 'user-1';
  const mockToken = generateValidMockToken(userId);

  // Set auth state BEFORE page loads using addInitScript
  // This ensures localStorage is populated before any app code runs
  await page.addInitScript(
    (authData) => {
      // Clear any existing state first
      localStorage.clear();
      sessionStorage.clear();

      // CRITICAL: Set test mode flag FIRST so mockAuthAPI.isTestMode() returns true
      window.playwright = true;

      // Set auth storage
      localStorage.setItem('auth-storage', JSON.stringify(authData));
      sessionStorage.setItem('auth-token', authData.state.token);
    },
    {
      state: {
        // User data must match user-1 from mockData.ts for verifyToken() to succeed
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
    }
  );
}

/**
 * Wait for the page to be fully loaded and stable
 * Useful before taking visual snapshots to avoid flaky tests
 *
 * @param page - Playwright page object
 * @param selector - Optional selector to wait for (defaults to common app elements)
 */
export async function waitForPageReady(
  page: Page,
  selector?: string
): Promise<void> {
  // Wait for DOM content to load
  await page.waitForLoadState('domcontentloaded');

  // Wait for specific selector or default app elements
  const waitSelector =
    selector ||
    '[data-testid="app-container"], [data-testid="dashboard"], nav, main';
  await page.waitForSelector(waitSelector, { timeout: 10000 });

  // Small delay to allow animations to complete
  await page.waitForTimeout(500);
}

// TypeScript declarations for test-mode globals
declare global {
  interface Window {
    playwright?: boolean;
  }
}
