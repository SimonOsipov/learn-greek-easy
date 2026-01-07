/**
 * K6 Authentication Performance Test Scenario
 *
 * Tests the complete login flow measuring detailed timing metrics for each step.
 * This scenario uses k6 browser module to simulate real user interactions.
 *
 * @module k6/scenarios/auth
 *
 * @description
 * Measures the following timing metrics:
 * - auth_navigate_time: Time to navigate to login page and wait for it to be ready
 * - auth_fill_email_time: Time to fill the email input field
 * - auth_fill_password_time: Time to fill the password input field
 * - auth_submit_time: Time from clicking submit to navigation starting
 * - auth_redirect_time: Time from navigation start to dashboard being visible
 * - auth_total_time: Total time for entire login flow
 *
 * @example
 * // Run locally with default smoke scenario
 * // k6 run k6/scenarios/auth.js
 *
 * @example
 * // Run locally with load scenario
 * // K6_SCENARIO=load k6 run k6/scenarios/auth.js
 *
 * @example
 * // Run against preview environment
 * // K6_ENV=preview K6_API_BASE_URL=https://api.preview.example.com K6_FRONTEND_BASE_URL=https://preview.example.com k6 run k6/scenarios/auth.js
 *
 * @example
 * // Run with Grafana Cloud output
 * // K6_CLOUD_TOKEN=your-token k6 run --out cloud k6/scenarios/auth.js
 */

import { browser } from 'k6/browser';
import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// Import login function - metrics are registered when auth.js is loaded
import { login } from '../lib/auth.js';

// Import config helpers
import { currentEnvironment, getScenario } from '../lib/config.js';

// =============================================================================
// Scenario Configuration
// =============================================================================

const scenarioName = __ENV.K6_SCENARIO || 'smoke';
let scenarioConfig;
try {
  scenarioConfig = getScenario(scenarioName);
} catch {
  console.warn(`Invalid scenario '${scenarioName}', using 'smoke'`);
  scenarioConfig = getScenario('smoke');
}

// =============================================================================
// K6 Options Export
// =============================================================================

/**
 * K6 test options configuration.
 *
 * Configures the browser scenario with chromium and sets thresholds for
 * all authentication timing metrics.
 *
 * @type {Object}
 */
export const options = {
  scenarios: {
    auth: {
      executor: scenarioConfig.executor,
      vus: scenarioConfig.vus,
      duration: scenarioConfig.duration,
      exec: 'authScenario',
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
  thresholds: {
    auth_navigate_time: ['p(95)<3000'],
    auth_fill_email_time: ['p(95)<500'],
    auth_fill_password_time: ['p(95)<500'],
    auth_submit_time: ['p(95)<2000'],
    auth_redirect_time: ['p(95)<2000'],
    auth_total_time: ['p(95)<8000'],
    checks: ['rate>0.95'],
  },
};

// =============================================================================
// Scenario Function
// =============================================================================

/**
 * Authentication scenario execution function.
 *
 * Creates a new browser page, performs the login flow, and verifies success.
 * All timing metrics are automatically recorded by the login() function.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function authScenario() {
  const page = await browser.newPage();

  try {
    const success = await login(page, {
      userRole: 'learner',
      timeout: 30000,
    });

    check(success, {
      'login completed successfully': (s) => s === true,
    });
  } finally {
    await page.close();
  }
}

// =============================================================================
// Summary Handler
// =============================================================================

/**
 * Handle test summary and generate reports.
 *
 * Generates a timestamped JSON report in the reports directory and outputs
 * a colored text summary to stdout.
 *
 * @param {Object} data - The k6 summary data object
 * @returns {Object} Output destinations and their content
 */
export function handleSummary(data) {
  // Generate timestamp for unique report filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = `k6/reports/auth-${currentEnvironment}-${timestamp}.json`;

  // Log execution context
  console.log(`\n--- Auth Scenario Summary ---`);
  console.log(`Environment: ${currentEnvironment}`);
  console.log(`Scenario: ${scenarioName}`);
  console.log(`VUs: ${scenarioConfig.vus}`);
  console.log(`Duration: ${scenarioConfig.duration}`);
  console.log(`Report: ${reportPath}`);
  console.log(`-----------------------------\n`);

  return {
    [reportPath]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}
