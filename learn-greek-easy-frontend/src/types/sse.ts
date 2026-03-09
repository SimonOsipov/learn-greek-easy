/** SSE type definitions for Learn Greek Easy frontend.
 *
 * These types are used by the useSSE hook and all SSE-consuming components
 * to ensure consistent event handling across the application.
 */

/** A parsed SSE event with typed payload. */
export interface SSEEvent<T = unknown> {
  /** The event type (maps to SSE `event:` field). Defaults to "message" if not specified. */
  type: string;
  /** The deserialized event payload. */
  data: T;
  /** Optional event ID (maps to SSE `id:` field). */
  id?: string;
}

/** SSE connection lifecycle states. */
export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Structured error payload from an SSE error event. */
export interface SSEErrorEvent {
  /** Machine-readable error code (e.g. "auth_failed", "stream_error"). */
  code: string;
  /** Human-readable error description. */
  message: string;
}

/** Configuration options for the useSSE hook. */
export interface SSEOptions<T = unknown> {
  /** Additional request headers (Authorization is injected automatically). */
  headers?: Record<string, string>;
  /** Called for each parsed SSE event received. */
  onEvent?: (event: SSEEvent<T>) => void;
  /** Called on connection errors or server-sent error events. */
  onError?: (error: SSEErrorEvent | Error) => void;
  /** Called when the connection state transitions. */
  onStateChange?: (state: SSEConnectionState) => void;
  /** Whether to automatically reconnect on disconnect. Defaults to true. */
  reconnect?: boolean;
  /** Maximum number of reconnection attempts. Defaults to 10. */
  maxRetries?: number;
  /** Whether the connection is active. Set to false to defer connection. Defaults to true. */
  enabled?: boolean;
}

/** Return value of the useSSE hook. */
export interface UseSSEReturn {
  /** Current connection lifecycle state. */
  state: SSEConnectionState;
  /** Manually close the SSE connection and stop reconnection. */
  close: () => void;
}
