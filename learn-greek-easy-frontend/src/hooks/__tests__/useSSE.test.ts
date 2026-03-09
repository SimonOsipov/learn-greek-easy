/**
 * Tests for useSSE hook and parseSSEChunk parser.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockSSEStream } from '@/lib/sseTestUtils';
import { parseSSEChunk, useSSE } from '../useSSE';

// ---------------------------------------------------------------------------
// parseSSEChunk tests
// ---------------------------------------------------------------------------

describe('parseSSEChunk', () => {
  it('parses a single event with data only', () => {
    const events = parseSSEChunk('data: hello\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('message');
    expect(events[0].data).toBe('hello');
  });

  it('parses JSON data', () => {
    const events = parseSSEChunk('data: {"key":"value"}\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ key: 'value' });
  });

  it('parses event type', () => {
    const events = parseSSEChunk('event: progress\ndata: 50\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('progress');
  });

  it('parses event id', () => {
    const events = parseSSEChunk('id: 42\ndata: test\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('42');
  });

  it('handles multiline data', () => {
    const events = parseSSEChunk('data: line1\ndata: line2\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('line1\nline2');
  });

  it('ignores comment lines (heartbeats)', () => {
    const events = parseSSEChunk(': heartbeat\ndata: real\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('real');
  });

  it('parses multiple events in one chunk', () => {
    const events = parseSSEChunk('data: first\n\ndata: second\n\n');
    expect(events).toHaveLength(2);
    expect(events[0].data).toBe('first');
    expect(events[1].data).toBe('second');
  });

  it('returns empty array for comment-only chunk', () => {
    const events = parseSSEChunk(': heartbeat\n\n');
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useSSE hook tests
// ---------------------------------------------------------------------------

describe('useSSE', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const makeMockResponse = (stream: ReadableStream<Uint8Array>, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      body: stream,
      headers: new Headers(),
    }) as unknown as Response;

  it('connects on mount when enabled', async () => {
    mockFetch.mockResolvedValue(makeMockResponse(createMockSSEStream([{ data: 'hello' }])));

    const { result } = renderHook(() => useSSE('/api/test', { onEvent: vi.fn() }));

    await waitFor(() => {
      expect(result.current.state).toBe('connected');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'text/event-stream' }),
      })
    );
  });

  it('calls onEvent for each received event', async () => {
    const onEvent = vi.fn();
    mockFetch.mockResolvedValue(
      makeMockResponse(
        createMockSSEStream([
          { type: 'update', data: { count: 1 } },
          { type: 'update', data: { count: 2 } },
        ])
      )
    );

    renderHook(() => useSSE('/api/test', { onEvent }));

    await waitFor(() => {
      expect(onEvent).toHaveBeenCalledTimes(2);
    });

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'update' }));
  });

  it('does not connect when enabled is false', () => {
    renderHook(() => useSSE('/api/test', { onEvent: vi.fn(), enabled: false }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('cleans up on unmount', async () => {
    mockFetch.mockResolvedValue(makeMockResponse(createMockSSEStream([{ data: 'hello' }])));

    const { unmount } = renderHook(() => useSSE('/api/test', { onEvent: vi.fn() }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    unmount();

    // After unmount, fetch should not be called again
    const callCountAfterUnmount = mockFetch.mock.calls.length;
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetch.mock.calls.length).toBe(callCountAfterUnmount);
  });

  it('close() sets state to disconnected', async () => {
    mockFetch.mockResolvedValue(makeMockResponse(createMockSSEStream([{ data: 'hello' }])));

    const { result } = renderHook(() => useSSE('/api/test', { onEvent: vi.fn() }));

    await waitFor(() => expect(result.current.state).toBe('connected'));

    act(() => {
      result.current.close();
    });

    expect(result.current.state).toBe('disconnected');
  });
});
