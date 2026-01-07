// src/stores/deckStore.ts

/**
 * Deck State Management Store
 *
 * Uses Zustand for state management with real backend API integration.
 * Progress is managed server-side via SM-2 algorithm.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { DeckType } from '@/components/decks/DeckTypeFilter';
import { reportAPIError } from '@/lib/errorReporting';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CultureDeckResponse } from '@/services/cultureDeckAPI';
import { deckAPI } from '@/services/deckAPI';
import type { DeckDetailResponse, DeckResponse } from '@/services/deckAPI';
import { progressAPI } from '@/services/progressAPI';
import type { DeckProgressSummary } from '@/services/progressAPI';
import { studyAPI } from '@/services/studyAPI';
import { useAuthStore } from '@/stores/authStore';
import type { Deck, DeckFilters, DeckProgress } from '@/types/deck';

/**
 * Extended filter state including deck type
 */
export interface DeckStoreFilters extends DeckFilters {
  deckType: DeckType;
}

/**
 * Default filter state
 * Resets on each session to prevent stale filter preferences
 */
const DEFAULT_FILTERS: DeckStoreFilters = {
  search: '', // Empty search = show all
  levels: [], // Empty = show all levels (A1, A2, B1, B2)
  categories: [], // Empty = show all categories
  status: [], // Empty = show all statuses (not-started, in-progress, completed)
  showPremiumOnly: false, // Default to showing both free and premium decks
  deckType: 'all', // Empty = show all deck types (vocabulary, culture)
};

/**
 * Transform backend deck response to frontend Deck type
 */
const transformDeckResponse = (deck: DeckResponse, progressData?: DeckProgressSummary): Deck => {
  // Determine status from progress data
  let status: 'not-started' | 'in-progress' | 'completed' = 'not-started';
  if (progressData) {
    if (progressData.completion_percentage >= 100) {
      status = 'completed';
    } else if (progressData.cards_studied > 0) {
      status = 'in-progress';
    }
  }

  // Get total cards from progress data (more reliable) or deck response
  const totalCards = progressData?.total_cards ?? deck.card_count ?? 0;

  // Build progress object matching DeckProgress interface
  const progress: DeckProgress | undefined = progressData
    ? {
        deckId: deck.id,
        status,
        cardsTotal: progressData.total_cards,
        cardsNew: progressData.total_cards - progressData.cards_studied,
        cardsLearning: progressData.cards_studied - progressData.cards_mastered,
        cardsReview: progressData.cards_due,
        cardsMastered: progressData.cards_mastered,
        dueToday: progressData.cards_due,
        streak: 0, // Not available at deck level
        lastStudied: progressData.last_studied_at
          ? new Date(progressData.last_studied_at)
          : undefined,
        totalTimeSpent: progressData.estimated_review_time_minutes ?? 0,
        accuracy: progressData.mastery_percentage ?? 0,
      }
    : undefined;

  return {
    id: deck.id,
    title: deck.name,
    titleGreek: deck.name, // Use name as Greek title (backend stores Greek names)
    description: deck.description || '',
    level: deck.level.toUpperCase() as 'A1' | 'A2' | 'B1' | 'B2',
    category: 'vocabulary', // Default category - backend doesn't have categories
    cardCount: totalCards,
    estimatedTime: deck.estimated_time_minutes ?? 10,
    isPremium: false, // Backend doesn't have premium concept yet
    tags: deck.tags || [],
    thumbnail: `/images/decks/${deck.level.toLowerCase()}.jpg`,
    createdBy: 'Learn Greek Easy', // Default author
    createdAt: new Date(deck.created_at),
    updatedAt: new Date(deck.updated_at),
    progress,
  };
};

/**
 * Transform detailed deck response with cards
 */
const transformDeckDetailResponse = (
  deck: DeckDetailResponse,
  progressData?: DeckProgressSummary
): Deck => {
  const baseDeck = transformDeckResponse(deck, progressData);

  // Add cards if available
  if (deck.cards) {
    baseDeck.cards = deck.cards.map((card) => ({
      id: card.id,
      deckId: deck.id,
      front: card.greek_word,
      back: card.english_translation,
      pronunciation: card.pronunciation || '',
      example: card.example_sentence || '',
      exampleTranslation: card.example_translation || '',
      notes: card.notes || '',
      difficulty: card.difficulty as 'easy' | 'medium' | 'hard',
      createdAt: new Date(card.created_at),
      updatedAt: new Date(card.updated_at),
    }));
  }

  return baseDeck;
};

/**
 * Transform culture deck response to frontend Deck type
 */
const transformCultureDeckResponse = (deck: CultureDeckResponse): Deck => {
  // Determine status from progress data
  let status: 'not-started' | 'in-progress' | 'completed' = 'not-started';
  if (deck.progress) {
    if (deck.progress.questions_mastered >= deck.progress.questions_total) {
      status = 'completed';
    } else if (deck.progress.questions_mastered > 0 || deck.progress.questions_learning > 0) {
      status = 'in-progress';
    }
  }

  // Get total questions from progress data or deck response
  const totalCards = deck.progress?.questions_total ?? deck.question_count ?? 0;

  // Build progress object matching DeckProgress interface
  const progress: DeckProgress | undefined = deck.progress
    ? {
        deckId: deck.id,
        status,
        cardsTotal: deck.progress.questions_total,
        cardsNew: deck.progress.questions_new,
        cardsLearning: deck.progress.questions_learning,
        cardsReview: 0, // Culture decks don't have review concept yet
        cardsMastered: deck.progress.questions_mastered,
        dueToday: 0, // Culture decks don't have spaced repetition yet
        streak: 0,
        lastStudied: undefined,
        totalTimeSpent: 0,
        accuracy:
          deck.progress.questions_total > 0
            ? Math.round((deck.progress.questions_mastered / deck.progress.questions_total) * 100)
            : 0,
      }
    : undefined;

  return {
    id: deck.id,
    title: deck.name.en,
    titleGreek: deck.name.el,
    description: deck.description.en,
    level: 'A1', // Culture decks don't have CEFR levels
    category: 'culture', // KEY: Set category to 'culture'
    cardCount: totalCards,
    estimatedTime: Math.ceil(totalCards * 0.5), // Estimate 30 seconds per question
    isPremium: false,
    tags: [deck.category], // Use culture category as tag (history, geography, etc.)
    thumbnail: `/images/culture/${deck.category}.jpg`,
    createdBy: 'Learn Greek Easy',
    createdAt: new Date(),
    updatedAt: new Date(),
    progress,
  };
};

/**
 * Deck Store State Interface
 */
interface DeckState {
  /** All available decks (fetched from API) */
  decks: Deck[];

  /** Total number of decks before filtering (for display purposes) */
  totalDecks: number;

  /** Currently selected deck for detail view */
  selectedDeck: Deck | null;

  /** Active filter settings */
  filters: DeckStoreFilters;

  /** Loading state for async operations */
  isLoading: boolean;

  /** Error message for user display (null = no error) */
  error: string | null;

  /** Fetch all decks from API with current filters applied */
  fetchDecks: () => Promise<void>;

  /** Select a deck by ID and fetch its full details */
  selectDeck: (deckId: string) => Promise<void>;

  /** Clear the currently selected deck */
  clearSelection: () => void;

  /** Update filter settings (partial update) */
  setFilters: (filters: Partial<DeckStoreFilters>) => void;

  /** Reset all filters to default state */
  clearFilters: () => void;

  /** Initialize deck for learning (create initial progress) */
  startLearning: (deckId: string) => Promise<void>;

  /** Clear current error message */
  clearError: () => void;
}

/**
 * Deck store hook for components
 */
export const useDeckStore = create<DeckState>()(
  devtools(
    (set, get) => ({
      // Initial state
      decks: [],
      totalDecks: 0,
      selectedDeck: null,
      filters: DEFAULT_FILTERS,
      isLoading: false,
      error: null,

      /**
       * Fetch all decks with current filters
       */
      fetchDecks: async () => {
        const { filters } = get();

        set({ isLoading: true, error: null });

        try {
          // Build API params from filters
          const params: {
            page?: number;
            page_size?: number;
            level?: string;
            search?: string;
          } = {
            page: 1,
            page_size: 50,
          };

          // Add level filter if specified
          if (filters.levels.length === 1) {
            params.level = filters.levels[0];
          }

          // Add search filter
          if (filters.search) {
            params.search = filters.search;
          }

          // Fetch vocabulary decks, culture decks, and progress in parallel
          const [deckResponse, cultureResponse, progressResponse] = await Promise.all([
            deckAPI.getList(params),
            cultureDeckAPI.getList().catch(() => ({ decks: [], total: 0 })), // Graceful fallback if culture API fails
            progressAPI.getDeckProgressList({ page: 1, page_size: 50 }),
          ]);

          // Create progress lookup map
          const progressMap = new Map<string, DeckProgressSummary>();
          for (const progress of progressResponse.decks) {
            progressMap.set(progress.deck_id, progress);
          }

          // Transform vocabulary decks with progress
          const vocabDecks = deckResponse.decks.map((deck) =>
            transformDeckResponse(deck, progressMap.get(deck.id))
          );

          // Transform culture decks (they have their own progress structure)
          const cultureDecks = cultureResponse.decks.map((deck) =>
            transformCultureDeckResponse(deck)
          );

          // Merge both deck types
          let decks = [...vocabDecks, ...cultureDecks];

          // Store total count before filtering for display purposes
          const totalDecks = decks.length;

          // Apply client-side filters for multiple levels
          if (filters.levels.length > 1) {
            decks = decks.filter((deck) => filters.levels.includes(deck.level));
          }

          // Apply status filter client-side
          if (filters.status.length > 0) {
            decks = decks.filter((deck) =>
              filters.status.includes(deck.progress?.status ?? 'not-started')
            );
          }

          // Apply deck type filter client-side
          if (filters.deckType !== 'all') {
            decks = decks.filter((deck) => {
              if (filters.deckType === 'culture') {
                return deck.category === 'culture';
              }
              // vocabulary - show all non-culture decks
              return deck.category !== 'culture';
            });
          }

          set({
            decks,
            totalDecks,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to load decks. Please try again.';

          set({
            isLoading: false,
            error: errorMessage,
            decks: [],
            totalDecks: 0,
          });

          throw error;
        }
      },

      /**
       * Select a specific deck by ID
       */
      selectDeck: async (deckId: string) => {
        set({ isLoading: true, error: null });

        try {
          // Fetch deck details and progress in parallel
          const [deckResponse, progressResponse] = await Promise.all([
            deckAPI.getById(deckId),
            progressAPI.getDeckProgressDetail(deckId).catch(() => null),
          ]);

          // Transform progress response to summary format if available
          let progressSummary: DeckProgressSummary | undefined;
          if (progressResponse) {
            progressSummary = {
              deck_id: progressResponse.deck_id,
              deck_name: progressResponse.deck_name,
              deck_level: progressResponse.deck_level,
              total_cards: progressResponse.progress.total_cards,
              cards_studied: progressResponse.progress.cards_studied,
              cards_mastered: progressResponse.progress.cards_mastered,
              cards_due: progressResponse.progress.cards_due,
              mastery_percentage: progressResponse.progress.mastery_percentage,
              completion_percentage: progressResponse.progress.completion_percentage,
              last_studied_at: progressResponse.timeline.last_studied_at,
              average_easiness_factor: progressResponse.statistics.average_easiness_factor,
              estimated_review_time_minutes: Math.round(
                progressResponse.statistics.total_study_time_seconds / 60
              ),
            };
          }

          const deck = transformDeckDetailResponse(deckResponse, progressSummary);

          set({
            selectedDeck: deck,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to load deck details. Please try again.';

          set({
            isLoading: false,
            error: errorMessage,
            selectedDeck: null,
          });

          throw error;
        }
      },

      /**
       * Clear the currently selected deck
       */
      clearSelection: () => {
        set({ selectedDeck: null });
      },

      /**
       * Update filters and automatically re-fetch decks
       */
      setFilters: (newFilters: Partial<DeckStoreFilters>) => {
        const { filters, fetchDecks } = get();

        // Merge new filters with existing
        let updatedFilters = {
          ...filters,
          ...newFilters,
        };

        // Clear level filters when switching to culture deck type
        // Culture decks don't have CEFR levels (A1, A2, B1, B2)
        if (newFilters.deckType === 'culture') {
          updatedFilters = {
            ...updatedFilters,
            levels: [],
          };
        }

        set({ filters: updatedFilters });

        // Automatically re-fetch with new filters
        fetchDecks().catch((error) => {
          reportAPIError(error, { operation: 'fetchDecksAfterFilterChange', endpoint: '/decks' });
        });
      },

      /**
       * Reset all filters to defaults
       */
      clearFilters: () => {
        const { fetchDecks } = get();

        set({ filters: DEFAULT_FILTERS });

        // Re-fetch with default filters
        fetchDecks().catch((error) => {
          reportAPIError(error, { operation: 'fetchDecksAfterClearFilters', endpoint: '/decks' });
        });
      },

      /**
       * Start learning a deck
       * Initializes cards for study in the backend
       */
      startLearning: async (deckId: string) => {
        set({ isLoading: true, error: null });

        try {
          // Get deck to check premium status
          const { selectedDeck, decks } = get();
          const deck =
            selectedDeck?.id === deckId ? selectedDeck : decks.find((d) => d.id === deckId);

          if (!deck) {
            throw new Error('Deck not found');
          }

          // Check premium access
          const { user } = useAuthStore.getState();
          const isPremiumLocked = deck.isPremium && user?.role === 'free';

          if (isPremiumLocked) {
            throw new Error(
              'This is a premium deck. Please upgrade your account to access premium content.'
            );
          }

          // Initialize all cards in the deck for study in the backend
          // This creates card_statistics entries for the user
          await studyAPI.initializeDeck(deckId);

          set({ isLoading: false, error: null });

          // Re-fetch decks to update progress
          await get().fetchDecks();

          // Re-fetch selected deck if needed
          if (selectedDeck?.id === deckId) {
            await get().selectDeck(deckId);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to start learning. Please try again.';

          set({
            isLoading: false,
            error: errorMessage,
          });

          throw error;
        }
      },

      /**
       * Clear current error message
       */
      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'deckStore' }
  )
);
