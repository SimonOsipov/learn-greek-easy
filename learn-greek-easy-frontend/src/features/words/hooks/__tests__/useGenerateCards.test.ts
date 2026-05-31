/**
 * useGenerateCards Hook Tests
 *
 * Covers:
 * - onSuccess: shows success toast with created/updated counts and invalidates query
 * - onError: shows destructive toast
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

vi.mock('@/services/wordEntryAPI', () => ({
  wordEntryAPI: {
    generateCards: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

import { useGenerateCards } from '../useGenerateCards';
import { wordEntryAPI } from '@/services/wordEntryAPI';

// ============================================
// Utilities
// ============================================

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

// ============================================
// Tests
// ============================================

describe('useGenerateCards Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('onSuccess', () => {
    it('shows a success toast with created and updated counts', async () => {
      const mockResponse = { card_type: 'meaning', created: 3, updated: 1 };
      vi.mocked(wordEntryAPI.generateCards).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useGenerateCards(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ wordEntryId: 'word-1', cardType: 'meaning' });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockToast).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('cardGenerate.success'),
        })
      );
    });

    it('invalidates the wordEntryCards query for the given wordEntryId', async () => {
      const mockResponse = { card_type: 'meaning', created: 2, updated: 0 };
      vi.mocked(wordEntryAPI.generateCards).mockResolvedValue(mockResponse);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useGenerateCards(), { wrapper });

      await act(async () => {
        result.current.mutate({ wordEntryId: 'word-42', cardType: 'article' });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['wordEntryCards', 'word-42'],
      });
    });

    it('calls wordEntryAPI.generateCards with the correct arguments', async () => {
      vi.mocked(wordEntryAPI.generateCards).mockResolvedValue({
        card_type: 'declension',
        created: 5,
        updated: 0,
      });

      const { result } = renderHook(() => useGenerateCards(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ wordEntryId: 'word-99', cardType: 'declension' });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(wordEntryAPI.generateCards).toHaveBeenCalledWith('word-99', 'declension');
    });
  });

  describe('onError', () => {
    it('shows a destructive toast when the API call fails', async () => {
      vi.mocked(wordEntryAPI.generateCards).mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useGenerateCards(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ wordEntryId: 'word-1', cardType: 'meaning' });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockToast).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });

    it('does not invalidate queries when the API call fails', async () => {
      vi.mocked(wordEntryAPI.generateCards).mockRejectedValue(new Error('Server error'));

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useGenerateCards(), { wrapper });

      await act(async () => {
        result.current.mutate({ wordEntryId: 'word-1', cardType: 'meaning' });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
});
