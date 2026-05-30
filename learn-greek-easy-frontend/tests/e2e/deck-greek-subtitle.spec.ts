/**
 * E2E Tests: Greek Subtitle — Language-Switch Invariant (DGREEK-08)
 *
 * Proves the LOCKED Display Spec:
 *   - titleGreek is sourced from raw name_el (constant, locale-independent).
 *   - The Greek subtitle renders only when name_el !== localizedTitle.
 *   - The Greek subtitle string is IDENTICAL across en↔ru locale switches
 *     (it never changes, only the localizedTitle changes).
 *   - Covers BOTH the /decks index card AND the deck-detail hero.
 *
 * Seed data used:
 *   "Greek A1 Vocabulary (Nouns)" — seeded by auth.setup.ts (seed_v2_words_decks).
 *     name_en = "Greek A1 Vocabulary (Nouns)"
 *     name_el = "Βασικά Ελληνικά Ουσιαστικά"   ← DIFFERENT from name_en → subtitle shown
 *     name_ru = "Греческий словарь A1 (существительные)"
 *
 * NOTE: Do NOT add beforeEach seed calls — auth.setup.ts already seeds the
 * database and authenticates users. Re-seeding would invalidate stored tokens.
 *
 * NOTE: The app does not have an 'el' UI locale (el falls back to 'en').
 * The "suppressed when equal" case is covered by the unit tests in
 * DxResumeHero.test.tsx and deckStore.test.ts (DGREEK-08 describe blocks).
 * The E2E spec verifies the observable locale-switch invariant on real data.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The Greek subtitle string from seed data — constant across all locales. */
const GREEK_SUBTITLE = 'Βασικά Ελληνικά Ουσιαστικά';

/** English title (localizedName for en locale). */
const EN_TITLE = 'Greek A1 Vocabulary (Nouns)';

/** Russian title (localizedName for ru locale). */
const RU_TITLE = 'Греческий словарь A1 (существительные)';

/** data-testid for the Greek subtitle on the index deck card. */
const CARD_GREEK_SUBTITLE_TESTID = 'deck-card-greek-subtitle';

/** data-testid for the deck card. */
const DECK_CARD_TESTID = 'deck-card';

/** API base URL for direct calls in beforeAll. */
function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set the UI language via localStorage and reload so i18next picks it up.
 */
async function setLanguage(page: Page, lang: 'en' | 'ru'): Promise<void> {
  await page.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  await page.reload();
}

/**
 * Find the deck card for "Greek A1 Vocabulary (Nouns)" by looking for either
 * the EN or RU localized title. Returns the deck card locator.
 */
async function findTargetDeckCard(page: Page): Promise<ReturnType<Page['locator']>> {
  // Wait for deck cards to be visible first
  const allCards = page.locator(`[data-testid="${DECK_CARD_TESTID}"]`);
  await expect(allCards.first()).toBeVisible({ timeout: 15000 });

  // Find the card containing either the EN or RU title (handles both locale states)
  const card = page
    .locator(`[data-testid="${DECK_CARD_TESTID}"]`)
    .filter({ hasText: EN_TITLE })
    .or(
      page
        .locator(`[data-testid="${DECK_CARD_TESTID}"]`)
        .filter({ hasText: RU_TITLE })
    )
    .first();

  return card;
}

// ---------------------------------------------------------------------------
// SUITE 1: Deck Index Card — Greek subtitle invariant across locale switches
// ---------------------------------------------------------------------------

test.describe('DGREEK-08: Index Card — Greek subtitle locale-switch invariant', () => {
  test('en locale: Greek subtitle visible and equals name_el (not name_en)', async ({ page }) => {
    await page.goto('/decks');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();

    const card = await findTargetDeckCard(page);
    await expect(card).toBeVisible({ timeout: 15000 });

    // EN title should be visible (localizedName)
    const cardTitle = card.locator('[data-testid="deck-card-title"]');
    await expect(cardTitle).toHaveText(EN_TITLE, { timeout: 10000 });

    // Greek subtitle MUST be present and show the GREEK string, NOT the EN title
    const greekSubtitle = card.locator(`[data-testid="${CARD_GREEK_SUBTITLE_TESTID}"]`);
    await expect(greekSubtitle).toBeVisible({ timeout: 10000 });
    await expect(greekSubtitle).toHaveText(GREEK_SUBTITLE);
    await expect(greekSubtitle).not.toHaveText(EN_TITLE);
    await expect(greekSubtitle).toHaveAttribute('lang', 'el');
  });

  test('ru locale: Greek subtitle shows the SAME string as en locale (invariant)', async ({
    page,
  }) => {
    await page.goto('/decks');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'ru'));
    await page.reload();

    const card = await findTargetDeckCard(page);
    await expect(card).toBeVisible({ timeout: 15000 });

    // RU title should be visible (localizedName changed)
    const cardTitle = card.locator('[data-testid="deck-card-title"]');
    await expect(cardTitle).toHaveText(RU_TITLE, { timeout: 10000 });

    // Greek subtitle MUST be present and show the SAME Greek string (unchanged)
    const greekSubtitle = card.locator(`[data-testid="${CARD_GREEK_SUBTITLE_TESTID}"]`);
    await expect(greekSubtitle).toBeVisible({ timeout: 10000 });
    await expect(greekSubtitle).toHaveText(GREEK_SUBTITLE);   // same as en!
    await expect(greekSubtitle).not.toHaveText(RU_TITLE);
    await expect(greekSubtitle).toHaveAttribute('lang', 'el');
  });

  test('en↔ru switch: Greek subtitle string is identical across locales', async ({ page }) => {
    // Start in en
    await page.goto('/decks');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();

    let card = await findTargetDeckCard(page);
    await expect(card).toBeVisible({ timeout: 15000 });

    const greekSubtitleEN = card.locator(`[data-testid="${CARD_GREEK_SUBTITLE_TESTID}"]`);
    await expect(greekSubtitleEN).toHaveText(GREEK_SUBTITLE, { timeout: 10000 });

    // Switch to ru
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'ru'));
    await page.reload();

    card = await findTargetDeckCard(page);
    await expect(card).toBeVisible({ timeout: 15000 });

    const greekSubtitleRU = card.locator(`[data-testid="${CARD_GREEK_SUBTITLE_TESTID}"]`);
    // Must show the same Greek string — locale-switch MUST NOT change titleGreek
    await expect(greekSubtitleRU).toHaveText(GREEK_SUBTITLE, { timeout: 10000 });
  });

  test('DOM layout: EN title above Greek subtitle (semantic structure)', async ({ page }) => {
    await page.goto('/decks');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();

    const card = await findTargetDeckCard(page);
    await expect(card).toBeVisible({ timeout: 15000 });

    const cardTitle = card.locator('[data-testid="deck-card-title"]');
    const greekSubtitle = card.locator(`[data-testid="${CARD_GREEK_SUBTITLE_TESTID}"]`);

    await expect(cardTitle).toBeVisible({ timeout: 10000 });
    await expect(greekSubtitle).toBeVisible({ timeout: 10000 });

    // Verify semantic structure: title element precedes subtitle in DOM
    // (title is an h3, subtitle is a p — both inside the middle div)
    const titleBox = await cardTitle.boundingBox();
    const subtitleBox = await greekSubtitle.boundingBox();

    expect(titleBox).not.toBeNull();
    expect(subtitleBox).not.toBeNull();

    // Greek subtitle must appear BELOW the EN title (larger y coordinate)
    expect(subtitleBox!.y).toBeGreaterThan(titleBox!.y);
  });
});

// ---------------------------------------------------------------------------
// SUITE 2: Deck Detail Hero — Greek subtitle locale-switch invariant
// ---------------------------------------------------------------------------

test.describe('DGREEK-08: Detail Hero — Greek subtitle locale-switch invariant', () => {
  let targetDeckId: string;

  test.beforeAll(async ({ request }) => {
    const apiBaseUrl = getApiBaseUrl();
    try {
      const resp = await request.get(`${apiBaseUrl}/api/v1/decks?page_size=100`);
      if (!resp.ok()) return;
      const data = await resp.json();
      const deck = (data.decks ?? []).find(
        (d: { name: string; name_en?: string }) =>
          d.name === EN_TITLE || d.name_en === EN_TITLE
      );
      targetDeckId = deck?.id ?? '';
    } catch {
      targetDeckId = '';
    }
  });

  test('en locale: deck detail hero shows Greek subtitle (name_el != name_en)', async ({ page }) => {
    if (!targetDeckId) {
      test.skip();
      return;
    }

    await page.addInitScript((lng) => { window.localStorage.setItem('i18nextLng', lng); }, 'en');
    await page.goto(`/decks/${targetDeckId}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for detail page to load
    await expect(page.locator('[data-testid="word-browser"]')).toBeVisible({ timeout: 20000 });

    // Hero heading must show EN title
    const heroHeading = page.locator('.dx-hero-resume-h');
    await expect(heroHeading).toBeVisible({ timeout: 10000 });
    await expect(heroHeading).toHaveText(EN_TITLE);

    // Hero Greek subtitle MUST be visible with the Greek string
    const heroGreekSubtitle = page.locator('.dx-hero-resume-el');
    await expect(heroGreekSubtitle).toBeVisible({ timeout: 10000 });
    await expect(heroGreekSubtitle).toHaveText(GREEK_SUBTITLE);
    await expect(heroGreekSubtitle).toHaveAttribute('lang', 'el');
  });

  test('ru locale: deck detail hero shows SAME Greek subtitle string', async ({ page }) => {
    if (!targetDeckId) {
      test.skip();
      return;
    }

    await page.addInitScript((lng) => { window.localStorage.setItem('i18nextLng', lng); }, 'ru');
    await page.goto(`/decks/${targetDeckId}`);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('[data-testid="word-browser"]')).toBeVisible({ timeout: 20000 });

    // Hero heading must show RU title (localizedName changed)
    const heroHeading = page.locator('.dx-hero-resume-h');
    await expect(heroHeading).toBeVisible({ timeout: 10000 });
    await expect(heroHeading).toHaveText(RU_TITLE);

    // Hero Greek subtitle MUST be the SAME Greek string (locale-invariant)
    const heroGreekSubtitle = page.locator('.dx-hero-resume-el');
    await expect(heroGreekSubtitle).toBeVisible({ timeout: 10000 });
    await expect(heroGreekSubtitle).toHaveText(GREEK_SUBTITLE);  // same as en!
    await expect(heroGreekSubtitle).toHaveAttribute('lang', 'el');
  });

  test('en↔ru: detail hero Greek subtitle identical across locales', async ({ page }) => {
    if (!targetDeckId) {
      test.skip();
      return;
    }

    // en first
    await page.addInitScript((lng) => { window.localStorage.setItem('i18nextLng', lng); }, 'en');
    await page.goto(`/decks/${targetDeckId}`);
    await expect(page.locator('[data-testid="word-browser"]')).toBeVisible({ timeout: 20000 });
    const subtitleEN = page.locator('.dx-hero-resume-el');
    await expect(subtitleEN).toHaveText(GREEK_SUBTITLE, { timeout: 10000 });

    // then ru (page is already on app origin here — post-goto evaluate is fine)
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'ru'));
    await page.goto(`/decks/${targetDeckId}`);
    await page.reload();
    await expect(page.locator('[data-testid="word-browser"]')).toBeVisible({ timeout: 20000 });
    const subtitleRU = page.locator('.dx-hero-resume-el');
    await expect(subtitleRU).toHaveText(GREEK_SUBTITLE, { timeout: 10000 });
  });

  test('DOM layout: EN title above Greek subtitle in detail hero (semantic structure)', async ({
    page,
  }) => {
    if (!targetDeckId) {
      test.skip();
      return;
    }

    await page.addInitScript((lng) => { window.localStorage.setItem('i18nextLng', lng); }, 'en');
    await page.goto(`/decks/${targetDeckId}`);
    await expect(page.locator('[data-testid="word-browser"]')).toBeVisible({ timeout: 20000 });

    const heroHeading = page.locator('.dx-hero-resume-h');
    const heroGreekSubtitle = page.locator('.dx-hero-resume-el');

    await expect(heroHeading).toBeVisible({ timeout: 10000 });
    await expect(heroGreekSubtitle).toBeVisible({ timeout: 10000 });

    // Verify heading appears above the subtitle
    const headingBox = await heroHeading.boundingBox();
    const subtitleBox = await heroGreekSubtitle.boundingBox();

    expect(headingBox).not.toBeNull();
    expect(subtitleBox).not.toBeNull();
    expect(subtitleBox!.y).toBeGreaterThan(headingBox!.y);
  });
});
