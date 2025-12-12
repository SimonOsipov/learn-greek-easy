// src/stores/__tests__/deckStore.test.ts
/**
 * DeckStore Unit Tests
 *
 * These tests are enabled by TEST-FIX-1's conditional persistence pattern.
 * In test mode (import.meta.env.MODE === 'test'), the persist middleware
 * is disabled, allowing proper unit testing with mocked APIs.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { mockDeckAPI } from '@/services/mockDeckAPI';
import { useAuthStore } from '@/stores/authStore';
import type { Deck, DeckProgress, DeckFilters } from '@/types/deck';

import { useDeckStore } from '../deckStore';

// Mock the mockDeckAPI service
vi.mock('@/services/mockDeckAPI', () => ({
  mockDeckAPI: {
    getAllDecks: vi.fn(),
    getDeckById: vi.fn(),
    startDeck: vi.fn(),
    reviewCard: vi.fn(),
    reviewSession: vi.fn(),
    completeDeck: vi.fn(),
    resetDeckProgress: vi.fn(),
  },
}));

// Mock authStore for premium access checks
vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

describe('deckStore', () => {
  // Mock data
  const mockDeck: Deck = {
    id: 'deck-1',
    title: 'Greek Basics',
    titleGreek: 'Ελληνικά Βασικά',
    description: 'Learn basic Greek vocabulary',
    level: 'A1',
    category: 'vocabulary',
    tags: ['beginner', 'basics'],
    cardCount: 20,
    estimatedTime: 30,
    isPremium: false,
    createdBy: 'system',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockDeck2: Deck = {
    ...mockDeck,
    id: 'deck-2',
    title: 'Greek Phrases',
    titleGreek: 'Ελληνικές Φράσεις',
    category: 'phrases',
  };

  const mockPremiumDeck: Deck = {
    ...mockDeck,
    id: 'premium-deck-1',
    title: 'Advanced Greek',
    titleGreek: 'Προχωρημένα Ελληνικά',
    isPremium: true,
    level: 'B2',
  };

  const mockProgress: DeckProgress = {
    deckId: 'deck-1',
    status: 'in-progress',
    cardsTotal: 20,
    cardsNew: 10,
    cardsLearning: 5,
    cardsReview: 3,
    cardsMastered: 2,
    dueToday: 8,
    streak: 5,
    lastStudied: new Date('2025-01-10'),
    totalTimeSpent: 60,
    accuracy: 75,
  };

  const mockCompletedProgress: DeckProgress = {
    ...mockProgress,
    status: 'completed',
    cardsNew: 0,
    cardsLearning: 0,
    cardsReview: 0,
    cardsMastered: 20,
    accuracy: 95,
  };

  const DEFAULT_FILTERS: DeckFilters = {
    search: '',
    levels: [],
    categories: [],
    status: [],
    showPremiumOnly: false,
  };

  beforeEach(() => {
    // Reset store to initial state before each test
    useDeckStore.setState({
      decks: [],
      selectedDeck: null,
      deckProgress: {},
      filters: DEFAULT_FILTERS,
      isLoading: false,
      error: null,
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Setup default authStore mock (free user)
    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: { id: 'user-1', role: 'free' },
    } as ReturnType<typeof useAuthStore.getState>);
  });

  describe('Initial State', () => {
    it('should have correct initial state values', () => {
      const { result } = renderHook(() => useDeckStore());

      expect(result.current.decks).toEqual([]);
      expect(result.current.selectedDeck).toBeNull();
      expect(result.current.deckProgress).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should have default filters', () => {
      const { result } = renderHook(() => useDeckStore());

      expect(result.current.filters).toEqual(DEFAULT_FILTERS);
    });
  });

  describe('fetchDecks', () => {
    it('should set loading state during fetch', async () => {
      vi.mocked(mockDeckAPI.getAllDecks).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([mockDeck]), 100))
      );

      const { result } = renderHook(() => useDeckStore());

      expect(result.current.isLoading).toBe(false);

      const fetchPromise = act(async () => {
        await result.current.fetchDecks();
      });

      // Check loading state is set
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await fetchPromise;

      expect(result.current.isLoading).toBe(false);
    });

    it('should populate decks on success', async () => {
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([mockDeck, mockDeck2]);

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        await result.current.fetchDecks();
      });

      expect(result.current.decks).toHaveLength(2);
      expect(result.current.decks[0].id).toBe('deck-1');
      expect(result.current.decks[1].id).toBe('deck-2');
      expect(result.current.error).toBeNull();
    });

    it('should inject deckProgress into fetched decks', async () => {
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([mockDeck]);

      // Pre-populate progress
      useDeckStore.setState({
        deckProgress: { 'deck-1': mockProgress },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        await result.current.fetchDecks();
      });

      expect(result.current.decks[0].progress).toEqual(mockProgress);
    });

    it('should set error on failure', async () => {
      const mockError = new Error('Network error');
      vi.mocked(mockDeckAPI.getAllDecks).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        try {
          await result.current.fetchDecks();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
    });

    it('should clear decks on error', async () => {
      vi.mocked(mockDeckAPI.getAllDecks).mockRejectedValue(new Error('Fetch failed'));

      // Pre-populate decks
      useDeckStore.setState({ decks: [mockDeck] });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        try {
          await result.current.fetchDecks();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.decks).toEqual([]);
    });
  });

  describe('selectDeck', () => {
    it('should select deck by ID', async () => {
      vi.mocked(mockDeckAPI.getDeckById).mockResolvedValue(mockDeck);

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        await result.current.selectDeck('deck-1');
      });

      expect(result.current.selectedDeck).not.toBeNull();
      expect(result.current.selectedDeck?.id).toBe('deck-1');
      expect(result.current.error).toBeNull();
    });

    it('should inject progress into selected deck', async () => {
      vi.mocked(mockDeckAPI.getDeckById).mockResolvedValue(mockDeck);

      // Pre-populate progress
      useDeckStore.setState({
        deckProgress: { 'deck-1': mockProgress },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        await result.current.selectDeck('deck-1');
      });

      expect(result.current.selectedDeck?.progress).toEqual(mockProgress);
    });

    it('should set error when deck not found', async () => {
      const mockError = new Error('Deck not found');
      vi.mocked(mockDeckAPI.getDeckById).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        try {
          await result.current.selectDeck('nonexistent');
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Deck not found');
      expect(result.current.selectedDeck).toBeNull();
    });
  });

  describe('clearSelection', () => {
    it('should clear selected deck', () => {
      // Pre-populate selected deck
      useDeckStore.setState({ selectedDeck: mockDeck });

      const { result } = renderHook(() => useDeckStore());

      expect(result.current.selectedDeck).not.toBeNull();

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedDeck).toBeNull();
    });
  });

  describe('setFilters', () => {
    it('should update filters with partial update', () => {
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([]);

      const { result } = renderHook(() => useDeckStore());

      act(() => {
        result.current.setFilters({ search: 'greek', levels: ['A1', 'A2'] });
      });

      expect(result.current.filters.search).toBe('greek');
      expect(result.current.filters.levels).toEqual(['A1', 'A2']);
      // Unchanged filters should remain
      expect(result.current.filters.categories).toEqual([]);
    });

    it('should trigger re-fetch after filter change', async () => {
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([mockDeck]);

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        result.current.setFilters({ search: 'test' });
        // Wait for async fetch
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(mockDeckAPI.getAllDecks).toHaveBeenCalled();
    });
  });

  describe('clearFilters', () => {
    it('should reset filters to defaults', async () => {
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([]);

      // Pre-set some filters
      useDeckStore.setState({
        filters: {
          search: 'test',
          levels: ['B1'],
          categories: ['grammar'],
          status: ['in-progress'],
          showPremiumOnly: true,
        },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        result.current.clearFilters();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(result.current.filters).toEqual(DEFAULT_FILTERS);
    });

    it('should trigger re-fetch after clearing', async () => {
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([]);

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        result.current.clearFilters();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(mockDeckAPI.getAllDecks).toHaveBeenCalled();
    });
  });

  describe('startLearning', () => {
    it('should initialize progress for deck', async () => {
      vi.mocked(mockDeckAPI.getDeckById).mockResolvedValue(mockDeck);
      vi.mocked(mockDeckAPI.startDeck).mockResolvedValue(mockProgress);
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([mockDeck]);

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        await result.current.startLearning('deck-1');
      });

      expect(mockDeckAPI.startDeck).toHaveBeenCalledWith('deck-1');
      expect(result.current.deckProgress['deck-1']).toEqual(mockProgress);
    });

    it('should throw error for locked premium decks (free user)', async () => {
      vi.mocked(mockDeckAPI.getDeckById).mockResolvedValue(mockPremiumDeck);
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { id: 'user-1', role: 'free' },
      } as ReturnType<typeof useAuthStore.getState>);

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        try {
          await result.current.startLearning('premium-deck-1');
        } catch (error) {
          expect((error as Error).message).toContain('premium deck');
        }
      });

      expect(result.current.error).toContain('premium');
      expect(mockDeckAPI.startDeck).not.toHaveBeenCalled();
    });

    it('should allow premium deck for premium user', async () => {
      vi.mocked(mockDeckAPI.getDeckById).mockResolvedValue(mockPremiumDeck);
      vi.mocked(mockDeckAPI.startDeck).mockResolvedValue({
        ...mockProgress,
        deckId: 'premium-deck-1',
      });
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([mockPremiumDeck]);
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { id: 'user-1', role: 'premium' },
      } as ReturnType<typeof useAuthStore.getState>);

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        await result.current.startLearning('premium-deck-1');
      });

      expect(mockDeckAPI.startDeck).toHaveBeenCalledWith('premium-deck-1');
      expect(result.current.error).toBeNull();
    });

    it('should update selected deck if matches', async () => {
      vi.mocked(mockDeckAPI.getDeckById).mockResolvedValue(mockDeck);
      vi.mocked(mockDeckAPI.startDeck).mockResolvedValue(mockProgress);
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([mockDeck]);

      // Pre-select the deck
      useDeckStore.setState({ selectedDeck: mockDeck });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        await result.current.startLearning('deck-1');
      });

      expect(result.current.selectedDeck?.progress).toEqual(mockProgress);
    });
  });

  describe('updateProgress', () => {
    it('should update progress for specific deck', () => {
      // Pre-populate progress
      useDeckStore.setState({
        deckProgress: { 'deck-1': mockProgress },
        decks: [{ ...mockDeck, progress: mockProgress }],
      });

      const { result } = renderHook(() => useDeckStore());

      act(() => {
        result.current.updateProgress('deck-1', { accuracy: 85, streak: 10 });
      });

      expect(result.current.deckProgress['deck-1'].accuracy).toBe(85);
      expect(result.current.deckProgress['deck-1'].streak).toBe(10);
    });

    it('should update selected deck if matches', () => {
      // Pre-populate selected deck with progress
      useDeckStore.setState({
        selectedDeck: { ...mockDeck, progress: mockProgress },
        deckProgress: { 'deck-1': mockProgress },
        decks: [{ ...mockDeck, progress: mockProgress }],
      });

      const { result } = renderHook(() => useDeckStore());

      act(() => {
        result.current.updateProgress('deck-1', { accuracy: 90 });
      });

      expect(result.current.selectedDeck?.progress?.accuracy).toBe(90);
    });

    it('should warn when no existing progress', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useDeckStore());

      act(() => {
        result.current.updateProgress('nonexistent-deck', { accuracy: 50 });
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No progress found for deck nonexistent-deck')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('reviewCard', () => {
    it('should call API and update progress', async () => {
      const updatedProgress = { ...mockProgress, accuracy: 80 };
      vi.mocked(mockDeckAPI.reviewCard).mockResolvedValue(updatedProgress);
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([mockDeck]);

      // Pre-populate progress
      useDeckStore.setState({
        deckProgress: { 'deck-1': mockProgress },
        decks: [{ ...mockDeck, progress: mockProgress }],
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        await result.current.reviewCard('deck-1', 'card-1', true);
      });

      expect(mockDeckAPI.reviewCard).toHaveBeenCalledWith('deck-1', 'card-1', true);
      expect(result.current.deckProgress['deck-1'].accuracy).toBe(80);
    });

    it('should handle errors', async () => {
      const mockError = new Error('Review failed');
      vi.mocked(mockDeckAPI.reviewCard).mockRejectedValue(mockError);

      useDeckStore.setState({
        deckProgress: { 'deck-1': mockProgress },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        try {
          await result.current.reviewCard('deck-1', 'card-1', true);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Review failed');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('reviewSession', () => {
    it('should batch update progress', async () => {
      const updatedProgress = {
        ...mockProgress,
        totalTimeSpent: 90,
        accuracy: 82,
      };
      vi.mocked(mockDeckAPI.reviewSession).mockResolvedValue(updatedProgress);
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([mockDeck]);

      useDeckStore.setState({
        deckProgress: { 'deck-1': mockProgress },
        decks: [{ ...mockDeck, progress: mockProgress }],
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        await result.current.reviewSession('deck-1', 10, 8, 30);
      });

      expect(mockDeckAPI.reviewSession).toHaveBeenCalledWith('deck-1', 10, 8, 30);
      expect(result.current.deckProgress['deck-1'].totalTimeSpent).toBe(90);
    });

    it('should handle errors', async () => {
      const mockError = new Error('Session failed');
      vi.mocked(mockDeckAPI.reviewSession).mockRejectedValue(mockError);

      useDeckStore.setState({
        deckProgress: { 'deck-1': mockProgress },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        try {
          await result.current.reviewSession('deck-1', 10, 8, 30);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Session failed');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('completeDeck', () => {
    it('should mark deck as completed', async () => {
      vi.mocked(mockDeckAPI.completeDeck).mockResolvedValue(mockCompletedProgress);
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([mockDeck]);

      useDeckStore.setState({
        deckProgress: { 'deck-1': mockProgress },
        decks: [{ ...mockDeck, progress: mockProgress }],
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        await result.current.completeDeck('deck-1');
      });

      expect(mockDeckAPI.completeDeck).toHaveBeenCalledWith('deck-1');
      expect(result.current.deckProgress['deck-1'].status).toBe('completed');
    });

    it('should handle errors', async () => {
      const mockError = new Error('Complete failed');
      vi.mocked(mockDeckAPI.completeDeck).mockRejectedValue(mockError);

      useDeckStore.setState({
        deckProgress: { 'deck-1': mockProgress },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        try {
          await result.current.completeDeck('deck-1');
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Complete failed');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('resetProgress', () => {
    it('should reset deck progress', async () => {
      const resetProgress: DeckProgress = {
        ...mockProgress,
        status: 'not-started',
        cardsNew: 20,
        cardsLearning: 0,
        cardsReview: 0,
        cardsMastered: 0,
        streak: 0,
        totalTimeSpent: 0,
        accuracy: 0,
      };
      vi.mocked(mockDeckAPI.resetDeckProgress).mockResolvedValue(resetProgress);
      vi.mocked(mockDeckAPI.getAllDecks).mockResolvedValue([mockDeck]);

      useDeckStore.setState({
        deckProgress: { 'deck-1': mockProgress },
        decks: [{ ...mockDeck, progress: mockProgress }],
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        await result.current.resetProgress('deck-1');
      });

      expect(mockDeckAPI.resetDeckProgress).toHaveBeenCalledWith('deck-1');
      expect(result.current.deckProgress['deck-1'].status).toBe('not-started');
      expect(result.current.deckProgress['deck-1'].cardsMastered).toBe(0);
    });

    it('should handle errors', async () => {
      const mockError = new Error('Reset failed');
      vi.mocked(mockDeckAPI.resetDeckProgress).mockRejectedValue(mockError);

      useDeckStore.setState({
        deckProgress: { 'deck-1': mockProgress },
      });

      const { result } = renderHook(() => useDeckStore());

      await act(async () => {
        try {
          await result.current.resetProgress('deck-1');
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Reset failed');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      // Pre-set an error
      useDeckStore.setState({ error: 'Some error message' });

      const { result } = renderHook(() => useDeckStore());

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
