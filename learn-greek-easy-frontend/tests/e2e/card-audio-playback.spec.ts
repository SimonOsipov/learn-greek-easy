/**
 * E2E Tests: Card Audio Playback (CAUDIO feature)
 *
 * Tests verify that the SpeakerButton renders correctly on practice cards
 * and that the "A" keyboard shortcut triggers audio playback.
 *
 * Strategy: API route interception with page.route() to inject audio URLs
 * and mock audio file responses. This avoids dependency on real audio files.
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
    const sessionEntry = authState.origins?.[0]?.localStorage?.find(
      (item: { name: string; value: string }) => item.name === storageKey
    );
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
const SILENT_WAV_BASE64 =
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

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

    // Find V2 deck
    const decksResp = await request.get(`${apiBaseUrl}/api/v1/decks?page_size=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(decksResp.ok()).toBe(true);
    const decksData = await decksResp.json();
    const v2Deck = (decksData.decks as Array<{ id: string; card_system: string }>).find(
      (d) => d.card_system === 'V2'
    );
    if (!v2Deck) throw new Error('[CAUDIO] No V2 deck found. Run E2E seed first.');
    v2DeckId = v2Deck.id;

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
      `[CAUDIO] Using V2 deck ${v2DeckId}, word entry ${testWordEntryId} (${testWordEntryLemma})`
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
   * Helper: intercept word entry and cards APIs to inject audio URL.
   */
  async function setupAudioMocks(
    page: Parameters<Parameters<typeof test>[1]>[0],
    options: {
      audioUrl?: string;
      cardType?: string;
    } = {}
  ) {
    const audioUrl = options.audioUrl ?? 'https://test.local/audio.wav';
    const cardType = options.cardType ?? 'meaning_el_to_en';

    // Mock audio file request
    await page.route('https://test.local/**', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'audio/wav',
        body: silentAudioBuffer(),
      });
    });

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
            examples: [
              {
                id: 'example-001',
                greek: 'Γεια σας!',
                english: 'Hello!',
                audio_url: audioUrl,
                audio_status: 'ready',
              },
            ],
            audio_key: 'test/audio.wav',
            audio_url: audioUrl,
            audio_status: 'ready',
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
        const mockCard = buildMockCard(cardType, 'test-card-001', testWordEntryId, v2DeckId, audioUrl);
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ cards: [mockCard] }),
        });
      }
    );
  }

  const practiceUrl = () => `/decks/${v2DeckId}/words/${testWordEntryId}/practice`;

  test('speaker button visible on front for meaning_el_to_en card', async ({ page }) => {
    await setupAudioMocks(page, { cardType: 'meaning_el_to_en' });
    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="practice-card-front"]', { timeout: 10000 });

    const speakerButton = page.getByRole('button', { name: /play audio/i });
    await expect(speakerButton).toBeVisible({ timeout: 5000 });
  });

  test('no speaker on meaning_en_to_el front, speaker appears on back after flip', async ({
    page,
  }) => {
    await setupAudioMocks(page, { cardType: 'meaning_en_to_el' });
    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="practice-card-front"]', { timeout: 10000 });

    // No speaker on front (English side has no Greek audio)
    await expect(page.getByRole('button', { name: /play audio/i })).not.toBeVisible();

    // Flip card
    await page.keyboard.press('Space');
    await page.waitForSelector('[data-testid="practice-card-back"]', { timeout: 5000 });

    // Speaker appears on back
    const speakerButton = page.getByRole('button', { name: /play audio/i });
    await expect(speakerButton).toBeVisible({ timeout: 5000 });
  });

  test('speaker button visible on front for sentence_translation (el_to_target)', async ({
    page,
  }) => {
    await setupAudioMocks(page, { cardType: 'sentence_translation' });
    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="practice-card-front"]', { timeout: 10000 });

    const speakerButton = page.getByRole('button', { name: /play audio/i });
    await expect(speakerButton).toBeVisible({ timeout: 5000 });
  });

  test('speaker hidden when audio_url is null', async ({ page }) => {
    // Set up mocks with non-null audio first (to establish card mock)
    await setupAudioMocks(page, { cardType: 'meaning_el_to_en', audioUrl: 'https://test.local/audio.wav' });

    // Override the word entry mock to have null audio_url
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
            examples: null,
            audio_key: null,
            audio_url: null,
            audio_status: 'missing',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });
      }
    );

    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="practice-card-front"]', { timeout: 10000 });

    await expect(page.getByRole('button', { name: /play audio/i })).not.toBeVisible();
  });

  test('no speaker on plural_form card', async ({ page }) => {
    await setupAudioMocks(page, { cardType: 'plural_form' });
    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="practice-card-front"]', { timeout: 10000 });

    await expect(page.getByRole('button', { name: /play audio/i })).not.toBeVisible();
    await page.keyboard.press('Space');
    await page.waitForSelector('[data-testid="practice-card-back"]', { timeout: 5000 });
    await expect(page.getByRole('button', { name: /play audio/i })).not.toBeVisible();
  });

  test('"A" key toggles audio when speaker is visible', async ({ page }) => {
    await setupAudioMocks(page, { cardType: 'meaning_el_to_en' });
    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="practice-card-front"]', { timeout: 10000 });

    // Verify speaker is visible
    const speakerButton = page.getByRole('button', { name: /play audio/i });
    await expect(speakerButton).toBeVisible({ timeout: 5000 });

    // Press "A" to start audio
    await page.keyboard.press('a');

    // Button aria-label should change to "Pause audio" or "Loading audio"
    await expect(
      page.getByRole('button', { name: /pause audio|loading audio/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test('"A" key is no-op when no speaker is visible (meaning_en_to_el front)', async ({
    page,
  }) => {
    await setupAudioMocks(page, { cardType: 'meaning_en_to_el' });
    await page.goto(practiceUrl());
    await page.waitForSelector('[data-testid="practice-card-front"]', { timeout: 10000 });

    // No speaker on front
    await expect(page.getByRole('button', { name: /play audio/i })).not.toBeVisible();

    // Press "A" -- should be silent no-op, no speaker button appears
    await page.keyboard.press('a');

    // Still no speaker button
    await expect(
      page.getByRole('button', { name: /play audio|pause audio|loading audio/i })
    ).not.toBeVisible();
  });
});
