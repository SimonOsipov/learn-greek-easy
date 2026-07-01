// src/stores/deckStore.ts

/**
 * Deck State Management Store
 *
 * Uses Zustand for state management with real backend API integration.
 * Progress is managed server-side via SM-2 algorithm.
 *
 * Caching strategy:
 * - Vocabulary decks: refetched when server-side params (search, single level) change
 * - Progress data: fetched once per page session, cached in module scope
 * - Client-side filters (status, multi-level): applied locally without API calls
 */

import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { reportAPIError } from '@/lib/errorReporting';
import { deckAPI } from '@/services/deckAPI';
import type { DeckDetailResponse, DeckLevel, DeckResponse } from '@/services/deckAPI';
import { progressAPI } from '@/services/progressAPI';
import type { DeckProgressDetailResponse, DeckProgressSummary } from '@/services/progressAPI';
import type { Deck, DeckFilters, DeckProgress } from '@/types/deck';

import type { PersistOptions } from 'zustand/middleware';

/**
 * Filter state for the deck store
 */
export type DeckStoreFilters = DeckFilters;

/**
 * Default filter state
 * Resets on each session to prevent stale filter preferences
 */
const DEFAULT_FILTERS: DeckStoreFilters = {
  search: '', // Empty search = show all
  levels: [], // Empty = show all levels (A1, A2, B1, B2)
  categories: [], // Empty = show all categories
  status: [], // Empty = show all statuses (not-started, in-progress, completed)
};

// ---------------------------------------------------------------------------
// Module-level caches for progress
// Populated on first fetchDecks(), reused on filter-only changes
// Invalidated when fetchDecks() is called again (e.g., page re-mount)
// ---------------------------------------------------------------------------
let _cachedProgressMap: Map<string, DeckProgressSummary> | null = null;

// ---------------------------------------------------------------------------
// Deck-cover cache persistence (deck-covers-always-available)
//
// The deck list carries each deck's coverImageUrl. Persisting a slim copy to
// localStorage lets covers paint instantly on any page (deck-detail hero
// sibling stack, dashboard feed) without first visiting /decks. Presigned cover
// URLs are 30-day-valid and byte-stable, so a persisted URL keeps working and
// hits the browser HTTP cache. ensureDecksFresh() then revalidates once per
// session (stale-while-revalidate).
// ---------------------------------------------------------------------------

/** localStorage key + schema version for the persisted deck-cover cache. */
const DECK_COVERS_PERSIST_KEY = 'greeklish-deck-covers-v1';

/** A fetched deck list stays "fresh" this long — skips the background revalidate. */
const DECKS_FRESH_TTL_MS = 5 * 60 * 1000;

/** Only rawDecks is persisted (cover + identity fields; progress is stripped). */
type PersistedDeckState = { rawDecks: Deck[] };

/** Coalesces concurrent ensureDecksFresh() callers onto a single network fetch. */
let _listFetchInFlight: Promise<void> | null = null;

/**
 * Slim a Deck for persistence: keep cover + identity fields, drop the volatile
 * `progress` object. Progress is user- and time-specific and always refreshed
 * by the background revalidate, so persisting it would flash stale counts.
 */
function toPersistedDeck(deck: Deck): Deck {
  const copy = { ...deck };
  delete copy.progress;
  return copy;
}

/** Revive Date fields that JSON serialised to ISO strings during persistence. */
function reviveDeckDates(deck: Deck): Deck {
  return {
    ...deck,
    createdAt: new Date(deck.createdAt),
    updatedAt: new Date(deck.updatedAt),
  };
}

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

  // Search — client-side refinement: OR-match across title, nameEn, nameRu, titleGreek.
  // This catches Greek-only substrings that the backend transliteration search may miss.
  if (filters.search) {
    const q = filters.search.toLowerCase();
    decks = decks.filter((d) =>
      [d.title, d.nameEn, d.nameRu, d.titleGreek].some((v) => v?.toLowerCase().includes(q))
    );
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

  // cardCount is the WORD-ENTRY count (one "word" per deck_word_entry), surfaced
  // as the deck's headline stat. Prefer deck.card_count; progressData.total_cards
  // is the SRS card-record count (~15 per word) and must NOT feed this field —
  // SRS counts live on the `progress` object below (cardsTotal etc.).
  const totalCards = deck.card_count ?? progressData?.total_cards ?? 0;

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
    titleGreek: deck.name_el ?? '', // Constant Greek name (raw name_el), independent of UI locale
    description: deck.description || '',
    level: deck.level.toUpperCase() as 'A1' | 'A2' | 'B1' | 'B2',
    category: 'vocabulary', // Default category - backend doesn't have categories
    cardCount: totalCards,
    estimatedTime: deck.estimated_time_minutes ?? 10,
    isPremium: deck.is_premium ?? false,
    tags: deck.tags || [],
    thumbnail: `/images/decks/${deck.level.toLowerCase()}.jpg`,
    coverImageUrl: deck.cover_image_url ?? undefined,
    coverImageVariants: deck.cover_image_variants ?? undefined,
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
  return { ...transformDeckResponse(deck, progressData), isOwned: deck.is_owned ?? false };
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

  /** Raw progress detail for the selected deck — consumed by V2DeckHeader to avoid a duplicate API call */
  selectedDeckProgressDetail: DeckProgressDetailResponse | null;

  /** Active filter settings */
  filters: DeckStoreFilters;

  /** Loading state for async operations */
  isLoading: boolean;

  /** Error message for user display (null = no error) */
  error: string | null;

  /**
   * Epoch ms of the last successful full fetch (null = not fetched this session).
   * Drives ensureDecksFresh()'s freshness gate. NOT persisted — each new session
   * revalidates once so covers stay fresh.
   */
  lastFetchedAt: number | null;

  /** Fetch all decks from API (full refresh — vocab + culture + progress) */
  fetchDecks: () => Promise<void>;

  /**
   * Warm/refresh the deck list once per session so deck covers are available on
   * any page (deck-detail hero, dashboard feed) without a prior /decks visit.
   * No-op when the in-memory list is still fresh; coalesces concurrent callers,
   * so calling it on every authenticated mount never double-fetches.
   */
  ensureDecksFresh: () => Promise<void>;

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
    persist(
      (set, get) => ({
        // Initial state
        decks: [],
        rawDecks: [],
        totalDecks: 0,
        selectedDeck: null,
        selectedDeckProgressDetail: null,
        filters: DEFAULT_FILTERS,
        isLoading: false,
        error: null,
        lastFetchedAt: null,

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

            // Fetch vocabulary decks and progress in parallel
            const [deckResponse, progressResponse] = await Promise.all([
              deckAPI.getList(params),
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

            const rawDecks = vocabDecks;

            // Apply client-side filters
            const decks = filterDecks(rawDecks, filters);

            set({
              rawDecks,
              decks,
              totalDecks: rawDecks.length,
              isLoading: false,
              error: null,
              lastFetchedAt: Date.now(),
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
         * Warm/refresh the deck list once per session (stale-while-revalidate).
         * Skips when the in-memory list is still fresh (< DECKS_FRESH_TTL_MS) and
         * coalesces concurrent callers via the module-level in-flight guard, so
         * mounting this alongside the dashboard's own fetch never double-fetches.
         */
        ensureDecksFresh: async () => {
          const { rawDecks, lastFetchedAt, fetchDecks } = get();
          const isFresh =
            rawDecks.length > 0 &&
            lastFetchedAt !== null &&
            Date.now() - lastFetchedAt < DECKS_FRESH_TTL_MS;
          if (isFresh) return;
          if (_listFetchInFlight) return _listFetchInFlight;
          _listFetchInFlight = fetchDecks().finally(() => {
            _listFetchInFlight = null;
          });
          return _listFetchInFlight;
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
              selectedDeckProgressDetail: progressResponse ?? null,
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
          set({ selectedDeck: null, selectedDeckProgressDetail: null });
        },

        /**
         * Update filters — only refetches when server-side params change.
         *
         * Server-side params: search, single level (sent to vocab deck API)
         * Client-side params: status, multi-level (filtered locally)
         */
        setFilters: (newFilters: Partial<DeckStoreFilters>) => {
          const { filters: prevFilters, fetchDecks, applyFilters } = get();

          // Merge new filters with existing
          const updatedFilters = {
            ...prevFilters,
            ...newFilters,
          };

          set({ filters: updatedFilters });

          // Determine if server-side API params changed
          const prevParams = getEffectiveApiParams(prevFilters);
          const newParams = getEffectiveApiParams(updatedFilters);
          const serverParamsChanged =
            prevParams.search !== newParams.search || prevParams.level !== newParams.level;

          if (serverParamsChanged) {
            // Server-side params changed — need to refetch vocab decks
            if (_cachedProgressMap) {
              // Use cached progress, only refetch vocab decks
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
      {
        name: DECK_COVERS_PERSIST_KEY,
        version: 1,
        storage: createJSONStorage(() => localStorage),
        // Persist ONLY the cover cache (identity + image fields). Progress and
        // transient view state (selectedDeck, isLoading, filters) are excluded.
        partialize: (state) => ({ rawDecks: state.rawDecks.map(toPersistedDeck) }),
        // Rehydrate: revive Date fields (JSON stored them as ISO strings) and
        // recompute the filtered `decks` list so covers paint instantly on any
        // page before the background revalidate runs.
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as PersistedDeckState;
          const rawDecks = (p.rawDecks ?? []).map(reviveDeckDates);
          return {
            ...current,
            rawDecks,
            decks: filterDecks(rawDecks, current.filters),
            totalDecks: rawDecks.length,
          };
        },
      } as PersistOptions<DeckState, PersistedDeckState>
    ),
    { name: 'deckStore' }
  )
);

/**
 * Refetch only vocabulary decks (server-side params changed),
 * using cached progress data.
 */
async function _refetchVocabOnly(
  _get: () => DeckState,
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

    const rawDecks = vocabDecks;

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
