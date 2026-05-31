/**
 * Tests for the SSE state machine in useGenerateAudio.
 *
 * Mocks useSSE to capture the onEvent/onError callbacks so tests can drive
 * SSE events directly (same pattern as PictureGenerationPanel.test.tsx and
 * GenerateNounDialog.sse.test.tsx). Uses a real QueryClient to assert the
 * optimistic cache mutations.
 */

import React from 'react';

import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { WordEntryResponse } from '@/services/wordEntryAPI';
import type { SSEEvent } from '@/types/sse';

// ============================================
// Mocks
// ============================================

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

vi.mock('@/services/wordEntryAPI', () => ({
  wordEntryAPI: {
    generateAudioStreamUrl: (id: string) => `/api/v1/words/${id}/audio/generate/stream`,
  },
}));

// Capture SSE callbacks so tests can fire events directly. The mock re-runs
// on every render of the hook, so it always reflects the latest `enabled`.
let capturedOnEvent: ((event: SSEEvent) => void) | undefined;
let capturedOnError: ((err: Error) => void) | undefined;

vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn(
    (
      _url: string,
      options: {
        onEvent?: (e: SSEEvent) => void;
        onError?: (e: Error) => void;
        enabled?: boolean;
      }
    ) => {
      if (options.enabled) {
        capturedOnEvent = options.onEvent;
        capturedOnError = options.onError;
      } else {
        capturedOnEvent = undefined;
        capturedOnError = undefined;
      }
      return { state: 'disconnected', close: vi.fn() };
    }
  ),
}));

// Import after mocks
import { useGenerateAudio } from '../useGenerateAudio';

// ============================================
// Helpers
// ============================================

const WORD_ENTRY_ID = 'word-1';

const makeWordEntry = (overrides: Partial<WordEntryResponse> = {}): WordEntryResponse =>
  ({
    id: WORD_ENTRY_ID,
    audio_status: 'pending',
    examples: [
      { id: 'ex-1', audio_status: 'pending' },
      { id: 'ex-2', audio_status: 'pending' },
    ],
    ...overrides,
  }) as unknown as WordEntryResponse;

const fireEvent = (type: string, data: unknown) => {
  act(() => {
    capturedOnEvent?.({ type, data } as SSEEvent);
  });
};

// ============================================
// Tests
// ============================================

describe('useGenerateAudio SSE state machine', () => {
  let queryClient: QueryClient;

  const renderAudioHook = () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
    return renderHook(() => useGenerateAudio({ wordEntryId: WORD_ENTRY_ID }), { wrapper });
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    capturedOnEvent = undefined;
    capturedOnError = undefined;
    vi.clearAllMocks();
  });

  it('starts idle and becomes generating after triggerGeneration + start event', () => {
    const { result } = renderAudioHook();
    expect(result.current.progress.status).toBe('idle');
    expect(result.current.isGenerating).toBe(false);

    act(() => result.current.triggerGeneration());
    // useSSE now enabled — callbacks captured
    expect(capturedOnEvent).toBeDefined();

    fireEvent('word_audio:start', { word_entry_id: WORD_ENTRY_ID, part_count: 3 });

    expect(result.current.progress.status).toBe('generating');
    expect(result.current.progress.totalParts).toBe(3);
    expect(result.current.isGenerating).toBe(true);
  });

  it('per-part error keeps the stream open and shows no toast', () => {
    const { result } = renderAudioHook();
    act(() => result.current.triggerGeneration());
    fireEvent('word_audio:start', { word_entry_id: WORD_ENTRY_ID, part_count: 2 });

    fireEvent('word_audio:error', {
      part: 'example',
      example_id: 'ex-1',
      stage: 'tts',
      error: 'TTS failed for example',
      word_entry_id: WORD_ENTRY_ID,
    });

    // The errored part is marked, but stream stays open (status still generating)
    expect(result.current.progress.parts.get('example:ex-1')).toBe('error');
    expect(result.current.progress.status).toBe('generating');
    expect(result.current.progress.errorMessage).toBe('TTS failed for example');
    // Stream not closed — useSSE still enabled, callbacks still captured
    expect(capturedOnEvent).toBeDefined();
    // No destructive toast for a per-part error
    expect(mockToast).not.toHaveBeenCalled();

    // A subsequent part can still complete on the open stream
    fireEvent('word_audio:part_complete', {
      part: 'example',
      example_id: 'ex-2',
      part_index: 1,
      total_parts: 2,
    });
    expect(result.current.progress.parts.get('example:ex-2')).toBe('complete');
    expect(result.current.progress.partsCompleted).toBe(1);
  });

  it('pipeline error (no part) closes the stream and shows a single destructive toast', () => {
    const { result } = renderAudioHook();
    act(() => result.current.triggerGeneration());
    fireEvent('word_audio:start', { word_entry_id: WORD_ENTRY_ID, part_count: 2 });

    fireEvent('word_audio:error', {
      part: null,
      example_id: null,
      stage: 'pipeline',
      error: 'Pipeline crashed',
      word_entry_id: WORD_ENTRY_ID,
    });

    expect(result.current.progress.status).toBe('error');
    expect(result.current.progress.errorMessage).toBe('Pipeline crashed');
    expect(result.current.isGenerating).toBe(false);
    // Stream closed: useSSE disabled, callbacks cleared
    expect(capturedOnEvent).toBeUndefined();
    // Exactly one destructive toast
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('part_complete for lemma updates the lemma root audio_status in cache', () => {
    queryClient.setQueryData(['wordEntry', WORD_ENTRY_ID], makeWordEntry());

    const { result } = renderAudioHook();
    act(() => result.current.triggerGeneration());
    fireEvent('word_audio:start', { word_entry_id: WORD_ENTRY_ID, part_count: 1 });

    fireEvent('word_audio:part_complete', {
      part: 'lemma',
      example_id: null,
      part_index: 0,
      total_parts: 1,
    });

    expect(result.current.progress.parts.get('lemma')).toBe('complete');
    expect(result.current.progress.partsCompleted).toBe(1);

    const cached = queryClient.getQueryData<WordEntryResponse>(['wordEntry', WORD_ENTRY_ID]);
    expect(cached?.audio_status).toBe('ready');
    // Examples untouched
    expect(cached?.examples?.every((ex) => ex.audio_status === 'pending')).toBe(true);
  });

  it('part_complete by example_id updates only the matching example', () => {
    queryClient.setQueryData(['wordEntry', WORD_ENTRY_ID], makeWordEntry());

    const { result } = renderAudioHook();
    act(() => result.current.triggerGeneration());

    fireEvent('word_audio:part_complete', {
      part: 'example',
      example_id: 'ex-2',
      part_index: 1,
      total_parts: 2,
    });

    const cached = queryClient.getQueryData<WordEntryResponse>(['wordEntry', WORD_ENTRY_ID]);
    const ex1 = cached?.examples?.find((e) => e.id === 'ex-1');
    const ex2 = cached?.examples?.find((e) => e.id === 'ex-2');
    expect(ex2?.audio_status).toBe('ready');
    // Only the matching example changed
    expect(ex1?.audio_status).toBe('pending');
    // Lemma root untouched
    expect(cached?.audio_status).toBe('pending');
  });

  it('part_complete with a mismatched example_id leaves the cache unchanged', () => {
    const original = makeWordEntry();
    queryClient.setQueryData(['wordEntry', WORD_ENTRY_ID], original);

    const { result } = renderAudioHook();
    act(() => result.current.triggerGeneration());

    fireEvent('word_audio:part_complete', {
      part: 'example',
      example_id: 'does-not-exist',
      part_index: 0,
      total_parts: 1,
    });

    const cached = queryClient.getQueryData<WordEntryResponse>(['wordEntry', WORD_ENTRY_ID]);
    // No example was corrupted; all still pending
    expect(cached?.examples?.every((ex) => ex.audio_status === 'pending')).toBe(true);
    expect(cached?.audio_status).toBe('pending');
  });

  it('part_complete for an example with null example_id leaves the cache unchanged', () => {
    queryClient.setQueryData(['wordEntry', WORD_ENTRY_ID], makeWordEntry());

    const { result } = renderAudioHook();
    act(() => result.current.triggerGeneration());

    fireEvent('word_audio:part_complete', {
      part: 'example',
      example_id: null,
      part_index: 0,
      total_parts: 1,
    });

    const cached = queryClient.getQueryData<WordEntryResponse>(['wordEntry', WORD_ENTRY_ID]);
    expect(cached?.examples?.every((ex) => ex.audio_status === 'pending')).toBe(true);
    expect(cached?.audio_status).toBe('pending');
  });

  it('complete event closes the stream, invalidates the query, and shows a success toast', () => {
    queryClient.setQueryData(['wordEntry', WORD_ENTRY_ID], makeWordEntry());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderAudioHook();
    act(() => result.current.triggerGeneration());
    fireEvent('word_audio:start', { word_entry_id: WORD_ENTRY_ID, part_count: 1 });

    fireEvent('word_audio:complete', { word_entry_id: WORD_ENTRY_ID, parts_completed: 1 });

    expect(result.current.progress.status).toBe('complete');
    expect(result.current.isGenerating).toBe(false);
    expect(capturedOnEvent).toBeUndefined(); // stream closed
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['wordEntry', WORD_ENTRY_ID],
    });
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.not.objectContaining({ variant: 'destructive' }));
  });

  it('tts/upload/persist stage events update the part stage map', () => {
    const { result } = renderAudioHook();
    act(() => result.current.triggerGeneration());
    fireEvent('word_audio:start', { word_entry_id: WORD_ENTRY_ID, part_count: 1 });

    fireEvent('word_audio:tts', { part: 'lemma', example_id: null });
    expect(result.current.progress.parts.get('lemma')).toBe('tts');

    fireEvent('word_audio:upload', { part: 'lemma', example_id: null });
    expect(result.current.progress.parts.get('lemma')).toBe('upload');

    fireEvent('word_audio:persist', { part: 'lemma', example_id: null });
    expect(result.current.progress.parts.get('lemma')).toBe('persist');
  });

  it('onError (transport-level) sets error status, closes stream, and shows destructive toast', () => {
    const { result } = renderAudioHook();
    act(() => result.current.triggerGeneration());
    expect(capturedOnError).toBeDefined();

    act(() => {
      capturedOnError?.(new Error('connection lost'));
    });

    expect(result.current.progress.status).toBe('error');
    expect(result.current.progress.errorMessage).toBe('connection lost');
    expect(capturedOnEvent).toBeUndefined(); // stream closed
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('cancel resets progress back to idle and closes the stream', () => {
    const { result } = renderAudioHook();
    act(() => result.current.triggerGeneration());
    fireEvent('word_audio:start', { word_entry_id: WORD_ENTRY_ID, part_count: 2 });
    expect(result.current.progress.status).toBe('generating');

    act(() => result.current.cancel());

    expect(result.current.progress.status).toBe('idle');
    expect(result.current.progress.totalParts).toBe(0);
    expect(result.current.progress.parts.size).toBe(0);
    expect(capturedOnEvent).toBeUndefined(); // stream closed
  });
});
