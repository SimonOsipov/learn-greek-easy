/**
 * E2E Tests: Card Audio Playback (CAUDIO feature)
 *
 * Tests verify that the SpeakerButton renders correctly on practice cards
 * and that the "A" keyboard shortcut triggers audio playback.
 *
 * Strategy: API route interception with page.route() to inject audio URLs
 * and mock audio file responses. This avoids dependency on real audio files.
 *
 * pf Audio Matrix (derived from pf renderer source, 2026-05):
 *
 *   meaning_el_to_en:
 *     front  — TranslationElToEn renders AudioChip iff audio_url non-null
 *     back   — Answer renders AudioChip iff example_audio_url non-null (AND hasExample)
 *
 *   meaning_en_to_el:
 *     front  — TranslationEnToEl: NO audio chip (English-prompt only, no audioState prop)
 *     back   — Answer renders AudioChip iff example_audio_url non-null (AND hasExample)
 *
 *   article:
 *     front  — GrammarArticle: NO audio chip (no audioState prop)
 *     back   — Answer: example_audio_url gate
 *
 *   plural_form:
 *     front  — GrammarPlural renders AudioChip iff audio_url non-null
 *     back   — Answer: example_audio_url gate
 *
 *   sentence_translation (el_to_en direction, default):
 *     front  — SentenceElToEn renders AudioChip iff resolveV2CardAudioUrl non-null
 *              (resolveV2CardAudioUrl → example_audio_url ?? audio_url)
 *     back   — Answer: example_audio_url gate
 *
 *   sentence_translation (en_to_el direction):
 *     front  — SentenceEnToEl: NO audio chip
 *     back   — Answer: example_audio_url gate
 */

import * as fs from 'fs';

import { test, expect } from '@playwright/test';

import { getSupabaseStorageKey } from './helpers/supabase-test-client';

// Storage state path for learner (same as playwright.config.ts)
const LEARNER_AUTH = 'playwright/.auth/learner.json';

test.use({ storageState: LEARNER_AUTH });

test.describe.configure({ mode: 'serial' });

/**
 * Get the API base URL from environment
 */
function getApiBaseUrl(): string {
  return process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
}

/**
 * Read the learner's access token from the saved storageState file.
 * Token is stored in the Supabase session localStorage key (sb-<ref>-auth-token).
 */
function getLearnerAccessToken(): string | null {
  try {
    const storageKey = getSupabaseStorageKey();
    const authState = JSON.parse(fs.readFileSync(LEARNER_AUTH, 'utf-8'));
    const sessionEntry = (authState.origins ?? [])
      .flatMap(
        (origin: { localStorage?: Array<{ name: string; value: string }> }) =>
          origin.localStorage ?? []
      )
      .find((item: { name: string; value: string }) => item.name === storageKey);
    if (sessionEntry) {
      const session = JSON.parse(sessionEntry.value);
      return session?.access_token || null;
    }
  } catch {
    // File might not exist or be invalid
  }
  return null;
}

// Minimal valid WAV file (44 bytes, 1 sample, 8kHz, mono)
// Allows the browser Audio element to load without 404
const SILENT_WAV_BASE64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

function silentAudioBuffer(): Buffer {
  return Buffer.from(SILENT_WAV_BASE64, 'base64');
}

// Test IDs populated in beforeAll
let v2DeckId: string;
let testWordEntryId: string;
let testWordEntryLemma: string;

test.describe('Card Audio Playback', () => {
  test.beforeAll(async ({ request }) => {
    const apiBaseUrl = getApiBaseUrl();
    const accessToken = getLearnerAccessToken();
    if (!accessToken) {
      throw new Error(
        '[CAUDIO] Could not read learner access token from storageState. ' +
          'Ensure auth.setup.ts ran successfully.'
      );
    }

    // Find a deck to use for audio tests
    const decksResp = await request.get(`${apiBaseUrl}/api/v1/decks?page_size=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(decksResp.ok()).toBe(true);
    const decksData = await decksResp.json();
    const deckList = decksData.decks as Array<{ id: string; name: string }>;
    // Use E2E V2 deck which has word entries
    const deck = deckList.find((d) => d.name.includes('Greek A1 Vocabulary')) ?? deckList[0];
    if (!deck) throw new Error('[CAUDIO] No deck found. Run E2E seed first.');
    v2DeckId = deck.id;

    // Get word entries for the V2 deck
    const wordsResp = await request.get(
      `${apiBaseUrl}/api/v1/decks/${v2DeckId}/word-entries?page_size=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    expect(wordsResp.ok()).toBe(true);
    const wordsData = await wordsResp.json();
    const wordEntries = wordsData.word_entries as Array<{ id: string; lemma: string }>;
    if (!wordEntries?.length) throw new Error('[CAUDIO] No word entries found in V2 deck.');
    testWordEntryId = wordEntries[0].id;
    testWordEntryLemma = wordEntries[0].lemma;

    console.log(
      `[CAUDIO] Using deck ${v2DeckId}, word entry ${testWordEntryId} (${testWordEntryLemma})`
    );
  });

  /**
   * Build a mock card object for route interception.
   */
  function buildMockCard(
    cardType: string,
    cardId: string,
    wordEntryId: string,
    deckId: string,
    audioUrl: string
  ) {
    const baseCard = {
      id: cardId,
      word_entry_id: wordEntryId,
      deck_id: deckId,
      card_type: cardType,
      tier: 1,
      variant_key: 'default',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (cardType === 'meaning_el_to_en') {
      return {
        ...baseCard,
        front_content: {
          card_type: 'meaning_el_to_en',
          prompt: 'What does this mean?',
          main: testWordEntryLemma,
          sub: null,
          badge: 'Noun',
          hint: null,
        },
        back_content: {
          card_type: 'meaning_el_to_en',
          answer: 'hello',
          answer_sub: null,
          context: null,
        },
      };
    }

    if (cardType === 'meaning_en_to_el') {
      return {
        ...baseCard,
        front_content: {
          card_type: 'meaning_en_to_el',
          prompt: 'How do you say this in Greek?',
          main: 'hello',
          sub: null,
          badge: 'Noun',
          hint: null,
        },
        back_content: {
          card_type: 'meaning_en_to_el',
          answer: testWordEntryLemma,
          answer_sub: null,
          context: null,
        },
      };
    }

    if (cardType === 'sentence_translation') {
      return {
        ...baseCard,
        front_content: {
          card_type: 'sentence_translation',
          prompt: 'Translate this sentence',
          main: 'Γεια σας!',
          sub: null,
          badge: 'Sentence',
          hint: null,
          example_id: 'example-001',
        },
        back_content: {
          card_type: 'sentence_translation',
          answer: 'Hello!',
          answer_sub: null,
          answer_ru: null,
          context: null,
        },
      };
    }

    if (cardType === 'plural_form') {
      return {
        ...baseCard,
        front_content: {
          card_type: 'plural_form',
          prompt: 'What is the plural?',
          main: testWordEntryLemma,
          sub: null,
          badge: 'Noun',
          hint: null,
        },
        back_content: {
          card_type: 'plural_form',
          answer: testWordEntryLemma + 'α',
          answer_sub: null,
        },
      };
    }

    // Default fallback
    return {
      ...baseCard,
      front_content: { card_type: cardType, prompt: 'Test', main: 'test', badge: 'Noun' },
      back_content: { card_type: cardType, answer: 'test' },
    };
  }

  /**
   * Helper: intercept word entry, cards, and study queue APIs to inject audio URL.
   *
   * Queue card audio fields set per card type (matches resolveV2CardAudioUrl logic):
   *   sentence_translation → audio_url: null, example_audio_url: audioUrl
   *   all other types      → audio_url: audioUrl, example_audio_url: null
   *
   * Pass audioUrl: null explicitly to simulate a card with no audio.
   */
  async function setupAudioMocks(
    page: Parameters<Parameters<typeof test>[1]>[0],
    options: {
      audioUrl?: string | null;
      cardType?: string;
    } = {}
  ) {
    const audioUrl =
      options.audioUrl !== undefined ? options.audioUrl : 'https://test.local/audio.wav';
    const cardType = options.cardType ?? 'meaning_el_to_en';

    // Mock audio file request (only needed when audioUrl is non-null)
    if (audioUrl) {
      await page.route('https://test.local/**', (route) => {
        void route.fulfill({
          status: 200,
          contentType: 'audio/wav',
          body: silentAudioBuffer(),
        });
      });
    }

    // Mock word entry API to inject audio_url.
    // Use a function matcher so query params don't prevent matching, and /cards subpath is excluded.
    await page.route(
      (url) => url.pathname === `/api/v1/word-entries/${testWordEntryId}`,
      (route) => {
        if (route.request().method() !== 'GET') {
          void route.continue();
          return;
        }
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: testWordEntryId,
            deck_id: v2DeckId,
            lemma: testWordEntryLemma,
            part_of_speech: 'noun',
            translation_en: 'hello',
            translation_en_plural: null,
            translation_ru: null,
            translation_ru_plural: null,
            pronunciation: null,
            grammar_data: null,
            examples: audioUrl
              ? [
                  {
                    id: 'example-001',
                    greek: 'Γεια σας!',
                    english: 'Hello!',
                    audio_url: audioUrl,
                    audio_status: 'ready',
                  },
                ]
              : null,
            audio_key: audioUrl ? 'test/audio.wav' : null,
            audio_url: audioUrl ?? null,
            audio_status: audioUrl ? 'ready' : 'missing',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });
      }
    );

    // Mock cards API to return specific card type.
    await page.route(
      (url) => url.pathname === `/api/v1/word-entries/${testWordEntryId}/cards`,
      (route) => {
        if (route.request().method() !== 'GET') {
          void route.continue();
          return;
        }
        const mockCard = buildMockCard(
          cardType,
          'test-card-001',
          testWordEntryId,
          v2DeckId,
          audioUrl ?? ''
        );
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          // API returns array directly, NOT { cards: [...] } wrapper
          body: JSON.stringify([mockCard]),
        });
      }
    );

    // Mock V2 study queue API to return a queue card with audio fields.
    // The V2FlashcardPracticePage reads audio from the queue card (not word-entry API).
    //
    // resolveV2CardAudioUrl dispatch:
    //   sentence_translation|cloze → example_audio_url ?? audio_url
    //   other                      → audio_url
    await page.route(
      (url) => url.pathname === '/api/v1/study/queue/v2',
      (route) => {
        if (route.request().method() !== 'GET') {
          void route.continue();
          return;
        }
        const mockCard = buildMockCard(
          cardType,
          'test-card-001',
          testWordEntryId,
          v2DeckId,
          audioUrl ?? ''
        );
        const isSentence = cardType === 'sentence_translation';
        const queueCard = {
          card_record_id: 'test-card-001',
          word_entry_id: testWordEntryId,
          deck_id: v2DeckId,
          deck_name: 'E2E V2 Nouns',
          card_type: cardType,
          variant_key: 'default',
          front_content: mockCard.front_content,
          back_content: mockCard.back_content,
          status: 'new',
          is_new: true,
          is_early_practice: false,
          due_date: null,
          easiness_factor: null,
          interval: null,
          // sentence_translation uses example_audio_url; other types use audio_url
          audio_url: isSentence ? null : (audioUrl ?? null),
          example_audio_url: isSentence ? (audioUrl ?? null) : null,
          translation_ru: null,
          translation_ru_plural: null,
          sentence_ru: null,
        };
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            total_due: 0,
            total_new: 1,
            total_early_practice: 0,
            total_in_queue: 1,
            cards: [queueCard],
          }),
        });
      }
    );
  }

  const practiceUrl = () => `/decks/${v2DeckId}/words/${testWordEntryId}/practice`;

  // CAUDIO-01: meaning_el_to_en front shows speaker when audio_url present
  // pf matrix: TranslationElToEn renders AudioChip iff audioState.audioUrl non-null.
  // resolveV2CardAudioUrl(meaning_el_to_en) → audio_url. Mock sets audio_url: audioUrl.
  test('speaker button visible on front for meaning_el_to_en card', async ({ page }) => {
    await setupAudioMocks(page, { cardType: 'meaning_el_to_en' });
    await page.goto(practiceUrl());
    // pf-card is the question-phase shell (replaces legacy practice-card-front)
    await page.waitForSelector('[data-testid="pf-card"]', { timeout: 10000 });

    const speakerButton = page.getByRole('button', { name: /play audio/i });
    await expect(speakerButton).toBeVisible({ timeout: 5000 });
  });

  // CAUDIO-02: meaning_en_to_el
  //   Front — TranslationEnToEl renders NO audio chip (English-prompt only, no audioState prop).
  //   Back  — Answer renders AudioChip only when example_audio_url is set on the queue card.
  test('speaker visible on meaning_en_to_el back after flip (example_audio_url provided)', async ({
    page,
  }) => {
    const audioUrl = 'https://test.local/audio.wav';
    await setupAudioMocks(page, { cardType: 'meaning_en_to_el', audioUrl });
    // Patch the queue mock to add example_audio_url (Answer.tsx hasExample check):
    // audio_url stays non-null (for the 'a' key shortcut), AND example_audio_url is set
    // so Answer renders the AudioChip on the back.
    await page.route(
      (url) => url.pathname === '/api/v1/study/queue/v2',
      (route) => {
        if (route.request().method() !== 'GET') {
          void route.continue();
          return;
        }
        const mockCard = buildMockCard(
          'meaning_en_to_el',
          'test-card-001',
          testWordEntryId,
          v2DeckId,
          audioUrl
        );
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            total_due: 0,
            total_new: 1,
            total_early_practice: 0,
            total_in_queue: 1,
            cards: [
              {
                card_record_id: 'test-card-001',
                word_entry_id: testWordEntryId,
                deck_id: v2DeckId,
                deck_name: 'E2E V2 Nouns',
                card_type: 'meaning_en_to_el',
                variant_key: 'default',
                front_content: mockCard.front_content,
                back_content: mockCard.back_content,
                status: 'new',
                is_new: true,
                is_early_practice: false,
                due_date: null,
                easiness_factor: null,
                interval: null,
                audio_url: audioUrl,
                // example_audio_url set so Answer.tsx hasExample=true → AudioChip renders on back
                example_audio_url: audioUrl,
                translation_ru: null,
                translation_ru_plural: null,
                sentence_ru: null,
              },
            ],
          }),
        });
      }
    );

    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="pf-card"]', { timeout: 10000 });

    // Front: TranslationEnToEl renders NO audio chip (English prompt only, no audioState prop)
    await expect(page.getByRole('button', { name: /play audio/i })).not.toBeVisible();

    // Flip card
    await page.keyboard.press('Space');
    // pf-rating-row appears after flip
    await page.waitForSelector('[data-testid="pf-rating-row"]', { timeout: 5000 });

    // Back: Answer renders AudioChip because example_audio_url is set
    const speakerButton = page.getByRole('button', { name: /play audio/i });
    await expect(speakerButton).toBeVisible({ timeout: 5000 });
  });

  // CAUDIO-03: sentence_translation (el_to_en direction, default)
  //   Front — SentenceElToEn renders AudioChip iff resolveV2CardAudioUrl returns non-null.
  //   resolveV2CardAudioUrl(sentence_translation) → example_audio_url ?? audio_url.
  //   Mock sets example_audio_url: audioUrl for sentence cards.
  test('speaker button visible on front for sentence_translation (el_to_target)', async ({
    page,
  }) => {
    await setupAudioMocks(page, { cardType: 'sentence_translation' });
    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="pf-card"]', { timeout: 10000 });

    const speakerButton = page.getByRole('button', { name: /play audio/i });
    await expect(speakerButton).toBeVisible({ timeout: 5000 });
  });

  // CAUDIO-04: speaker hidden when audio_url is null (meaning_el_to_en with no audio)
  //   pf matrix: AudioChip returns null when audioUrl falsy. Queue card must have audio_url: null.
  test('speaker hidden when audio_url is null', async ({ page }) => {
    // Set up mocks with null audio_url to confirm AudioChip returns null
    await setupAudioMocks(page, {
      cardType: 'meaning_el_to_en',
      audioUrl: null,
    });

    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="pf-card"]', { timeout: 10000 });

    await expect(page.getByRole('button', { name: /play audio/i })).not.toBeVisible();
  });

  // CAUDIO-05: plural_form with null audio_url → no speaker on front or back
  //   pf matrix: GrammarPlural renders AudioChip iff audioState.audioUrl non-null.
  //   resolveV2CardAudioUrl(plural_form) → audio_url.
  //   When audio_url is null → AudioChip returns null → no speaker button.
  //   Answer back: hasExample gated on sentence_ru || example_audio_url; both null → no chip.
  test('no speaker on plural_form card when audio_url is null', async ({ page }) => {
    await setupAudioMocks(page, { cardType: 'plural_form', audioUrl: null });
    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="pf-card"]', { timeout: 10000 });

    // Front: GrammarPlural receives audioState with audioUrl=null → AudioChip returns null
    await expect(page.getByRole('button', { name: /play audio/i })).not.toBeVisible();

    // Flip to back
    await page.keyboard.press('Space');
    await page.waitForSelector('[data-testid="pf-rating-row"]', { timeout: 5000 });

    // Back: Answer has no example_audio_url → no AudioChip in example block
    await expect(page.getByRole('button', { name: /play audio/i })).not.toBeVisible();
  });

  // CAUDIO-06: plural_form WITH audio_url → speaker IS visible on front
  //   pf matrix: GrammarPlural renders AudioChip when audioState.audioUrl is non-null.
  test('speaker visible on plural_form front when audio_url is present', async ({ page }) => {
    await setupAudioMocks(page, {
      cardType: 'plural_form',
      audioUrl: 'https://test.local/audio.wav',
    });
    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="pf-card"]', { timeout: 10000 });

    // Front: GrammarPlural receives non-null audioState → AudioChip renders speaker button
    const speakerButton = page.getByRole('button', { name: /play audio/i });
    await expect(speakerButton).toBeVisible({ timeout: 5000 });
  });

  // CAUDIO-07: "A" key toggles audio when speaker is visible (meaning_el_to_en)
  test('"A" key toggles audio when speaker is visible', async ({ page }) => {
    await setupAudioMocks(page, { cardType: 'meaning_el_to_en' });
    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="pf-card"]', { timeout: 10000 });

    // Verify speaker is visible
    const speakerButton = page.getByRole('button', { name: /play audio/i });
    await expect(speakerButton).toBeVisible({ timeout: 5000 });

    // Set up request interceptor BEFORE triggering (to avoid race condition)
    const audioRequest = page.waitForRequest(
      (req) => req.method() === 'GET' && req.url() === 'https://test.local/audio.wav'
    );
    await page.keyboard.press('a');
    // Verify audio playback was triggered by confirming the audio request was made
    await audioRequest;
  });

  // CAUDIO-08: "A" key triggers audio on meaning_en_to_el even without a visible speaker chip.
  //   pf matrix: TranslationEnToEl has NO audio chip (no audioState prop passed to it).
  //   Page-level keyboard handler still calls audioToggle() when audioUrl is truthy
  //   (V2FlashcardPracticePage: `a: () => { if (audioUrl) audioToggle(); }`).
  //   So 'a' triggers the audio fetch even when no speaker button is shown.
  test('"A" key triggers audio on meaning_en_to_el (no speaker chip on front)', async ({
    page,
  }) => {
    await setupAudioMocks(page, { cardType: 'meaning_en_to_el' });
    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="pf-card"]', { timeout: 10000 });

    // Front: TranslationEnToEl renders NO audio chip — speaker button NOT visible
    await expect(page.getByRole('button', { name: /play audio/i })).not.toBeVisible();

    // Press "A" — page-level handler fires audioToggle() when audioUrl is truthy
    const audioRequest = page.waitForRequest(
      (req) => req.method() === 'GET' && req.url() === 'https://test.local/audio.wav'
    );
    await page.keyboard.press('a');
    await audioRequest;
  });
});
