/**
 * Tests for SSE integration in useWordEntry hook.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useWordEntry } from '../useWordEntry';
import type { SSEConnectionState, SSEEvent, SSEOptions } from '@/types/sse';

// Mock useSSE
vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn(),
  parseSSEChunk: vi.fn(),
}));

// Mock the word entry API
vi.mock('@/services/wordEntryAPI', () => ({
  wordEntryAPI: {
    getById: vi.fn(),
  },
}));

import { useSSE } from '@/hooks/useSSE';
import { wordEntryAPI } from '@/services/wordEntryAPI';

const createWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
};

function makeWordEntry(audioStatus = 'generating') {
  return {
    id: 'word-1',
    deck_id: 'deck-1',
    lemma: 'σπίτι',
    part_of_speech: 'noun',
    translation_en: 'house',
    translation_ru: null,
    pronunciation: null,
    grammar_data: null,
    examples: [
      {
        id: 'ex-1',
        greek: 'test',
        english: 'test',
        audio_key: null,
        audio_url: null,
        audio_status: 'missing',
      },
    ],
    audio_key: null,
    audio_url: null,
    audio_status: audioStatus,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

describe('useWordEntry SSE integration', () => {
  let queryClient: QueryClient;
  let capturedOptions: SSEOptions<unknown> | null = null;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    capturedOptions = null;
    vi.mocked(useSSE).mockImplementation((_url: string, options: SSEOptions<unknown>) => {
      capturedOptions = options;
      return { state: 'connected' as SSEConnectionState, close: vi.fn() };
    });
    vi.mocked(wordEntryAPI.getById).mockResolvedValue(makeWordEntry('generating') as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  describe('SSE enablement', () => {
    it('enables SSE when isAdmin=true and audio is generating', async () => {
      renderHook(() => useWordEntry({ wordId: 'word-1', isAdmin: true }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(wordEntryAPI.getById).toHaveBeenCalled());
      await waitFor(() => {
        const calls = vi.mocked(useSSE).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[1].enabled).toBe(true);
        expect(lastCall[0]).toContain('/word-entries/word-1/audio/stream');
      });
    });

    it('disables SSE when isAdmin=false', async () => {
      renderHook(() => useWordEntry({ wordId: 'word-1', isAdmin: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(wordEntryAPI.getById).toHaveBeenCalled());
      await waitFor(() => {
        const calls = vi.mocked(useSSE).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[1].enabled).toBe(false);
      });
    });

    it('disables SSE when audio is not generating', async () => {
      vi.mocked(wordEntryAPI.getById).mockResolvedValue(makeWordEntry('ready') as any);

      renderHook(() => useWordEntry({ wordId: 'word-1', isAdmin: true }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(wordEntryAPI.getById).toHaveBeenCalled());
      await waitFor(() => {
        const calls = vi.mocked(useSSE).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[1].enabled).toBe(false);
      });
    });
  });

  describe('cache updates via SSE events', () => {
    it('updates lemma audio_status and audio_url on lemma event', async () => {
      // Pre-populate cache
      queryClient.setQueryData(['wordEntry', 'word-1'], makeWordEntry('generating'));

      renderHook(() => useWordEntry({ wordId: 'word-1', isAdmin: true }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(capturedOptions?.onEvent).toBeDefined());

      act(() => {
        capturedOptions!.onEvent!({
          type: 'audio_status_changed',
          data: {
            word_entry_id: 'word-1',
            part: 'lemma',
            status: 'ready',
            audio_url: 'https://cdn.example.com/audio.mp3',
            example_id: null,
          },
        } as SSEEvent<unknown>);
      });

      const cached = queryClient.getQueryData(['wordEntry', 'word-1']) as any;
      expect(cached?.audio_status).toBe('ready');
      expect(cached?.audio_url).toBe('https://cdn.example.com/audio.mp3');
    });

    it('updates example audio_status on example event', async () => {
      queryClient.setQueryData(['wordEntry', 'word-1'], makeWordEntry('generating'));

      renderHook(() => useWordEntry({ wordId: 'word-1', isAdmin: true }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(capturedOptions?.onEvent).toBeDefined());

      act(() => {
        capturedOptions!.onEvent!({
          type: 'audio_status_changed',
          data: {
            word_entry_id: 'word-1',
            part: 'example',
            example_id: 'ex-1',
            status: 'ready',
            audio_url: 'https://cdn.example.com/ex1.mp3',
          },
        } as SSEEvent<unknown>);
      });

      const cached = queryClient.getQueryData(['wordEntry', 'word-1']) as any;
      const example = cached?.examples?.find((e: any) => e.id === 'ex-1');
      expect(example?.audio_status).toBe('ready');
      expect(example?.audio_url).toBe('https://cdn.example.com/ex1.mp3');
    });
  });
});
