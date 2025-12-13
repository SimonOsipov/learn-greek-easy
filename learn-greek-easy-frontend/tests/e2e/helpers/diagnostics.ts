/**
 * E2E Test Diagnostics Helper
 *
 * Provides diagnostic logging for debugging test failures:
 * - Captures browser console output
 * - Logs authentication state
 *
 * NOTE: The init script logic (setting window.playwright, localStorage overrides)
 * has been moved to auth-helpers.ts loginViaLocalStorage() to ensure atomic
 * execution order. This file now only provides console capture utilities.
 */

import { Page } from '@playwright/test';

/**
 * Enable diagnostic console capture for test execution
 *
 * This function sets up console capture to log [TEST] prefixed messages
 * from the browser to the Node.js console.
 *
 * NOTE: This does NOT add any init scripts. All init script logic is now
 * in auth-helpers.ts loginViaLocalStorage() to ensure window.playwright
 * is set FIRST before any other code runs.
 */
export async function enableTestDiagnostics(page: Page): Promise<void> {
  // Only set up console capture - init script logic moved to auth-helpers.ts
  page.on('console', msg => {
    if (msg.text().startsWith('[TEST]')) {
      console.log('Browser:', msg.text());
    }
  });
}

/**
 * Log current authentication state for debugging
 *
 * Captures and logs the current state of authentication storage
 * to help diagnose auth-related test failures.
 */
export async function logAuthState(page: Page): Promise<void> {
  const state = await page.evaluate(() => {
    return {
      localStorage: localStorage.getItem('auth-storage'),
      sessionStorage: sessionStorage.getItem('auth-token'),
      playwrightFlag: (window as any).playwright,
    };
  });
  console.log('[AUTH STATE]', JSON.stringify(state, null, 2));
}
