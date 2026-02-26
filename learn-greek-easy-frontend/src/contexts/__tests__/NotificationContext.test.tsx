/**
 * NotificationContext Tests
 *
 * Tests for:
 * - Change A: Filtering expected polling errors (401, 408) from Sentry reporting
 * - Change B: Pausing polling when the tab becomes hidden
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

  it('should resume polling and do an immediate refresh when tab becomes visible', async () => {
    const { unmount } = renderHook(() => useNotifications(), { wrapper });

    // Let the initial effects settle
    await act(async () => {
      await Promise.resolve();
    });

    // First hide the tab to stop polling
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

    // An immediate refresh should have fired
    const callsAfterVisible = vi.mocked(notificationAPI.fetchUnreadCount).mock.calls.length;
    expect(callsAfterVisible).toBeGreaterThan(callsWhileHidden);

    // And the interval should be running again
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(vi.mocked(notificationAPI.fetchUnreadCount).mock.calls.length).toBeGreaterThan(
      callsAfterVisible
    );

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

  it('should not start polling when tab is hidden at mount time', async () => {
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

    // Advance 3 full polling intervals — polling should NOT have fired
    await act(async () => {
      vi.advanceTimersByTime(180000);
      await Promise.resolve();
    });

    expect(vi.mocked(notificationAPI.fetchUnreadCount)).not.toHaveBeenCalled();

    // Now make the tab visible — should trigger an immediate refresh
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    // Immediate refresh on visibility restore
    expect(vi.mocked(notificationAPI.fetchUnreadCount).mock.calls.length).toBe(1);

    // Advance another interval — polling should now be running
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(vi.mocked(notificationAPI.fetchUnreadCount).mock.calls.length).toBe(2);

    unmount();
  });
});
