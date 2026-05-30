// src/stores/v2PracticeStore.ts

/**
 * V2 Practice Session State Management Store
 *
 * Manages the full lifecycle of a V2 practice session:
 * - Fetching the study queue (card-record based)
 * - Optimistic card advancement on rating
 * - Background review submission with stats accumulation
 * - Session summary computation on completion
 * - Streak + per-card rating history for PRACT2-1 top bar
 *
 * Simplified V1 reviewStore.ts pattern: flat state, no crash recovery, no pause/resume.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { MAX_ANSWER_TIME_SECONDS } from '@/lib/timeFormatUtils';
import { reviewAPI } from '@/services/reviewAPI';
import type { ReviewResult } from '@/services/reviewAPI';
import { studyAPI } from '@/services/studyAPI';
import type { StudyQueue, StudyQueueCard } from '@/services/studyAPI';
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
// Exported types
// ============================================

/**
 * Per-card rating outcome bucket used for progress-bar colouring (PRACT2-1-02).
 * Exact quality→bucket mapping is finalised in PRACT2-1-07; this typing
 * establishes the shape consumed by TopBar / ProgressBar.
 */
export type RatingKey = 'forgot' | 'tough' | 'ok' | 'easy';

/**
 * Type-mode toggle: 'reveal' is the default (tap-to-flip); 'type' shows the
 * TypedInput field and runs the forgiving judge before revealing.
 * Persistence via localStorage is owned by PRACT2-1-11 — this field is
 * in-memory only.
 */
export type InputMode = 'reveal' | 'type';

/**
 * Maps a practice rating (1-4) to a RatingKey for display purposes.
 * 1 = forgot, 2 = tough, 3 = ok, 4 = easy.
 */
export function ratingToKey(rating: 1 | 2 | 3 | 4): RatingKey {
  switch (rating) {
    case 1:
      return 'forgot';
    case 2:
      return 'tough';
    case 3:
      return 'ok';
    case 4:
      return 'easy';
  }
}

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
 * Adapts a StudyQueueCard to a CardRecordResponse-compatible shape for PracticeCard
 */
export function v2QueueCardToCardRecord(card: StudyQueueCard): CardRecordResponse {
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
export function resolveV2CardAudioUrl(card: StudyQueueCard): string | null {
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

/**
 * Toast payload set from the .then(result) callback after a review submits.
 * Keyed by card_record_id so a late async response cannot attach to the wrong
 * card (the advance is optimistic / synchronous — result arrives after flip).
 */
export interface ToastPayload {
  /** The card this toast belongs to — guards against mis-attachment. */
  forCardId: string;
  /** Whole-day interval from SM-2 (ReviewResult.interval). */
  interval: number;
  /** ISO date string from ReviewResult.next_review_date. */
  nextReviewDate: string;
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
  /** The cards in the current session queue (renamed from `queue` in PRACT2-1-02). */
  cards: StudyQueueCard[];
  currentIndex: number;
  isFlipped: boolean;
  sessionId: string | null;
  deckId: string | null;
  cardType: CardRecordType | null;
  wordEntryId: string | null;
  sessionStats: V2SessionStats;
  isLoading: boolean;
  error: string | null;
  sessionSummary: V2SessionSummary | null;

  // Queue totals from the API response (PRACT2-1-02)
  totalNew: number;
  totalReview: number;

  // Streak & per-card rating history (PRACT2-1-02)
  streak: number;
  ratings: (RatingKey | null)[];

  // Rating-aware slide-out (PRACT2-1-07)
  /** Direction for the slide-out animation set on rateCard (before advance). */
  leaveDirection: 'left' | 'right' | null;

  // Toast state (PRACT2-1-07) — set in .then(result) from reviewAPI.submit
  /** Toast payload keyed by card_record_id to prevent mis-attachment. */
  toast: ToastPayload | null;

  // Type mode (PRACT2-1-08) — in-memory only; localStorage persistence is PRACT2-1-11
  /** Whether the user types an answer before flipping ('type') or taps to reveal ('reveal'). */
  inputMode: InputMode;

  // Timing
  cardStartTime: number | null;
  sessionStartTime: number | null;

  // Internal tracking: pending reviews not yet acknowledged by backend
  _pendingReviews: number;

  // Actions
  startSession: (
    deckId: string | null,
    cardType?: CardRecordType,
    wordEntryId?: string
  ) => Promise<void>;
  rateCard: (rating: 1 | 2 | 3 | 4) => void;
  flipCard: () => void;
  endSession: () => void;
  resetSession: () => void;
  clearError: () => void;
  clearSessionSummary: () => void;
  /** Clear the leave-direction after the slide-out animation completes. */
  clearLeaveDirection: () => void;
  /** Clear the toast (called when the user moves to the next card). */
  clearToast: () => void;
  /** Switch input mode (reveal ↔ type) — does NOT persist; that's PRACT2-1-11. */
  setInputMode: (mode: InputMode) => void;
}

// ============================================
// Store
// ============================================

export const useV2PracticeStore = create<V2PracticeState>()(
  devtools(
    (set, get) => ({
      // Initial state
      cards: [],
      currentIndex: 0,
      isFlipped: false,
      sessionId: null,
      deckId: null,
      cardType: null,
      wordEntryId: null,
      sessionStats: { ...DEFAULT_SESSION_STATS },
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
      inputMode: 'reveal' as InputMode,

      /**
       * Start a new V2 practice session.
       *
       * For cardType='meaning': fetches with no card_type filter (limit=50),
       * then filters client-side to cards where card_type starts with 'meaning_'.
       */
      startSession: async (
        deckId: string | null,
        cardType?: CardRecordType,
        wordEntryId?: string
      ) => {
        set({ isLoading: true, error: null });

        try {
          const { user } = useAuthStore.getState();
          if (!user) {
            throw new Error('You must be logged in to start a practice session');
          }

          let queueData: StudyQueue;

          if (cardType === ('meaning' as string)) {
            // Meaning mode: fetch broad, filter client-side
            queueData = await studyAPI.getQueue({
              deck_id: deckId ?? undefined,
              limit: 50,
              include_new: true,
              new_cards_limit: 10,
              word_entry_id: wordEntryId,
            });
            queueData = {
              ...queueData,
              cards: queueData.cards.filter(
                (c) => c.card_type.startsWith('meaning_') || c.card_type === 'sentence_translation'
              ),
            };
          } else {
            queueData = await studyAPI.getQueue({
              deck_id: deckId ?? undefined,
              card_type: cardType,
              limit: 20,
              include_new: true,
              new_cards_limit: 10,
              word_entry_id: wordEntryId,
            });
          }

          const now = Date.now();
          set({
            cards: queueData.cards,
            currentIndex: 0,
            isFlipped: false,
            sessionId: generateSessionId(),
            deckId,
            cardType: cardType ?? null,
            wordEntryId: wordEntryId ?? null,
            sessionStats: { ...DEFAULT_SESSION_STATS },
            isLoading: false,
            error: null,
            sessionSummary: null,
            cardStartTime: now,
            sessionStartTime: now,
            _pendingReviews: 0,
            // Queue totals for TopBar deck label (PRACT2-1-02)
            totalNew: queueData.total_new,
            totalReview: queueData.total_due,
            // Reset streak + ratings for new session
            streak: 0,
            ratings: new Array(queueData.cards.length).fill(null),
            leaveDirection: null,
            toast: null,
            // inputMode persists across cards — reset only on explicit setInputMode call
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
       * Fires submit in the background. On success, accumulates stats.
       * On failure, sets error without reverting the optimistic advance.
       * When the last card is rated and all background submissions return,
       * computes V2SessionSummary.
       *
       * Also updates streak and per-card ratings array (PRACT2-1-02):
       * - ok/easy → streak +1
       * - forgot  → streak reset to 0
       * - tough   → streak unchanged
       */
      rateCard: (rating: 1 | 2 | 3 | 4) => {
        const state = get();
        const {
          cards,
          currentIndex,
          cardStartTime,
          sessionId,
          deckId,
          sessionStartTime,
          _pendingReviews,
          streak,
          ratings,
        } = state;

        const card = cards[currentIndex];
        if (!card) return;

        const quality = mapPracticeRatingToQuality(rating);
        const timeTaken = cardStartTime
          ? Math.min(Math.floor((Date.now() - cardStartTime) / 1000), MAX_ANSWER_TIME_SECONDS)
          : 0;

        const nextIndex = currentIndex + 1;
        const isLastCard = nextIndex >= cards.length;
        const now = Date.now();

        // Update streak: ok/easy +1, forgot reset to 0, tough unchanged
        const ratingKey = ratingToKey(rating);
        const newStreak =
          ratingKey === 'ok' || ratingKey === 'easy'
            ? streak + 1
            : ratingKey === 'forgot'
              ? 0
              : streak; // tough: unchanged

        // Update per-card ratings array
        const newRatings = [...ratings];
        newRatings[currentIndex] = ratingKey;

        // Determine slide direction: Forgot/Tough → right (relearn); OK/Easy → left (graduate)
        const newLeaveDirection: 'left' | 'right' =
          ratingKey === 'forgot' || ratingKey === 'tough' ? 'right' : 'left';

        // Optimistic advance (includes streak + ratings update — single source of truth)
        // leaveDirection is set BEFORE the index advances so the outgoing card
        // can read it in data-leave; toast is cleared — will repopulate from .then
        set({
          currentIndex: nextIndex,
          isFlipped: false,
          cardStartTime: isLastCard ? null : now,
          _pendingReviews: _pendingReviews + 1,
          streak: newStreak,
          ratings: newRatings,
          leaveDirection: newLeaveDirection,
          toast: null,
        });

        // Background submission
        reviewAPI
          .submit({
            card_record_id: card.card_record_id,
            quality,
            time_taken: timeTaken,
          })
          .then((result: ReviewResult) => {
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

            // Populate toast — keyed by this card's ID so a late response
            // from a previous card can't clobber the current card's toast.
            // Only set if the current displayed card is still the one we just rated
            // (i.e., forCardId matches what was submitted).
            const toastPayload: ToastPayload = {
              forCardId: card.card_record_id,
              interval: result.interval,
              nextReviewDate: result.next_review_date,
            };
            set({ toast: toastPayload });

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
          cards: [],
          currentIndex: 0,
          isFlipped: false,
          sessionId: null,
          deckId: null,
          cardType: null,
          wordEntryId: null,
          sessionStats: { ...DEFAULT_SESSION_STATS },
          isLoading: false,
          error: null,
          cardStartTime: null,
          sessionStartTime: null,
          _pendingReviews: 0,
          totalNew: 0,
          totalReview: 0,
          streak: 0,
          ratings: [],
          leaveDirection: null,
          toast: null,
          inputMode: 'reveal' as InputMode,
        });
      },

      /**
       * Reset all session state including session summary.
       */
      resetSession: () => {
        set({
          cards: [],
          currentIndex: 0,
          isFlipped: false,
          sessionId: null,
          deckId: null,
          cardType: null,
          wordEntryId: null,
          sessionStats: { ...DEFAULT_SESSION_STATS },
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
          inputMode: 'reveal' as InputMode,
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

      /**
       * Clear the leave-direction (called by the slide wrapper after 320ms).
       */
      clearLeaveDirection: () => {
        set({ leaveDirection: null });
      },

      /**
       * Clear the toast (called when moving to the next card).
       */
      clearToast: () => {
        set({ toast: null });
      },

      /**
       * Switch between reveal mode and type mode.
       * Persistence is out of scope here — see PRACT2-1-11.
       */
      setInputMode: (mode: InputMode) => {
        set({ inputMode: mode });
      },
    }),
    { name: 'v2PracticeStore' }
  )
);
