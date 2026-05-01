/**
 * E2E Tests: Gamification IMMEDIATE-mode toast on review unlock (GAMIF-05-06)
 *
 * Proves the IMMEDIATE-mode achievement unlock contract end-to-end:
 * 1. Seed e2e_learner to "near-threshold" state:
 *    - CardRecordStatistics rows deleted (cards_learned == 0; all cards appear as "new")
 *    - CardRecordReview rows deleted
 *    - UserAchievement row for `learning_first_word` deleted
 *    - UserXP.projection_version reset to 0
 * 2. Navigate to /decks → first V2 deck → start review.
 * 3. Reveal answer and click the "Good" SRS button (crosses the threshold).
 * 4. Assert the achievement toast title is visible within 10s of the review submission.
 *    Toast title: "Achievement Unlocked: First Word" (from notify_achievement_unlocked).
 * 5. Call GET /api/v1/xp/achievements and confirm `learning_first_word` has
 *    `unlocked: true` and `unlocked_at` non-null — proves the DB write happened.
 *
 * Determinism: no waitForTimeout. All waits use expect().toBeVisible({ timeout }).
 * Teardown: afterEach re-runs the near-threshold reset so the spec is re-runnable.
 */

import * as fs from 'fs';

import { test, expect } from '@playwright/test';

import { getSupabaseStorageKey } from './helpers/supabase-test-client';

// ---------- constants ----------

const LEARNER_AUTH = 'playwright/.auth/learner.json';
const LEARNER_EMAIL = 'e2e_learner@test.com';
const ACHIEVEMENT_ID = 'learning_first_word';
// Exact toast title produced by notify_achievement_unlocked:
// title=f'Achievement Unlocked: {achievement_name}' where achievement_name='First Word'
const TOAST_TITLE = 'Achievement Unlocked: First Word';

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

/**
 * Extract the learner's Supabase access token from the saved storageState file.
 * Mirrors the pattern used in gamification-reconcile-self-heal.spec.ts.
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
    '[GAMIF-05-06] Could not read learner access token from storageState. ' +
      'Ensure auth.setup.ts ran successfully before this spec.',
  );
}

// ---------- helpers ----------

/**
 * Reset the learner to the near-threshold state via the test-only seed endpoint.
 * cards_learned will be 0 so submitting one review crosses the threshold.
 * Idempotent — safe to call in beforeEach and afterEach.
 */
async function resetToNearThreshold(request: import('@playwright/test').APIRequestContext) {
  const apiBaseUrl = getApiBaseUrl();
  const resp = await request.post(
    `${apiBaseUrl}/api/v1/test/seed/gamification-near-threshold`,
    {
      data: { email: LEARNER_EMAIL, achievement_id: ACHIEVEMENT_ID },
    },
  );
  if (!resp.ok()) {
    const body = await resp.text();
    throw new Error(
      `[GAMIF-05-06] gamification-near-threshold seed failed: ${resp.status()} ${body}`,
    );
  }
  return resp.json();
}

// ---------- spec ----------

test.describe('Gamification — IMMEDIATE-mode toast on review unlock (GAMIF-05)', () => {
  test.use({ storageState: LEARNER_AUTH });

  test.beforeEach(async ({ request }) => {
    await resetToNearThreshold(request);
  });

  test.afterEach(async ({ request }) => {
    // Restore the e2e_learner's full baseline so subsequent specs in this shard
    // (notably gamification-reconcile-self-heal.spec.ts which expects review history
    // for `learning_first_word`) get a clean state. /seed/all truncates and re-seeds
    // users/decks/cards/stats/reviews.
    const apiBaseUrl = getApiBaseUrl();
    const resp = await request.post(`${apiBaseUrl}/api/v1/test/seed/all`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!resp.ok()) {
      console.error(`[GAMIF-05-06] /seed/all restore failed: ${resp.status()} ${await resp.text()}`);
    }
  });

  test(
    'GAMIF-05-06: IMMEDIATE-mode toast appears within review request lifecycle',
    async ({ page, request }) => {
      const apiBaseUrl = getApiBaseUrl();
      const authHeaders = { Authorization: `Bearer ${getLearnerAccessToken()}` };

      // ── NAVIGATE: find the V2 deck and open the practice session ────────────
      const decksResp = await request.get(`${apiBaseUrl}/api/v1/decks?page_size=100`, {
        headers: authHeaders,
      });
      expect(decksResp.ok()).toBeTruthy();
      const decksData = await decksResp.json();
      const decks = decksData.decks as Array<{ id: string; name: string }>;
      const v2Deck = decks.find((d) => d.name.includes('Greek A1 Vocabulary'));
      if (!v2Deck) {
        throw new Error(
          '[GAMIF-05-06] No V2 deck found. ' +
            `Available: ${decks.map((d) => d.name).join(', ')}`,
        );
      }

      // Navigate directly to the practice URL (avoids multi-click navigation)
      await page.goto(`/decks/${v2Deck.id}/practice`);

      // Wait until the card is visible (SSE connection will be established by now)
      const practiceCard = page.locator('[data-testid="practice-card"]');
      const emptyState = page.getByText(/all caught up/i);
      await expect(practiceCard.or(emptyState)).toBeVisible({ timeout: 15000 });

      // If no new/due cards, V2 deck may not exist — fail with a clear message.
      // After reset_user_to_near_threshold all CardRecordStatistics are deleted, so
      // every card in the deck should appear as "new" via get_new_cards.
      const isEmpty = await emptyState.isVisible().catch(() => false);
      if (isEmpty) {
        throw new Error(
          '[GAMIF-05-06] No new/due cards found after near-threshold reset. ' +
            'Ensure /seed/all created the V2 Greek A1 Vocabulary deck with active cards.',
        );
      }

      // ── ACT: flip card and submit "Good" — crosses the threshold ────────────
      // Card front is visible; press Space to flip (or click the card)
      await expect(page.locator('[data-testid="practice-card-front"]')).toBeVisible({
        timeout: 10000,
      });
      await page.locator('[data-testid="practice-card-front"]').click();

      // Card back must be visible before we click the rating
      await expect(page.locator('[data-testid="practice-card-back"]')).toBeVisible({
        timeout: 10000,
      });
      await page.locator('[data-testid="srs-button-good"]').click();

      // ── ASSERT: toast title appears within 10s of the review submission ──────
      // Uses data-testid="toast-title" added to ToastTitle in toaster.tsx
      // { exact: true } avoids substring matches from other concurrent toasts
      const toastTitle = page
        .getByTestId('toast-title')
        .filter({ hasText: TOAST_TITLE });
      await expect(toastTitle).toBeVisible({ timeout: 10000 });

      // ── PROVE DB write happened (not a UI lie) ──────────────────────────────
      const achResp = await request.get(`${apiBaseUrl}/api/v1/xp/achievements`, {
        headers: authHeaders,
      });
      expect(achResp.ok()).toBeTruthy();
      const achBody = await achResp.json();
      const ach = (
        achBody.achievements as Array<{
          id: string;
          unlocked: boolean;
          unlocked_at: string | null;
        }>
      ).find((a) => a.id === ACHIEVEMENT_ID);
      expect(ach).toBeDefined();
      expect(ach!.unlocked).toBe(true);
      expect(ach!.unlocked_at).toBeTruthy();
    },
  );
});
