/**
 * K6 Protocol-Mode Authentication Helper
 *
 * Provides Supabase token acquisition and auth headers for k6 HTTP (protocol-mode) tests.
 * This is the protocol-mode counterpart to auth.js (which drives the browser login flow).
 *
 * Key design notes:
 * - Protocol mode only — no browser, no page object, no selectors.
 * - Reads SUPABASE_URL and SUPABASE_ANON_KEY directly from the k6 environment (D9).
 *   These env vars are injected by the CI step defined in PERF-12-05; a local run
 *   must export them before invoking k6.
 * - PERF-11's token helper does not exist yet, so PERF-12 owns this helper (D4).
 * - Subsequent API calls use the frontend-proxy base URL via apiUrl() from config.js;
 *   that wiring happens in the scenario file (PERF-12-04), not here.
 *
 * @module k6/lib/api-auth
 */

import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { getTestUser } from './config.js';

// =============================================================================
// Timing Metrics
// =============================================================================

/**
 * Time for GET /api/v1/auth/me (identity check).
 * @type {Trend}
 */
export const apiMeTime = new Trend('api_me_time', true);

/**
 * Time for GET /api/v1/dashboard (dashboard data).
 * @type {Trend}
 */
export const apiDashboardTime = new Trend('api_dashboard_time', true);

/**
 * Time for GET /api/v1/study/queue/v2 (study queue fetch).
 * @type {Trend}
 */
export const apiStudyQueueTime = new Trend('api_study_queue_time', true);

/**
 * Time for POST /api/v1/reviews/v2 (submit review answer).
 * @type {Trend}
 */
export const apiReviewTime = new Trend('api_review_time', true);

/**
 * Total time for the full protocol-mode scenario iteration.
 * @type {Trend}
 */
export const apiTotalTime = new Trend('api_total_time', true);

// =============================================================================
// Token Acquisition
// =============================================================================

/**
 * Obtain a Supabase JWT access token for the e2e_learner test user.
 *
 * Hits the Supabase Auth REST endpoint directly (not via the frontend proxy)
 * using the password grant flow. The token is short-lived (~1 h) and suitable
 * for bearer auth against the backend API.
 *
 * Required env vars (must be set before running k6):
 *   SUPABASE_URL      — e.g. https://<project>.supabase.co
 *   SUPABASE_ANON_KEY — the project's public anon key
 *
 * @returns {string} A valid Supabase JWT access token
 * @throws {Error} If env vars are missing or the token grant fails
 */
export function getApiToken() {
  const supabaseUrl = __ENV.SUPABASE_URL;
  const anonKey = __ENV.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL env var is not set. ' +
        'Export it before running k6, or verify the CI step injects it (PERF-12-05).'
    );
  }
  if (!anonKey) {
    throw new Error(
      'SUPABASE_ANON_KEY env var is not set. ' +
        'Export it before running k6, or verify the CI step injects it (PERF-12-05).'
    );
  }

  const { email, password } = getTestUser('learner'); // e2e_learner@test.com / TestPassword123!

  const res = http.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    { headers: { apikey: anonKey, 'Content-Type': 'application/json' } }
  );

  check(res, { 'supabase token 200': (r) => r.status === 200 });

  const token = res.json('access_token'); // k6 res.json(path) selector

  if (!token) {
    throw new Error(`Supabase token grant failed: status=${res.status}`);
  }

  return token;
}

// =============================================================================
// Auth Headers
// =============================================================================

/**
 * Build Authorization + Content-Type headers for a protocol-mode API request.
 *
 * @param {string} token - A valid Supabase JWT access token from getApiToken()
 * @returns {{ Authorization: string, 'Content-Type': string }} HTTP headers object
 */
export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
