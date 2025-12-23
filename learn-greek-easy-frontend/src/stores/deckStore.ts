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
 * Deck Store State Interface
 */
interface DeckState {
  /** All available decks (fetched from API) */
  decks: Deck[];

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

          // Fetch decks and progress in parallel
          const [deckResponse, progressResponse] = await Promise.all([
            deckAPI.getList(params),
            progressAPI.getDeckProgressList({ page: 1, page_size: 50 }),
          ]);

          // Create progress lookup map
          const progressMap = new Map<string, DeckProgressSummary>();
          for (const progress of progressResponse.decks) {
            progressMap.set(progress.deck_id, progress);
          }

          // Transform and merge deck data with progress
          let decks = deckResponse.decks.map((deck) =>
            transformDeckResponse(deck, progressMap.get(deck.id))
          );

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
        const updatedFilters = {
          ...filters,
          ...newFilters,
        };

        set({ filters: updatedFilters });

        // Automatically re-fetch with new filters
        fetchDecks().catch((error) => {
          console.error('Error fetching decks after filter change:', error);
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
          console.error('Error fetching decks after clearing filters:', error);
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

          // Initialize cards for study in the backend
          // This creates card_statistics entries for the user
          await studyAPI.initializeCards({
            deck_id: deckId,
          });

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
