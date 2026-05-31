/**
 * useUpdateWordEntry Hook Tests
 *
 * Covers:
 * - Success path: setQueryData with correct cache key + shape, onSuccess callback fires
 * - 404 error path: shows destructive notFound toast
 * - Non-404 error path: shows generic destructive toast
 * - isPending lifecycle: true while mutation is in-flight, false before/after
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

import { useUpdateWordEntry } from '../useUpdateWordEntry';
import { wordEntryAPI } from '@/services/wordEntryAPI';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/wordEntryAPI', () => ({
  wordEntryAPI: {
    updateInline: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// ============================================
// Fixtures
// ============================================

const mockWordEntryResponse: WordEntryResponse = {
  id: 'we-123',
  deck_id: 'deck-456',
  lemma: 'σπίτι',
  part_of_speech: 'noun',
  translation_en: 'house',
  translation_en_plural: 'houses',
  translation_ru: 'дом',
  translation_ru_plural: null,
  pronunciation: '/spí·ti/',
  grammar_data: { gender: 'neuter' },
  examples: [],
  audio_key: null,
  audio_url: null,
  audio_status: 'ready',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockPayload = {
  translation_en: 'home',
};

// ============================================
// Wrapper
// ============================================

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
};

// ============================================
// Tests
// ============================================

describe('useUpdateWordEntry Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Success path', () => {
    it('calls setQueryData with the correct cache key and response shape on success', async () => {
      vi.mocked(wordEntryAPI.updateInline).mockResolvedValue(mockWordEntryResponse);

      const { queryClient, wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ wordEntryId: 'we-123', payload: mockPayload });
      });

      expect(queryClient.getQueryData(['wordEntry', 'we-123'])).toEqual(mockWordEntryResponse);
    });

    it('does not corrupt the cache shape (stored value equals API response exactly)', async () => {
      vi.mocked(wordEntryAPI.updateInline).mockResolvedValue(mockWordEntryResponse);

      const { queryClient, wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ wordEntryId: 'we-123', payload: mockPayload });
      });

      const cached = queryClient.getQueryData(['wordEntry', 'we-123']);
      expect(cached).toStrictEqual(mockWordEntryResponse);
    });

    it('calls the onSuccess callback with the returned data', async () => {
      vi.mocked(wordEntryAPI.updateInline).mockResolvedValue(mockWordEntryResponse);

      const onSuccess = vi.fn();
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry({ onSuccess }), { wrapper });

      act(() => {
        result.current.mutate({ wordEntryId: 'we-123', payload: mockPayload });
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledOnce();
        expect(onSuccess).toHaveBeenCalledWith(mockWordEntryResponse);
      });
    });

    it('shows a success toast on success', async () => {
      vi.mocked(wordEntryAPI.updateInline).mockResolvedValue(mockWordEntryResponse);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      act(() => {
        result.current.mutate({ wordEntryId: 'we-123', payload: mockPayload });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'wordEntryEdit.success' })
        );
      });
    });

    it('does not call onSuccess callback when none is provided', async () => {
      vi.mocked(wordEntryAPI.updateInline).mockResolvedValue(mockWordEntryResponse);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      // Should not throw
      await act(async () => {
        result.current.mutate({ wordEntryId: 'we-123', payload: mockPayload });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledOnce();
      });
    });
  });

  describe('404 error path', () => {
    it('shows a destructive notFound toast when the error status is 404', async () => {
      const error404 = { status: 404, message: 'Not found' };
      vi.mocked(wordEntryAPI.updateInline).mockRejectedValue(error404);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      act(() => {
        result.current.mutate({ wordEntryId: 'we-123', payload: mockPayload });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'wordEntryEdit.error',
            description: 'wordEntryEdit.notFound',
            variant: 'destructive',
          })
        );
      });
    });

    it('does not show the generic error toast on 404', async () => {
      const error404 = { status: 404 };
      vi.mocked(wordEntryAPI.updateInline).mockRejectedValue(error404);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      act(() => {
        result.current.mutate({ wordEntryId: 'we-123', payload: mockPayload });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledOnce();
      });

      // The single toast call must include the description (notFound variant), not be the generic one
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'wordEntryEdit.notFound' })
      );
    });
  });

  describe('Non-404 error path', () => {
    it('shows a generic destructive toast for a 500 error', async () => {
      const error500 = { status: 500, message: 'Internal server error' };
      vi.mocked(wordEntryAPI.updateInline).mockRejectedValue(error500);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      act(() => {
        result.current.mutate({ wordEntryId: 'we-123', payload: mockPayload });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'wordEntryEdit.error',
            variant: 'destructive',
          })
        );
      });

      // Must NOT include a description (that's the 404 branch)
      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ description: 'wordEntryEdit.notFound' })
      );
    });

    it('shows a generic destructive toast when the error has no status field', async () => {
      const genericError = new Error('Network error');
      vi.mocked(wordEntryAPI.updateInline).mockRejectedValue(genericError);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      act(() => {
        result.current.mutate({ wordEntryId: 'we-123', payload: mockPayload });
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'wordEntryEdit.error',
            variant: 'destructive',
          })
        );
      });

      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.anything() })
      );
    });
  });

  describe('isPending lifecycle', () => {
    it('is false before mutation is triggered', () => {
      vi.mocked(wordEntryAPI.updateInline).mockReturnValue(new Promise(() => {}));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      expect(result.current.isPending).toBe(false);
    });

    it('is true while mutation is in-flight', async () => {
      let resolveApi!: (value: WordEntryResponse) => void;
      vi.mocked(wordEntryAPI.updateInline).mockReturnValue(
        new Promise<WordEntryResponse>((resolve) => {
          resolveApi = resolve;
        })
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      act(() => {
        result.current.mutate({ wordEntryId: 'we-123', payload: mockPayload });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      // resolve so the promise doesn't hang
      act(() => {
        resolveApi(mockWordEntryResponse);
      });
    });

    it('is false after the mutation resolves successfully', async () => {
      vi.mocked(wordEntryAPI.updateInline).mockResolvedValue(mockWordEntryResponse);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      act(() => {
        result.current.mutate({ wordEntryId: 'we-123', payload: mockPayload });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });

    it('is false after the mutation rejects', async () => {
      vi.mocked(wordEntryAPI.updateInline).mockRejectedValue({ status: 500 });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateWordEntry(), { wrapper });

      act(() => {
        result.current.mutate({ wordEntryId: 'we-123', payload: mockPayload });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });
  });
});
