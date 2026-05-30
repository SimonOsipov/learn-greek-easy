// src/stores/__tests__/v2PracticeStore.test.ts

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { reviewAPI } from '@/services/reviewAPI';
import type { ReviewResult } from '@/services/reviewAPI';
import { studyAPI } from '@/services/studyAPI';
import type { StudyQueue, StudyQueueCard } from '@/services/studyAPI';
import { useAuthStore } from '@/stores/authStore';

import {
  useV2PracticeStore,
  mapPracticeRatingToQuality,
  v2QueueCardToCardRecord,
  resolveV2CardAudioUrl,
} from '../v2PracticeStore';
import type { ToastPayload } from '../v2PracticeStore';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/studyAPI', () => ({
  studyAPI: {
    getQueue: vi.fn(),
  },
}));

vi.mock('@/services/reviewAPI', () => ({
  reviewAPI: {
    submit: vi.fn(),
  },
}));

vi.mock('@/stores/authStore');

// ============================================
// Helpers
// ============================================

function makeMockCard(overrides: Partial<StudyQueueCard> = {}): StudyQueueCard {
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

function makeMockQueue(cards: StudyQueueCard[]): StudyQueue {
  return {
    total_due: 0,
    total_new: cards.length,
    total_early_practice: 0,
    total_in_queue: cards.length,
    cards,
  };
}

function makeMockReviewResult(overrides: Partial<ReviewResult> = {}): ReviewResult {
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
      cards: [],
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
      totalNew: 0,
      totalReview: 0,
      streak: 0,
      ratings: [],
      leaveDirection: null,
      toast: null,
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
    vi.mocked(studyAPI.getQueue).mockResolvedValue(queue);

    await useV2PracticeStore.getState().startSession('deck-1');

    const state = useV2PracticeStore.getState();
    expect(state.cards).toHaveLength(1);
    expect(state.cards[0].card_record_id).toBe('cr-1');
    expect(state.currentIndex).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.sessionId).not.toBeNull();
    expect(state.deckId).toBe('deck-1');
    expect(studyAPI.getQueue).toHaveBeenCalledWith(expect.objectContaining({ deck_id: 'deck-1' }));
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
    vi.mocked(studyAPI.getQueue).mockResolvedValue(queue);

    await useV2PracticeStore
      .getState()
      .startSession(
        'deck-1',
        'meaning' as ReturnType<typeof useV2PracticeStore.getState>['cardType']
      );

    const state = useV2PracticeStore.getState();
    // Should filter to meaning_* and sentence_translation cards
    expect(state.cards).toHaveLength(2);
    expect(state.cards[0].card_type).toBe('meaning_el_to_en');
    expect(state.cards[1].card_type).toBe('sentence_translation');

    // Should NOT have card_type in the API call
    expect(studyAPI.getQueue).toHaveBeenCalledWith(
      expect.not.objectContaining({ card_type: expect.anything() })
    );
    // Should have limit=50
    expect(studyAPI.getQueue).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });

  // ============================================
  // Test 3: rateCard advances index and maps quality
  // ============================================

  it('rateCard advances currentIndex and maps quality correctly', async () => {
    const card1 = makeMockCard({ card_record_id: 'cr-1' });
    const card2 = makeMockCard({ card_record_id: 'cr-2' });
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card1, card2]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(makeMockReviewResult());

    await useV2PracticeStore.getState().startSession('deck-1');

    useV2PracticeStore.getState().rateCard(3); // good → quality 4

    expect(useV2PracticeStore.getState().currentIndex).toBe(1);
    expect(useV2PracticeStore.getState().isFlipped).toBe(false);

    expect(reviewAPI.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        card_record_id: 'cr-1',
        quality: 4, // good maps to 4
      })
    );
  });

  // ============================================
  // Test 4: stats accumulation from ReviewResult
  // ============================================

  it('stats accumulate from ReviewResult on background submission', async () => {
    const card = makeMockCard();
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(
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
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(makeMockReviewResult());

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

  it('v2QueueCardToCardRecord maps StudyQueueCard to CardRecordResponse shape', () => {
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
    vi.mocked(studyAPI.getQueue).mockResolvedValue(queue);

    await useV2PracticeStore.getState().startSession('deck-1', undefined, 'word-entry-1');

    expect(vi.mocked(studyAPI.getQueue)).toHaveBeenCalledWith(
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

  // ============================================
  // Test: streak and ratings updated by rateCard (PRACT2-1-02)
  // ============================================

  it('rateCard updates streak on ok rating', async () => {
    const card1 = makeMockCard({ card_record_id: 'cr-1' });
    const card2 = makeMockCard({ card_record_id: 'cr-2' });
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card1, card2]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(makeMockReviewResult());

    await useV2PracticeStore.getState().startSession('deck-1');
    useV2PracticeStore.getState().rateCard(3); // ok → streak +1

    expect(useV2PracticeStore.getState().streak).toBe(1);
    expect(useV2PracticeStore.getState().ratings[0]).toBe('ok');
  });

  it('rateCard resets streak on forgot rating', async () => {
    const card1 = makeMockCard({ card_record_id: 'cr-1' });
    const card2 = makeMockCard({ card_record_id: 'cr-2' });
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card1, card2]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(makeMockReviewResult());

    await useV2PracticeStore.getState().startSession('deck-1');
    // Set streak to 5 manually
    useV2PracticeStore.setState({ streak: 5 });
    useV2PracticeStore.getState().rateCard(1); // forgot → streak 0

    expect(useV2PracticeStore.getState().streak).toBe(0);
    expect(useV2PracticeStore.getState().ratings[0]).toBe('forgot');
  });

  it('rateCard leaves streak unchanged on tough rating', async () => {
    const card1 = makeMockCard({ card_record_id: 'cr-1' });
    const card2 = makeMockCard({ card_record_id: 'cr-2' });
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card1, card2]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(makeMockReviewResult());

    await useV2PracticeStore.getState().startSession('deck-1');
    useV2PracticeStore.setState({ streak: 3 });
    useV2PracticeStore.getState().rateCard(2); // tough → streak unchanged

    expect(useV2PracticeStore.getState().streak).toBe(3);
    expect(useV2PracticeStore.getState().ratings[0]).toBe('tough');
  });

  // ============================================
  // Tests: leaveDirection (PRACT2-1-07)
  // ============================================

  it('rateCard sets leaveDirection=right for Forgot (rating=1)', async () => {
    const card1 = makeMockCard({ card_record_id: 'cr-1' });
    const card2 = makeMockCard({ card_record_id: 'cr-2' });
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card1, card2]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(makeMockReviewResult());

    await useV2PracticeStore.getState().startSession('deck-1');
    useV2PracticeStore.getState().rateCard(1); // Forgot

    expect(useV2PracticeStore.getState().leaveDirection).toBe('right');
  });

  it('rateCard sets leaveDirection=right for Tough (rating=2)', async () => {
    const card1 = makeMockCard({ card_record_id: 'cr-1' });
    const card2 = makeMockCard({ card_record_id: 'cr-2' });
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card1, card2]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(makeMockReviewResult());

    await useV2PracticeStore.getState().startSession('deck-1');
    useV2PracticeStore.getState().rateCard(2); // Tough

    expect(useV2PracticeStore.getState().leaveDirection).toBe('right');
  });

  it('rateCard sets leaveDirection=left for OK (rating=3)', async () => {
    const card1 = makeMockCard({ card_record_id: 'cr-1' });
    const card2 = makeMockCard({ card_record_id: 'cr-2' });
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card1, card2]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(makeMockReviewResult());

    await useV2PracticeStore.getState().startSession('deck-1');
    useV2PracticeStore.getState().rateCard(3); // OK

    expect(useV2PracticeStore.getState().leaveDirection).toBe('left');
  });

  it('rateCard sets leaveDirection=left for Easy (rating=4)', async () => {
    const card1 = makeMockCard({ card_record_id: 'cr-1' });
    const card2 = makeMockCard({ card_record_id: 'cr-2' });
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card1, card2]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(makeMockReviewResult());

    await useV2PracticeStore.getState().startSession('deck-1');
    useV2PracticeStore.getState().rateCard(4); // Easy

    expect(useV2PracticeStore.getState().leaveDirection).toBe('left');
  });

  it('clearLeaveDirection sets leaveDirection to null', async () => {
    useV2PracticeStore.setState({ leaveDirection: 'right' });
    useV2PracticeStore.getState().clearLeaveDirection();
    expect(useV2PracticeStore.getState().leaveDirection).toBeNull();
  });

  // ============================================
  // Tests: toast state (PRACT2-1-07)
  // ============================================

  it('toast is set from reviewAPI.submit .then with real interval and nextReviewDate', async () => {
    const card1 = makeMockCard({ card_record_id: 'cr-1' });
    const card2 = makeMockCard({ card_record_id: 'cr-2' });
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card1, card2]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(
      makeMockReviewResult({ interval: 7, next_review_date: '2026-06-06' })
    );

    await useV2PracticeStore.getState().startSession('deck-1');
    useV2PracticeStore.getState().rateCard(3);

    // Wait for .then to resolve
    await vi.waitFor(() => {
      const t = useV2PracticeStore.getState().toast as ToastPayload | null;
      return t !== null;
    });

    const toast = useV2PracticeStore.getState().toast as ToastPayload;
    expect(toast.interval).toBe(7);
    expect(toast.nextReviewDate).toBe('2026-06-06');
    expect(toast.forCardId).toBe('cr-1');
  });

  it('toast is cleared on next rateCard call', async () => {
    const card1 = makeMockCard({ card_record_id: 'cr-1' });
    const card2 = makeMockCard({ card_record_id: 'cr-2' });
    const card3 = makeMockCard({ card_record_id: 'cr-3' });
    vi.mocked(studyAPI.getQueue).mockResolvedValue(makeMockQueue([card1, card2, card3]));
    vi.mocked(reviewAPI.submit).mockResolvedValue(makeMockReviewResult({ interval: 5 }));

    await useV2PracticeStore.getState().startSession('deck-1');
    useV2PracticeStore.getState().rateCard(3);
    // Wait for toast to populate
    await vi.waitFor(() => useV2PracticeStore.getState().toast !== null);

    // Rate next card — toast should clear immediately (synchronous set in rateCard)
    useV2PracticeStore.getState().rateCard(3);
    // Toast is set to null synchronously before the next .then fires
    expect(useV2PracticeStore.getState().toast).toBeNull();
  });

  it('clearToast sets toast to null', () => {
    useV2PracticeStore.setState({
      toast: { forCardId: 'cr-1', interval: 3, nextReviewDate: '2026-06-03' },
    });
    useV2PracticeStore.getState().clearToast();
    expect(useV2PracticeStore.getState().toast).toBeNull();
  });
});
