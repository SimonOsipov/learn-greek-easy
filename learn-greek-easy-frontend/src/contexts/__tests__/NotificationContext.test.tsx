/**
 * NotificationContext Tests
 *
 * Tests for:
 * - Change A: Filtering expected polling errors (401, 408) from Sentry reporting
 * - Change B: Tab visibility drives SSE connection (SSE enabled only when tab is visible)
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { NotificationProvider, useNotifications } from '../NotificationContext';
import { APIRequestError } from '@/services/api';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      isAuthenticated: true,
      user: { preferences: { notifications: true } },
    })
  ),
  useHasHydrated: vi.fn(() => true),
}));

vi.mock('@/stores/appStore', () => ({
  useAppStore: vi.fn((selector) =>
    selector({
      authInitialized: true,
    })
  ),
}));

vi.mock('@/services/notificationAPI', () => ({
  fetchNotifications: vi.fn().mockResolvedValue({
    notifications: [],
    unread_count: 0,
    has_more: false,
  }),
  fetchUnreadCount: vi.fn().mockResolvedValue(0),
  markNotificationAsRead: vi.fn().mockResolvedValue({}),
  markAllNotificationsAsRead: vi.fn().mockResolvedValue({}),
  deleteNotification: vi.fn().mockResolvedValue({}),
  clearAllNotifications: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

async function getNotificationContext() {
  const { result } = renderHook(() => useNotifications(), { wrapper });
  // Wait for initial fetch to settle
  await waitFor(() => expect(result.current).toBeDefined());
  return result;
}

// ---------------------------------------------------------------------------
// Imports used inside tests (after mocks are in place)
// ---------------------------------------------------------------------------

import * as notificationAPI from '@/services/notificationAPI';
import { reportAPIError } from '@/lib/errorReporting';
import { useSSE } from '@/hooks/useSSE';
import { useAuthStore, useHasHydrated } from '@/stores/authStore';
import { useAppStore } from '@/stores/appStore';
import type { SSEConnectionState, SSEEvent, SSEOptions } from '@/types/sse';

// ---------------------------------------------------------------------------
// Change A: Error filtering
// ---------------------------------------------------------------------------

describe('Change A — refreshUnreadCount error filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: fetchUnreadCount resolves normally
    vi.mocked(notificationAPI.fetchNotifications).mockResolvedValue({
      notifications: [],
      unread_count: 0,
      has_more: false,
    });
    vi.mocked(notificationAPI.fetchUnreadCount).mockResolvedValue(0);
  });

  it('should NOT report a 401 APIRequestError to Sentry', async () => {
    const error401 = new APIRequestError({
      status: 401,
      statusText: 'Unauthorized',
      message: 'Unauthorized',
    });
    vi.mocked(notificationAPI.fetchUnreadCount).mockRejectedValueOnce(error401);

    const result = await getNotificationContext();

    await act(async () => {
      await result.current.refreshUnreadCount();
    });

    expect(reportAPIError).not.toHaveBeenCalled();
  });

  it('should NOT report a 408 APIRequestError to Sentry', async () => {
    const error408 = new APIRequestError({
      status: 408,
      statusText: 'Request Timeout',
      message: 'Request Timeout',
    });
    vi.mocked(notificationAPI.fetchUnreadCount).mockRejectedValueOnce(error408);

    const result = await getNotificationContext();

    await act(async () => {
      await result.current.refreshUnreadCount();
    });

    expect(reportAPIError).not.toHaveBeenCalled();
  });

  it('should still report a 500 APIRequestError to Sentry', async () => {
    const error500 = new APIRequestError({
      status: 500,
      statusText: 'Internal Server Error',
      message: 'Internal Server Error',
    });
    vi.mocked(notificationAPI.fetchUnreadCount).mockRejectedValueOnce(error500);

    const result = await getNotificationContext();

    await act(async () => {
      await result.current.refreshUnreadCount();
    });

    expect(reportAPIError).toHaveBeenCalledWith(error500, {
      operation: 'refreshUnreadCount',
      endpoint: '/notifications/unread-count',
    });
  });

  it('should still report non-APIRequestError errors to Sentry', async () => {
    const genericError = new Error('Network failure');
    vi.mocked(notificationAPI.fetchUnreadCount).mockRejectedValueOnce(genericError);

    const result = await getNotificationContext();

    await act(async () => {
      await result.current.refreshUnreadCount();
    });

    expect(reportAPIError).toHaveBeenCalledWith(genericError, {
      operation: 'refreshUnreadCount',
      endpoint: '/notifications/unread-count',
    });
  });
});

// ---------------------------------------------------------------------------
// Change B: Visibility-aware polling
// ---------------------------------------------------------------------------

describe('Change B — visibility-aware polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(notificationAPI.fetchNotifications).mockResolvedValue({
      notifications: [],
      unread_count: 0,
      has_more: false,
    });
    vi.mocked(notificationAPI.fetchUnreadCount).mockResolvedValue(0);

    // Reset visibility to 'visible' before each test
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should stop polling when tab becomes hidden', async () => {
    const { unmount } = renderHook(() => useNotifications(), { wrapper });

    // Let the initial effects settle
    await act(async () => {
      await Promise.resolve();
    });

    const callsBefore = vi.mocked(notificationAPI.fetchUnreadCount).mock.calls.length;

    // Hide the tab
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Advance time past the polling interval — should NOT trigger another poll
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    const callsAfter = vi.mocked(notificationAPI.fetchUnreadCount).mock.calls.length;
    expect(callsAfter).toBe(callsBefore);

    unmount();
  });

  it('should not trigger polling refresh when tab becomes visible (SSE reconnects instead)', async () => {
    const { unmount } = renderHook(() => useNotifications(), { wrapper });

    // Let the initial effects settle
    await act(async () => {
      await Promise.resolve();
    });

    // First hide the tab
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const callsWhileHidden = vi.mocked(notificationAPI.fetchUnreadCount).mock.calls.length;

    // Now make the tab visible again
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    // No extra polling calls — SSE handles reconnection, not fetchUnreadCount
    const callsAfterVisible = vi.mocked(notificationAPI.fetchUnreadCount).mock.calls.length;
    expect(callsAfterVisible).toBe(callsWhileHidden);

    // Polling interval should NOT fire (fallback polling is not active)
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(vi.mocked(notificationAPI.fetchUnreadCount).mock.calls.length).toBe(callsAfterVisible);

    unmount();
  });

  it('should clean up the visibilitychange event listener on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useNotifications(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  it('should not poll when tab is hidden (SSE disabled when hidden)', async () => {
    // Set hidden BEFORE mounting
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    const { unmount } = renderHook(() => useNotifications(), { wrapper });

    // Let initial effects settle
    await act(async () => {
      await Promise.resolve();
    });

    // Isolate from the initial fetch by clearing the mock now
    vi.mocked(notificationAPI.fetchUnreadCount).mockClear();

    // Advance 3 full polling intervals — polling should NOT have fired (no fallback polling active)
    await act(async () => {
      vi.advanceTimersByTime(180000);
      await Promise.resolve();
    });

    expect(vi.mocked(notificationAPI.fetchUnreadCount)).not.toHaveBeenCalled();

    // Now make the tab visible — SSE reconnects, no polling refresh triggered
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    // No polling refresh — SSE handles real-time updates
    expect(vi.mocked(notificationAPI.fetchUnreadCount)).not.toHaveBeenCalled();

    // Advance another interval — polling still should not fire (SSE is primary)
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(vi.mocked(notificationAPI.fetchUnreadCount)).not.toHaveBeenCalled();

    unmount();
  });
});

// ---------------------------------------------------------------------------
// SSE integration
// ---------------------------------------------------------------------------

describe('SSE integration', () => {
  let capturedOnEvent: ((event: SSEEvent<unknown>) => void) | undefined;
  let capturedOnStateChange: ((state: SSEConnectionState) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    // Restore store mocks cleared by clearAllMocks
    vi.mocked(useAuthStore).mockImplementation((selector: (state: any) => any) =>
      selector({
        isAuthenticated: true,
        user: { preferences: { notifications: true } },
      })
    );
    vi.mocked(useHasHydrated).mockReturnValue(true);
    vi.mocked(useAppStore).mockImplementation((selector: (state: any) => any) =>
      selector({ authInitialized: true })
    );

    vi.mocked(notificationAPI.fetchNotifications).mockResolvedValue({
      notifications: [],
      unread_count: 0,
      has_more: false,
    });
    vi.mocked(notificationAPI.fetchUnreadCount).mockResolvedValue(0);

    // Reset visibility to visible
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });

    capturedOnEvent = undefined;
    capturedOnStateChange = undefined;
    vi.mocked(useSSE).mockImplementation((_url: string, options: SSEOptions<unknown>) => {
      capturedOnEvent = options.onEvent;
      capturedOnStateChange = options.onStateChange;
      return { state: 'connected' as SSEConnectionState, close: vi.fn() };
    });
  });

  it('calls useSSE with correct URL and enabled:true when authenticated', async () => {
    renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => {
      expect(vi.mocked(useSSE)).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/stream'),
        expect.objectContaining({ enabled: true })
      );
    });
  });

  it('calls useSSE with enabled:false when not authenticated', async () => {
    // Override auth to return not authenticated
    vi.mocked(useAuthStore).mockImplementation((selector: (state: any) => any) =>
      selector({
        isAuthenticated: false,
        user: { preferences: { notifications: true } },
      })
    );
    renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => {
      expect(vi.mocked(useSSE)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ enabled: false })
      );
    });
  });

  it('updates unreadCount on unread_count SSE event', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(capturedOnEvent).toBeDefined());

    act(() => {
      capturedOnEvent!({ type: 'unread_count', data: { count: 7 } });
    });

    expect(result.current.unreadCount).toBe(7);
  });

  it('activates fallback polling when SSE state becomes error', async () => {
    // Render with real timers to capture callbacks synchronously
    renderHook(() => useNotifications(), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(capturedOnStateChange).toBeDefined();

    // Trigger SSE error state — this sets useFallbackPolling=true
    // which triggers the fallback polling useEffect to call refreshUnreadCount immediately
    await act(async () => {
      capturedOnStateChange!('error');
      // Flush microtasks and React state updates
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(vi.mocked(notificationAPI.fetchUnreadCount)).toHaveBeenCalled();
  });

  it('no polling interval when SSE is connected', async () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useNotifications(), { wrapper });
      await act(async () => {
        await Promise.resolve();
      });

      vi.mocked(notificationAPI.fetchUnreadCount).mockClear();
      await act(async () => {
        vi.advanceTimersByTime(120000);
        await Promise.resolve();
      });

      expect(vi.mocked(notificationAPI.fetchUnreadCount)).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
