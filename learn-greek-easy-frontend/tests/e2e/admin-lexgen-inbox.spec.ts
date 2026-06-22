// learn-greek-easy-frontend/tests/e2e/admin-lexgen-inbox.spec.ts
//
// LEXGEN-12-05: E2E acceptance spec for the Verification Inbox (read-only slice).
//
// Covers the two critical flows from the story (LEXGEN-12 § E2E Test Flows):
//   1. Admin opens the queue → priority-ordered `needs_review` proposals → opens a
//      proposal → sees per-field values + provenance + flagged markers, with
//      NO numeric scores anywhere (anti-anchoring, Decision Record §3) and NO
//      action controls (read-only slice; actions are LEXGEN-13).
//   2. Empty queue (cleared in beforeAll) shows the empty state, no errors.
//
// ─────────────────────────────────────────────────────────────────────────────
// SEED-ROUTE CONTRACT (the executor implements these in
// learn-greek-easy-backend/src/api/v1/test/seed.py — Test-first: this spec is
// authored RED before those routes exist). Both routes gated on
// TEST_SEED_ENABLED and never mounted in prod (mirror seed.py /news-feed +
// /news-feed/clear; never /truncate).
//
//   POST /api/v1/test/seed/lexgen-proposals
//     Creates a DETERMINISTIC set of word_proposal rows:
//       (a) ONE heavily-flagged `needs_review` row: SEVERAL flagged fields
//           (>= 3, including at least one morphological field e.g. "gender" and
//           one content field e.g. "example_greek"); reconciliation_log.fields
//           carrying {value, source} for the flagged morphological fields;
//           generated_content populated for all 4 content keys; AND judge_scores
//           + trust_score populated (so the "scores absent" assertion is real).
//           This row MUST sort FIRST (most-flagged, ORDER BY
//           jsonb_array_length(flagged_fields) DESC, created_at ASC, id ASC).
//       (b) ONE `needs_review` row with ZERO flagged fields (still needs_review).
//       (c) A few MORE `needs_review` rows with intermediate flag counts so the
//           total needs_review count is in the story's 5–10 range.
//       (d) A few NON-`needs_review` rows (e.g. `scored`, `shipped`) — these MUST
//           NOT appear in the queue (proves the server-side needs_review filter).
//     The total needs_review count MUST be <= 20 (the UI PAGE_SIZE) so every
//     seeded needs_review row lands on page 1 — this lets the spec assert the
//     visible row count == needs_review_created exactly (filter-correctness).
//     Returns SeedResultResponse; `results` MUST include:
//       - needs_review_created: number   (queue row count the spec asserts on)
//       - non_review_created:   number   (rows that must be EXCLUDED, > 0)
//       - judge_score_digits:   number[] (the rubric/trust digits seeded on the
//                                         most-flagged row, so the spec can assert
//                                         those exact digits never reach the DOM —
//                                         e.g. the 1–5 rubric values + the
//                                         trust_score's significant digits)
//     Ordering the spec relies on: the heavily-flagged row (a) is FIRST.
//
//   POST /api/v1/test/seed/lexgen-proposals/clear
//     Deletes ONLY word_proposal rows (never /truncate). Returns SeedResultResponse.
//
// Requires TEST_SEED_ENABLED=true on the deployed preview backend.
// This spec runs in CI's E2E shards + the Phase 3.5 release — NOT locally
// (project rule: no local server).
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test, type Locator } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';

test.use({ storageState: STORAGE_STATE.ADMIN });

// Run serially so seed / clear state does not cross-contaminate between blocks.
test.describe.configure({ mode: 'serial' });

// ── Helpers ───────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

// The score-language the detail panel must NEVER surface (anti-anchoring,
// Decision Record §3). These are case-insensitive substring patterns; the panel
// shows only field VALUE / SOURCE / a "Flagged" badge — none of these words.
const FORBIDDEN_SCORE_PATTERNS: RegExp[] = [
  /score/i,
  /naturalness/i,
  /sense[\s_]?fit/i,
  /trust/i,
  /confidence/i,
  /a2[\s_]?appropriateness/i,
  /translation[\s_]?faith/i,
];

/** Open the inbox tab and wait for the active SectionTab to confirm render. */
async function openInbox(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin?tab=lexgenInbox');
  await page.locator('.va-tab[aria-selected="true"]').waitFor({ state: 'visible' });
}

/**
 * Assert none of the forbidden score patterns appear within a given scope, and
 * none of the seeded judge-score digits appear there either. Scope is the detail
 * panel so the queue's flagged-count badges (legitimate integers) are excluded.
 */
async function assertNoScoresIn(scope: Locator, judgeScoreDigits: number[]): Promise<void> {
  for (const pattern of FORBIDDEN_SCORE_PATTERNS) {
    await expect(
      scope.getByText(pattern),
      `forbidden score language ${pattern} must not appear in the detail panel`
    ).toHaveCount(0);
  }
  // The exact seeded rubric / trust digits must be absent from the panel text.
  const panelText = (await scope.textContent()) ?? '';
  for (const digit of judgeScoreDigits) {
    expect(
      panelText.includes(String(digit)),
      `seeded judge-score digit "${digit}" must not be rendered in the detail panel`
    ).toBe(false);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Block A — populated queue
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Admin Verification Inbox — populated (LEXGEN-12-05)', () => {
  let needsReviewCreated: number;
  let nonReviewCreated: number;
  let judgeScoreDigits: number[];

  test.beforeAll(async ({ request }) => {
    const apiBaseUrl = getApiBaseUrl();
    const res = await request.post(`${apiBaseUrl}/api/v1/test/seed/lexgen-proposals`);
    expect(res.ok(), 'seed route must exist and succeed').toBeTruthy();
    const body = await res.json();
    const results = body?.results ?? {};

    needsReviewCreated = results.needs_review_created;
    nonReviewCreated = results.non_review_created;
    judgeScoreDigits = results.judge_score_digits ?? [];

    // Contract sanity — the spec's assertions depend on these.
    expect(needsReviewCreated, 'needs_review_created must be a positive count').toBeGreaterThan(0);
    expect(
      needsReviewCreated,
      'all needs_review rows must fit on page 1 (PAGE_SIZE=20) for the filter assertion'
    ).toBeLessThanOrEqual(20);
    expect(
      nonReviewCreated,
      'must seed non-needs_review rows so the queue filter is provable'
    ).toBeGreaterThan(0);
    expect(
      judgeScoreDigits.length,
      'must report the seeded judge-score digits so the no-scores assertion is meaningful'
    ).toBeGreaterThan(0);
  });

  // ── flow-1 + order: queue shows only needs_review, priority-ordered ──────────

  test('queue lists only needs_review rows, priority-ordered, with no scores', async ({ page }) => {
    await openInbox(page);

    const table = page.getByTestId('lexgen-inbox-table');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Filter-correctness: the visible row count equals the number of needs_review
    // rows seeded — NOT needs_review_created + non_review_created. This proves the
    // server-side `status = needs_review` filter excludes scored/shipped rows.
    const rows = page.locator('[data-testid^="lexgen-inbox-row-"]');
    await expect(rows).toHaveCount(needsReviewCreated);

    // No score language anywhere in the queue (the flagged-count badge is a bare
    // integer, not a "score" — none of the forbidden words appear).
    for (const pattern of FORBIDDEN_SCORE_PATTERNS) {
      await expect(
        table.getByText(pattern),
        `forbidden score language ${pattern} must not appear in the queue`
      ).toHaveCount(0);
    }
  });

  // ── flow-1: open detail (read-only, provenance, flagged, NO SCORES) ──────────

  test('opening the first (most-flagged) proposal shows provenance + flagged markers, no scores, no actions', async ({
    page,
  }) => {
    await openInbox(page);
    await expect(page.getByTestId('lexgen-inbox-table')).toBeVisible({ timeout: 15_000 });

    // Ordering: the FIRST row is the most-flagged proposal (ORDER BY flagged DESC,
    // created_at ASC, id ASC). Click it to open the detail Sheet.
    const firstRow = page.locator('[data-testid^="lexgen-inbox-row-"]').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    const detail = page.getByTestId('lexgen-proposal-detail');
    await expect(detail).toBeVisible({ timeout: 10_000 });

    // Per-field rows are rendered (value + provenance + flagged for each field).
    const fieldRows = detail.locator('[data-testid^="lexgen-field-row-"]');
    await expect(fieldRows.first()).toBeVisible();
    expect(await fieldRows.count()).toBeGreaterThan(0);

    // The most-flagged row carries at least one flagged-field badge.
    await expect(detail.getByTestId('lexgen-field-flagged-badge').first()).toBeVisible();

    // Provenance: the i18n "Source" label appears on at least one field row.
    await expect(detail.getByText(/source/i).first()).toBeVisible();

    // ── Anti-anchoring (Decision Record §3): NO numeric scores anywhere. ──
    // No forbidden score language, and none of the seeded judge-score digits,
    // appear in the detail panel.
    await assertNoScoresIn(detail, judgeScoreDigits);

    // ── Read-only slice: NO action controls (approve/edit/regenerate/reject). ──
    // The Sheet's own close button (an "X" / "Close") does not match these words.
    await expect(
      detail.getByRole('button', { name: /approve|edit|regenerate|reject/i }),
      'detail must be read-only — no review-action buttons (those are LEXGEN-13)'
    ).toHaveCount(0);
  });

  // ── pagination (graceful): controls only render when total > one page ────────

  test('pagination controls behave (skipped gracefully when single-page)', async ({ page }) => {
    await openInbox(page);
    await expect(page.getByTestId('lexgen-inbox-table')).toBeVisible({ timeout: 15_000 });

    const next = page.getByTestId('pagination-next');
    const hasPagination = (await next.count()) > 0;
    test.skip(!hasPagination, 'single page of results — pagination controls not rendered');

    // When present, Prev is disabled on page 1 and Next is enabled.
    await expect(page.getByTestId('pagination-prev')).toBeDisabled();
    await expect(next).toBeEnabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block B — empty queue (cleared in beforeAll, per D-SEED-CLEAR)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Admin Verification Inbox — empty (LEXGEN-12-05)', () => {
  test.beforeAll(async ({ request }) => {
    const apiBaseUrl = getApiBaseUrl();
    const res = await request.post(`${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/clear`);
    expect(res.ok(), 'clear route must exist and succeed').toBeTruthy();
  });

  // ── flow-2: empty queue shows the empty state, no errors ─────────────────────

  test('empty queue shows the empty state and no rows or errors', async ({ page }) => {
    await openInbox(page);

    // Empty state visible; no queue table; no error alert.
    await expect(page.getByTestId('lexgen-inbox-empty')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('lexgen-inbox-table')).toHaveCount(0);
    await expect(page.locator('[data-testid^="lexgen-inbox-row-"]')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
