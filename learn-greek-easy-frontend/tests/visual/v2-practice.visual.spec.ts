/**
 * V2 Practice Visual Regression Tests
 *
 * Visual regression tests for the V2 Practice session UI accessible from deck pages.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * Test Scenarios (5 reference states, light + dark):
 * 1. V2 Practice - Question (translation front)  — light & dark
 * 2. V2 Practice - Answer (translation back + rating row)  — light & dark
 * 3. V2 Practice - Declension table (filled target cell)  — light & dark
 * 4. V2 Practice - Audio surface (translation card with audio_url)  — light & dark
 * 5. V2 Practice - Done (session complete)  — light & dark
 *
 * Additional legacy snapshots retained:
 * 6. V2 Practice - Active Front - Desktop Light
 * 7. V2 Practice - Empty State - Mobile Light
 * 8. V2 Practice - Filter Pills - Mobile Light
 *
 * Viewports:
 * - Desktop: 1280x720
 * - Mobile: 375x667
 *
 * Note: V2 Practice is accessed from deck pages via /decks/:deckId/practice route.
 * The practice UI renders card records from GET /api/v1/study/queue/v2.
 * SRS rating buttons submit reviews to POST /api/v1/reviews/v2.
 *
 * Selector notes (post-PRACT2-1 pf-renderer migration):
 *   pf-card          — the flip target (Card.tsx, replaces legacy practice-card)
 *   pf-rating-btn-ok — the OK/Good rating button (replaces srs-button-good)
 *   pf-rating-row    — the rating row (confirms answer phase)
 *   pf-done          — the session-complete screen
 *   pf-decl-grid     — the declension paradigm table
 *   pf-decl-target   — the target cell (revealed = filled form, unrevealed = "?")
 *   .pf-app[data-fam] — family discriminator set by PracticeApp
 */

import { test, expect } from '@chromatic-com/playwright';
import { Page } from '@playwright/test';

import {
  takeSnapshot,
  loginForVisualTest,
  VIEWPORTS,
} from './helpers/visual-helpers';

// ============================================================================
// MOCK DATA
// ============================================================================

// ── Card 1: meaning_el_to_en — no audio (translation family, question reference)
const mockV2Card1 = {
  card_record_id: 'cr-001',
  word_entry_id: 'we-001',
  deck_id: 'deck-001',
  deck_name: 'Essential Greek A1',
  card_type: 'meaning_el_to_en',
  variant_key: null,
  front_content: {
    card_type: 'meaning_el_to_en',
    prompt: 'What does this mean?',
    main: 'σπίτι',
    sub: 'noun, neuter',
    badge: 'A1',
  },
  back_content: {
    card_type: 'meaning_el_to_en',
    answer: 'house, home',
    context: {
      label: 'Example',
      greek: 'Δεν είμαι σπίτι.',
      english: 'I am not at home.',
    },
  },
  status: 'new',
  is_new: true,
  is_early_practice: false,
  due_date: null,
  easiness_factor: 2.5,
  interval: 0,
  audio_url: null,
  example_audio_url: null,
  translation_ru: 'дом',
  translation_ru_plural: null,
  sentence_ru: null,
};

// ── Card 2: meaning_en_to_el — no audio
const mockV2Card2 = {
  card_record_id: 'cr-002',
  word_entry_id: 'we-002',
  deck_id: 'deck-001',
  deck_name: 'Essential Greek A1',
  card_type: 'meaning_en_to_el',
  variant_key: null,
  front_content: {
    card_type: 'meaning_en_to_el',
    prompt: 'How do you say this in Greek?',
    main: 'water',
    badge: 'A1',
  },
  back_content: {
    card_type: 'meaning_en_to_el',
    answer: 'νερό',
    answer_sub: 'το νερό',
    context: {
      label: 'Example',
      greek: 'Θέλω νερό.',
      english: 'I want water.',
    },
  },
  status: 'new',
  is_new: true,
  is_early_practice: false,
  due_date: null,
  easiness_factor: 2.5,
  interval: 0,
  audio_url: null,
  example_audio_url: null,
  translation_ru: 'вода',
  translation_ru_plural: null,
  sentence_ru: null,
};

// ── Card 3: sentence_translation — with sentence_ru + example_audio_url set
const mockV2CardSentence = {
  card_record_id: 'cr-003',
  word_entry_id: 'we-003',
  deck_id: 'deck-001',
  deck_name: 'Essential Greek A1',
  card_type: 'sentence_translation',
  variant_key: null,
  front_content: {
    card_type: 'sentence_translation',
    prompt: 'Translate this sentence',
    main: 'Πηγαίνω στο σπίτι.',
    badge: 'A1',
  },
  back_content: {
    card_type: 'sentence_translation',
    answer: 'I go home.',
    context: {
      label: 'Translation',
      greek: 'Πηγαίνω στο σπίτι.',
      english: 'I go home.',
    },
  },
  status: 'new',
  is_new: true,
  is_early_practice: false,
  due_date: null,
  easiness_factor: 2.5,
  interval: 0,
  audio_url: 'https://storage.example.com/audio/sentence-001.mp3',
  example_audio_url: 'https://storage.example.com/audio/sentence-001.mp3',
  translation_ru: 'Я иду домой.',
  translation_ru_plural: null,
  sentence_ru: 'Я иду домой.',
};

// ── Card 4: article (grammar family)
const mockV2CardArticle = {
  card_record_id: 'cr-004',
  word_entry_id: 'we-004',
  deck_id: 'deck-001',
  deck_name: 'Essential Greek A1',
  card_type: 'article',
  variant_key: null,
  front_content: {
    card_type: 'article',
    prompt: 'What is the article?',
    main: 'ο άνθρωπος',
    badge: 'A1',
  },
  back_content: {
    card_type: 'article',
    answer: 'ο',
    context: {
      label: 'Example',
      greek: 'Ο άνθρωπος είναι εδώ.',
      english: 'The man is here.',
    },
  },
  status: 'new',
  is_new: true,
  is_early_practice: false,
  due_date: null,
  easiness_factor: 2.5,
  interval: 0,
  audio_url: null,
  example_audio_url: null,
  translation_ru: 'человек',
  translation_ru_plural: null,
  sentence_ru: null,
};

// ── Card 5: plural_form (declension family per families.ts mapping)
const mockV2CardPlural = {
  card_record_id: 'cr-005',
  word_entry_id: 'we-005',
  deck_id: 'deck-001',
  deck_name: 'Essential Greek A1',
  card_type: 'plural_form',
  variant_key: null,
  front_content: {
    card_type: 'plural_form',
    prompt: 'What is the plural?',
    main: 'βιβλίο',
    sub: null,
    badge: 'A1',
  },
  back_content: {
    card_type: 'plural_form',
    answer: 'βιβλία',
    context: {
      label: 'Example',
      greek: 'Δύο βιβλία.',
      english: 'Two books.',
    },
  },
  status: 'new',
  is_new: true,
  is_early_practice: false,
  due_date: null,
  easiness_factor: 2.5,
  interval: 0,
  audio_url: null,
  example_audio_url: null,
  translation_ru: 'книга',
  translation_ru_plural: 'книги',
  sentence_ru: null,
};

// ── Card 6: declension — full DeclensionTable (Genitive sg highlighted).
//   Shape mirrors card_record.py:47-61,206-210 + card_generator_service.py:610-688.
//   Nominative is NEVER the target (backend guarantee) — target is Genitive singular.
const mockV2CardDeclension = {
  card_record_id: 'cr-006',
  word_entry_id: 'we-006',
  deck_id: 'deck-001',
  deck_name: 'Essential Greek A1',
  card_type: 'declension',
  variant_key: null,
  front_content: {
    card_type: 'declension',
    prompt: 'Complete the paradigm',
    main: 'σπίτι',
    hint: 'house',
    badge: 'A1',
  },
  back_content: {
    card_type: 'declension',
    declension_table: {
      gender: 'Neuter',
      rows: [
        {
          case: 'Nominative',
          singular: 'σπίτι',
          plural: 'σπίτια',
          highlight_singular: false,
          highlight_plural: false,
        },
        {
          case: 'Genitive',
          singular: 'σπιτιού',
          plural: 'σπιτιών',
          highlight_singular: true,
          highlight_plural: false,
        },
        {
          case: 'Accusative',
          singular: 'σπίτι',
          plural: 'σπίτια',
          highlight_singular: false,
          highlight_plural: false,
        },
        {
          case: 'Vocative',
          singular: 'σπίτι',
          plural: 'σπίτια',
          highlight_singular: false,
          highlight_plural: false,
        },
      ],
    },
  },
  status: 'new',
  is_new: true,
  is_early_practice: false,
  due_date: null,
  easiness_factor: 2.5,
  interval: 0,
  audio_url: null,
  example_audio_url: null,
  translation_ru: 'дом',
  translation_ru_plural: null,
  sentence_ru: null,
};

// ── Card 7: meaning_el_to_en WITH audio_url — exercises AudioChip play control
const mockV2CardAudio = {
  card_record_id: 'cr-007',
  word_entry_id: 'we-007',
  deck_id: 'deck-001',
  deck_name: 'Essential Greek A1',
  card_type: 'meaning_el_to_en',
  variant_key: null,
  front_content: {
    card_type: 'meaning_el_to_en',
    prompt: 'What does this mean?',
    main: 'γάτα',
    sub: null,
    badge: 'A1',
  },
  back_content: {
    card_type: 'meaning_el_to_en',
    answer: 'cat',
    context: {
      label: 'Example',
      greek: 'Η γάτα κοιμάται.',
      english: 'The cat is sleeping.',
    },
  },
  status: 'review',
  is_new: false,
  is_early_practice: false,
  due_date: '2026-01-15T00:00:00Z',
  easiness_factor: 2.5,
  interval: 1,
  audio_url: 'https://storage.example.com/audio/gata-001.mp3',
  example_audio_url: null,
  translation_ru: 'кошка',
  translation_ru_plural: null,
  sentence_ru: null,
};

// ── Expanded queue — one card per renderable family + audio-carrying translation.
// Queue order:
//   [0] cr-001  meaning_el_to_en (translation, no audio)     — State 1: question
//   [1] cr-002  meaning_en_to_el (translation, no audio)     — State 2: answer (after rating [0])
//   [2] cr-003  sentence_translation (sentence family)        — sentence family
//   [3] cr-004  article (grammar family)                      — grammar family
//   [4] cr-005  plural_form (declension family per families)  — declension family (table-less)
//   [5] cr-006  declension (full DeclensionTable)             — State 3: declension table
//   [6] cr-007  meaning_el_to_en with audio_url               — State 4: audio surface
const mockV2Queue = {
  total_due: 5,
  total_new: 7,
  total_early_practice: 0,
  total_in_queue: 7,
  cards: [
    mockV2Card1,
    mockV2Card2,
    mockV2CardSentence,
    mockV2CardArticle,
    mockV2CardPlural,
    mockV2CardDeclension,
    mockV2CardAudio,
  ],
};

const mockV2QueueEmpty = {
  total_due: 0,
  total_new: 0,
  total_early_practice: 0,
  total_in_queue: 0,
  cards: [],
};

const mockV2Deck = {
  id: 'deck-001',
  name: 'Essential Greek A1',
  name_en: 'Essential Greek A1',
  name_ru: 'Основы греческого A1',
  description: 'Learn essential Greek vocabulary',
  description_en: 'Learn essential Greek vocabulary',
  description_ru: null,
  level: 'A1',
  is_active: true,
  is_premium: false,
  card_count: 25,
  estimated_time_minutes: 30,
  tags: ['vocabulary'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  cover_image_url: null,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set light or dark theme via localStorage and DOM class.
 */
async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
}

/**
 * Build a review result response for a given card record and quality score.
 */
function makeReviewResult(cardRecordId: string, quality: number): object {
  return {
    card_record_id: cardRecordId,
    quality,
    previous_status: 'new',
    new_status: quality >= 4 ? 'review' : 'learning',
    easiness_factor: 2.5,
    interval: 1,
    repetitions: 1,
    next_review_date: '2026-03-19T00:00:00Z',
    message: null,
  };
}

/**
 * Mock the V2 study queue and review endpoints.
 * IMPORTANT: Must be called BEFORE loginForVisualTest to intercept all requests.
 */
async function setupV2PracticeMocks(
  page: Page,
  queue: typeof mockV2Queue | typeof mockV2QueueEmpty
): Promise<void> {
  await page.route('**/api/v1/study/queue/v2*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(queue),
    });
  });

  await page.route('**/api/v1/reviews/v2', async (route) => {
    const body = route.request().postDataJSON();
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeReviewResult(body.card_record_id, body.quality)),
    });
  });

  await page.route('**/api/v1/xp/stats*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total_xp: 0, current_level: 1, xp_to_next_level: 100, level_progress_percent: 0 }),
    });
  });
}

/**
 * Mock deck detail, progress, and word-entries endpoints for the deck header / filter pills snapshot.
 * IMPORTANT: Must be called BEFORE loginForVisualTest to intercept all requests.
 */
async function setupV2DeckMocks(page: Page): Promise<void> {
  await page.route('**/api/v1/decks/deck-001', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockV2Deck),
    });
  });

  await page.route('**/api/v1/progress/decks/deck-001', (route) => {
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Not found' }),
    });
  });

  // The word browser uses /api/v1/decks/:id/word-entries (NOT /api/v1/word-entries)
  await page.route('**/api/v1/decks/*/word-entries*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }),
    });
  });
}

/**
 * Navigate to the practice page and wait for the first pf-card to appear.
 *
 * Uses [data-testid="pf-card"] (Card.tsx L42) — the correct testid for the pf renderer.
 * Replaces the stale [data-testid="practice-card-front"] pattern (legacy shared/PracticeCard.tsx,
 * not emitted by pf renderers).
 */
async function navigateToPractice(page: Page): Promise<void> {
  await page.goto('/decks/deck-001/practice');
  await expect(page.locator('[data-testid="pf-card"]')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(300);
}

/**
 * Flip the current card (click pf-card) and wait for the rating row to confirm answer phase.
 */
async function flipCard(page: Page): Promise<void> {
  await page.locator('[data-testid="pf-card"]').click();
  await expect(page.locator('[data-testid="pf-rating-row"]')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(300);
}

/**
 * Rate the current card "OK" (rating 3) via pf-rating-btn-ok.
 *
 * Replaces the stale [data-testid="srs-button-good"] pattern (legacy PracticeCard, not pf).
 * Waits for the next pf-card or pf-done to appear.
 */
async function rateOk(page: Page): Promise<void> {
  await page.locator('[data-testid="pf-rating-btn-ok"]').click();
  const nextCard = page.locator('[data-testid="pf-card"]');
  const done = page.locator('[data-testid="pf-done"]');
  await expect(nextCard.or(done)).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(300);
}

// ============================================================================
// REFERENCE STATE VISUAL TESTS (5 states × light + dark)
// ============================================================================

test.describe('V2 Practice - Reference States', () => {
  // ── State 1: Question (translation front) ──────────────────────────────────

  test('V2 Practice - State 1 Question - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);
    // pf-card visible, not yet flipped → question state
    await takeSnapshot(page, 'V2 Practice - State 1 Question - Mobile Light', testInfo);
  });

  test('V2 Practice - State 1 Question - Mobile Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'dark');
    await navigateToPractice(page);
    await takeSnapshot(page, 'V2 Practice - State 1 Question - Mobile Dark', testInfo);
  });

  // ── State 2: Answer (translation back + rating row) ────────────────────────

  test('V2 Practice - State 2 Answer - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);
    await flipCard(page);
    // pf-rating-row visible → answer/back state
    await takeSnapshot(page, 'V2 Practice - State 2 Answer - Mobile Light', testInfo);
  });

  test('V2 Practice - State 2 Answer - Mobile Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'dark');
    await navigateToPractice(page);
    await flipCard(page);
    await takeSnapshot(page, 'V2 Practice - State 2 Answer - Mobile Dark', testInfo);
  });

  // ── State 3: Declension table with filled target cell ──────────────────────
  //   Navigate to card index 5 (cr-006, declension) by rating cards 0-4 "OK".
  //   Then flip to reveal the filled target cell (pf-decl-target with is-revealed).

  test('V2 Practice - State 3 Declension Table - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    // Advance through cards 0-4 (meaning_el_to_en, meaning_en_to_el,
    // sentence_translation, article, plural_form) by flip + rate OK
    for (let i = 0; i < 5; i++) {
      await flipCard(page);
      await rateOk(page);
      await expect(page.locator('[data-testid="pf-card"]')).toBeVisible({ timeout: 8000 });
    }

    // Now on declension card (cr-006) — confirm via data-fam attribute
    await expect(page.locator('.pf-app[data-fam="declension"]')).toBeVisible({ timeout: 5000 });
    // Declension grid shown in question state (target cell shows "?")
    await expect(page.locator('[data-testid="pf-decl-grid"]')).toBeVisible();

    // Flip to answer phase — target cell fills with real Greek form
    await flipCard(page);
    await expect(page.locator('[data-testid="pf-decl-target"]')).toBeVisible();

    await takeSnapshot(page, 'V2 Practice - State 3 Declension Table - Mobile Light', testInfo);
  });

  test('V2 Practice - State 3 Declension Table - Mobile Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'dark');
    await navigateToPractice(page);

    for (let i = 0; i < 5; i++) {
      await flipCard(page);
      await rateOk(page);
      await expect(page.locator('[data-testid="pf-card"]')).toBeVisible({ timeout: 8000 });
    }

    await expect(page.locator('.pf-app[data-fam="declension"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="pf-decl-grid"]')).toBeVisible();
    await flipCard(page);
    await expect(page.locator('[data-testid="pf-decl-target"]')).toBeVisible();

    await takeSnapshot(page, 'V2 Practice - State 3 Declension Table - Mobile Dark', testInfo);
  });

  // ── State 4: Audio surface (translation card with audio_url => AudioChip) ──
  //   Navigate to card index 6 (cr-007, meaning_el_to_en with audio_url).
  //   AudioChip (pf-audio-chip) renders inside TranslationElToEn when audio_url is non-null.

  test('V2 Practice - State 4 Audio Surface - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    // Advance through cards 0-5
    for (let i = 0; i < 6; i++) {
      await flipCard(page);
      await rateOk(page);
      await expect(page.locator('[data-testid="pf-card"]')).toBeVisible({ timeout: 8000 });
    }

    // Now on audio card (cr-007) — translation family with audio_url set
    await expect(page.locator('.pf-app[data-fam="translation"]')).toBeVisible({ timeout: 5000 });
    // pf-audio-chip rendered inside TranslationElToEn when audioUrl is present
    await expect(page.locator('[data-testid="pf-audio-chip"]')).toBeVisible({ timeout: 5000 });

    await takeSnapshot(page, 'V2 Practice - State 4 Audio Surface - Mobile Light', testInfo);
  });

  test('V2 Practice - State 4 Audio Surface - Mobile Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'dark');
    await navigateToPractice(page);

    for (let i = 0; i < 6; i++) {
      await flipCard(page);
      await rateOk(page);
      await expect(page.locator('[data-testid="pf-card"]')).toBeVisible({ timeout: 8000 });
    }

    await expect(page.locator('.pf-app[data-fam="translation"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="pf-audio-chip"]')).toBeVisible({ timeout: 5000 });

    await takeSnapshot(page, 'V2 Practice - State 4 Audio Surface - Mobile Dark', testInfo);
  });

  // ── State 5: Done (session complete) ───────────────────────────────────────
  //   Complete all 7 cards to reach the pf-done screen.

  test('V2 Practice - State 5 Done - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    // Complete all 7 cards; rateOk handles pf-card or pf-done
    for (let i = 0; i < 7; i++) {
      const cardVisible = await page.locator('[data-testid="pf-card"]').isVisible().catch(() => false);
      if (!cardVisible) break;
      await flipCard(page);
      await rateOk(page);
    }

    await expect(page.locator('[data-testid="pf-done"]')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'V2 Practice - State 5 Done - Mobile Light', testInfo);
  });

  test('V2 Practice - State 5 Done - Mobile Dark', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'dark');
    await navigateToPractice(page);

    for (let i = 0; i < 7; i++) {
      const cardVisible = await page.locator('[data-testid="pf-card"]').isVisible().catch(() => false);
      if (!cardVisible) break;
      await flipCard(page);
      await rateOk(page);
    }

    await expect(page.locator('[data-testid="pf-done"]')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'V2 Practice - State 5 Done - Mobile Dark', testInfo);
  });
});

// ============================================================================
// ACTIVE SESSION VISUAL TESTS (legacy desktop snapshot)
// ============================================================================

test.describe('V2 Practice - Active Session', () => {
  test('V2 Practice - Active Front - Desktop Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setupV2PracticeMocks(page, mockV2Queue);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await navigateToPractice(page);

    await takeSnapshot(page, 'V2 Practice - Active Front - Desktop Light', testInfo);
  });
});

// ============================================================================
// EMPTY STATE VISUAL TESTS
// ============================================================================

test.describe('V2 Practice - Empty State', () => {
  test('V2 Practice - Empty State - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2PracticeMocks(page, mockV2QueueEmpty);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await page.goto('/decks/deck-001/practice');

    await expect(page.getByText(/all caught up/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'V2 Practice - Empty State - Mobile Light', testInfo);
  });
});

// ============================================================================
// DECK HEADER FILTER PILLS VISUAL TESTS
// ============================================================================

test.describe('V2 Practice - Deck Header Filter Pills', () => {
  test('V2 Practice - Filter Pills - Mobile Light', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setupV2DeckMocks(page);
    await loginForVisualTest(page);
    await setTheme(page, 'light');
    await page.goto('/decks/deck-001');

    await expect(page.locator('[data-testid="start-review-button"]')).toBeVisible({
      timeout: 10000,
    });
    // Wait for filter pills to render before snapshotting
    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'V2 Practice - Filter Pills - Mobile Light', testInfo);
  });
});
