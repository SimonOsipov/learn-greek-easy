// learn-greek-easy-frontend/tests/e2e/lexgen-inbox-actions.spec.ts
//
// LEXGEN-13-06: E2E acceptance spec for the 4 Verification Inbox review actions.
//
// ─────────────────────────────────────────────────────────────────────────────
// DESIGN DECISIONS (Executor summary — see Backlog task-1153 for full rationale)
// ─────────────────────────────────────────────────────────────────────────────
//
// Option A (coordinator-directed, 2026-06-23): edit + regenerate GENUINELY run
// the full chain (generator→verify→reconcile→judge) against the deployed preview
// backend using a deterministic FakeOpenRouter injected ONLY at
// `_get_openrouter()` in `lexgen_review_service.py`.
//
// The fake is gated by `LEXGEN_E2E_FAKE_LLM=true` (set in test.yml for both
// E2E backend-start steps) AND `not is_production` (structural double-guard).
// Pipeline-stage files (generator/verify/judge/reconciler) are BYTE-IDENTICAL to
// origin/main — the fake never touches them.
//
// Real-chain+fake integration test `test_lexgen_fake_openrouter_chain.py` (CI-only)
// pins the fake's correctness locally as a binding gate.
//
// spaCy caveat: `check_target_attested` lemmatizes the single-token example;
// worst case the verify stage marks FLAGGED (not REJECTED) → chain still ends
// needs_review via FLAGGED→NEEDS_REVIEW.  Final status is deterministic;
// only flagged_fields varies.  ALL assertions are on STATUS + attempt/log
// EXISTENCE, NEVER an exact flagged_fields set.
//
// Flow → lemma mapping (distinct lemmas — parallel-shard-safe):
//   Flow 1 (approve)    → ουρανός   (zero-flagged)
//   Flow 2 (edit)       → δρόμος    (flagged: gender; generated_fields.gender = masculine)
//   Flow 3 (regenerate) → βιβλίο    (flagged: gender; retry_attempts = 2)
//   Flow 4 (reject)     → θάλασσα   (flagged: gender, declension_group, example_greek)
//
// DB assertions use the 3 test-only read endpoints (D2):
//   GET /api/v1/test/seed/lexgen-proposals/{id}/review-log
//   GET /api/v1/test/seed/lexgen-proposals/{id}/attempts
//   GET /api/v1/test/seed/lexgen-proposals/{id}/state
//
// The admin detail GET 404s on non-needs_review (shipped/rejected) so these
// read endpoints are the only way to assert final state from Playwright.
//
// FORBIDDEN_SCORE_PATTERNS: reused from admin-lexgen-inbox.spec.ts to preserve
// the anti-anchoring invariant (no score language in the detail panel).
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test, type Page, type APIRequestContext } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';

test.use({ storageState: STORAGE_STATE.ADMIN });

// All 4 flows run serially so seed state is predictable and per-lemma IDs
// are resolved once then used throughout that flow.
test.describe.configure({ mode: 'serial' });

// ── Helpers ───────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

// Score language that must NEVER appear in the detail panel (anti-anchoring,
// Decision Record §3). Matches FORBIDDEN_SCORE_PATTERNS in admin-lexgen-inbox.spec.ts.
const FORBIDDEN_SCORE_PATTERNS: RegExp[] = [
  /score/i,
  /naturalness/i,
  /sense[\s_]?fit/i,
  /trust/i,
  /confidence/i,
  /a2[\s_]?appropriateness/i,
  /translation[\s_]?faith/i,
];

/** Navigate to the lexgen inbox tab and wait for it to be active. */
async function openInbox(page: Page): Promise<void> {
  await page.goto('/admin?tab=lexgenInbox');
  await page.locator('.va-tab[aria-selected="true"]').waitFor({ state: 'visible' });
  await expect(page.getByTestId('lexgen-inbox-table')).toBeVisible({ timeout: 15_000 });
}

/**
 * Resolve a proposal ID by calling the test-only seed list endpoint and finding
 * the item whose lemma matches. Uses a fresh API request (not a page navigation)
 * so it works even when the proposal detail sheet is open.
 *
 * Uses GET /api/v1/test/seed/lexgen-proposals instead of the admin endpoint
 * because the admin endpoint is gated by get_current_superuser and Playwright's
 * raw request context does not carry the admin JWT (only cookies, not the
 * localStorage-backed Authorization header the app's axios attaches). The seed
 * endpoint uses verify_seed_access (TEST_SEED_ENABLED gate), which requires no
 * auth header — matching the pattern used by the existing read endpoints.
 */
async function resolveProposalId(
  request: APIRequestContext,
  lemma: string,
): Promise<string> {
  const apiBaseUrl = getApiBaseUrl();
  const res = await request.get(
    `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals`,
  );
  expect(res.ok(), `test seed list endpoint must succeed for lemma=${lemma}`).toBeTruthy();
  const body = await res.json();
  const item = (body.proposals ?? []).find((i: { lemma: string }) => i.lemma === lemma);
  expect(item, `proposal with lemma="${lemma}" must exist in the seeded proposals`).toBeTruthy();
  return item.id as string;
}

/**
 * Click the inbox row whose cell text contains the given lemma to open its
 * detail sheet.
 */
async function openDetailForLemma(page: Page, lemma: string): Promise<void> {
  // The table is already visible from openInbox(). Click the row by visible text.
  const row = page.locator('[data-testid^="lexgen-inbox-row-"]').filter({ hasText: lemma });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();
  await expect(page.getByTestId('lexgen-proposal-detail')).toBeVisible({ timeout: 10_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// beforeAll: seed lexgen proposals (includes the dedicated approve deck)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Admin Verification Inbox — Review Actions (LEXGEN-13-06)', () => {
  const apiBaseUrl = getApiBaseUrl();

  test.beforeAll(async ({ request }) => {
    // Seed the 4 lexgen proposals (θάλασσα, βιβλίο, ποτάμι, δρόμος, ουρανός + 2
    // non-review rows) AND the dedicated "LEXGEN E2E Approve Deck". Idempotent —
    // deletes all word_proposal rows and the named deck first, then re-creates both.
    // No dependency on /seed/admin-cards.
    const proposalsRes = await request.post(`${apiBaseUrl}/api/v1/test/seed/lexgen-proposals`);
    expect(proposalsRes.ok(), 'POST /seed/lexgen-proposals must succeed').toBeTruthy();
    const proposalsBody = await proposalsRes.json();
    expect(
      proposalsBody?.results?.needs_review_created,
      'seed must create needs_review proposals',
    ).toBeGreaterThan(0);
    expect(
      proposalsBody?.results?.approve_deck?.id,
      'seed must create and return the dedicated approve deck',
    ).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Flow 1 — Approve → ship (ουρανός)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // AC-2: word_entries row created; status == shipped; shipped_word_entry_id set;
  // at least one accept log row with action=="approve" and human_decision=="accept".
  // ουρανός has zero flagged fields → one summary accept row (field == null).

  test('Flow 1: approve → ship (ουρανός)', async ({ page, request }) => {
    // TEMP DIAGNOSTIC (LEXGEN-13-06) — revert after root cause identified
    // Replaced toPass retry block with a single linear sequence that emits
    // DIAGNOSTIC: log lines so CI shows the ground truth before the failing assertion.
    test.setTimeout(120_000);
    const proposalId = await resolveProposalId(request, 'ουρανός');

    // 1. Register a response listener BEFORE any navigation so we capture the
    //    /admin/decks call the component fires when the approve dialog opens.
    const deckResponses: Array<{ status: number; body: string }> = [];
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/v1/admin/decks')) {
        let body = '';
        try {
          body = await resp.text();
        } catch {
          body = '<unreadable>';
        }
        deckResponses.push({ status: resp.status(), body: body.slice(0, 2000) });
      }
    });

    // 2. Reseed the deck (deck-only endpoint — does not wipe word_proposal rows).
    const deckRes = await request.post(`${apiBaseUrl}/api/v1/test/seed/lexgen-approve-deck`);
    console.log(
      'DIAGNOSTIC: reseed status=',
      deckRes.status(),
      'body=',
      await deckRes.text(),
    );

    // 3. Hit decks-debug IMMEDIATELY after reseed to see raw DB state.
    const dbg1 = await request.get(`${apiBaseUrl}/api/v1/test/seed/decks-debug`);
    console.log('DIAGNOSTIC: decks-debug AFTER reseed =', await dbg1.text());

    // 4. Navigate to the inbox and open the ουρανός detail (triggers list_decks query).
    await openInbox(page);
    await openDetailForLemma(page, 'ουρανός');

    // 5. Hit decks-debug again after navigation to detect truncation during nav.
    const dbg2 = await request.get(`${apiBaseUrl}/api/v1/test/seed/decks-debug`);
    console.log('DIAGNOSTIC: decks-debug AFTER nav =', await dbg2.text());

    const detail = page.getByTestId('lexgen-proposal-detail');

    // Anti-anchoring: no score language in the detail panel.
    for (const pattern of FORBIDDEN_SCORE_PATTERNS) {
      await expect(detail.getByText(pattern)).toHaveCount(0);
    }

    // 6. Click Approve to open the confirm dialog.
    await page.getByTestId('lexgen-action-approve').click();

    // 7. Open the deck Select and wait briefly for the list_decks response.
    const deckSelect = page.getByTestId('lexgen-approve-deck-select');
    await expect(deckSelect).toBeVisible({ timeout: 5_000 });
    await deckSelect.click();
    await page.waitForTimeout(2000);

    // 8. Log all captured /admin/decks browser responses.
    console.log(
      'DIAGNOSTIC: /admin/decks browser responses =',
      JSON.stringify(deckResponses),
    );

    // 9. Log the option count visible in the Select portal.
    const optCount = await page.getByRole('option').count();
    console.log('DIAGNOSTIC: option count in Select =', optCount);

    // 10. Final assertion — will fail if the deck is absent, but diagnostics above
    //     already printed so CI log shows ground truth.
    await expect(page.getByRole('option', { name: /LEXGEN E2E Approve Deck/i }))
      .toBeVisible({ timeout: 5_000 });

    // END TEMP DIAGNOSTIC (LEXGEN-13-06)

    // The Select is open and the option is visible — pick it and confirm.
    await page.getByRole('option', { name: /LEXGEN E2E Approve Deck/i }).click();

    // Confirm approve.
    await page.getByTestId('lexgen-approve-confirm').click();

    // Wait for the mutation to settle (sheet closes or status changes).
    // The detail sheet closes after a successful approve.
    await expect(page.getByTestId('lexgen-proposal-detail')).toHaveCount(0, {
      timeout: 15_000,
    });

    // DB assertions via test-read endpoints.
    const stateRes = await request.get(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/${proposalId}/state`,
    );
    expect(stateRes.ok(), 'state endpoint must succeed').toBeTruthy();
    const state = await stateRes.json();
    expect(state.status, 'status must be shipped after approve').toBe('shipped');
    expect(state.shipped_word_entry_id, 'shipped_word_entry_id must be set').not.toBeNull();
    expect(state.word_entry_exists, 'word_entries row must exist').toBe(true);

    const logRes = await request.get(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/${proposalId}/review-log`,
    );
    expect(logRes.ok(), 'review-log endpoint must succeed').toBeTruthy();
    const logBody = await logRes.json();
    const acceptRows = (logBody.rows as Array<{ action: string; human_decision: string | null }>)
      .filter((r) => r.action === 'approve');
    expect(acceptRows.length, 'at least one approve log row must exist').toBeGreaterThanOrEqual(1);
    // All approve rows carry human_decision=="accept".
    acceptRows.forEach((r) => {
      expect(r.human_decision, 'approve log rows must have human_decision=="accept"').toBe(
        'accept',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Flow 2 — Edit → re-score → needs_review (δρόμος)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // AC-3: status stays needs_review (never auto-approved/shipped);
  // EDIT log row with field=="gender", pipeline_value=="masculine",
  // edited_value=="feminine".
  //
  // With LEXGEN_E2E_FAKE_LLM=true and a valid evidence_packet, the real chain
  // runs (edit→judge→needs_review) via the FakeOpenRouter.

  test('Flow 2: edit gender → re-score → stays needs_review (δρόμος)', async ({
    page,
    request,
  }) => {
    const proposalId = await resolveProposalId(request, 'δρόμος');

    await openInbox(page);
    await openDetailForLemma(page, 'δρόμος');

    // Click the edit button for the "gender" field.
    await page.getByTestId('lexgen-field-edit-btn-gender').click();

    // Clear the current value and type the new value.
    const editInput = page.getByTestId('lexgen-field-edit-gender');
    await expect(editInput).toBeVisible({ timeout: 5_000 });
    await editInput.clear();
    await editInput.fill('feminine');

    // Save the edit.
    await page.getByTestId('lexgen-field-save-gender').click();

    // Wait for the mutation to settle. The sheet may reload or show a toast.
    // We wait for the save button to disappear (editing mode ends).
    await expect(page.getByTestId('lexgen-field-save-gender')).toHaveCount(0, {
      timeout: 15_000,
    });

    // DB assertions.
    const stateRes = await request.get(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/${proposalId}/state`,
    );
    expect(stateRes.ok(), 'state endpoint must succeed').toBeTruthy();
    const state = await stateRes.json();
    expect(
      state.status,
      'status must remain needs_review after edit (binary routing — never auto-approved)',
    ).toBe('needs_review');

    const logRes = await request.get(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/${proposalId}/review-log`,
    );
    expect(logRes.ok(), 'review-log endpoint must succeed').toBeTruthy();
    const logBody = await logRes.json();
    const editRows = (
      logBody.rows as Array<{
        action: string;
        field: string | null;
        pipeline_value: string | null;
        edited_value: string | null;
      }>
    ).filter((r) => r.action === 'edit' && r.field === 'gender');
    expect(editRows.length, 'at least one edit log row for gender must exist').toBeGreaterThanOrEqual(1);
    const editRow = editRows[0];
    expect(editRow.pipeline_value, 'pipeline_value (old) must be masculine').toBe('masculine');
    expect(editRow.edited_value, 'edited_value (new) must be feminine').toBe('feminine');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Flow 3 — Regenerate → prior attempt retained (βιβλίο)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // AC-4: status ends needs_review; ProposalAttempt snapshot retained
  // (attempt_no==1, retry_attempts==2 preserved from the seed); reject log
  // rows for the prior flagged field(s).
  //
  // With LEXGEN_E2E_FAKE_LLM=true the real chain runs
  // (regenerate→generator→verify→reconcile→judge→needs_review).

  test('Flow 3: regenerate → prior attempt retained (βιβλίο)', async ({ page, request }) => {
    const proposalId = await resolveProposalId(request, 'βιβλίο');

    await openInbox(page);
    await openDetailForLemma(page, 'βιβλίο');

    // Click the Regenerate action button to open the confirm dialog.
    await page.getByTestId('lexgen-action-regenerate').click();

    // Confirm regenerate.
    await page.getByTestId('lexgen-regenerate-confirm').click();

    // Wait for the mutation to settle. The sheet may reload or close.
    // Expect the confirm button to disappear.
    await expect(page.getByTestId('lexgen-regenerate-confirm')).toHaveCount(0, {
      timeout: 30_000,
    });

    // DB assertions.
    const stateRes = await request.get(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/${proposalId}/state`,
    );
    expect(stateRes.ok(), 'state endpoint must succeed').toBeTruthy();
    const state = await stateRes.json();
    expect(
      state.status,
      'status must end needs_review after regenerate',
    ).toBe('needs_review');

    const attemptsRes = await request.get(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/${proposalId}/attempts`,
    );
    expect(attemptsRes.ok(), 'attempts endpoint must succeed').toBeTruthy();
    const attemptsBody = await attemptsRes.json();
    expect(
      attemptsBody.attempts.length,
      'at least one ProposalAttempt snapshot must exist after regenerate',
    ).toBeGreaterThanOrEqual(1);

    // The snapshot with attempt_no==1 was created by regenerate(). It captures
    // the proposal's state BEFORE mutation — including retry_attempts==2 from seed.
    const snap = (attemptsBody.attempts as Array<{ attempt_no: number; retry_attempts: number | null; generated_fields: unknown }>).find(
      (a) => a.attempt_no === 1,
    );
    expect(snap, 'ProposalAttempt with attempt_no==1 must exist').toBeTruthy();
    // retry_attempts preserved from the seed row (βιβλίο: retry_attempts=2).
    expect(
      snap?.retry_attempts,
      'attempt snapshot must preserve retry_attempts==2 from the seed',
    ).toBe(2);
    expect(snap?.generated_fields, 'attempt snapshot must carry generated_fields').not.toBeNull();

    // Reject log rows for the prior flagged field(s).
    const logRes = await request.get(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/${proposalId}/review-log`,
    );
    expect(logRes.ok(), 'review-log endpoint must succeed').toBeTruthy();
    const logBody = await logRes.json();
    const rejectRows = (logBody.rows as Array<{ action: string }>).filter(
      (r) => r.action === 'reject',
    );
    expect(
      rejectRows.length,
      'at least one reject log row must exist (for prior flagged field)',
    ).toBeGreaterThanOrEqual(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Flow 4 — Reject → archived (θάλασσα)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // AC-5: status == rejected; rejection_reason stored; 3 reject log rows
  // (gender, declension_group, example_greek), each with human_decision=="accept".

  test('Flow 4: reject → archived (θάλασσα)', async ({ page, request }) => {
    const proposalId = await resolveProposalId(request, 'θάλασσα');

    await openInbox(page);
    await openDetailForLemma(page, 'θάλασσα');

    // Click the Reject action button to open the confirm dialog.
    await page.getByTestId('lexgen-action-reject').click();

    // Type a rejection reason.
    const REJECTION_REASON = 'Example sentence is too complex for A2 level';
    const reasonTextarea = page.getByTestId('lexgen-reject-reason');
    await expect(reasonTextarea).toBeVisible({ timeout: 5_000 });
    await reasonTextarea.fill(REJECTION_REASON);

    // Confirm reject.
    await page.getByTestId('lexgen-reject-confirm').click();

    // Wait for the mutation to settle (confirm button disappears).
    await expect(page.getByTestId('lexgen-reject-confirm')).toHaveCount(0, {
      timeout: 15_000,
    });

    // DB assertions.
    const stateRes = await request.get(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/${proposalId}/state`,
    );
    expect(stateRes.ok(), 'state endpoint must succeed').toBeTruthy();
    const state = await stateRes.json();
    expect(state.status, 'status must be rejected').toBe('rejected');
    expect(state.rejection_reason, 'rejection_reason must be stored').toBe(REJECTION_REASON);

    const logRes = await request.get(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/${proposalId}/review-log`,
    );
    expect(logRes.ok(), 'review-log endpoint must succeed').toBeTruthy();
    const logBody = await logRes.json();

    // θάλασσα has 3 flagged fields: gender, declension_group, example_greek.
    const rejectRows = (
      logBody.rows as Array<{ action: string; field: string | null; human_decision: string | null }>
    ).filter((r) => r.action === 'reject');
    expect(
      rejectRows.length,
      'must have 3 reject log rows (one per flagged field)',
    ).toBe(3);

    const fields = rejectRows.map((r) => r.field).sort();
    expect(fields).toContain('gender');
    expect(fields).toContain('declension_group');
    expect(fields).toContain('example_greek');

    // Each reject log row carries human_decision=="accept" (per review:reject).
    rejectRows.forEach((r) => {
      expect(r.human_decision, 'reject log rows must have human_decision=="accept"').toBe(
        'accept',
      );
    });
  });
});
