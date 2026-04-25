/**
 * useAnalytics Hook Tests
 *
 * Tests the TanStack Query-backed useAnalytics hook.
 * Mocks @/features/analytics so no real network calls are made.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { createElement } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createTestQueryClient } from '@/lib/test-utils';
import { useAnalytics } from '@/hooks/useAnalytics';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockGetAnalytics = vi.fn();

vi.mock('@/features/analytics', () => ({
  getAnalytics: (...args: unknown[]) => mockGetAnalytics(...args),
}));

// Stub stores so hook is deterministic
let mockUserId: string | undefined = 'user-123';
let mockDateRange: string = 'last7';

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: mockUserId ? { id: mockUserId } : null }),
}));

vi.mock('@/stores/dateRangeStore', () => ({
  useDateRangeStore: (selector: (s: { dateRange: string }) => unknown) =>
    selector({ dateRange: mockDateRange }),
}));

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const fixtureData = {
  overview: {
    totalReviews: 100,
    cardsStudied: 50,
    averageAccuracy: 0.85,
    totalStudyTime: 3600,
  },
  streak: {
    currentStreak: 7,
    longestStreak: 15,
    lastStudyDate: '2025-01-08T10:00:00.000Z',
  },
  progressData: [{ date: '2025-01-01', reviewCount: 10, cardsStudied: 5, accuracy: 0.8 }],
  deckStats: [],
  recentActivity: [],
};

// ---------------------------------------------------------------------------
// Helper: render hook inside a fresh QueryClientProvider
// ---------------------------------------------------------------------------

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAnalytics Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockUserId = 'user-123';
    mockDateRange = 'last7';
    mockGetAnalytics.mockResolvedValue(fixtureData);
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Load on mount
  // -------------------------------------------------------------------------

  describe('load on mount', () => {
    it('returns loading state initially then data', async () => {
      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(queryClient),
      });

      // Initial loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(fixtureData);
      expect(result.current.error).toBeNull();
    });

    it('calls getAnalytics with userId and dateRange', async () => {
      renderHook(() => useAnalytics(), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(mockGetAnalytics).toHaveBeenCalledTimes(1));

      expect(mockGetAnalytics).toHaveBeenCalledWith('user-123', 'last7');
    });
  });

  // -------------------------------------------------------------------------
  // enabled: !!userId — no fetch when unauthenticated
  // -------------------------------------------------------------------------

  describe('no fetch when no userId', () => {
    it('does not call getAnalytics when userId is undefined', async () => {
      mockUserId = undefined;

      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(queryClient),
      });

      // Not loading (disabled query), not fetching
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      // Give Query a tick to potentially fire (it should not)
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockGetAnalytics).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  describe('error state', () => {
    it('exposes error when getAnalytics rejects', async () => {
      const apiError = new Error('Network failure');
      mockGetAnalytics.mockRejectedValue(apiError);

      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // AC #4: refetchInterval: false — no poll-based refetch
  // -------------------------------------------------------------------------

  describe('refetchInterval: false', () => {
    it('does not refetch automatically after 10 minutes (called exactly once)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        const { result } = renderHook(() => useAnalytics(), {
          wrapper: makeWrapper(queryClient),
        });

        // Wait for initial fetch to complete
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(mockGetAnalytics).toHaveBeenCalledTimes(1);

        // Advance timers by 10 minutes — no interval-based refetch should fire
        await act(async () => {
          vi.advanceTimersByTime(10 * 60 * 1000);
          await Promise.resolve();
        });

        expect(mockGetAnalytics).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC #5: refetchOnWindowFocus — extra fetch on window focus
  //
  // TanStack Query v5 subscribes to `visibilitychange` on window via its
  // internal focusManager. In happy-dom, `document.visibilityState` is
  // read-only so dispatching the DOM event doesn't flip the manager state.
  //
  // The official testing approach: use `focusManager.setFocused(true/false)`
  // to drive the focus manager directly — this triggers `onFocus()` on the
  // QueryCache just as a real visibilitychange event would.
  // -------------------------------------------------------------------------

  describe('refetchOnWindowFocus: true', () => {
    it('triggers exactly one extra fetch when window regains focus', async () => {
      // Use a client that does NOT globally disable refetchOnWindowFocus.
      const focusQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: Infinity,
            staleTime: 0, // data immediately stale — focus triggers refetch
          },
        },
      });

      // Use fake timers so we can advance past the hook's staleTime (5 min)
      // without waiting in real time. We need data to be stale before the
      // focus transition, since refetchOnWindowFocus: true only refetches stale data.
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        const { result } = renderHook(() => useAnalytics(), {
          wrapper: makeWrapper(focusQueryClient),
        });

        // Wait for initial fetch to complete
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(mockGetAnalytics).toHaveBeenCalledTimes(1);

        // Advance time past staleTime (5 min + 1s) so data becomes stale
        await act(async () => {
          vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
          await Promise.resolve();
        });

        // Simulate focus loss then regain:
        // setFocused(false) → setFocused(true) creates the false→true transition
        // that causes QueryClient to call queryCache.onFocus() and refetch stale queries.
        await act(async () => {
          focusManager.setFocused(false);
        });
        await act(async () => {
          focusManager.setFocused(true);
          await Promise.resolve();
        });

        await waitFor(() => expect(mockGetAnalytics).toHaveBeenCalledTimes(2));
      } finally {
        vi.useRealTimers();
        // Restore default focus management (unset manual override)
        focusManager.setFocused(undefined);
        focusQueryClient.clear();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Back-compat aliases
  // -------------------------------------------------------------------------

  describe('back-compat aliases', () => {
    it('exposes loading alias that mirrors isLoading', async () => {
      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(queryClient),
      });

      expect(result.current.loading).toBe(result.current.isLoading);

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.loading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // _autoLoad param is a no-op (backward-compat regression)
  // -------------------------------------------------------------------------

  describe('auto-load behavior', () => {
    it('fetches on mount automatically when userId is set', async () => {
      const { result } = renderHook(() => useAnalytics(), {
        wrapper: makeWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockGetAnalytics).toHaveBeenCalledTimes(1);
    });
  });
});
