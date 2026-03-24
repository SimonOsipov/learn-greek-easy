// src/stores/deckStore.ts

/**
 * Deck State Management Store
 *
 * Uses Zustand for state management with real backend API integration.
 * Progress is managed server-side via SM-2 algorithm.
 *
 * Caching strategy:
 * - Vocabulary decks: refetched when server-side params (search, single level) change
 * - Culture decks: fetched once per page session, cached in module scope
 * - Progress data: fetched once per page session, cached in module scope
 * - Client-side filters (status, deckType, multi-level): applied locally without API calls
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { DeckType } from '@/components/decks/DeckFilters';
import { reportAPIError } from '@/lib/errorReporting';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CultureDeckResponse } from '@/services/cultureDeckAPI';
import { deckAPI } from '@/services/deckAPI';
import type { DeckDetailResponse, DeckLevel, DeckResponse } from '@/services/deckAPI';
import { progressAPI } from '@/services/progressAPI';
import type { DeckProgressSummary } from '@/services/progressAPI';
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
  deckType: 'all', // Empty = show all deck types (vocabulary, culture)
};

// ---------------------------------------------------------------------------
// Module-level caches for culture decks and progress
// Populated on first fetchDecks(), reused on filter-only changes
// Invalidated when fetchDecks() is called again (e.g., page re-mount)
// ---------------------------------------------------------------------------
let _cachedCultureDecks: Deck[] | null = null;
let _cachedProgressMap: Map<string, DeckProgressSummary> | null = null;

/**
 * Compute effective API params from filters.
 * Only search and single-level are sent to the backend.
 */
function getEffectiveApiParams(filters: DeckStoreFilters) {
  return {
    level: filters.levels.length === 1 ? filters.levels[0] : undefined,
    search: filters.search || undefined,
  };
}

/**
 * Apply client-side filters to the raw (unfiltered) deck list.
 */
function filterDecks(rawDecks: Deck[], filters: DeckStoreFilters): Deck[] {
  let decks = rawDecks;

  // Multiple levels — filter client-side (backend only supports single level)
  if (filters.levels.length > 1) {
    decks = decks.filter((deck) => filters.levels.includes(deck.level));
  }

  // Status filter — always client-side
  if (filters.status.length > 0) {
    decks = decks.filter((deck) => filters.status.includes(deck.progress?.status ?? 'not-started'));
  }

  // Deck type filter — always client-side
  if (filters.deckType !== 'all') {
    decks = decks.filter((deck) => {
      if (filters.deckType === 'culture') {
        return deck.category === 'culture';
      }
      // vocabulary — show all non-culture decks
      return deck.category !== 'culture';
    });
  }

  return decks;
}

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
    isPremium: deck.is_premium ?? false,
    tags: deck.tags || [],
    thumbnail: `/images/decks/${deck.level.toLowerCase()}.jpg`,
    coverImageUrl: deck.cover_image_url ?? undefined,
    createdBy: 'Greeklish', // Default author
    createdAt: new Date(deck.created_at),
    updatedAt: new Date(deck.updated_at),
    progress,
    nameEn: deck.name_en,
    nameRu: deck.name_ru,
    descriptionEn: deck.description_en,
    descriptionRu: deck.description_ru,
  };
};

/**
 * Transform detailed deck response
 * Note: Cards are fetched separately via studyAPI, not included in deck detail
 */
const transformDeckDetailResponse = (
  deck: DeckDetailResponse,
  progressData?: DeckProgressSummary
): Deck => {
  return transformDeckResponse(deck, progressData);
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
    title: deck.name,
    titleGreek: deck.name,
    description: deck.description || '',
    level: 'A1', // Culture decks don't have CEFR levels
    category: 'culture', // KEY: Set category to 'culture'
    cardCount: totalCards,
    estimatedTime: Math.ceil(totalCards * 0.5), // Estimate 30 seconds per question
    isPremium: deck.is_premium ?? false,
    tags: [deck.category], // Use culture category as tag (history, geography, etc.)
    thumbnail: `/images/culture/${deck.category}.jpg`,
    coverImageUrl: deck.cover_image_url ?? undefined,
    createdBy: 'Greeklish',
    createdAt: new Date(),
    updatedAt: new Date(),
    progress,
    nameEn: deck.name_en,
    nameRu: deck.name_ru,
    descriptionEn: deck.description_en,
    descriptionRu: deck.description_ru,
  };
};

/**
 * Deck Store State Interface
 */
interface DeckState {
  /** Filtered decks (for display) */
  decks: Deck[];

  /** All decks before client-side filtering (internal) */
  rawDecks: Deck[];

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

  /** Fetch all decks from API (full refresh — vocab + culture + progress) */
  fetchDecks: () => Promise<void>;

  /** Re-apply client-side filters to rawDecks without any API calls */
  applyFilters: () => void;

  /** Select a deck by ID and fetch its full details */
  selectDeck: (deckId: string) => Promise<void>;

  /** Clear the currently selected deck */
  clearSelection: () => void;

  /** Update filter settings (partial update) — smart about when to refetch */
  setFilters: (filters: Partial<DeckStoreFilters>) => void;

  /** Reset all filters to default state */
  clearFilters: () => void;

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
      rawDecks: [],
      totalDecks: 0,
      selectedDeck: null,
      filters: DEFAULT_FILTERS,
      isLoading: false,
      error: null,

      /**
       * Full fetch: vocabulary decks + culture decks + progress.
       * Always refreshes all caches. Called on page mount and clearFilters.
       */
      fetchDecks: async () => {
        const { filters } = get();

        set({ isLoading: true, error: null });

        try {
          // Build API params from filters
          const params: {
            page?: number;
            page_size?: number;
            level?: DeckLevel;
            search?: string;
          } = {
            page: 1,
            page_size: 50,
          };

          // Add level filter if specified
          if (filters.levels.length === 1) {
            params.level = filters.levels[0] as DeckLevel;
          }

          // Add search filter
          if (filters.search) {
            params.search = filters.search;
          }

          // Fetch vocabulary decks, culture decks, and progress in parallel
          const [deckResponse, cultureResponse, progressResponse] = await Promise.all([
            deckAPI.getList(params),
            cultureDeckAPI.getList().catch(() => ({ decks: [], total: 0 })),
            progressAPI
              .getDeckProgressList({ page: 1, page_size: 50 })
              .catch(() => ({ decks: [] })),
          ]);

          // Update progress cache
          _cachedProgressMap = new Map<string, DeckProgressSummary>();
          for (const progress of progressResponse.decks) {
            _cachedProgressMap.set(progress.deck_id, progress);
          }

          // Transform vocabulary decks with progress
          const vocabDecks = deckResponse.decks.map((deck) =>
            transformDeckResponse(deck, _cachedProgressMap!.get(deck.id))
          );

          // Transform and cache culture decks
          _cachedCultureDecks = cultureResponse.decks.map((deck) =>
            transformCultureDeckResponse(deck)
          );

          // Merge both deck types
          const rawDecks = [...vocabDecks, ..._cachedCultureDecks];

          // Apply client-side filters
          const decks = filterDecks(rawDecks, filters);

          set({
            rawDecks,
            decks,
            totalDecks: rawDecks.length,
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
            rawDecks: [],
            totalDecks: 0,
          });

          throw error;
        }
      },

      /**
       * Re-apply client-side filters to rawDecks. No API calls.
       */
      applyFilters: () => {
        const { rawDecks, filters } = get();
        const decks = filterDecks(rawDecks, filters);
        set({ decks, totalDecks: rawDecks.length });
      },

      /**
       * Select a specific deck by ID
       */
      selectDeck: async (deckId: string) => {
        // Validate deckId to prevent API calls with invalid IDs
        if (!deckId || deckId === 'undefined') {
          throw new Error('Invalid deck ID');
        }

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
              deck_type: 'vocabulary', // Decks from deckAPI are vocabulary decks
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
       * Update filters — only refetches when server-side params change.
       *
       * Server-side params: search, single level (sent to vocab deck API)
       * Client-side params: status, deckType, multi-level (filtered locally)
       */
      setFilters: (newFilters: Partial<DeckStoreFilters>) => {
        const { filters: prevFilters, fetchDecks, applyFilters } = get();

        // Merge new filters with existing
        let updatedFilters = {
          ...prevFilters,
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

        // Determine if server-side API params changed
        const prevParams = getEffectiveApiParams(prevFilters);
        const newParams = getEffectiveApiParams(updatedFilters);
        const serverParamsChanged =
          prevParams.search !== newParams.search || prevParams.level !== newParams.level;

        if (serverParamsChanged) {
          // Server-side params changed — need to refetch vocab decks
          if (_cachedCultureDecks && _cachedProgressMap) {
            // Use cached culture + progress, only refetch vocab decks
            _refetchVocabOnly(get, set, updatedFilters).catch((error) => {
              reportAPIError(error, {
                operation: 'refetchVocabAfterFilterChange',
                endpoint: '/decks',
              });
            });
          } else {
            // No cache yet — full fetch
            fetchDecks().catch((error) => {
              reportAPIError(error, {
                operation: 'fetchDecksAfterFilterChange',
                endpoint: '/decks',
              });
            });
          }
        } else {
          // Only client-side filters changed — re-filter locally, no API calls
          applyFilters();
        }
      },

      /**
       * Reset all filters to defaults
       */
      clearFilters: () => {
        const { fetchDecks } = get();

        set({ filters: DEFAULT_FILTERS });

        // Re-fetch with default filters (refreshes all caches)
        fetchDecks().catch((error) => {
          reportAPIError(error, { operation: 'fetchDecksAfterClearFilters', endpoint: '/decks' });
        });
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

/**
 * Refetch only vocabulary decks (server-side params changed),
 * using cached culture decks and progress data.
 */
async function _refetchVocabOnly(
  get: () => DeckState,
  set: (state: Partial<DeckState>) => void,
  filters: DeckStoreFilters
): Promise<void> {
  set({ isLoading: true, error: null });

  try {
    const params: {
      page?: number;
      page_size?: number;
      level?: DeckLevel;
      search?: string;
    } = {
      page: 1,
      page_size: 50,
    };

    if (filters.levels.length === 1) {
      params.level = filters.levels[0] as DeckLevel;
    }

    if (filters.search) {
      params.search = filters.search;
    }

    const deckResponse = await deckAPI.getList(params);

    // Transform vocab decks with cached progress
    const vocabDecks = deckResponse.decks.map((deck) =>
      transformDeckResponse(deck, _cachedProgressMap!.get(deck.id))
    );

    // Merge with cached culture decks
    const rawDecks = [...vocabDecks, ..._cachedCultureDecks!];

    // Apply client-side filters
    const decks = filterDecks(rawDecks, filters);

    set({
      rawDecks,
      decks,
      totalDecks: rawDecks.length,
      isLoading: false,
      error: null,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to load decks. Please try again.';

    set({
      isLoading: false,
      error: errorMessage,
    });

    throw error;
  }
}
