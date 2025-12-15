/**
 * E2E Test Diagnostics Helper
 *
 * Provides diagnostic logging for debugging test failures:
 * - Logs when test mode is active
 * - Tracks localStorage changes
 * - Monitors store hydration
 * - Captures browser console output
 */

import { Page } from '@playwright/test';

/**
 * Enable diagnostic logging for test execution
 */
export async function enableTestDiagnostics(page: Page): Promise<void> {
  // Capture browser console logs that start with [TEST]
  page.on('console', msg => {
    if (msg.text().startsWith('[TEST]') || msg.text().startsWith('[AUTH')) {
      console.log('Browser:', msg.text());
    }
  });

  // Add localStorage monitoring via addInitScript (for debugging, not critical timing)
  await page.addInitScript(() => {
    // Set playwright flag to enable test mode in PublicRoute
    (window as any).playwright = true;
    console.log('[TEST] window.playwright flag set to true');
    // Log when localStorage changes
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key: string, value: string) {
      console.log('[TEST] localStorage.setItem:', key, value.substring(0, 100));
      return originalSetItem.call(this, key, value);
    };
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
