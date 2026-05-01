/**
 * E2E Tests: Gamification Reconcile-on-Read Self-Heal (GAMIF-04)
 *
 * Proves the Phase 4 self-heal contract end-to-end:
 * 1. Seed e2e_learner into the "stuck" state:
 *    - UserAchievement row for `learning_first_word` is deleted
 *    - UserXP.projection_version is reset to 0 (legacy, never reconciled)
 *    The learner already has V2 review history from /seed/all, so the
 *    computed `cards_learned >= 1` condition remains satisfied.
 * 2. Navigate to /achievements (triggers reconcile on the GET /xp/achievements handler).
 * 3. Assert the `learning_first_word` card visibly shows "Completed" and NOT "Locked".
 * 4. Call GET /api/v1/xp/achievements via authenticated API and confirm
 *    `unlocked: true` and `unlocked_at` is non-null — proving the DB write happened.
 *
 * Determinism: no waitForTimeout. All waits use expect().toBeVisible({ timeout }).
 * Teardown: afterEach re-runs the stuck-state reset so the test is re-runnable.
 */

import * as fs from 'fs';

import { test, expect } from '@playwright/test';

import { getSupabaseStorageKey } from './helpers/supabase-test-client';

// ---------- constants ----------

const LEARNER_AUTH = 'playwright/.auth/learner.json';
const LEARNER_EMAIL = 'e2e_learner@test.com';
const ACHIEVEMENT_ID = 'learning_first_word';

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

/**
 * Extract the learner's Supabase access token from the saved storageState file.
 * Mirrors the pattern used in flashcard-review-v2.spec.ts.
 */
function getLearnerAccessToken(): string {
  const storageKey = getSupabaseStorageKey();
  try {
    const authState = JSON.parse(fs.readFileSync(LEARNER_AUTH, 'utf-8'));
    const sessionEntry = authState.origins?.[0]?.localStorage?.find(
      (item: { name: string; value: string }) => item.name === storageKey,
    );
    if (sessionEntry) {
      const session = JSON.parse(sessionEntry.value);
      const token = session?.access_token;
      if (token) return token;
    }
  } catch {
    // Fall through to throw below
  }
  throw new Error(
    '[GAMIF-04] Could not read learner access token from storageState. ' +
      'Ensure auth.setup.ts ran successfully before this spec.',
  );
}

// ---------- helpers ----------

/**
 * Reset the learner to the "stuck" gamification state via the test-only seed endpoint.
 * Idempotent — safe to call in beforeEach and afterEach.
 */
async function resetToStuckState(request: import('@playwright/test').APIRequestContext) {
  const apiBaseUrl = getApiBaseUrl();
  const resp = await request.post(
    `${apiBaseUrl}/api/v1/test/seed/gamification-reset-stuck-state`,
    {
      data: { email: LEARNER_EMAIL, achievement_id: ACHIEVEMENT_ID },
    },
  );
  if (!resp.ok()) {
    const body = await resp.text();
    throw new Error(
      `[GAMIF-04] gamification-reset-stuck-state failed: ${resp.status()} ${body}`,
    );
  }
  return resp.json();
}

// ---------- spec ----------

test.describe('Gamification — reconcile-on-read self-heal (GAMIF-04)', () => {
  test.use({ storageState: LEARNER_AUTH });

  test.beforeEach(async ({ request }) => {
    await resetToStuckState(request);
  });

  test.afterEach(async ({ request }) => {
    // Re-run the reset so the spec is idempotent across CI reruns on the same DB.
    // (Each /seed/all also truncates user_achievement, so CI full-suite runs are clean;
    // this teardown covers repeated single-spec runs without a full reseed.)
    await resetToStuckState(request);
  });

  test(
    'GAMIF-04-05: stuck user navigating to /achievements is self-healed',
    async ({ page, request }) => {
      const apiBaseUrl = getApiBaseUrl();
      const authHeaders = { Authorization: `Bearer ${getLearnerAccessToken()}` };

      // ── ACT: navigate to /achievements — triggers reconcile on read ─────────
      // NOTE: We intentionally skip a pre-state API check here. Calling
      // GET /xp/achievements would itself trigger reconcile-on-read (flags are
      // on at 100% in CI), which would immediately re-unlock the achievement
      // and make the "pre-locked" assertion false. The beforeEach reset
      // (gamification-reset-stuck-state) is the authoritative source that the
      // stuck state is set; the test only needs to verify the AFTER state.
      await page.goto('/achievements');

      // ── ASSERT: card visibly shows Unlocked ─────────────────────────────────
      const card = page.getByTestId(`achievement-card-${ACHIEVEMENT_ID}`);
      await expect(card).toBeVisible({ timeout: 15000 });

      // "Completed" badge is visible
      await expect(card.getByText('Completed')).toBeVisible({ timeout: 10000 });

      // "Locked" badge is NOT visible (exact match — "Unlocked 5/1/2026" contains "Locked" as substring)
      await expect(card.getByText('Locked', { exact: true })).not.toBeVisible();

      // ── PROVE DB write happened (not a UI lie) ──────────────────────────────
      const postResp = await request.get(`${apiBaseUrl}/api/v1/xp/achievements`, {
        headers: authHeaders,
      });
      expect(postResp.ok()).toBeTruthy();
      const postBody = await postResp.json();
      const postAch = (
        postBody.achievements as Array<{
          id: string;
          unlocked: boolean;
          unlocked_at: string | null;
        }>
      ).find((a) => a.id === ACHIEVEMENT_ID);
      expect(postAch).toBeDefined();
      expect(postAch!.unlocked).toBe(true);
      expect(postAch!.unlocked_at).toBeTruthy();
    },
  );
});
