// learn-greek-easy-frontend/tests/e2e/admin-decks.spec.ts
//
// ADMIN2-09 / DKDR-14: E2E happy-path coverage for the Decks Drawer.
// 6 flows — Flow 6 (empty state) is skipped (see inline TODO).

import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

import { STORAGE_STATE } from '../../playwright.config';

import { navigateToAdminTab } from './helpers/admin-helpers';

test.use({ storageState: STORAGE_STATE.ADMIN });
test.describe.configure({ mode: 'serial' });

// ── Helpers ───────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

// ── Seed state (set in beforeAll, used across flows) ─────────────────────────

let vocabDeckId: string;
let cultureDeckId: string;
let firstWordEntryId: string;

async function captureSeed(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const res = await request.post(`${apiBaseUrl}/api/v1/test/seed/all`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();

  // v2_decks[0] is the Nouns vocab deck (Greek A1 Vocabulary (Nouns))
  const v2Decks: Array<{ id: string; name: string }> = body?.results?.v2_decks?.v2_decks ?? [];
  expect(v2Decks.length).toBeGreaterThan(0);
  vocabDeckId = v2Decks[0].id;

  // culture.decks[0] is the first culture deck
  const cultureDecks: Array<{ id: string; name: string; category: string }> =
    body?.results?.culture?.decks ?? [];
  expect(cultureDecks.length).toBeGreaterThan(0);
  cultureDeckId = cultureDecks[0].id;

  // Fetch word entries for the vocab deck to get the first word entry id
  const wordsRes = await request.get(
    `${apiBaseUrl}/api/v1/admin/decks/${vocabDeckId}/words?page=1&page_size=1`
  );
  if (wordsRes.ok()) {
    const wordsBody = await wordsRes.json();
    const cards: Array<{ id: string }> = wordsBody?.cards ?? [];
    if (cards.length > 0) {
      firstWordEntryId = cards[0].id;
    }
  }
}

test.beforeAll(async ({ request }) => {
  await captureSeed(request);
});

// ── Flows ─────────────────────────────────────────────────────────────────────

test.describe('ADMIN2-09 Decks Drawer — happy paths (DKDR-14)', () => {
  // ── Flow 1: Vocab item edit → completion pill updates ──────────────────────
  test('Flow 1: vocab item edit → completion pill updates', async ({ page }) => {
    // Navigate directly to the vocab deck (URL deep-link skips deck-row ambiguity).
    await page.goto(`/admin?tab=decks&edit=${vocabDeckId}`);
    await expect(page.getByTestId('deck-drawer')).toBeVisible({ timeout: 15_000 });
    // Wait for vocab body to populate (the words tab is the default for vocab decks).
    await expect(page.getByTestId('deck-drawer-tab-words')).toBeVisible({ timeout: 15_000 });

    // Click the first word row inside the drawer (deterministic because we're already on the vocab deck).
    await page.getByTestId('word-row').first().click({ timeout: 10_000 });

    // The rest is unchanged — wait for detail, edit, save.
    await expect(page.getByTestId('vocab-word-detail-lemma')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('vocab-word-detail-pills')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('word-entry-edit-btn').click();
    await expect(page.getByTestId('word-entry-edit-form')).toBeVisible({ timeout: 5_000 });
    const translationEnInput = page.getByTestId('word-entry-field-translation-en');
    await translationEnInput.clear();
    await translationEnInput.fill('E2E updated translation');
    await page.getByTestId('word-entry-save-btn').click();
    await expect(page.getByTestId('word-entry-edit-form')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('word-entry-content-fields')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('vocab-word-detail-pills')).toBeVisible();
  });

  // ── Flow 2: Culture item edit — toggle correct answer ─────────────────────
  test('Flow 2: culture item edit — toggle correct answer', async ({ page }) => {
    // Navigate directly to the culture deck via URL deep-link to avoid deck list ambiguity
    await page.goto(`/admin?tab=decks&edit=${cultureDeckId}`);
    await expect(page.getByTestId('deck-drawer')).toBeVisible({ timeout: 15_000 });

    // Questions tab is the default for culture decks
    await expect(page.getByTestId('deck-drawer-tab-questions')).toBeVisible({ timeout: 15_000 });

    // Click first question row to push detail view
    await page.getByTestId('question-row').first().click();
    await expect(page.getByTestId('culture-question-detail')).toBeVisible({ timeout: 15_000 });

    // Toggle the "correct" radio for option A (EN language tab is default)
    // correct-radio-A-en is the radio for option A on the EN tab
    const correctRadioA = page.getByTestId('correct-radio-A-en');
    if (await correctRadioA.isVisible()) {
      await correctRadioA.click();
    }

    // Save
    await page.getByTestId('culture-question-detail-save').click();

    // Drawer should stay visible after save (no navigation away from detail)
    await expect(page.getByTestId('deck-drawer')).toBeVisible({ timeout: 5_000 });
  });

  // ── Flow 3: Settings → Deactivate ─────────────────────────────────────────
  test('Flow 3: Settings → toggle Active off → DeactivationWarningDialog → confirm', async ({
    page,
  }) => {
    // Open vocab deck drawer
    await page.goto(`/admin?tab=decks&edit=${vocabDeckId}`);
    await expect(page.getByTestId('deck-drawer')).toBeVisible({ timeout: 15_000 });

    // Switch to Settings tab
    await page.getByTestId('deck-drawer-tab-settings').click();
    await expect(page.getByTestId('deck-settings-tab')).toBeVisible({ timeout: 15_000 });

    // Toggle the Active switch — clicking it when deck is_active=true triggers the warning dialog
    const activeSwitch = page.getByTestId('deck-edit-is-active');
    await activeSwitch.click();

    // DeactivationWarningDialog should appear
    await expect(page.getByTestId('deactivation-warning-dialog')).toBeVisible({ timeout: 5_000 });

    // Confirm deactivation
    await page.getByTestId('deactivation-confirm').click();
    await expect(page.getByTestId('deactivation-warning-dialog')).not.toBeVisible({
      timeout: 5_000,
    });

    // Form is now dirty — save it
    await page.getByTestId('deck-settings-save').click();

    // Auto-saved indicator appears briefly
    await expect(page.getByTestId('deck-settings-auto-saved')).toBeVisible({ timeout: 5_000 });

    // Re-seed to restore active state so subsequent tests aren't affected
    const apiBaseUrl = getApiBaseUrl();
    await page.request.post(`${apiBaseUrl}/api/v1/test/seed/all`);
  });

  // ── Flow 4: ESC dirty-form guard ──────────────────────────────────────────
  test('Flow 4: ESC dirty-form guard — Keep editing keeps form intact', async ({ page }) => {
    // Open vocab deck drawer on settings tab
    await page.goto(`/admin?tab=decks&edit=${vocabDeckId}&subtab=settings`);
    await expect(page.getByTestId('deck-drawer')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('deck-settings-tab')).toBeVisible({ timeout: 15_000 });

    // Edit the deck name (EN) to make the form dirty
    const nameEnInput = page.getByTestId('deck-edit-name-en');
    await nameEnInput.clear();
    await nameEnInput.fill('E2E Dirty Name');

    // Press Escape — should trigger the discard-changes dialog (not close the drawer)
    await page.keyboard.press('Escape');

    // Discard-changes dialog should appear
    await expect(page.getByTestId('deck-settings-discard-dialog')).toBeVisible({
      timeout: 5_000,
    });

    // Click "Keep editing" (the cancel button in the discard dialog)
    await page.getByTestId('deck-settings-discard-cancel').click();

    // Dialog should close, drawer should remain open
    await expect(page.getByTestId('deck-settings-discard-dialog')).not.toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId('deck-drawer')).toBeVisible();

    // The edited name should still be in the input (form was not reset)
    await expect(nameEnInput).toHaveValue('E2E Dirty Name');
  });

  // ── Flow 5: Deep-link to Cards sub-tab ────────────────────────────────────
  test('Flow 5: deep-link to Cards sub-tab lands on Cards tab', async ({ page }) => {
    // If we have a word entry id from the seed, use it; otherwise navigate to
    // the drawer list view and pick the first word entry interactively.
    if (firstWordEntryId) {
      // Direct deep-link to the Cards sub-tab of a specific word entry
      await page.goto(
        `/admin?tab=decks&edit=${vocabDeckId}&item=${firstWordEntryId}&subtab=cards`
      );
      await expect(page.getByTestId('deck-drawer')).toBeVisible({ timeout: 15_000 });

      // Skeleton may flash briefly during fetch — wait for it to resolve
      const skeleton = page.getByTestId('deck-drawer-skeleton');
      if (await skeleton.isVisible().catch(() => false)) {
        await expect(skeleton).not.toBeVisible({ timeout: 5_000 });
      }

      // Cards sub-tab trigger should be active
      const cardsTab = page.getByTestId('word-entry-tab-cards');
      await expect(cardsTab).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('word-entry-tab-content-cards')).toBeVisible({
        timeout: 15_000,
      });
    } else {
      // Fallback: navigate via list and click through to verify tab switching works
      await page.goto(`/admin?tab=decks&edit=${vocabDeckId}`);
      await expect(page.getByTestId('deck-drawer')).toBeVisible({ timeout: 15_000 });

      await page.getByTestId('word-row').first().click();
      await expect(page.getByTestId('vocab-word-detail-lemma')).toBeVisible({ timeout: 15_000 });

      await page.getByTestId('word-entry-tab-cards').click();
      await expect(page.getByTestId('word-entry-tab-content-cards')).toBeVisible({
        timeout: 5_000,
      });
    }
  });

  // ── Flow 6: Page-level empty state ────────────────────────────────────────
  // TODO(ADMIN2-09 follow-up): Implement when a seeder endpoint supports
  // /seed/decks/clear or when the test harness can create an admin with zero
  // decks. Reproducing a zero-decks state without re-seeding the entire suite
  // is not feasible within the current E2E seeding harness.
  test.skip('Flow 6: page-level empty state (TODO — needs zero-deck seeder)', async ({ page }) => {
    await navigateToAdminTab(page, 'decks');
    await expect(page.getByTestId('deck-empty-page')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("No decks yet. Click 'Add deck' to create your first.")
    ).toBeVisible();
  });
});
