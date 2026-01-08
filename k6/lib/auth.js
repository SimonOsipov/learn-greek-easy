/**
 * K6 Authentication Helper Library
 *
 * Provides login functionality with detailed timing metrics for k6 browser tests.
 * All timing measurements are captured as k6 Trend metrics for aggregation and analysis.
 *
 * @module k6/lib/auth
 */

import { Trend } from 'k6/metrics';
import { frontendUrl, getTestUser } from './config.js';
import { testId, auth, dashboard } from './selectors.js';

// =============================================================================
// Timing Metrics
// =============================================================================

/**
 * Time to navigate to login page and wait for it to be ready.
 * Includes network request, React hydration, and loader disappearance.
 * @type {Trend}
 */
export const authNavigateTime = new Trend('auth_navigate_time', true);

/**
 * Time to fill the email input field.
 * @type {Trend}
 */
export const authFillEmailTime = new Trend('auth_fill_email_time', true);

/**
 * Time to fill the password input field.
 * @type {Trend}
 */
export const authFillPasswordTime = new Trend('auth_fill_password_time', true);

/**
 * Time from clicking submit to navigation starting.
 * Includes form validation and API request initiation.
 * @type {Trend}
 */
export const authSubmitTime = new Trend('auth_submit_time', true);

/**
 * Time from navigation start to dashboard being visible.
 * Measures redirect and dashboard render time.
 * @type {Trend}
 */
export const authRedirectTime = new Trend('auth_redirect_time', true);

/**
 * Total time for entire login flow from start to finish.
 * @type {Trend}
 */
export const authTotalTime = new Trend('auth_total_time', true);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate elapsed time from a start timestamp.
 *
 * @param {number} startTime - The start timestamp from Date.now()
 * @returns {number} Elapsed time in milliseconds
 */
function measureStep(startTime) {
  return Date.now() - startTime;
}

// =============================================================================
// Main Login Function
// =============================================================================

/**
 * Perform a complete login flow with timing measurements.
 *
 * This function navigates to the login page, fills credentials, submits the form,
 * and waits for the dashboard to appear. Each step is timed and recorded to the
 * corresponding Trend metric.
 *
 * @async
 * @param {import('k6/experimental/browser').Page} page - The k6 browser page instance
 * @param {Object} [options={}] - Login options
 * @param {'learner' | 'beginner' | 'advanced' | 'admin' | 'xpBoundary' | 'xpMid' | 'xpMax'} [options.userRole='learner'] - The test user role to login as
 * @param {number} [options.timeout=30000] - Maximum time in milliseconds to wait for each step
 * @returns {Promise<boolean>} True if login succeeded, false if it failed
 *
 * @example
 * // Basic usage with default learner role
 * const success = await login(page);
 *
 * @example
 * // Login as admin with custom timeout
 * const success = await login(page, { userRole: 'admin', timeout: 60000 });
 */
export async function login(page, options = {}) {
  const { userRole = 'learner', timeout = 30000 } = options;
  const totalStartTime = Date.now();

  try {
    // Get user credentials for the specified role
    const user = getTestUser(userRole);

    // -------------------------------------------------------------------------
    // Step 1: Navigate to login page
    // -------------------------------------------------------------------------
    const navigateStartTime = Date.now();

    // Navigate to login page and wait for network to settle
    await page.goto(frontendUrl('/login'), { waitUntil: 'networkidle' });

    // Wait for React hydration (app ready indicator)
    await page.waitForSelector('[data-app-ready="true"]', { timeout: timeout });

    // Check if page loader is visible and wait for it to disappear
    // Use a shorter timeout since loader may not be present
    try {
      const loaderSelector = testId(auth.pageLoader);
      const loader = await page.$(loaderSelector);
      if (loader) {
        await page.waitForSelector(loaderSelector, {
          state: 'hidden',
          timeout: 2000,
        });
      }
    } catch {
      // Loader not present or already hidden, continue
    }

    // Wait for login card to be visible
    await page.waitForSelector(testId(auth.loginCard), {
      state: 'visible',
      timeout: timeout,
    });

    authNavigateTime.add(measureStep(navigateStartTime));

    // -------------------------------------------------------------------------
    // Step 2: Fill email input
    // -------------------------------------------------------------------------
    const emailStartTime = Date.now();

    const emailInput = page.locator(testId(auth.emailInput));
    await emailInput.fill(user.email);

    authFillEmailTime.add(measureStep(emailStartTime));

    // -------------------------------------------------------------------------
    // Step 3: Fill password input
    // -------------------------------------------------------------------------
    const passwordStartTime = Date.now();

    const passwordInput = page.locator(testId(auth.passwordInput));
    await passwordInput.fill(user.password);

    authFillPasswordTime.add(measureStep(passwordStartTime));

    // -------------------------------------------------------------------------
    // Step 4: Submit login form
    // -------------------------------------------------------------------------
    const submitStartTime = Date.now();

    const submitButton = page.locator(testId(auth.loginSubmit));
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      submitButton.click(),
    ]);

    authSubmitTime.add(measureStep(submitStartTime));

    // -------------------------------------------------------------------------
    // Step 5: Wait for dashboard to be visible
    // -------------------------------------------------------------------------
    const redirectStartTime = Date.now();

    await page.waitForSelector(testId(dashboard.dashboard), {
      state: 'visible',
      timeout: timeout,
    });

    authRedirectTime.add(measureStep(redirectStartTime));

    // -------------------------------------------------------------------------
    // Record total time and return success
    // -------------------------------------------------------------------------
    authTotalTime.add(measureStep(totalStartTime));

    return true;
  } catch (error) {
    // Log error with context for debugging
    console.error(`Login failed for userRole '${userRole}': ${error.message}`);

    // Record total time even on failure for analysis
    authTotalTime.add(measureStep(totalStartTime));

    return false;
  }
}
