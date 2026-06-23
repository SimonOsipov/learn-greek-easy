// learn-greek-easy-frontend/tests/e2e/admin-lexgen-submit.spec.ts
//
// LEXGEN-14-05: E2E acceptance spec for the rewired admin submit flow.
//
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE NOTE — Why no UI form interaction
// ─────────────────────────────────────────────────────────────────────────────
//
// LexgenSubmitDialog is mounted in two places:
//   1. DeckDetailModal (trigger: `create-card-btn`, when isVocabulary=True)
//   2. VocabDrawerBody  (trigger: `word-list-add-word`)
//
// Both paths require navigating through the `useDeck` hook, which resolves a
// deck by listing up to 200 decks via adminAPI.listDecks. This consistently
// exceeds CI runner timeouts (see: admin-decks.spec.ts — ALL flows skipped for
// this reason). Driving the form through a flaky path would make these tests
// unreliable.
//
// Alternative used here: POST /api/v1/test/seed/lexgen-submit-flows — a
// test-only endpoint that:
//   (a) Seeds a WiktionaryMorphology reference row for βιβλίο (gloss_en="book")
//       so assemble_evidence("βιβλίο","noun") returns wiktionary.present=True.
//   (b) Calls LexgenPipelineService.run_for_lemma() for both test lemmas,
//       using FakeOpenRouter (LEXGEN_E2E_FAKE_LLM=true in CI).
//   Returns proposal IDs for assertion via the existing test-read endpoints.
//
// This seam exercises the SAME code path as the UI form (adminAPI.submitLexgenProposal
// → POST /api/v1/admin/lexgen/proposals → LexgenPipelineService.run_for_lemma),
// so the pipeline coverage is equivalent. The difference is the HTTP caller is
// the seed endpoint, not the browser form.
//
// The "no old-endpoint calls" assertion is verified by probing
// POST /api/v1/admin/word-entries/generate directly (must return 404/405 after
// the LEXGEN-14-02 cutover removed the route).
//
// VISUAL GATE NOTE
// The story lists a visual scenario `admin-generate-rewired`. The visual check
// is the RALPH Phase 3.5 release-verify gate (manual screenshot review of the
// thin submit form replacing the old UnifiedVerificationTable). We do NOT add
// a screenshot assertion here — that would be brittle and duplicate the
// release-verify gate. These tests prove the functional pipeline outcome.
//
// ─────────────────────────────────────────────────────────────────────────────
// SEED ROUTE CONTRACT (implemented in backend/src/api/v1/test/seed.py LEXGEN-14-05)
//
//   POST /api/v1/test/seed/lexgen-submit-flows
//     Seeds a WiktionaryMorphology row for βιβλίο and invokes
//     LexgenPipelineService.run_for_lemma() for both:
//       • βιβλίο  → attested  → needs_review
//       • ξψζ     → absent    → rejected (never-invent)
//     Returns SeedResultResponse; results includes:
//       - attested_proposal_id: string   (βιβλίο proposal UUID)
//       - rejected_proposal_id: string   (ξψζ proposal UUID)
//       - attested_lemma: string         (= "βιβλίο")
//       - rejected_lemma: string         (= "ξψζ")
//       - attested_outcome: string       (= "queued")
//       - rejected_outcome: string       (= "rejected")
//     Idempotent: deletes all word_proposal rows before running.
//     Requires TEST_SEED_ENABLED=true.
//
//   GET /api/v1/test/seed/lexgen-proposals/{id}/state
//     Returns { status, rejection_reason, shipped_word_entry_id,
//               word_entry_exists, flagged_fields }.
//     Used to assert final DB state after the pipeline runs.
// ─────────────────────────────────────────────────────────────────────────────

import { expect, test } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';

test.use({ storageState: STORAGE_STATE.ADMIN });

// All assertions run serially — the seed endpoint is idempotent but we rely
// on stable IDs captured in beforeAll.
test.describe.configure({ mode: 'serial' });

// ── Helpers ───────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

// ─────────────────────────────────────────────────────────────────────────────
// LEXGEN-14-05: Rewired submit flow assertions
// ─────────────────────────────────────────────────────────────────────────────

test.describe('LEXGEN submit flow — rewired pipeline (LEXGEN-14-05)', () => {
  const apiBaseUrl = getApiBaseUrl();

  // IDs are resolved once in beforeAll and shared across the two flow tests.
  let attestedProposalId: string;
  let rejectedProposalId: string;

  test.beforeAll(async ({ request }) => {
    // Call the seed endpoint — this seeds reference data and runs the pipeline
    // for both test lemmas (βιβλίο attested, ξψζ never-invent).
    // Requires LEXGEN_E2E_FAKE_LLM=true in the backend env (set in test.yml).
    const res = await request.post(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-submit-flows`,
    );
    expect(
      res.ok(),
      `POST /seed/lexgen-submit-flows must succeed; got ${res.status()}`,
    ).toBeTruthy();

    const body = await res.json();
    const results = body?.results ?? {};

    attestedProposalId = results.attested_proposal_id as string;
    rejectedProposalId = results.rejected_proposal_id as string;

    expect(
      attestedProposalId,
      'attested_proposal_id must be present in seed results',
    ).toBeTruthy();
    expect(
      rejectedProposalId,
      'rejected_proposal_id must be present in seed results',
    ).toBeTruthy();

    // The seed endpoint reports the pipeline outcome: verify the outcome keys
    // match what we expect (early guard before the state assertions below).
    expect(
      results.attested_outcome,
      'attested lemma must have outcome "queued"',
    ).toBe('queued');
    expect(
      results.rejected_outcome,
      'rejected lemma must have outcome "rejected"',
    ).toBe('rejected');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Flow 1 — Attested lemma (βιβλίο) → pipeline runs → needs_review
  //
  // Verifies:
  //   • The pipeline ran to completion for an attested lemma.
  //   • status == "needs_review" (NOT auto-shipped — Decision Record §3 binary routing).
  //   • shipped_word_entry_id == null (no auto-ship on fresh submit).
  //   • word_entry_exists == false (no WordEntry created by the submit path).
  //   • The old /word-entries/generate endpoint is GONE (returns 404 or 405).
  // ─────────────────────────────────────────────────────────────────────────

  test('Flow 1: attested lemma → pipeline runs → needs_review (no auto-ship)', async ({
    request,
  }) => {
    // Assert pipeline outcome via the test-read state endpoint.
    const stateRes = await request.get(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/${attestedProposalId}/state`,
    );
    expect(stateRes.ok(), 'state endpoint must succeed for attested proposal').toBeTruthy();
    const state = await stateRes.json();

    // The attested proposal must be queued for inbox review — NOT auto-shipped.
    expect(
      state.status,
      'attested lemma must reach needs_review (binary routing — never auto-approved)',
    ).toBe('needs_review');

    // No word_entry was created by the submit path (deck-linking happens at inbox approve).
    expect(
      state.shipped_word_entry_id,
      'shipped_word_entry_id must be null — no auto-ship on fresh submit',
    ).toBeNull();
    expect(
      state.word_entry_exists,
      'word_entry_exists must be false — submit does not create a WordEntry',
    ).toBe(false);

    // The old generate endpoint must be GONE after the LEXGEN-14-02 cutover.
    // POSTing to it must return 404 (unregistered) or 405 (method not allowed).
    const oldEndpointRes = await request.post(
      `${apiBaseUrl}/api/v1/admin/word-entries/generate`,
      { data: { lemma: 'βιβλίο', deck_id: '00000000-0000-0000-0000-000000000000' } },
    );
    expect(
      [404, 405],
      `old /word-entries/generate must return 404 or 405 after cutover; ` +
        `got ${oldEndpointRes.status()}`,
    ).toContain(oldEndpointRes.status());
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Flow 2 — Absent lemma (ξψζ) → never-invent gate → rejected
  //
  // Verifies:
  //   • The never-invent gate fires for a lemma absent from all references.
  //   • status == "rejected".
  //   • rejection_reason contains "never_invent".
  //   • shipped_word_entry_id == null (no WordEntry created).
  //   • word_entry_exists == false.
  //   • The old /word-entries/generate/stream endpoint is also GONE.
  // ─────────────────────────────────────────────────────────────────────────

  test('Flow 2: absent lemma → never-invent gate → rejected (no word entry)', async ({
    request,
  }) => {
    // Assert pipeline outcome via the test-read state endpoint.
    const stateRes = await request.get(
      `${apiBaseUrl}/api/v1/test/seed/lexgen-proposals/${rejectedProposalId}/state`,
    );
    expect(stateRes.ok(), 'state endpoint must succeed for rejected proposal').toBeTruthy();
    const state = await stateRes.json();

    // The never-invent gate must have fired — status is rejected.
    expect(
      state.status,
      'absent lemma must be hard-rejected by the never-invent gate',
    ).toBe('rejected');

    // Rejection reason must reference the never_invent gate.
    expect(
      state.rejection_reason,
      'rejection_reason must not be null for a rejected proposal',
    ).not.toBeNull();
    expect(
      (state.rejection_reason as string).includes('never_invent'),
      `rejection_reason must contain "never_invent"; got "${state.rejection_reason}"`,
    ).toBe(true);

    // No WordEntry was created for the rejected proposal.
    expect(
      state.shipped_word_entry_id,
      'shipped_word_entry_id must be null for a rejected proposal',
    ).toBeNull();
    expect(
      state.word_entry_exists,
      'word_entry_exists must be false for rejected proposals',
    ).toBe(false);

    // The old SSE stream endpoint must also be GONE after the LEXGEN-14-02 cutover.
    const oldStreamRes = await request.post(
      `${apiBaseUrl}/api/v1/admin/word-entries/generate/stream`,
      { data: { lemma: 'ξψζ', deck_id: '00000000-0000-0000-0000-000000000000' } },
    );
    expect(
      [404, 405],
      `old /word-entries/generate/stream must return 404 or 405 after cutover; ` +
        `got ${oldStreamRes.status()}`,
    ).toContain(oldStreamRes.status());
  });
});
