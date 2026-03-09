/**
 * useSSE — React hook for consuming Server-Sent Events via fetch() + ReadableStream.
 *
 * Uses fetch() instead of EventSource to support Authorization headers.
 * Handles connection lifecycle, SSE protocol parsing, auth token injection,
 * and exponential backoff reconnection.
 */

import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';
import type {
  SSEConnectionState,
  SSEErrorEvent,
  SSEEvent,
  SSEOptions,
  UseSSEReturn,
} from '@/types/sse';

// ---------------------------------------------------------------------------
// SSE Text Protocol Parser
// ---------------------------------------------------------------------------

/**
 * Parse a raw SSE text chunk into an array of SSEEvent objects.
 * Exported for unit testing.
 */
export function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = chunk.split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;

    let eventType = 'message';
    const dataLines: string[] = [];
    let id: string | undefined;
    // retry value stored but applied via reconnect logic
    // let serverRetry: number | undefined;

    for (const line of block.split('\n')) {
      if (line.startsWith(':')) {
        // Comment (heartbeat) — ignore
        continue;
      } else if (line.startsWith('data: ')) {
        dataLines.push(line.slice(6));
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5));
      } else if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('id: ')) {
        id = line.slice(4).trim();
      } else if (line.startsWith('id:')) {
        id = line.slice(3).trim();
      }
      // retry: lines are silently consumed
    }

    if (dataLines.length === 0) continue;

    const rawData = dataLines.join('\n');
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawData);
    } catch {
      parsedData = rawData;
    }

    const event: SSEEvent = { type: eventType, data: parsedData };
    if (id !== undefined) event.id = id;
    events.push(event);
  }

  return events;
}

// ---------------------------------------------------------------------------
// Backoff helper
// ---------------------------------------------------------------------------

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

function getBackoffDelay(attempt: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
}

// ---------------------------------------------------------------------------
// useSSE hook
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RETRIES = 10;

export function useSSE<T = unknown>(url: string, options: SSEOptions<T>): UseSSEReturn {
  const {
    headers: extraHeaders,
    method = 'GET',
    body,
    onEvent,
    onError,
    onStateChange,
    reconnect = true,
    maxRetries = DEFAULT_MAX_RETRIES,
    enabled = true,
  } = options;

  const [state, setState] = useState<SSEConnectionState>('disconnected');

  // Refs for mutable state that shouldn't trigger re-renders
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isManualCloseRef = useRef(false);

  const updateState = (newState: SSEConnectionState) => {
    setState(newState);
    onStateChange?.(newState);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const connect = async (signal: AbortSignal) => {
    if (!isMountedRef.current || isManualCloseRef.current) return;

    updateState('connecting');

    try {
      // Inject auth token
      const requestHeaders: Record<string, string> = {
        Accept: 'text/event-stream',
        ...extraHeaders,
      };

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        requestHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(url, {
        method,
        headers: {
          ...requestHeaders,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      // Connected successfully — reset retry counter
      retryCountRef.current = 0;
      updateState('connected');

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete events (terminated by \n\n)
        const lastDoubleNewline = buffer.lastIndexOf('\n\n');
        if (lastDoubleNewline !== -1) {
          const complete = buffer.slice(0, lastDoubleNewline + 2);
          buffer = buffer.slice(lastDoubleNewline + 2);

          const events = parseSSEChunk(complete);
          for (const event of events) {
            if (event.type === 'error') {
              onError?.(event.data as SSEErrorEvent);
            } else {
              onEvent?.(event as SSEEvent<T>);
            }
          }
        }
      }

      // Stream ended cleanly
      if (!isMountedRef.current || isManualCloseRef.current) return;
    } catch (err) {
      if (!isMountedRef.current || isManualCloseRef.current) return;
      if ((err as Error).name === 'AbortError') return;

      onError?.(err instanceof Error ? err : new Error(String(err)));
    }

    // Schedule reconnect if appropriate
    if (!isMountedRef.current || isManualCloseRef.current || !reconnect) {
      updateState('disconnected');
      return;
    }

    if (retryCountRef.current >= maxRetries) {
      updateState('error');
      return;
    }

    retryCountRef.current += 1;
    const delay = getBackoffDelay(retryCountRef.current - 1);

    reconnectTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current || isManualCloseRef.current) return;
      const newAbort = new AbortController();
      abortControllerRef.current = newAbort;
      void connect(newAbort.signal);
    }, delay);
  };

  useEffect(() => {
    isMountedRef.current = true;
    isManualCloseRef.current = false;

    if (!enabled) {
      updateState('disconnected');
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    retryCountRef.current = 0;
    void connect(abortController.signal);

    return () => {
      isMountedRef.current = false;
      clearReconnectTimer();
      abortController.abort();
      abortControllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  const close = () => {
    isManualCloseRef.current = true;
    retryCountRef.current = 0;
    clearReconnectTimer();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    updateState('disconnected');
  };

  return { state, close };
}

// ---------------------------------------------------------------------------
// Integration patterns (for reference by SSE consumers)
// ---------------------------------------------------------------------------

// Zustand integration:
//   onEvent: (event) => useMyStore.getState().handleSSEEvent(event.data)
//
// TanStack Query integration:
//   onEvent: (event) => {
//     queryClient.setQueryData(['key'], (old) => mergeUpdate(old, event.data));
//     // or: queryClient.invalidateQueries({ queryKey: ['key'] });
//   }
