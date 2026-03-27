// src/stores/__tests__/v2PracticeStore.test.ts

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { reviewAPI } from '@/services/reviewAPI';
import type { V2ReviewResult } from '@/services/reviewAPI';
import { studyAPI } from '@/services/studyAPI';
import type { V2StudyQueue, V2StudyQueueCard } from '@/services/studyAPI';
import { useAuthStore } from '@/stores/authStore';

import {
  useV2PracticeStore,
  mapPracticeRatingToQuality,
  v2QueueCardToCardRecord,
  resolveV2CardAudioUrl,
} from '../v2PracticeStore';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/studyAPI', () => ({
  studyAPI: {
    getV2Queue: vi.fn(),
  },
}));

vi.mock('@/services/reviewAPI', () => ({
  reviewAPI: {
    submitV2: vi.fn(),
  },
}));

vi.mock('@/stores/authStore');

// ============================================
// Helpers
// ============================================

function makeMockCard(overrides: Partial<V2StudyQueueCard> = {}): V2StudyQueueCard {
  return {
    card_record_id: 'cr-1',
    word_entry_id: 'we-1',
    deck_id: 'deck-1',
    deck_name: 'Test Deck',
    card_type: 'meaning_el_to_en',
    variant_key: 'meaning',
    front_content: { word: 'σπίτι' },
    back_content: { translation: 'house' },
    status: 'new',
    is_new: true,
    is_early_practice: false,
    due_date: null,
    easiness_factor: null,
    interval: null,
    audio_url: 'https://s3.example.com/word.mp3',
    example_audio_url: null,
    translation_ru: 'дом',
    translation_ru_plural: 'дома',
    sentence_ru: null,
    ...overrides,
  };
}

function makeMockQueue(cards: V2StudyQueueCard[]): V2StudyQueue {
  return {
    total_due: 0,
    total_new: cards.length,
    total_early_practice: 0,
    total_in_queue: cards.length,
    cards,
  };
}

function makeMockReviewResult(overrides: Partial<V2ReviewResult> = {}): V2ReviewResult {
  return {
    card_record_id: 'cr-1',
    quality: 4,
    previous_status: 'new',
    new_status: 'learning',
    easiness_factor: 2.5,
    interval: 1,
    repetitions: 1,
    next_review_date: '2026-03-20',
    message: null,
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('v2PracticeStore', () => {
  beforeEach(() => {
    useV2PracticeStore.setState({
      queue: [],
      currentIndex: 0,
      isFlipped: false,
      sessionId: null,
      deckId: null,
      cardType: null,
      wordEntryId: null,
      sessionStats: {
        cardsReviewed: 0,
        againCount: 0,
        hardCount: 0,
        goodCount: 0,
        easyCount: 0,
        newStarted: 0,
        cardsMastered: 0,
        cardsRelearning: 0,
      },
      isLoading: false,
      error: null,
      sessionSummary: null,
      cardStartTime: null,
      sessionStartTime: null,
      _pendingReviews: 0,
    });

    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
    } as ReturnType<typeof useAuthStore.getState>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Test 1: startSession loads queue and sets state
  // ============================================

  it('startSession loads queue and sets state', async () => {
    const card = makeMockCard();
    const queue = makeMockQueue([card]);
    vi.mocked(studyAPI.getV2Queue).mockResolvedValue(queue);

    await useV2PracticeStore.getState().startSession('deck-1');

    const state = useV2PracticeStore.getState();
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].card_record_id).toBe('cr-1');
    expect(state.currentIndex).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.sessionId).not.toBeNull();
    expect(state.deckId).toBe('deck-1');
    expect(studyAPI.getV2Queue).toHaveBeenCalledWith(
      expect.objectContaining({ deck_id: 'deck-1' })
    );
  });

  // ============================================
  // Test 2: meaning mode fetches limit=50 without card_type, filters client-side
  // ============================================

  it('meaning filter fetches limit=50 without card_type and filters to meaning_* and sentence_translation', async () => {
    const meaningCard = makeMockCard({ card_type: 'meaning_el_to_en' });
    const sentenceCard = makeMockCard({
      card_record_id: 'cr-2',
      card_type: 'sentence_translation',
    });
    const otherCard = makeMockCard({ card_record_id: 'cr-3', card_type: 'plural_form' });
    const queue = makeMockQueue([meaningCard, sentenceCard, otherCard]);
    vi.mocked(studyAPI.getV2Queue).mockResolvedValue(queue);

    await useV2PracticeStore
      .getState()
      .startSession(
        'deck-1',
        'meaning' as ReturnType<typeof useV2PracticeStore.getState>['cardType']
      );

    const state = useV2PracticeStore.getState();
    // Should filter to meaning_* and sentence_translation cards
    expect(state.queue).toHaveLength(2);
    expect(state.queue[0].card_type).toBe('meaning_el_to_en');
    expect(state.queue[1].card_type).toBe('sentence_translation');

    // Should NOT have card_type in the API call
    expect(studyAPI.getV2Queue).toHaveBeenCalledWith(
      expect.not.objectContaining({ card_type: expect.anything() })
    );
    // Should have limit=50
    expect(studyAPI.getV2Queue).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });

  // ============================================
  // Test 3: rateCard advances index and maps quality
  // ============================================

  it('rateCard advances currentIndex and maps quality correctly', async () => {
    const card1 = makeMockCard({ card_record_id: 'cr-1' });
    const card2 = makeMockCard({ card_record_id: 'cr-2' });
    vi.mocked(studyAPI.getV2Queue).mockResolvedValue(makeMockQueue([card1, card2]));
    vi.mocked(reviewAPI.submitV2).mockResolvedValue(makeMockReviewResult());

    await useV2PracticeStore.getState().startSession('deck-1');

    useV2PracticeStore.getState().rateCard(3); // good → quality 4

    expect(useV2PracticeStore.getState().currentIndex).toBe(1);
    expect(useV2PracticeStore.getState().isFlipped).toBe(false);

    expect(reviewAPI.submitV2).toHaveBeenCalledWith(
      expect.objectContaining({
        card_record_id: 'cr-1',
        quality: 4, // good maps to 4
      })
    );
  });

  // ============================================
  // Test 4: stats accumulation from V2ReviewResult
  // ============================================

  it('stats accumulate from V2ReviewResult on background submission', async () => {
    const card = makeMockCard();
    vi.mocked(studyAPI.getV2Queue).mockResolvedValue(makeMockQueue([card]));
    vi.mocked(reviewAPI.submitV2).mockResolvedValue(
      makeMockReviewResult({
        previous_status: 'review',
        new_status: 'mastered',
      })
    );

    await useV2PracticeStore.getState().startSession('deck-1');

    useV2PracticeStore.getState().rateCard(4); // easy

    // Wait for the background promise to resolve
    await vi.waitFor(() => {
      const stats = useV2PracticeStore.getState().sessionStats;
      return stats.cardsReviewed === 1;
    });

    const stats = useV2PracticeStore.getState().sessionStats;
    expect(stats.cardsReviewed).toBe(1);
    expect(stats.easyCount).toBe(1);
    expect(stats.cardsMastered).toBe(1); // new_status=mastered, previous!=mastered
    expect(stats.againCount).toBe(0);
  });

  // ============================================
  // Test 5: sessionSummary computed on last card + all pending resolved
  // ============================================

  it('sessionSummary is set after last card rated and all pending reviews resolved', async () => {
    const card = makeMockCard();
    vi.mocked(studyAPI.getV2Queue).mockResolvedValue(makeMockQueue([card]));
    vi.mocked(reviewAPI.submitV2).mockResolvedValue(makeMockReviewResult());

    await useV2PracticeStore.getState().startSession('deck-1');

    expect(useV2PracticeStore.getState().sessionSummary).toBeNull();

    useV2PracticeStore.getState().rateCard(3);

    await vi.waitFor(() => {
      return useV2PracticeStore.getState().sessionSummary !== null;
    });

    const summary = useV2PracticeStore.getState().sessionSummary!;
    expect(summary.cardsReviewed).toBe(1);
    expect(summary.deckId).toBe('deck-1');
    expect(summary.ratingBreakdown.good).toBe(1);
    expect(summary.sessionId).toBeTruthy();
  });

  // ============================================
  // Test 6: mapPracticeRatingToQuality values
  // ============================================

  it('mapPracticeRatingToQuality maps 1→0, 2→2, 3→4, 4→5', () => {
    expect(mapPracticeRatingToQuality(1)).toBe(0);
    expect(mapPracticeRatingToQuality(2)).toBe(2);
    expect(mapPracticeRatingToQuality(3)).toBe(4);
    expect(mapPracticeRatingToQuality(4)).toBe(5);
  });

  // ============================================
  // Test 7: v2QueueCardToCardRecord mapping
  // ============================================

  it('v2QueueCardToCardRecord maps V2StudyQueueCard to CardRecordResponse shape', () => {
    const card = makeMockCard();
    const result = v2QueueCardToCardRecord(card);

    expect(result.id).toBe(card.card_record_id);
    expect(result.word_entry_id).toBe(card.word_entry_id);
    expect(result.deck_id).toBe(card.deck_id);
    expect(result.card_type).toBe(card.card_type);
    expect(result.front_content).toBe(card.front_content);
    expect(result.back_content).toBe(card.back_content);
    expect(result.is_active).toBe(true);
    expect(result.variant_key).toBe(card.variant_key);
  });

  // ============================================
  // Test 8: resolveV2CardAudioUrl per card type
  // ============================================

  it('resolveV2CardAudioUrl returns example_audio_url for sentence types, audio_url for word types', () => {
    const sentenceCard = makeMockCard({
      card_type: 'sentence_translation',
      audio_url: 'https://s3.example.com/word.mp3',
      example_audio_url: 'https://s3.example.com/example.mp3',
    });
    expect(resolveV2CardAudioUrl(sentenceCard)).toBe('https://s3.example.com/example.mp3');

    const clozeCard = makeMockCard({
      card_type: 'cloze',
      audio_url: 'https://s3.example.com/word.mp3',
      example_audio_url: 'https://s3.example.com/cloze.mp3',
    });
    expect(resolveV2CardAudioUrl(clozeCard)).toBe('https://s3.example.com/cloze.mp3');

    // Sentence card with no example audio falls back to word audio
    const sentenceNoExample = makeMockCard({
      card_type: 'sentence_translation',
      audio_url: 'https://s3.example.com/word.mp3',
      example_audio_url: null,
    });
    expect(resolveV2CardAudioUrl(sentenceNoExample)).toBe('https://s3.example.com/word.mp3');

    const meaningCard = makeMockCard({
      card_type: 'meaning_el_to_en',
      audio_url: 'https://s3.example.com/word.mp3',
      example_audio_url: 'https://s3.example.com/example.mp3',
    });
    expect(resolveV2CardAudioUrl(meaningCard)).toBe('https://s3.example.com/word.mp3');
  });

  // ============================================
  // Test: startSession with wordEntryId passes word_entry_id to API
  // ============================================

  it('startSession with wordEntryId passes word_entry_id to API', async () => {
    const card = makeMockCard();
    const queue = makeMockQueue([card]);
    vi.mocked(studyAPI.getV2Queue).mockResolvedValue(queue);

    await useV2PracticeStore.getState().startSession('deck-1', undefined, 'word-entry-1');

    expect(vi.mocked(studyAPI.getV2Queue)).toHaveBeenCalledWith(
      expect.objectContaining({ word_entry_id: 'word-entry-1' })
    );
    expect(useV2PracticeStore.getState().wordEntryId).toBe('word-entry-1');
  });

  // ============================================
  // Test: endSession resets wordEntryId to null
  // ============================================

  it('endSession resets wordEntryId to null', () => {
    useV2PracticeStore.setState({ wordEntryId: 'some-id' });

    useV2PracticeStore.getState().endSession();

    expect(useV2PracticeStore.getState().wordEntryId).toBeNull();
  });
});
