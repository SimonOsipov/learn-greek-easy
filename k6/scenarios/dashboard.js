/**
 * K6 Dashboard Performance Test Scenario
 *
 * Tests the complete user journey from dashboard through deck selection to practice session.
 * This scenario uses k6 browser module to simulate real user interactions with the dashboard.
 *
 * @module k6/scenarios/dashboard
 *
 * @description
 * Measures the following timing metrics:
 * - dashboard_load_time: Time for dashboard to fully render after login
 * - dashboard_stats_api_time: Time for network to settle after dashboard load (stats API)
 * - deck_navigation_time: Time from clicking deck card to navigation starting
 * - deck_load_time: Time for deck detail page to be visible
 * - session_start_time: Time from clicking Start Practice to MCQ component visible
 * - card_interaction_time: Time to select answer and submit
 * - dashboard_flow_total_time: Total time for the entire flow
 *
 * @example
 * // Run locally with default smoke scenario
 * // k6 run k6/scenarios/dashboard.js
 *
 * @example
 * // Run locally with load scenario
 * // K6_SCENARIO=load k6 run k6/scenarios/dashboard.js
 *
 * @example
 * // Run against preview environment
 * // K6_ENV=preview K6_API_BASE_URL=https://api.preview.example.com K6_FRONTEND_BASE_URL=https://preview.example.com k6 run k6/scenarios/dashboard.js
 *
 * @example
 * // Run with Grafana Cloud output
 * // K6_CLOUD_TOKEN=your-token k6 run --out cloud k6/scenarios/dashboard.js
 */

import { browser } from 'k6/browser';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

import { login } from '../lib/auth.js';
import { testId, dashboard, decks, culture, answerOption } from '../lib/selectors.js';
import { currentEnvironment, getScenario, frontendUrl } from '../lib/config.js';

// =============================================================================
// Timing Metrics
// =============================================================================

/**
 * Time for dashboard to fully render after login.
 * @type {Trend}
 */
const dashboardLoadTime = new Trend('dashboard_load_time', true);

/**
 * Time for network to settle after dashboard load (stats API completion).
 * @type {Trend}
 */
const dashboardStatsApiTime = new Trend('dashboard_stats_api_time', true);

/**
 * Time from clicking deck card to navigation starting.
 * @type {Trend}
 */
const deckNavigationTime = new Trend('deck_navigation_time', true);

/**
 * Time for deck detail page to be visible.
 * @type {Trend}
 */
const deckLoadTime = new Trend('deck_load_time', true);

/**
 * Time from clicking Start Practice to MCQ component visible.
 * @type {Trend}
 */
const sessionStartTime = new Trend('session_start_time', true);

/**
 * Time to select answer and submit.
 * @type {Trend}
 */
const cardInteractionTime = new Trend('card_interaction_time', true);

/**
 * Total time for the entire dashboard flow.
 * @type {Trend}
 */
const dashboardFlowTotalTime = new Trend('dashboard_flow_total_time', true);

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
 * all dashboard timing metrics.
 *
 * @type {Object}
 */
export const options = {
  scenarios: {
    dashboard: {
      executor: scenarioConfig.executor,
      vus: scenarioConfig.vus,
      duration: scenarioConfig.duration,
      exec: 'dashboardScenario',
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
  thresholds: {
    dashboard_load_time: ['p(95)<2000'],
    dashboard_stats_api_time: ['p(95)<3000'],
    deck_navigation_time: ['p(95)<1000'],
    deck_load_time: ['p(95)<2000'],
    session_start_time: ['p(95)<2000'],
    card_interaction_time: ['p(95)<1500'],
    dashboard_flow_total_time: ['p(95)<15000'],
    checks: ['rate>0.95'],
  },
};

// =============================================================================
// Dashboard Flow Function
// =============================================================================

/**
 * Execute the complete dashboard flow with timing measurements.
 *
 * Flow:
 * 1. Login with learner user (lands on dashboard)
 * 2. Wait for dashboard stats to load
 * 3. Navigate to /decks page to access all decks
 * 4. Find and click a culture deck (or fallback to first deck)
 * 5. Wait for deck detail page
 * 6. If culture deck: start practice session and answer one question
 * 7. Record total flow time
 *
 * @async
 * @param {import('k6/experimental/browser').Page} page - The k6 browser page instance
 * @returns {Promise<boolean>} True if flow completed successfully, false on failure
 */
async function dashboardFlow(page) {
  const totalStartTime = Date.now();

  try {
    // -------------------------------------------------------------------------
    // Step 1: Login with learner user (lands on dashboard)
    // -------------------------------------------------------------------------
    const loginStartTime = Date.now();

    const loginSuccess = await login(page, { userRole: 'learner' });
    if (!loginSuccess) {
      console.error('Dashboard flow failed: login unsuccessful');
      dashboardFlowTotalTime.add(measureStep(totalStartTime));
      return false;
    }

    // Dashboard is already loaded by login - record time
    dashboardLoadTime.add(measureStep(loginStartTime));

    // -------------------------------------------------------------------------
    // Step 2: Wait for network idle (stats API completion)
    // -------------------------------------------------------------------------
    const statsStartTime = Date.now();

    // Wait for network to settle - stats API calls should complete
    await page.waitForLoadState('networkidle');

    dashboardStatsApiTime.add(measureStep(statsStartTime));

    // -------------------------------------------------------------------------
    // Step 3: Navigate to /decks page
    // -------------------------------------------------------------------------
    const navStartTime = Date.now();

    // Navigate to decks page to see all available decks
    await page.goto(frontendUrl('/decks'), { waitUntil: 'networkidle' });

    // Wait for decks page title to be visible
    await page.waitForSelector(testId(decks.decksTitle), {
      state: 'visible',
      timeout: 10000,
    });

    // Wait for first deck card to be visible
    await page.waitForSelector(testId(decks.deckCard), {
      state: 'visible',
      timeout: 10000,
    });

    // -------------------------------------------------------------------------
    // Step 4: Find and click a deck (prefer culture deck)
    // -------------------------------------------------------------------------
    // Try to find a culture deck by looking for culture-badge within deck cards
    let targetDeckCard = null;
    let isCultureDeck = false;

    // Get all deck cards
    const deckCards = page.locator(testId(decks.deckCard));
    const deckCount = await deckCards.count();

    if (deckCount === 0) {
      console.error('Dashboard flow failed: no deck cards found');
      dashboardFlowTotalTime.add(measureStep(totalStartTime));
      return false;
    }

    // Search for a deck with culture badge
    for (let i = 0; i < deckCount; i++) {
      const card = deckCards.nth(i);
      const cultureBadge = card.locator(testId(culture.cultureBadge));

      try {
        const badgeCount = await cultureBadge.count();
        if (badgeCount > 0) {
          targetDeckCard = card;
          isCultureDeck = true;
          console.log(`Found culture deck at index ${i}`);
          break;
        }
      } catch {
        // Badge not found in this card, continue searching
      }
    }

    // Fallback to first deck if no culture deck found
    if (!targetDeckCard) {
      console.log('No culture deck found, using first deck (vocabulary)');
      targetDeckCard = deckCards.first();
      isCultureDeck = false;
    }

    // Click the deck card
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), targetDeckCard.click()]);

    deckNavigationTime.add(measureStep(navStartTime));

    // -------------------------------------------------------------------------
    // Step 5: Wait for deck detail page
    // -------------------------------------------------------------------------
    const deckLoadStartTime = Date.now();

    await page.waitForSelector(testId(decks.deckDetail), {
      state: 'visible',
      timeout: 10000,
    });

    deckLoadTime.add(measureStep(deckLoadStartTime));

    // -------------------------------------------------------------------------
    // Step 6: Check for practice button and handle accordingly
    // -------------------------------------------------------------------------
    const practiceButton = page.locator(testId(culture.startPracticeButton));
    let hasPracticeButton = false;

    try {
      const practiceButtonCount = await practiceButton.count();
      hasPracticeButton = practiceButtonCount > 0;
    } catch {
      hasPracticeButton = false;
    }

    // If no practice button (vocabulary deck), log and complete flow
    if (!hasPracticeButton) {
      console.log('Vocabulary deck - skipping MCQ practice flow');
      dashboardFlowTotalTime.add(measureStep(totalStartTime));
      return true;
    }

    // -------------------------------------------------------------------------
    // Step 7: Start practice session (culture deck)
    // -------------------------------------------------------------------------
    const sessionStartTimeMs = Date.now();

    await practiceButton.click();

    // Wait for MCQ component to be visible
    await page.waitForSelector(testId(culture.mcq.component), {
      state: 'visible',
      timeout: 10000,
    });

    sessionStartTime.add(measureStep(sessionStartTimeMs));

    // -------------------------------------------------------------------------
    // Step 8: Answer a question
    // -------------------------------------------------------------------------
    const interactionStartTime = Date.now();

    // Wait for question text to be visible
    await page.waitForSelector(testId(culture.mcq.questionText), {
      state: 'visible',
      timeout: 10000,
    });

    // Click answer option A
    const optionA = page.locator(testId(answerOption('a')));
    await optionA.click();

    // Small delay before submitting
    sleep(0.1);

    // Click submit button
    const submitButton = page.locator(testId(culture.mcq.submitButton));
    await submitButton.click();

    // Wait for network to settle after submission
    await page.waitForLoadState('networkidle');

    cardInteractionTime.add(measureStep(interactionStartTime));

    // -------------------------------------------------------------------------
    // Record total flow time and return success
    // -------------------------------------------------------------------------
    dashboardFlowTotalTime.add(measureStep(totalStartTime));

    return true;
  } catch (error) {
    // Log error with context for debugging
    console.error(`Dashboard flow failed: ${error.message}`);

    // Record total time even on failure for analysis
    dashboardFlowTotalTime.add(measureStep(totalStartTime));

    return false;
  }
}

// =============================================================================
// Scenario Function
// =============================================================================

/**
 * Dashboard scenario execution function.
 *
 * Creates a new browser page, performs the dashboard flow, and verifies success.
 * All timing metrics are automatically recorded by the dashboardFlow() function.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function dashboardScenario() {
  const page = await browser.newPage();

  try {
    const success = await dashboardFlow(page);

    check(success, {
      'dashboard flow completed successfully': (s) => s === true,
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
  const reportPath = `k6/reports/dashboard-${currentEnvironment}-${timestamp}.json`;

  // Log execution context
  console.log(`\n--- Dashboard Scenario Summary ---`);
  console.log(`Environment: ${currentEnvironment}`);
  console.log(`Scenario: ${scenarioName}`);
  console.log(`VUs: ${scenarioConfig.vus}`);
  console.log(`Duration: ${scenarioConfig.duration}`);
  console.log(`Report: ${reportPath}`);
  console.log(`----------------------------------\n`);

  return {
    [reportPath]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}
