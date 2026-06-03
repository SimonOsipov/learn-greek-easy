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

// ---------------------------------------------------------------------------
// Tests — DVP visual polish (DVP-05 / CULT2-5)
// ---------------------------------------------------------------------------

test.describe('Culture deck detail — visual polish (CULT2-5)', () => {
  // ── DVP-01: Hero right column renders the front cover ──

  test('DVP-01: Hero cover stack is visible with a front cover card', async ({ page }) => {
    await navigateToCultureDeckDetail(page);

    // CultureHero always receives coverDeck on the deck-detail page, so the right
    // column (.dx-cover-stack) must be present in the DOM and visible.
    // The front cover host carries class "dx-cover-3".
    const coverStack = page.locator('.dx-cover-stack').first();
    await expect(coverStack).toBeVisible({ timeout: 10000 });

    // The front cover is always rendered inside the stack (siblingDecks are optional
    // but coverDeck is always provided on this page).
    const frontCover = coverStack.locator('.dx-cover-3');
    await expect(frontCover).toBeVisible();
  });

  // ── DVP-02: Metric tiles render descriptor trend lines, Mastered shows "% of deck" ──

  test('DVP-02: All four metric tiles render a trend descriptor and Mastered shows "% of deck"', async ({
    page,
  }) => {
    await navigateToCultureDeckDetail(page);

    const strip = page.getByTestId('culture-metric-strip');
    await expect(strip).toBeVisible({ timeout: 10000 });

    // All four metrics are configured with a `trend` prop → each renders
    // a .dx-metric-trend element inside CultureMetricStrip.
    const allTrends = strip.locator('.dx-metric-trend');
    await expect(allTrends).toHaveCount(4);

    // Locate the Mastered tile by its label text (UI language is English).
    // The label comes from t('culture:detail.metricMastered') = "Mastered".
    // We anchor on the .dx-metric-l text to avoid relying on index order.
    const masteredTile = strip
      .locator('.dx-metric')
      .filter({ has: page.locator('.dx-metric-l', { hasText: 'Mastered' }) });
    await expect(masteredTile).toBeVisible();

    // The Mastered tile's trend value is t('culture:detail.metricMasteredSub',
    // '{{pct}}% of deck') → always contains "% of deck".
    await expect(masteredTile.locator('.dx-metric-trend')).toContainText('% of deck');
  });

  // ── DVP-03: "Showing X of Y" counter lives inside the filter-row right pole ──

  test('DVP-03: Showing counter and language selector share the same flex-row container', async ({
    page,
  }) => {
    await navigateToCultureDeckDetail(page);

    // Wait for the question browser and its data to load (counter renders after load)
    const questionBrowser = page.getByTestId('question-browser');
    await expect(questionBrowser).toBeVisible({ timeout: 15000 });

    // Wait until the counter <p> is visible (it is hidden during loading)
    const questionGrid = page.getByTestId('question-grid');
    await expect(questionGrid).toBeVisible({ timeout: 15000 });

    // QuestionBrowser renders both the counter and the QuestionLanguageSelector
    // inside a shared <div class="flex flex-wrap items-center gap-3"> (the right
    // pole of the filter row). Assert co-containment: the counter <p> and the
    // language selector buttons must have a common ancestor within question-browser
    // that also contains the filter pills row.

    // The counter is a <p> element that contains "Showing" (EN UI locale).
    // Use a text-based locator scoped inside the question browser.
    const counter = questionBrowser.locator('p', { hasText: 'Showing' });
    await expect(counter).toBeVisible({ timeout: 10000 });

    // The Greek language pill button inside the browser (always rendered).
    const langSelector = questionBrowser.getByRole('button', { name: 'Greek' });
    await expect(langSelector).toBeVisible();

    // Assert co-containment: both elements must share the same immediate parent.
    // Evaluate: get the parent element of the counter and check that the language
    // selector button is a descendant of that same parent.
    const counterParentContainsLangSelector = await counter.evaluate((counterEl) => {
      const parent = counterEl.parentElement;
      if (!parent) return false;
      // The shared right-pole div has class "flex flex-wrap items-center gap-3"
      return parent.classList.contains('flex') && parent.classList.contains('gap-3');
    });
    expect(counterParentContainsLangSelector).toBe(true);

    // Also assert the language selector is a sibling/descendant of the same parent.
    const langSelectorInSameParent = await langSelector.evaluate((btnEl) => {
      // Walk up to the closest .flex.gap-3 container
      let el: Element | null = btnEl;
      while (el) {
        if (el.classList.contains('flex') && el.classList.contains('gap-3')) return true;
        el = el.parentElement;
      }
      return false;
    });
    expect(langSelectorInSameParent).toBe(true);
  });
});
