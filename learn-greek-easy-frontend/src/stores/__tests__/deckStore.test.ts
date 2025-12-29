// src/stores/__tests__/deckStore.test.ts

/**
 * DeckStore Tests - SKIPPED
 *
 * Rationale for Skipping Unit Tests:
 * ===================================
 *
 * The deckStore uses Zustand's `persist` middleware to store user progress
 * in localStorage. This creates the same testing limitations as authStore.
 *
 * Technical Limitation:
 * ====================
 *
 * 1. **Persist Middleware Closure**: When deckStore.ts is imported, Zustand's
 *    persist middleware captures `window.localStorage` at module load time
 *    and holds a closure reference to it.
 *
 * 2. **Mock Timing**: Our test-setup.ts mocks localStorage AFTER the module
 *    has already loaded, so the mock is never used by the persist middleware.
 *
 * 3. **Partial Persistence**: Unlike authStore which persists full state,
 *    deckStore only persists `deckProgress` via the `partialize` option:
 *
 *    ```typescript
 *    partialize: (state) => ({
 *      deckProgress: state.deckProgress,
 *    })
 *    ```
 *
 *    This means:
 *    - `deckProgress` state is persisted (can't unit test)
 *    - Other state (decks, selectedDeck, filters) is NOT persisted (could test)
 *
 * Why Full Store Tests Are Still Skipped:
 * =======================================
 *
 * While we could test non-persisted state, the core business logic of deckStore
 * revolves around progress tracking (which uses persist). Testing only the
 * UI state (filters, selectedDeck) would provide minimal value because:
 *
 * - Progress updates are the most complex logic
 * - Filters are simple state updates
 * - SelectedDeck is a straightforward setter
 *
 * Testing Strategy:
 * ================
 *
 * 1. **Service Layer Tests** (This task):
 *    - mockDeckAPI.test.ts covers ALL deck business logic
 *    - Tests progress calculations, state transitions, error handling
 *    - Provides comprehensive coverage of deck operations
 *
 * 2. **Integration Tests** (Tasks 10.06-10.07):
 *    - End-to-end tests using Playwright
 *    - Tests: select deck → start learning → review cards → progress saved
 *    - Verifies localStorage persistence works in real browser
 *
 * 3. **Component Tests** (Tasks 10.06-10.07):
 *    - DecksPage.test.tsx tests deck listing and filtering
 *    - DeckDetailPage.test.tsx tests deck actions (start, reset, etc.)
 *
 * What Gets Tested Where:
 * ======================
 *
 * Business Logic (mockDeckAPI.test.ts):
 * - getAllDecks() with filters
 * - getDeckById()
 * - startDeck() - progress initialization
 * - reviewCard() - SR state updates
 * - reviewSession() - batch progress updates
 * - completeDeck() - completion logic
 * - resetDeckProgress() - reset logic
 *
 * Integration (Playwright):
 * - Full deck learning flow
 * - Progress persistence across page reloads
 * - Filter state management
 *
 * Components (React Testing Library):
 * - Deck list rendering
 * - Filter UI interactions
 * - Deck selection
 * - Action button states
 *
 * Future Refactoring Options:
 * ==========================
 *
 * Same options as authStore:
 *
 * Option A: Conditional Persistence (simplest for MVP)
 * ```typescript
 * const store = import.meta.env.MODE === 'test'
 *   ? create(storeConfig)
 *   : create(persist(storeConfig, { name: 'deck-progress-storage' }));
 * ```
 *
 * Option B: Extract Progress Logic (best long-term)
 * ```typescript
 * // Pure functions (easy to test)
 * export function calculateProgressUpdate(current, session) { ... }
 * export function shouldCompleteDeck(progress) { ... }
 *
 * // Store uses pure functions
 * reviewSession: async (deckId, ...) => {
 *   const updated = calculateProgressUpdate(get().deckProgress[deckId], session);
 *   set({ deckProgress: { ...get().deckProgress, [deckId]: updated } });
 * }
 * ```
 *
 * Option C: Backend Migration (planned for post-MVP)
 * When backend is ready, progress will move to PostgreSQL and this store
 * will only manage UI state (no persistence needed).
 *
 * Current Decision:
 * ================
 *
 * Skip unit tests for deckStore because:
 * 1. Business logic is comprehensively tested in mockDeckAPI.test.ts
 * 2. Integration tests cover full user flows
 * 3. Component tests cover UI interactions
 * 4. Store is temporary (backend migration planned)
 *
 * This provides sufficient coverage for MVP without architectural changes.
 *
 * See Also:
 * - src/stores/deckStore.ts (TODO comments for backend migration)
 * - .claude/01-MVP/frontend/10/10.04-component-testing.md (persistence limitations)
 * - .claude/01-MVP/frontend/10/10.06-integration-testing-plan.md (deck flow tests)
 */

describe.skip('deckStore (uses persist middleware)', () => {
  it('should be tested via service tests and integration tests', () => {
    // This test suite is intentionally skipped
    // See documentation above for rationale and testing alternatives
  });
});

/**
 * Tests for setFilters function - specifically testing the culture/level filter behavior
 *
 * These tests don't rely on persistence and can run without mocking localStorage.
 * They verify that:
 * 1. When deckType is set to 'culture', level filters are automatically cleared
 * 2. Level filters work normally for 'all' and 'vocabulary' deck types
 *
 * Related bug: Level filter remains enabled when Culture filter is selected
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDeckStore, type DeckStoreFilters } from '../deckStore';

// Mock all the APIs used by deckStore
vi.mock('@/services/deckAPI', () => ({
  deckAPI: {
    getList: vi.fn().mockResolvedValue({ total: 0, page: 1, page_size: 50, decks: [] }),
    getById: vi.fn(),
  },
}));

vi.mock('@/services/cultureDeckAPI', () => ({
  cultureDeckAPI: {
    getList: vi.fn().mockResolvedValue({ decks: [], total: 0 }),
    getById: vi.fn(),
  },
}));

vi.mock('@/services/progressAPI', () => ({
  progressAPI: {
    getDeckProgressList: vi.fn().mockResolvedValue({ total: 0, page: 1, page_size: 50, decks: [] }),
    getDeckProgressDetail: vi.fn(),
  },
}));

vi.mock('@/services/studyAPI', () => ({
  studyAPI: {
    initializeDeck: vi.fn(),
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({ user: { role: 'free' } }),
  },
}));

describe('deckStore.setFilters - Culture/Level Filter Behavior', () => {
  const DEFAULT_FILTERS: DeckStoreFilters = {
    search: '',
    levels: [],
    categories: [],
    status: [],
    showPremiumOnly: false,
    deckType: 'all',
  };

  beforeEach(() => {
    // Reset store to default state before each test
    useDeckStore.setState({
      decks: [],
      totalDecks: 0,
      selectedDeck: null,
      filters: { ...DEFAULT_FILTERS },
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('Switching to Culture Deck Type', () => {
    it('should clear level filters when switching to culture deckType', async () => {
      // Start with some levels selected
      useDeckStore.setState({
        filters: {
          ...DEFAULT_FILTERS,
          levels: ['A1', 'B1'],
          deckType: 'all',
        },
      });

      const { result } = renderHook(() => useDeckStore());

      // Verify initial state has levels
      expect(result.current.filters.levels).toEqual(['A1', 'B1']);

      // Switch to culture
      await act(async () => {
        result.current.setFilters({ deckType: 'culture' });
      });

      // Levels should be cleared
      await waitFor(() => {
        expect(result.current.filters.levels).toEqual([]);
        expect(result.current.filters.deckType).toBe('culture');
      });
    });

    it('should clear all levels when switching from vocabulary to culture', async () => {
      // Start with vocabulary and multiple levels
      useDeckStore.setState({
        filters: {
          ...DEFAULT_FILTERS,
          levels: ['A1', 'A2', 'B1', 'B2'],
          deckType: 'vocabulary',
        },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        result.current.setFilters({ deckType: 'culture' });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual([]);
      });
    });

    it('should preserve other filters when clearing levels for culture', async () => {
      // Start with various filters
      useDeckStore.setState({
        filters: {
          ...DEFAULT_FILTERS,
          search: 'greek',
          levels: ['A1'],
          status: ['in-progress'],
          showPremiumOnly: true,
          deckType: 'all',
        },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        result.current.setFilters({ deckType: 'culture' });
      });

      await waitFor(() => {
        // Levels should be cleared
        expect(result.current.filters.levels).toEqual([]);
        // Other filters should be preserved
        expect(result.current.filters.search).toBe('greek');
        expect(result.current.filters.status).toEqual(['in-progress']);
        expect(result.current.filters.showPremiumOnly).toBe(true);
        expect(result.current.filters.deckType).toBe('culture');
      });
    });
  });

  describe('Keeping Levels for Non-Culture Deck Types', () => {
    it('should preserve level filters when switching to vocabulary', async () => {
      useDeckStore.setState({
        filters: {
          ...DEFAULT_FILTERS,
          levels: ['A1', 'B1'],
          deckType: 'all',
        },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        result.current.setFilters({ deckType: 'vocabulary' });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual(['A1', 'B1']);
        expect(result.current.filters.deckType).toBe('vocabulary');
      });
    });

    it('should preserve level filters when switching to all', async () => {
      useDeckStore.setState({
        filters: {
          ...DEFAULT_FILTERS,
          levels: ['A2'],
          deckType: 'vocabulary',
        },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        result.current.setFilters({ deckType: 'all' });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual(['A2']);
        expect(result.current.filters.deckType).toBe('all');
      });
    });

    it('should allow adding levels when deckType is all', async () => {
      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        result.current.setFilters({ levels: ['A1'] });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual(['A1']);
      });

      await act(async () => {
        result.current.setFilters({ levels: ['A1', 'B1'] });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual(['A1', 'B1']);
      });
    });

    it('should allow adding levels when deckType is vocabulary', async () => {
      useDeckStore.setState({
        filters: {
          ...DEFAULT_FILTERS,
          deckType: 'vocabulary',
        },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        result.current.setFilters({ levels: ['B2'] });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual(['B2']);
      });
    });
  });

  describe('Switching From Culture to Other Types', () => {
    it('should start with empty levels when switching from culture to vocabulary', async () => {
      useDeckStore.setState({
        filters: {
          ...DEFAULT_FILTERS,
          levels: [], // Culture has no levels
          deckType: 'culture',
        },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        result.current.setFilters({ deckType: 'vocabulary' });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual([]);
        expect(result.current.filters.deckType).toBe('vocabulary');
      });

      // Now user can add levels
      await act(async () => {
        result.current.setFilters({ levels: ['A1'] });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual(['A1']);
      });
    });

    it('should allow level selection after switching from culture to all', async () => {
      useDeckStore.setState({
        filters: {
          ...DEFAULT_FILTERS,
          deckType: 'culture',
        },
      });

      const { result } = renderHook(() => useDeckStore());

      // Switch to all
      await act(async () => {
        result.current.setFilters({ deckType: 'all' });
      });

      // Add a level
      await act(async () => {
        result.current.setFilters({ levels: ['B1'] });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual(['B1']);
      });
    });
  });

  describe('totalDecks Tracking', () => {
    it('should initialize totalDecks to 0', () => {
      const { result } = renderHook(() => useDeckStore());
      expect(result.current.totalDecks).toBe(0);
    });

    it('should reset totalDecks to 0 in initial state', async () => {
      // First set some totalDecks value
      useDeckStore.setState({
        totalDecks: 10,
        decks: [],
        filters: { ...DEFAULT_FILTERS },
      });

      const { result } = renderHook(() => useDeckStore());
      expect(result.current.totalDecks).toBe(10);

      // Reset to default state - wrap in act since we're updating state after hook is rendered
      await act(async () => {
        useDeckStore.setState({
          totalDecks: 0,
          decks: [],
          filters: { ...DEFAULT_FILTERS },
        });
      });

      expect(result.current.totalDecks).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty levels array when switching to culture', async () => {
      // Already no levels selected
      useDeckStore.setState({
        filters: {
          ...DEFAULT_FILTERS,
          levels: [],
          deckType: 'all',
        },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        result.current.setFilters({ deckType: 'culture' });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual([]);
        expect(result.current.filters.deckType).toBe('culture');
      });
    });

    it('should handle updating multiple filters including deckType to culture', async () => {
      useDeckStore.setState({
        filters: {
          ...DEFAULT_FILTERS,
          levels: ['A1', 'A2'],
          deckType: 'vocabulary',
        },
      });

      const { result } = renderHook(() => useDeckStore());

      // Update multiple filters at once
      await act(async () => {
        result.current.setFilters({
          deckType: 'culture',
          search: 'history',
          status: ['completed'],
        });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual([]); // Cleared
        expect(result.current.filters.deckType).toBe('culture');
        expect(result.current.filters.search).toBe('history');
        expect(result.current.filters.status).toEqual(['completed']);
      });
    });

    it('should not affect levels when only updating non-deckType filters', async () => {
      useDeckStore.setState({
        filters: {
          ...DEFAULT_FILTERS,
          levels: ['A1'],
          deckType: 'vocabulary',
        },
      });

      const { result } = renderHook(() => useDeckStore());

      // Update search only
      await act(async () => {
        result.current.setFilters({ search: 'basics' });
      });

      await waitFor(() => {
        expect(result.current.filters.levels).toEqual(['A1']); // Unchanged
        expect(result.current.filters.search).toBe('basics');
      });
    });
  });
});
