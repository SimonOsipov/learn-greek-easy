/**
 * Culture Deck Detail — E2E Tests (DDR-07, CULT2-4)
 *
 * Covers four user-visible changes introduced in DDR-03 through DDR-06:
 *   DDR-03: "Time on deck" metric tile shows a numeric value (not "—").
 *   DDR-04: No topic chips in the action panel.
 *   DDR-05: Opening a non-news question shows NO A2/B2 level toggle.
 *   DDR-06: Question browser defaults to EL language on first load.
 *
 * Auth: pre-authenticated learner via playwright.config.ts storageState.
 * NOTE: Do NOT add beforeEach seed calls — re-seeding would invalidate
 * cached auth tokens.
 *
 * Seeding note: The standard seed creates 5 culture decks (history, geography,
 * politics, culture, traditions) — none with category "news". Therefore the
 * A2/B2 toggle positive case (news deck) cannot be exercised against seeded
 * data; only the non-news case is asserted (DDR-05). A code comment explains
 * why the news-positive assertion is omitted.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper — navigate to a non-premium culture deck detail page and return the
// deck ID extracted from the URL. Mirrors the pattern used in
// culture-practice.spec.ts and culture-page-split.spec.ts.
// ---------------------------------------------------------------------------

async function navigateToCultureDeckDetail(page: Page): Promise<string> {
  await page.goto('/culture');

  // Wait for at least one deck card to be visible
  await expect(page.locator('[data-testid="deck-card"]').first()).toBeVisible({ timeout: 15000 });

  // Pick a non-premium deck (History + Traditions are premium in the seed)
  const nonPremiumDeck = page
    .locator('[data-testid="deck-card"]')
    .filter({ hasNot: page.locator('[aria-label="Premium content"]') })
    .first();

  await expect(nonPremiumDeck).toBeVisible();
  await nonPremiumDeck.click();

  // Confirm we landed on a deck detail page
  await expect(page).toHaveURL(/\/culture\/decks\//);
  await expect(page.getByTestId('deck-detail')).toBeVisible({ timeout: 10000 });

  const deckIdMatch = page.url().match(/\/culture\/decks\/([^/]+)/);
  return deckIdMatch ? deckIdMatch[1] : '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Culture deck detail — DDR review fixes (CULT2-4)', () => {
  // ── DDR-03: "Time on deck" metric tile shows a numeric value, not "—" ──

  test('DDR-03: Time on deck tile shows a numeric minutes value and "min" suffix', async ({
    page,
  }) => {
    await navigateToCultureDeckDetail(page);

    const strip = page.getByTestId('culture-metric-strip');
    await expect(strip).toBeVisible({ timeout: 10000 });

    // The Time-on-deck tile is the 4th metric (index 3, data-testid="culture-metric-3").
    // Its label is "Time on deck" and value is Math.round(time_on_deck_seconds / 60).
    // Even with zero seconds it renders "0", never "—".
    const timeOnDeckTile = page.getByTestId('culture-metric-3');
    await expect(timeOnDeckTile).toBeVisible();

    // Value region must contain a number (0 or positive integer).
    await expect(timeOnDeckTile.locator('.dx-metric-v')).toContainText(/\d+/);

    // "min" suffix rendered in the <small> element (sub="min" prop).
    await expect(timeOnDeckTile.locator('.dx-metric-v small')).toHaveText(/min/i);
  });

  // ── DDR-04: No topic chips in the action panel ──

  test('DDR-04: Action panel contains no topic chip filter UI', async ({ page }) => {
    await navigateToCultureDeckDetail(page);

    const actionPanel = page.getByTestId('culture-action-panel');
    await expect(actionPanel).toBeVisible({ timeout: 10000 });

    // Topic chips were previously rendered inside the action panel as buttons with
    // role="radio" inside a radiogroup labelled "Topic". Assert that no such group
    // or chip exists. Also assert no [data-testid="topic-chip"] or similar elements.
    await expect(actionPanel.locator('[role="radiogroup"]')).toHaveCount(0);
    await expect(actionPanel.locator('[data-testid*="topic"]')).toHaveCount(0);
    await expect(actionPanel.locator('[data-testid*="chip"]')).toHaveCount(0);
  });

  // ── DDR-05: Non-news question shows NO A2/B2 toggle ──

  test('DDR-05: Opening a non-news question shows no A2/B2 level toggle', async ({ page }) => {
    await navigateToCultureDeckDetail(page);

    // Wait for the question browser to load cards
    const questionGrid = page.getByTestId('question-grid');
    await expect(questionGrid).toBeVisible({ timeout: 15000 });

    // Click the first question card to open the detail dialog
    const firstQuestionCard = questionGrid.locator('[data-testid="question-card"]').first();
    await expect(firstQuestionCard).toBeVisible({ timeout: 10000 });
    await firstQuestionCard.click();

    // Wait for the dialog to appear and the content to load (not the skeleton)
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('question-detail-skeleton')).toHaveCount(0);
    await expect(page.getByTestId('question-detail-text')).toBeVisible({ timeout: 10000 });

    // The A2/B2 toggle buttons must NOT be present for non-news questions.
    // They only render when: category === 'news' && (data.audio_url || data.audio_a2_url).
    // All decks in the standard seed are non-news categories.
    await expect(page.getByTestId('detail-level-toggle-a2')).toHaveCount(0);
    await expect(page.getByTestId('detail-level-toggle-b2')).toHaveCount(0);

    // NOTE: The news-question positive case (asserting the toggle IS shown for a
    // news-category deck question) is intentionally omitted. The standard E2E seed
    // creates only history, geography, politics, culture, and traditions decks.
    // No "news" category CultureDeck is created by /seed/all or /seed/culture, and
    // no audio URLs are attached to news-linked questions in the seed, so the toggle
    // condition (category === 'news' && has audio) cannot be met deterministically
    // in the E2E environment without a dedicated news-deck seed endpoint.
  });

  // ── DDR-06: Question browser defaults to EL language ──

  test('DDR-06: Question language selector defaults to EL (Greek) on page load', async ({
    page,
  }) => {
    // Clear the persisted language selection to guarantee a clean default state.
    // The store persists to localStorage under 'culture-deck-question-language'.
    await page.goto('/culture');
    await page.evaluate(() => {
      localStorage.removeItem('culture-deck-question-language');
    });

    await navigateToCultureDeckDetail(page);

    // Wait for the question browser to render
    const questionBrowser = page.getByTestId('question-browser');
    await expect(questionBrowser).toBeVisible({ timeout: 15000 });

    // The QuestionLanguageSelector is rendered with variant="pill" inside the browser.
    // Pill variant renders <Button> elements with aria-pressed={isSelected} and
    // aria-label={t(`language.${lang}`, display.name)}.
    // Default language is 'el', mapped to aria-label "Greek".
    const elButton = questionBrowser.getByRole('button', { name: 'Greek' });
    await expect(elButton).toBeVisible({ timeout: 10000 });
    await expect(elButton).toHaveAttribute('aria-pressed', 'true');

    // The other language buttons must NOT be active
    const enButton = questionBrowser.getByRole('button', { name: 'English' });
    const ruButton = questionBrowser.getByRole('button', { name: 'Russian' });
    await expect(enButton).toHaveAttribute('aria-pressed', 'false');
    await expect(ruButton).toHaveAttribute('aria-pressed', 'false');
  });
});
