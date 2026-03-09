/**
 * Tests for useAnalyticsSSE hook.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SSEConnectionState, SSEEvent, SSEOptions } from '@/types/sse';

// Mock useSSE before importing the hook
vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn().mockReturnValue({ state: 'disconnected' as SSEConnectionState, close: vi.fn() }),
  parseSSEChunk: vi.fn(),
}));

// Mock analytics store
const mockRefreshAnalytics = vi.fn();
vi.mock('@/stores/analyticsStore', () => ({
  useAnalyticsStore: vi.fn((selector: (s: any) => any) =>
    selector({ refreshAnalytics: mockRefreshAnalytics })
  ),
}));

// Mock auth store
const mockUser = { id: 'user-123', email: 'test@example.com' };
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector: (s: any) => any) => selector({ user: mockUser })),
}));

import { useSSE } from '@/hooks/useSSE';
import { useAuthStore } from '@/stores/authStore';
import { useAnalyticsSSE } from '../useAnalyticsSSE';

describe('useAnalyticsSSE', () => {
  let capturedOptions: SSEOptions<unknown> | null = null;

  beforeEach(() => {
    capturedOptions = null;
    vi.mocked(useSSE).mockImplementation((_url: string, options: SSEOptions<unknown>) => {
      capturedOptions = options;
      return { state: 'disconnected' as SSEConnectionState, close: vi.fn() };
    });
    // Reset auth store mock to default (user present)
    vi.mocked(useAuthStore).mockImplementation((selector: (s: any) => any) =>
      selector({ user: mockUser })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls useSSE with correct URL and enabled:true when user is set', () => {
    renderHook(() => useAnalyticsSSE());

    expect(useSSE).toHaveBeenCalledWith(
      '/api/v1/progress/stream',
      expect.objectContaining({ enabled: true })
    );
  });

  it('calls useSSE with enabled:false when user is null', () => {
    vi.mocked(useAuthStore).mockImplementation((selector: (s: any) => any) =>
      selector({ user: null })
    );

    renderHook(() => useAnalyticsSSE());

    expect(useSSE).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ enabled: false })
    );
  });

  it('calls refreshAnalytics on dashboard_updated event', () => {
    renderHook(() => useAnalyticsSSE());

    act(() => {
      capturedOptions?.onEvent?.({
        type: 'dashboard_updated',
        data: { reason: 'review_completed' },
      } as SSEEvent<unknown>);
    });

    expect(mockRefreshAnalytics).toHaveBeenCalled();
  });

  it('does not call refreshAnalytics on unrelated SSE events', () => {
    renderHook(() => useAnalyticsSSE());

    act(() => {
      capturedOptions?.onEvent?.({
        type: 'heartbeat',
        data: {},
      } as SSEEvent<unknown>);
    });

    expect(mockRefreshAnalytics).not.toHaveBeenCalled();
  });

  it('calls refreshAnalytics when SSE connects', () => {
    renderHook(() => useAnalyticsSSE());
    mockRefreshAnalytics.mockClear();

    act(() => {
      capturedOptions?.onStateChange?.('connected');
    });

    expect(mockRefreshAnalytics).toHaveBeenCalled();
  });

  it('starts polling on SSE error state', () => {
    vi.useFakeTimers();

    renderHook(() => useAnalyticsSSE());
    mockRefreshAnalytics.mockClear();

    act(() => {
      capturedOptions?.onStateChange?.('error');
    });

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(mockRefreshAnalytics).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('stops polling when SSE reconnects', () => {
    vi.useFakeTimers();

    renderHook(() => useAnalyticsSSE());

    act(() => {
      capturedOptions?.onStateChange?.('error');
    });
    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    act(() => {
      capturedOptions?.onStateChange?.('connected');
    });
    mockRefreshAnalytics.mockClear();
    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    // After reconnect, polling is stopped — only at most the reconnect refresh fires
    expect(mockRefreshAnalytics.mock.calls.length).toBeLessThanOrEqual(1);

    vi.useRealTimers();
  });

  it('clears polling interval on unmount', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = renderHook(() => useAnalyticsSSE());

    act(() => {
      capturedOptions?.onStateChange?.('error');
    });
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    vi.useRealTimers();
    clearIntervalSpy.mockRestore();
  });
});
