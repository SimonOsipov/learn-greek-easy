/**
 * useWordEntries Hook Tests
 *
 * Tests for the useWordEntries hook which fetches word entries from the API.
 * Covers:
 * - Initial state
 * - Successful fetch
 * - Error handling
 * - Query enablement
 * - Pagination (hasNextPage, fetchNextPage, isFetchingNextPage)
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

import { useWordEntries } from '../useWordEntries';
import { wordEntryAPI } from '@/services/wordEntryAPI';

// Mock the wordEntryAPI
vi.mock('@/services/wordEntryAPI', () => ({
  wordEntryAPI: {
    getByDeck: vi.fn(),
  },
}));

// Mock word entries data
const mockWordEntries = [
  {
    id: '1',
    deck_id: 'deck-1',
    lemma: 'test',
    part_of_speech: 'NOUN',
    translation_en: 'test translation',
    translation_en_plural: null,
    translation_ru: null,
    translation_ru_plural: null,
    pronunciation: 'test',
    grammar_data: null,
    examples: null,
    audio_key: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    deck_id: 'deck-1',
    lemma: 'another',
    part_of_speech: 'VERB',
    translation_en: 'another translation',
    translation_en_plural: null,
    translation_ru: 'other ru',
    translation_ru_plural: null,
    pronunciation: 'another',
    grammar_data: null,
    examples: null,
    audio_key: 'audio-key',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Create a wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useWordEntries Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial State', () => {
    it('should return loading state initially', () => {
      vi.mocked(wordEntryAPI.getByDeck).mockReturnValue(new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useWordEntries({ deckId: 'deck-1' }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.wordEntries).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should have a refetch function', () => {
      vi.mocked(wordEntryAPI.getByDeck).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useWordEntries({ deckId: 'deck-1' }), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('Successful Fetch', () => {
    it('should fetch word entries successfully', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 2,
        page: 1,
        page_size: 40,
        word_entries: mockWordEntries,
      });

      const { result } = renderHook(() => useWordEntries({ deckId: 'deck-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.wordEntries).toEqual(mockWordEntries);
      expect(result.current.total).toBe(2);
      expect(result.current.error).toBeNull();
      expect(wordEntryAPI.getByDeck).toHaveBeenCalledWith('deck-1', 1, 40);
    });

    it('should return empty array when no word entries exist', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 0,
        page: 1,
        page_size: 40,
        word_entries: [],
      });

      const { result } = renderHook(() => useWordEntries({ deckId: 'deck-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.wordEntries).toEqual([]);
      expect(result.current.total).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      const mockError = new Error('API Error');
      vi.mocked(wordEntryAPI.getByDeck).mockRejectedValue(mockError);

      const { result } = renderHook(() => useWordEntries({ deckId: 'deck-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toEqual(mockError);
      expect(result.current.wordEntries).toEqual([]);
    });
  });

  describe('Query Enablement', () => {
    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(() => useWordEntries({ deckId: 'deck-1', enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(wordEntryAPI.getByDeck).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it('should not fetch when deckId is empty', () => {
      const { result } = renderHook(() => useWordEntries({ deckId: '' }), {
        wrapper: createWrapper(),
      });

      expect(wordEntryAPI.getByDeck).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it('should fetch when enabled is true (default)', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 0,
        page: 1,
        page_size: 40,
        word_entries: [],
      });

      renderHook(() => useWordEntries({ deckId: 'deck-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(wordEntryAPI.getByDeck).toHaveBeenCalledWith('deck-1', 1, 40);
      });
    });
  });

  describe('Query Key', () => {
    it('should use correct query key based on deckId', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 0,
        page: 1,
        page_size: 40,
        word_entries: [],
      });

      const { rerender } = renderHook(({ deckId }) => useWordEntries({ deckId }), {
        wrapper: createWrapper(),
        initialProps: { deckId: 'deck-1' },
      });

      await waitFor(() => {
        expect(wordEntryAPI.getByDeck).toHaveBeenCalledWith('deck-1', 1, 40);
      });

      // Rerender with different deckId
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-2',
        total: 0,
        page: 1,
        page_size: 40,
        word_entries: [],
      });

      rerender({ deckId: 'deck-2' });

      await waitFor(() => {
        expect(wordEntryAPI.getByDeck).toHaveBeenCalledWith('deck-2', 1, 40);
      });
    });
  });

  describe('Pagination', () => {
    it('should return hasNextPage false when all entries are on first page', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 2,
        page: 1,
        page_size: 40,
        word_entries: mockWordEntries,
      });

      const { result } = renderHook(() => useWordEntries({ deckId: 'deck-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasNextPage).toBe(false);
    });

    it('should compute hasNextPage correctly when more pages exist', async () => {
      const page1Entries = Array.from({ length: 40 }, (_, i) => ({
        ...mockWordEntries[0],
        id: `entry-${i}`,
      }));

      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 50,
        page: 1,
        page_size: 40,
        word_entries: page1Entries,
      });

      const { result } = renderHook(() => useWordEntries({ deckId: 'deck-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.wordEntries).toHaveLength(40);
      expect(result.current.total).toBe(50);
    });

    it('should flatten entries from multiple pages', async () => {
      const page1Entries = Array.from({ length: 40 }, (_, i) => ({
        ...mockWordEntries[0],
        id: `entry-p1-${i}`,
      }));
      const page2Entries = Array.from({ length: 10 }, (_, i) => ({
        ...mockWordEntries[0],
        id: `entry-p2-${i}`,
      }));

      vi.mocked(wordEntryAPI.getByDeck)
        .mockResolvedValueOnce({
          deck_id: 'deck-1',
          total: 50,
          page: 1,
          page_size: 40,
          word_entries: page1Entries,
        })
        .mockResolvedValueOnce({
          deck_id: 'deck-1',
          total: 50,
          page: 2,
          page_size: 40,
          word_entries: page2Entries,
        });

      const { result } = renderHook(() => useWordEntries({ deckId: 'deck-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.wordEntries).toHaveLength(40);
      expect(result.current.hasNextPage).toBe(true);

      // Fetch next page
      await act(async () => {
        result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.wordEntries).toHaveLength(50);
      });

      expect(result.current.hasNextPage).toBe(false);
      expect(wordEntryAPI.getByDeck).toHaveBeenCalledWith('deck-1', 2, 40);
    });

    it('should expose fetchNextPage and isFetchingNextPage', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 2,
        page: 1,
        page_size: 40,
        word_entries: mockWordEntries,
      });

      const { result } = renderHook(() => useWordEntries({ deckId: 'deck-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.fetchNextPage).toBe('function');
      expect(result.current.isFetchingNextPage).toBe(false);
    });
  });
});
