/**
 * Tests for polling behavior in useWordEntry hook.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { useWordEntry } from '../useWordEntry';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

vi.mock('@/services/wordEntryAPI', () => ({
  wordEntryAPI: {
    getById: vi.fn(),
  },
}));

// Import after mock declaration so we get the mocked version
import { wordEntryAPI } from '@/services/wordEntryAPI';

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useWordEntry polling behavior', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('polls every 3s when word entry has generating audio_status', async () => {
    const generatingEntry = {
      audio_status: 'generating',
      examples: [],
    } as unknown as WordEntryResponse;
    (wordEntryAPI.getById as ReturnType<typeof vi.fn>).mockResolvedValue(generatingEntry);

    const { result } = renderHook(() => useWordEntry({ wordId: 'test-id' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.wordEntry).not.toBeNull());
    expect(wordEntryAPI.getById).toHaveBeenCalled();
  });

  it('does not poll when audio_status is ready', async () => {
    const readyEntry = {
      audio_status: 'ready',
      examples: [],
    } as unknown as WordEntryResponse;
    (wordEntryAPI.getById as ReturnType<typeof vi.fn>).mockResolvedValue(readyEntry);

    const { result } = renderHook(() => useWordEntry({ wordId: 'test-id' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.wordEntry).not.toBeNull());
    expect(result.current.wordEntry?.audio_status).toBe('ready');
  });

  it('returns null wordEntry when wordId is empty and query is disabled', () => {
    const { result } = renderHook(() => useWordEntry({ wordId: '' }), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.wordEntry).toBeNull();
    expect(wordEntryAPI.getById).not.toHaveBeenCalled();
  });
});
