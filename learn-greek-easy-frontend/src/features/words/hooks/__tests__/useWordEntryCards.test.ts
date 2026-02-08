/**
 * useWordEntryCards Hook Tests
 *
 * Tests for the useWordEntryCards hook which fetches card records for a word entry.
 * Covers:
 * - Initial/loading state
 * - Successful fetch
 * - Error handling
 * - Query enablement (disabled state)
 * - Query key (refetch on wordEntryId change)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

import { useWordEntryCards } from '../useWordEntryCards';
import { wordEntryAPI } from '@/services/wordEntryAPI';

// Mock the wordEntryAPI
vi.mock('@/services/wordEntryAPI', () => ({
  wordEntryAPI: {
    getCardsByWordEntry: vi.fn(),
  },
}));

// Mock card records data
const mockCards = [
  {
    id: 'card-1',
    word_entry_id: 'word-1',
    deck_id: 'deck-1',
    card_type: 'meaning_el_to_en',
    tier: 1,
    front_content: {
      card_type: 'meaning_el_to_en',
      prompt: 'What does this mean?',
      main: '\u03C3\u03C0\u03AF\u03C4\u03B9',
      badge: 'A1',
    },
    back_content: {
      card_type: 'meaning_el_to_en',
      answer: 'house, home',
    },
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'card-2',
    word_entry_id: 'word-1',
    deck_id: 'deck-1',
    card_type: 'meaning_en_to_el',
    tier: 1,
    front_content: {
      card_type: 'meaning_en_to_el',
      prompt: 'Translate to Greek',
      main: 'house',
      badge: 'A1',
    },
    back_content: {
      card_type: 'meaning_en_to_el',
      answer: '\u03C3\u03C0\u03AF\u03C4\u03B9',
    },
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

describe('useWordEntryCards Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial State', () => {
    it('should return loading state initially', () => {
      vi.mocked(wordEntryAPI.getCardsByWordEntry).mockReturnValue(new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useWordEntryCards({ wordEntryId: 'word-1' }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.cards).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should have a refetch function', () => {
      vi.mocked(wordEntryAPI.getCardsByWordEntry).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useWordEntryCards({ wordEntryId: 'word-1' }), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('Successful Fetch', () => {
    it('should fetch cards successfully', async () => {
      vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

      const { result } = renderHook(() => useWordEntryCards({ wordEntryId: 'word-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.cards).toEqual(mockCards);
      expect(result.current.error).toBeNull();
      expect(wordEntryAPI.getCardsByWordEntry).toHaveBeenCalledWith('word-1');
    });

    it('should return empty array when no cards exist', async () => {
      vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue([]);

      const { result } = renderHook(() => useWordEntryCards({ wordEntryId: 'word-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.cards).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      const mockError = new Error('API Error');
      vi.mocked(wordEntryAPI.getCardsByWordEntry).mockRejectedValue(mockError);

      const { result } = renderHook(() => useWordEntryCards({ wordEntryId: 'word-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toEqual(mockError);
      expect(result.current.cards).toEqual([]);
    });
  });

  describe('Query Enablement', () => {
    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(
        () => useWordEntryCards({ wordEntryId: 'word-1', enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      expect(wordEntryAPI.getCardsByWordEntry).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it('should not fetch when wordEntryId is empty string', () => {
      const { result } = renderHook(() => useWordEntryCards({ wordEntryId: '' }), {
        wrapper: createWrapper(),
      });

      expect(wordEntryAPI.getCardsByWordEntry).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Query Key', () => {
    it('should refetch when wordEntryId changes', async () => {
      vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

      const { rerender } = renderHook(({ wordEntryId }) => useWordEntryCards({ wordEntryId }), {
        wrapper: createWrapper(),
        initialProps: { wordEntryId: 'word-1' },
      });

      await waitFor(() => {
        expect(wordEntryAPI.getCardsByWordEntry).toHaveBeenCalledWith('word-1');
      });

      // Rerender with different wordEntryId
      vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue([]);

      rerender({ wordEntryId: 'word-2' });

      await waitFor(() => {
        expect(wordEntryAPI.getCardsByWordEntry).toHaveBeenCalledWith('word-2');
      });
    });
  });
});
