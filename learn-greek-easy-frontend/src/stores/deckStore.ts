// src/stores/deckStore.ts

/**
 * Deck State Management Store
 *
 * ⚠️ TEMPORARY IMPLEMENTATION (MVP)
 *
 * This store manages deck data and progress on the frontend using:
 * - Zustand for state management
 * - localStorage for progress persistence
 * - Mock API with simulated delays
 *
 * TODO: Backend Migration Required
 * When backend is ready, refactor as follows:
 * 1. Replace mockDeckAPI with real API client
 * 2. Install TanStack Query for server state
 * 3. Move decks & progress to PostgreSQL
 * 4. Keep only UI state (filters, selectedDeckId) in Zustand
 * 5. Remove localStorage persistence for progress
 *
 * Estimated migration time: 4-6 hours
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Deck, DeckProgress, DeckFilters } from '@/types/deck';
import { mockDeckAPI } from '@/services/mockDeckAPI';
import { useAuthStore } from '@/stores/authStore';

/**
 * Default filter state
 * Resets on each session to prevent stale filter preferences
 */
const DEFAULT_FILTERS: DeckFilters = {
  search: '',              // Empty search = show all
  levels: [],              // Empty = show all levels (A1, A2, B1, B2)
  categories: [],          // Empty = show all categories
  status: [],              // Empty = show all statuses (not-started, in-progress, completed)
  showPremiumOnly: false,  // Default to showing both free and premium decks
};

/**
 * Deck Store State Interface
 */
interface DeckState {
  // ========================================
  // DATA STATE
  // TODO: Move to backend (PostgreSQL) when ready
  // ========================================

  /** All available decks (fetched from API) */
  decks: Deck[];

  /** Currently selected deck for detail view */
  selectedDeck: Deck | null;

  /** User's learning progress per deck (key: deckId)
   * TODO: Move to backend user_deck_progress table
   */
  deckProgress: Record<string, DeckProgress>;

  // ========================================
  // UI STATE
  // Keep on frontend after backend migration
  // ========================================

  /** Active filter settings */
  filters: DeckFilters;

  /** Loading state for async operations */
  isLoading: boolean;

  /** Error message for user display (null = no error) */
  error: string | null;

  // ========================================
  // ACTIONS
  // ========================================

  /**
   * Fetch all decks from API with current filters applied
   * Sets isLoading, populates decks array, handles errors
   */
  fetchDecks: () => Promise<void>;

  /**
   * Select a deck by ID and fetch its full details
   * Sets selectedDeck, handles errors
   * @param deckId - Unique deck identifier
   */
  selectDeck: (deckId: string) => Promise<void>;

  /**
   * Clear the currently selected deck
   */
  clearSelection: () => void;

  /**
   * Update filter settings (partial update)
   * Automatically triggers deck re-fetch
   * @param filters - Partial filter updates
   */
  setFilters: (filters: Partial<DeckFilters>) => void;

  /**
   * Reset all filters to default state
   */
  clearFilters: () => void;

  /**
   * Initialize deck for learning (create initial progress)
   * Checks premium access before allowing start
   * @param deckId - Deck to start learning
   */
  startLearning: (deckId: string) => Promise<void>;

  /**
   * Update user's progress for a deck
   * TODO: Replace with API call when backend ready
   * @param deckId - Deck being updated
   * @param progress - Partial progress updates
   */
  updateProgress: (deckId: string, progress: Partial<DeckProgress>) => void;

  /**
   * Simulate reviewing a single card
   * @param deckId - Deck containing the card
   * @param cardId - Card being reviewed
   * @param wasCorrect - Whether answer was correct
   */
  reviewCard: (deckId: string, cardId: string, wasCorrect: boolean) => Promise<void>;

  /**
   * Simulate a study session with multiple cards
   * @param deckId - Deck being studied
   * @param cardsReviewed - Number of cards reviewed
   * @param correctCount - Number answered correctly
   * @param sessionTimeMinutes - Time spent studying
   */
  reviewSession: (
    deckId: string,
    cardsReviewed: number,
    correctCount: number,
    sessionTimeMinutes: number
  ) => Promise<void>;

  /**
   * Mark deck as completed
   * @param deckId - Deck to complete
   */
  completeDeck: (deckId: string) => Promise<void>;

  /**
   * Reset deck progress to initial state
   * @param deckId - Deck to reset
   */
  resetProgress: (deckId: string) => Promise<void>;

  /**
   * Clear current error message
   */
  clearError: () => void;
}

/**
 * Deck store hook for components
 *
 * Usage:
 * ```tsx
 * const { decks, fetchDecks, selectDeck } = useDeckStore();
 *
 * useEffect(() => {
 *   fetchDecks();
 * }, [fetchDecks]);
 * ```
 */
export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => ({
      // ========================================
      // INITIAL STATE
      // ========================================

      decks: [],
      selectedDeck: null,
      deckProgress: {}, // Will be hydrated from localStorage on init
      filters: DEFAULT_FILTERS,
      isLoading: false,
      error: null,

      // ========================================
      // ACTIONS - DECK FETCHING
      // ========================================

      /**
       * Fetch all decks with current filters
       * TODO: Replace mockDeckAPI with real API when backend ready
       */
      fetchDecks: async () => {
        const { filters } = get();

        set({ isLoading: true, error: null });

        try {
          // TODO: Backend Migration - Replace with real API call
          // const decks = await deckAPI.getAll(filters);
          const decks = await mockDeckAPI.getAllDecks(filters);

          // Inject user's progress into decks
          // TODO: Backend Migration - Remove when backend returns joined data
          const { deckProgress } = get();
          const decksWithProgress = decks.map(deck => ({
            ...deck,
            progress: deckProgress[deck.id] || deck.progress,
          }));

          set({
            decks: decksWithProgress,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : 'Failed to load decks. Please try again.';

          set({
            isLoading: false,
            error: errorMessage,
            decks: [], // Clear decks on error
          });

          // Re-throw for component-level handling if needed
          throw error;
        }
      },

      /**
       * Select a specific deck by ID
       * TODO: Backend Migration - Replace mockDeckAPI with real API when backend ready
       */
      selectDeck: async (deckId: string) => {
        set({ isLoading: true, error: null });

        try {
          // TODO: Backend Migration - Replace with real API call
          // const deck = await deckAPI.getById(deckId);
          const deck = await mockDeckAPI.getDeckById(deckId);

          // Inject user's progress
          // TODO: Backend Migration - Remove when backend returns joined data
          const { deckProgress } = get();
          const deckWithProgress = {
            ...deck,
            progress: deckProgress[deck.id] || deck.progress,
          };

          set({
            selectedDeck: deckWithProgress,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error
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

      // ========================================
      // ACTIONS - FILTERING
      // ========================================

      /**
       * Update filters and automatically re-fetch decks
       */
      setFilters: (newFilters: Partial<DeckFilters>) => {
        const { filters, fetchDecks } = get();

        // Merge new filters with existing
        const updatedFilters = {
          ...filters,
          ...newFilters,
        };

        set({ filters: updatedFilters });

        // Automatically re-fetch with new filters
        // Don't await - let it run in background
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

      // ========================================
      // ACTIONS - LEARNING FLOW
      // ========================================

      /**
       * Start learning a deck
       * Checks premium access and initializes progress
       * TODO: Backend Migration - Replace with backend API call when ready
       */
      startLearning: async (deckId: string) => {
        set({ isLoading: true, error: null });

        try {
          // Get deck to check premium status
          // TODO: Backend Migration - Replace with real API call
          const deck = await mockDeckAPI.getDeckById(deckId);

          // Check premium access
          const { user } = useAuthStore.getState();
          const isPremiumLocked = deck.isPremium && user?.role === 'free';

          if (isPremiumLocked) {
            throw new Error(
              'This is a premium deck. Please upgrade your account to access premium content.'
            );
          }

          // Initialize progress
          // TODO: Backend Migration - Replace with backend API call
          // const progress = await deckAPI.startLearning(deckId);
          const progress = await mockDeckAPI.startDeck(deckId);

          // Update local progress state
          // TODO: Backend Migration - Remove when backend handles this
          set((state) => ({
            deckProgress: {
              ...state.deckProgress,
              [deckId]: progress,
            },
            isLoading: false,
            error: null,
          }));

          // Update selected deck if it's the current one
          const { selectedDeck } = get();
          if (selectedDeck?.id === deckId) {
            set({
              selectedDeck: {
                ...selectedDeck,
                progress,
              },
            });
          }

          // Re-fetch decks to update list with new progress
          await get().fetchDecks();

        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : 'Failed to start learning. Please try again.';

          set({
            isLoading: false,
            error: errorMessage,
          });

          throw error;
        }
      },

      /**
       * Update user's progress for a deck
       * TODO: Backend Migration - Replace with backend API call when ready
       */
      updateProgress: (deckId: string, progressUpdates: Partial<DeckProgress>) => {
        set((state) => {
          const currentProgress = state.deckProgress[deckId];

          if (!currentProgress) {
            console.warn(`No progress found for deck ${deckId}. Cannot update.`);
            return state;
          }

          // Merge updates
          const updatedProgress = {
            ...currentProgress,
            ...progressUpdates,
          };

          // Update deck progress map
          const newDeckProgress = {
            ...state.deckProgress,
            [deckId]: updatedProgress,
          };

          // Update selected deck if it matches
          let newSelectedDeck = state.selectedDeck;
          if (state.selectedDeck?.id === deckId) {
            newSelectedDeck = {
              ...state.selectedDeck,
              progress: updatedProgress,
            };
          }

          // Update decks array
          const newDecks = state.decks.map(deck =>
            deck.id === deckId
              ? { ...deck, progress: updatedProgress }
              : deck
          );

          return {
            deckProgress: newDeckProgress,
            selectedDeck: newSelectedDeck,
            decks: newDecks,
          };
        });

        // TODO: Backend Migration - When backend ready, add API call:
        // await deckAPI.updateProgress(deckId, progressUpdates);
      },

      /**
       * Review a single card and update progress
       */
      reviewCard: async (deckId: string, cardId: string, wasCorrect: boolean) => {
        set({ isLoading: true, error: null });

        try {
          // Call mock API
          const updatedProgress = await mockDeckAPI.reviewCard(deckId, cardId, wasCorrect);

          // Update store state
          set((state) => ({
            deckProgress: {
              ...state.deckProgress,
              [deckId]: updatedProgress,
            },
            isLoading: false,
          }));

          // Sync to selected deck and decks array
          const { updateProgress } = get();
          updateProgress(deckId, updatedProgress);

          // Re-fetch decks to ensure full sync
          await get().fetchDecks();

        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : 'Failed to update card progress.';

          set({
            isLoading: false,
            error: errorMessage,
          });

          throw error;
        }
      },

      /**
       * Review a study session and update progress
       */
      reviewSession: async (
        deckId: string,
        cardsReviewed: number,
        correctCount: number,
        sessionTimeMinutes: number
      ) => {
        set({ isLoading: true, error: null });

        try {
          // Call mock API
          const updatedProgress = await mockDeckAPI.reviewSession(
            deckId,
            cardsReviewed,
            correctCount,
            sessionTimeMinutes
          );

          // Update store state
          set((state) => ({
            deckProgress: {
              ...state.deckProgress,
              [deckId]: updatedProgress,
            },
            isLoading: false,
          }));

          // Sync to selected deck and decks array
          const { updateProgress } = get();
          updateProgress(deckId, updatedProgress);

          // Re-fetch decks to ensure full sync
          await get().fetchDecks();

        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : 'Failed to update session progress.';

          set({
            isLoading: false,
            error: errorMessage,
          });

          throw error;
        }
      },

      /**
       * Complete a deck (all cards mastered)
       */
      completeDeck: async (deckId: string) => {
        set({ isLoading: true, error: null });

        try {
          // Call mock API
          const updatedProgress = await mockDeckAPI.completeDeck(deckId);

          // Update store state
          set((state) => ({
            deckProgress: {
              ...state.deckProgress,
              [deckId]: updatedProgress,
            },
            isLoading: false,
          }));

          // Sync to selected deck and decks array
          const { updateProgress } = get();
          updateProgress(deckId, updatedProgress);

          // Re-fetch decks
          await get().fetchDecks();

        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : 'Failed to complete deck.';

          set({
            isLoading: false,
            error: errorMessage,
          });

          throw error;
        }
      },

      /**
       * Reset deck progress to initial state
       */
      resetProgress: async (deckId: string) => {
        set({ isLoading: true, error: null });

        try {
          // Call mock API
          const resetProgress = await mockDeckAPI.resetDeckProgress(deckId);

          // Update store state
          set((state) => ({
            deckProgress: {
              ...state.deckProgress,
              [deckId]: resetProgress,
            },
            isLoading: false,
          }));

          // Sync to selected deck and decks array
          const { updateProgress } = get();
          updateProgress(deckId, resetProgress);

          // Re-fetch decks
          await get().fetchDecks();

        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : 'Failed to reset deck progress.';

          set({
            isLoading: false,
            error: errorMessage,
          });

          throw error;
        }
      },

      // ========================================
      // ACTIONS - ERROR HANDLING
      // ========================================

      /**
       * Clear current error message
       */
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'deck-progress-storage', // localStorage key
      storage: createJSONStorage(() => localStorage),

      // Only persist user progress (temporary until backend)
      partialize: (state) => ({
        deckProgress: state.deckProgress,
      }),

      // TODO: Backend Migration - Remove this persist configuration when migrating to backend
      // Progress will be stored in PostgreSQL user_deck_progress table
    }
  )
);
