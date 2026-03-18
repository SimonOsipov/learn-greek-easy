// src/stores/v2PracticeStore.ts

/**
 * V2 Practice Session State Management Store
 *
 * Manages the full lifecycle of a V2 practice session:
 * - Fetching the study queue (card-record based)
 * - Optimistic card advancement on rating
 * - Background review submission with stats accumulation
 * - Session summary computation on completion
 *
 * Simplified V1 reviewStore.ts pattern: flat state, no crash recovery, no pause/resume.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { MAX_ANSWER_TIME_SECONDS } from '@/lib/timeFormatUtils';
import { reviewAPI } from '@/services/reviewAPI';
import type { V2ReviewResult } from '@/services/reviewAPI';
import { studyAPI } from '@/services/studyAPI';
import type { V2StudyQueue, V2StudyQueueCard } from '@/services/studyAPI';
import type { CardRecordResponse, CardRecordType } from '@/services/wordEntryAPI';
import { useAuthStore } from '@/stores/authStore';
import { generateSessionId } from '@/utils/analytics';

// ============================================
// Constants
// ============================================

const STATUS_ORDER: Record<string, number> = {
  new: 0,
  learning: 1,
  review: 2,
  mastered: 3,
};

// ============================================
// Exported Utility Functions
// ============================================

/**
 * Maps a practice rating (1-4) to SM-2 quality (0-5)
 */
export function mapPracticeRatingToQuality(rating: 1 | 2 | 3 | 4): number {
  switch (rating) {
    case 1:
      return 0; // again → complete blackout
    case 2:
      return 2; // hard → incorrect but remembered
    case 3:
      return 4; // good → correct with hesitation
    case 4:
      return 5; // easy → perfect response
  }
}

/**
 * Adapts a V2StudyQueueCard to a CardRecordResponse-compatible shape for PracticeCard
 */
export function v2QueueCardToCardRecord(card: V2StudyQueueCard): CardRecordResponse {
  return {
    id: card.card_record_id,
    word_entry_id: card.word_entry_id,
    deck_id: card.deck_id,
    card_type: card.card_type as CardRecordType,
    tier: null,
    variant_key: card.variant_key ?? '',
    front_content: card.front_content,
    back_content: card.back_content,
    is_active: true,
    created_at: '',
    updated_at: '',
  };
}

/**
 * Resolves the appropriate audio URL for a V2 queue card.
 * Sentence and cloze types use example_audio_url (falling back to audio_url).
 * Word types use audio_url.
 */
export function resolveV2CardAudioUrl(card: V2StudyQueueCard): string | null {
  const cardType = card.card_type;
  if (cardType === 'sentence_translation' || cardType === 'cloze') {
    return card.example_audio_url ?? card.audio_url;
  }
  return card.audio_url;
}

// ============================================
// Types
// ============================================

export interface V2SessionStats {
  cardsReviewed: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
  newStarted: number;
  cardsMastered: number;
  cardsRelearning: number;
}

export interface V2SessionSummary {
  sessionId: string;
  deckId: string | null;
  cardsReviewed: number;
  totalTimeSeconds: number;
  avgTimePerCard: number;
  ratingBreakdown: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
  newStarted: number;
  cardsMastered: number;
}

const DEFAULT_SESSION_STATS: V2SessionStats = {
  cardsReviewed: 0,
  againCount: 0,
  hardCount: 0,
  goodCount: 0,
  easyCount: 0,
  newStarted: 0,
  cardsMastered: 0,
  cardsRelearning: 0,
};

interface V2PracticeState {
  // Session data
  queue: V2StudyQueueCard[];
  currentIndex: number;
  isFlipped: boolean;
  sessionId: string | null;
  deckId: string | null;
  cardType: CardRecordType | null;
  sessionStats: V2SessionStats;
  isLoading: boolean;
  error: string | null;
  sessionSummary: V2SessionSummary | null;

  // Timing
  cardStartTime: number | null;
  sessionStartTime: number | null;

  // Internal tracking: pending reviews not yet acknowledged by backend
  _pendingReviews: number;

  // Actions
  startSession: (deckId: string | null, cardType?: CardRecordType) => Promise<void>;
  rateCard: (rating: 1 | 2 | 3 | 4) => void;
  flipCard: () => void;
  endSession: () => void;
  resetSession: () => void;
  clearError: () => void;
  clearSessionSummary: () => void;
}

// ============================================
// Store
// ============================================

export const useV2PracticeStore = create<V2PracticeState>()(
  devtools(
    (set, get) => ({
      // Initial state
      queue: [],
      currentIndex: 0,
      isFlipped: false,
      sessionId: null,
      deckId: null,
      cardType: null,
      sessionStats: { ...DEFAULT_SESSION_STATS },
      isLoading: false,
      error: null,
      sessionSummary: null,
      cardStartTime: null,
      sessionStartTime: null,
      _pendingReviews: 0,

      /**
       * Start a new V2 practice session.
       *
       * For cardType='meaning': fetches with no card_type filter (limit=50),
       * then filters client-side to cards where card_type starts with 'meaning_'.
       */
      startSession: async (deckId: string | null, cardType?: CardRecordType) => {
        set({ isLoading: true, error: null });

        try {
          const { user } = useAuthStore.getState();
          if (!user) {
            throw new Error('You must be logged in to start a practice session');
          }

          let queueData: V2StudyQueue;

          if (cardType === ('meaning' as string)) {
            // Meaning mode: fetch broad, filter client-side
            queueData = await studyAPI.getV2Queue({
              deck_id: deckId ?? undefined,
              limit: 50,
              include_new: true,
              new_cards_limit: 10,
            });
            queueData = {
              ...queueData,
              cards: queueData.cards.filter((c) => c.card_type.startsWith('meaning_')),
            };
          } else {
            queueData = await studyAPI.getV2Queue({
              deck_id: deckId ?? undefined,
              card_type: cardType,
              limit: 20,
              include_new: true,
              new_cards_limit: 10,
            });
          }

          const now = Date.now();
          set({
            queue: queueData.cards,
            currentIndex: 0,
            isFlipped: false,
            sessionId: generateSessionId(),
            deckId,
            cardType: cardType ?? null,
            sessionStats: { ...DEFAULT_SESSION_STATS },
            isLoading: false,
            error: null,
            sessionSummary: null,
            cardStartTime: now,
            sessionStartTime: now,
            _pendingReviews: 0,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to start practice session.';
          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },

      /**
       * Flip the current card to show the answer.
       */
      flipCard: () => {
        set({ isFlipped: true });
      },

      /**
       * Rate the current card and optimistically advance to the next.
       *
       * Fires submitV2 in the background. On success, accumulates stats.
       * On failure, sets error without reverting the optimistic advance.
       * When the last card is rated and all background submissions return,
       * computes V2SessionSummary.
       */
      rateCard: (rating: 1 | 2 | 3 | 4) => {
        const state = get();
        const {
          queue,
          currentIndex,
          cardStartTime,
          sessionId,
          deckId,
          sessionStartTime,
          _pendingReviews,
        } = state;

        const card = queue[currentIndex];
        if (!card) return;

        const quality = mapPracticeRatingToQuality(rating);
        const timeTaken = cardStartTime
          ? Math.min(Math.floor((Date.now() - cardStartTime) / 1000), MAX_ANSWER_TIME_SECONDS)
          : 0;

        const nextIndex = currentIndex + 1;
        const isLastCard = nextIndex >= queue.length;
        const now = Date.now();

        // Optimistic advance
        set({
          currentIndex: nextIndex,
          isFlipped: false,
          cardStartTime: isLastCard ? null : now,
          _pendingReviews: _pendingReviews + 1,
        });

        // Background submission
        reviewAPI
          .submitV2({
            card_record_id: card.card_record_id,
            quality,
            time_taken: timeTaken,
          })
          .then((result: V2ReviewResult) => {
            const s = get();
            const newPending = s._pendingReviews - 1;

            // Accumulate stats from result
            const wasNew = result.previous_status === 'new';
            const isMastered =
              result.new_status === 'mastered' && result.previous_status !== 'mastered';
            const isRelearning =
              STATUS_ORDER[result.new_status] < STATUS_ORDER[result.previous_status];

            const updatedStats: V2SessionStats = {
              cardsReviewed: s.sessionStats.cardsReviewed + 1,
              againCount: s.sessionStats.againCount + (rating === 1 ? 1 : 0),
              hardCount: s.sessionStats.hardCount + (rating === 2 ? 1 : 0),
              goodCount: s.sessionStats.goodCount + (rating === 3 ? 1 : 0),
              easyCount: s.sessionStats.easyCount + (rating === 4 ? 1 : 0),
              newStarted: s.sessionStats.newStarted + (wasNew ? 1 : 0),
              cardsMastered: s.sessionStats.cardsMastered + (isMastered ? 1 : 0),
              cardsRelearning: s.sessionStats.cardsRelearning + (isRelearning ? 1 : 0),
            };

            const isSessionComplete = isLastCard && newPending === 0;

            if (isSessionComplete) {
              const totalTimeSeconds = sessionStartTime
                ? Math.round((Date.now() - sessionStartTime) / 1000)
                : 0;
              const totalCards = updatedStats.cardsReviewed;
              const avgTimePerCard = totalCards > 0 ? Math.round(totalTimeSeconds / totalCards) : 0;

              const summary: V2SessionSummary = {
                sessionId: sessionId ?? '',
                deckId,
                cardsReviewed: updatedStats.cardsReviewed,
                totalTimeSeconds,
                avgTimePerCard,
                ratingBreakdown: {
                  again: updatedStats.againCount,
                  hard: updatedStats.hardCount,
                  good: updatedStats.goodCount,
                  easy: updatedStats.easyCount,
                },
                newStarted: updatedStats.newStarted,
                cardsMastered: updatedStats.cardsMastered,
              };

              set({
                sessionStats: updatedStats,
                _pendingReviews: newPending,
                sessionSummary: summary,
              });
            } else {
              set({
                sessionStats: updatedStats,
                _pendingReviews: newPending,
              });
            }
          })
          .catch((error: unknown) => {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to submit review.';
            const s = get();
            set({
              error: errorMessage,
              _pendingReviews: s._pendingReviews - 1,
            });
          });
      },

      /**
       * End the session immediately (clears session state, no summary).
       */
      endSession: () => {
        set({
          queue: [],
          currentIndex: 0,
          isFlipped: false,
          sessionId: null,
          deckId: null,
          cardType: null,
          sessionStats: { ...DEFAULT_SESSION_STATS },
          isLoading: false,
          error: null,
          cardStartTime: null,
          sessionStartTime: null,
          _pendingReviews: 0,
        });
      },

      /**
       * Reset all session state including session summary.
       */
      resetSession: () => {
        set({
          queue: [],
          currentIndex: 0,
          isFlipped: false,
          sessionId: null,
          deckId: null,
          cardType: null,
          sessionStats: { ...DEFAULT_SESSION_STATS },
          isLoading: false,
          error: null,
          sessionSummary: null,
          cardStartTime: null,
          sessionStartTime: null,
          _pendingReviews: 0,
        });
      },

      /**
       * Clear current error message.
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * Clear session summary from state.
       */
      clearSessionSummary: () => {
        set({ sessionSummary: null });
      },
    }),
    { name: 'v2PracticeStore' }
  )
);
