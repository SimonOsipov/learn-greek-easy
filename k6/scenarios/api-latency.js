/**
 * K6 API Latency / SM-2 Loop Scenario (Protocol Mode)
 *
 * Tests the core API endpoints used by the SM-2 spaced-repetition study loop
 * without a browser. Measures per-endpoint latency and total iteration time.
 *
 * Endpoints exercised per iteration:
 * - GET  /api/v1/auth/me            (identity check)
 * - GET  /api/v1/progress/dashboard (dashboard data)
 * - GET  /api/v1/study/queue/v2     (due cards)
 * - POST /api/v1/reviews/v2         (submit review — only when queue non-empty)
 *
 * @module k6/scenarios/api-latency
 *
 * @example
 * // Run locally with default smoke scenario (requires SUPABASE_URL + SUPABASE_ANON_KEY)
 * // k6 run k6/scenarios/api-latency.js
 *
 * @example
 * // Run against preview environment
 * // K6_ENV=preview K6_API_BASE_URL=https://preview.example.com k6 run k6/scenarios/api-latency.js
 */

import http from 'k6/http';
import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { apiUrl, currentEnvironment, getScenario } from '../lib/config.js';
import {
  getApiToken,
  authHeaders,
  apiMeTime,
  apiDashboardTime,
  apiStudyQueueTime,
  apiReviewTime,
  apiTotalTime,
} from '../lib/api-auth.js';

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
 * K6 test options — simple protocol mode (no browser block, no scenarios block).
 *
 * Thresholds MUST stay in sync with PROTOCOL_METRICS in parse-k6-results.cjs.
 *
 * @type {Object}
 */
export const options = {
  vus: scenarioConfig.vus,
  duration: scenarioConfig.duration,
  thresholds: {
    api_me_time: ['p(95)<1500'],
    api_dashboard_time: ['p(95)<2500'],
    api_study_queue_time: ['p(95)<2000'],
    api_review_time: ['p(95)<2000'],
    api_total_time: ['p(95)<6000'],
    checks: ['rate>0.95'],
  },
};

// =============================================================================
// Setup — fetch token once before iterations begin
// =============================================================================

/**
 * Obtain a Supabase JWT once and pass it to all VU iterations.
 *
 * @returns {{ token: string }}
 */
export function setup() {
  const token = getApiToken();
  return { token };
}

// =============================================================================
// Default Function (per-iteration)
// =============================================================================

/**
 * Execute one SM-2 API loop: me → dashboard → queue → (optional) review.
 *
 * @param {{ token: string }} data - Token from setup()
 */
export default function (data) {
  const loopStart = Date.now();
  const headers = authHeaders(data.token);

  // -------------------------------------------------------------------------
  // Step 1: GET /api/v1/auth/me
  // -------------------------------------------------------------------------
  const meStart = Date.now();
  const meRes = http.get(apiUrl('/api/v1/auth/me'), { headers });
  apiMeTime.add(Date.now() - meStart);
  check(meRes, { 'me 200': (r) => r.status === 200 });

  // -------------------------------------------------------------------------
  // Step 2: GET /api/v1/progress/dashboard
  // -------------------------------------------------------------------------
  const dashStart = Date.now();
  const dashRes = http.get(apiUrl('/api/v1/progress/dashboard'), { headers });
  apiDashboardTime.add(Date.now() - dashStart);
  check(dashRes, { 'dashboard 200': (r) => r.status === 200 });

  // -------------------------------------------------------------------------
  // Step 3: GET /api/v1/study/queue/v2
  // -------------------------------------------------------------------------
  const queueStart = Date.now();
  const queueRes = http.get(apiUrl('/api/v1/study/queue/v2'), { headers });
  apiStudyQueueTime.add(Date.now() - queueStart);
  check(queueRes, { 'queue 200': (r) => r.status === 200 });

  // -------------------------------------------------------------------------
  // Step 4: POST /api/v1/reviews/v2 — only when queue has a card
  // -------------------------------------------------------------------------
  const queue = queueRes.json();
  const card = queue && queue.cards && queue.cards[0];

  if (card && card.card_record_id) {
    const reviewStart = Date.now();
    const reviewRes = http.post(
      apiUrl('/api/v1/reviews/v2'),
      JSON.stringify({ card_record_id: card.card_record_id, quality: 4, time_taken: 5 }),
      { headers }
    );
    apiReviewTime.add(Date.now() - reviewStart);
    check(reviewRes, { 'review 200/201': (r) => r.status === 200 || r.status === 201 });
  } else {
    console.log('api-latency: study queue empty, skipping review POST');
  }

  // -------------------------------------------------------------------------
  // Total loop time (always recorded)
  // -------------------------------------------------------------------------
  apiTotalTime.add(Date.now() - loopStart);
}

// =============================================================================
// Summary Handler
// =============================================================================

/**
 * Handle test summary and generate reports.
 *
 * The base path prefix `api-latency-preview-` is what parse-k6-results.cjs
 * uses in findLatestReport('api-latency-preview-') to locate this report.
 *
 * @param {Object} data - The k6 summary data object
 * @returns {Object} Output destinations and their content
 */
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportBasePath = `k6/reports/api-latency-${currentEnvironment}-${timestamp}`;

  console.log(`\n--- API Latency Scenario Summary ---`);
  console.log(`Environment: ${currentEnvironment}`);
  console.log(`Scenario: ${scenarioName}`);
  console.log(`VUs: ${scenarioConfig.vus}`);
  console.log(`Duration: ${scenarioConfig.duration}`);
  console.log(`JSON Report: ${reportBasePath}.json`);
  console.log(`HTML Report: ${reportBasePath}.html`);
  console.log(`------------------------------------\n`);

  return {
    [`${reportBasePath}.json`]: JSON.stringify(data, null, 2),
    [`${reportBasePath}.html`]: htmlReport(data),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}
