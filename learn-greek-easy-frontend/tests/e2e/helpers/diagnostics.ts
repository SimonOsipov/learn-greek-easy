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
 *
 * This function adds initialization scripts to log key events during
 * test execution, helping diagnose timing and state issues.
 */
export async function enableTestDiagnostics(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Log when test mode is active
    console.log('[TEST] Test mode active, window.playwright =', window.playwright);

    // Log when localStorage changes
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key: string, value: string) {
      console.log('[TEST] localStorage.setItem:', key, value.substring(0, 100));
      return originalSetItem.call(this, key, value);
    };

    // Log when stores hydrate
    window.addEventListener('storage', (e) => {
      console.log('[TEST] Storage event:', e.key);
    });
  });

  // Capture browser console logs
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
