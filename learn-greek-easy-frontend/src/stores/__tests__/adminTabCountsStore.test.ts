/**
 * adminTabCountsStore Tests
 *
 * Covers:
 * - tabCountsFetchSeq monotonic counter discards stale (out-of-order) responses
 * - Happy-path: successful fetch commits counts
 * - Error path: error is committed when fetch fails
 * - selectTabCount selector returns 0 when counts is null, and correct value otherwise
 * - refetchAdminTabCounts fire-and-forget helper triggers fetchCounts
 */

import { act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

import {
  useAdminTabCountsStore,
  selectTabCount,
  refetchAdminTabCounts,
} from '../adminTabCountsStore';

// Mock the adminAPI module — no real network calls
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getAdminTabCounts: vi.fn(),
  },
}));

import { adminAPI } from '@/services/adminAPI';

const mockGetAdminTabCounts = adminAPI.getAdminTabCounts as MockedFunction<
  typeof adminAPI.getAdminTabCounts
>;

// Minimal counts fixture
const COUNTS_A = {
  inbox: 1,
  decks: 2,
  news: 3,
  situations: 4,
  exercises: 5,
  errors: 6,
  feedback: 7,
  changelog: 8,
  announcements: 9,
};

const COUNTS_B = {
  inbox: 10,
  decks: 20,
  news: 30,
  situations: 40,
  exercises: 50,
  errors: 60,
  feedback: 70,
  changelog: 80,
  announcements: 90,
};

describe('adminTabCountsStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAdminTabCountsStore.setState({
      counts: null,
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  // ============================================================
  // Initial state
  // ============================================================
  describe('initial state', () => {
    it('starts with counts null, loading false, error null', () => {
      const state = useAdminTabCountsStore.getState();
      expect(state.counts).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // ============================================================
  // Happy path — successful fetch
  // ============================================================
  describe('fetchCounts() — success', () => {
    it('commits counts on success', async () => {
      mockGetAdminTabCounts.mockResolvedValueOnce(COUNTS_A);

      await act(async () => {
        await useAdminTabCountsStore.getState().fetchCounts();
      });

      const state = useAdminTabCountsStore.getState();
      expect(state.counts).toEqual(COUNTS_A);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('clears a previous error on successful fetch', async () => {
      useAdminTabCountsStore.setState({ error: 'previous error', counts: null });
      mockGetAdminTabCounts.mockResolvedValueOnce(COUNTS_A);

      await act(async () => {
        await useAdminTabCountsStore.getState().fetchCounts();
      });

      expect(useAdminTabCountsStore.getState().error).toBeNull();
    });
  });

  // ============================================================
  // Error path
  // ============================================================
  describe('fetchCounts() — error', () => {
    it('sets error message and loading false when fetch rejects', async () => {
      mockGetAdminTabCounts.mockRejectedValueOnce(new Error('Network failure'));

      await act(async () => {
        await useAdminTabCountsStore.getState().fetchCounts();
      });

      const state = useAdminTabCountsStore.getState();
      expect(state.error).toBe('Network failure');
      expect(state.loading).toBe(false);
      expect(state.counts).toBeNull();
    });

    it('uses fallback message for non-Error rejections', async () => {
      mockGetAdminTabCounts.mockRejectedValueOnce('plain string error');

      await act(async () => {
        await useAdminTabCountsStore.getState().fetchCounts();
      });

      expect(useAdminTabCountsStore.getState().error).toBe('Failed to load tab counts');
    });
  });

  // ============================================================
  // Monotonic counter — stale response is discarded
  // ============================================================
  describe('tabCountsFetchSeq — stale response discarding', () => {
    it('discards result from an earlier in-flight call when a later call resolves first', async () => {
      // Create two promises we control
      let resolveFirst!: (v: typeof COUNTS_A) => void;
      let resolveSecond!: (v: typeof COUNTS_B) => void;

      const firstPromise = new Promise<typeof COUNTS_A>((res) => {
        resolveFirst = res;
      });
      const secondPromise = new Promise<typeof COUNTS_B>((res) => {
        resolveSecond = res;
      });

      mockGetAdminTabCounts.mockReturnValueOnce(firstPromise).mockReturnValueOnce(secondPromise);

      // Fire both calls without awaiting — they're now in-flight concurrently
      const call1 = useAdminTabCountsStore.getState().fetchCounts();
      const call2 = useAdminTabCountsStore.getState().fetchCounts();

      // Second call resolves first (newer data)
      await act(async () => {
        resolveSecond(COUNTS_B);
        await call2;
      });

      // State should reflect COUNTS_B
      expect(useAdminTabCountsStore.getState().counts).toEqual(COUNTS_B);

      // Now the stale first call resolves
      await act(async () => {
        resolveFirst(COUNTS_A);
        await call1;
      });

      // Stale response must be discarded — store still holds COUNTS_B
      expect(useAdminTabCountsStore.getState().counts).toEqual(COUNTS_B);
      expect(useAdminTabCountsStore.getState().loading).toBe(false);
    });

    it('discards stale error when a newer call has already succeeded', async () => {
      let rejectFirst!: (e: unknown) => void;
      let resolveSecond!: (v: typeof COUNTS_B) => void;

      const firstPromise = new Promise<typeof COUNTS_A>((_, rej) => {
        rejectFirst = rej;
      });
      const secondPromise = new Promise<typeof COUNTS_B>((res) => {
        resolveSecond = res;
      });

      mockGetAdminTabCounts.mockReturnValueOnce(firstPromise).mockReturnValueOnce(secondPromise);

      const call1 = useAdminTabCountsStore.getState().fetchCounts();
      const call2 = useAdminTabCountsStore.getState().fetchCounts();

      // Second call succeeds first
      await act(async () => {
        resolveSecond(COUNTS_B);
        await call2;
      });

      expect(useAdminTabCountsStore.getState().counts).toEqual(COUNTS_B);
      expect(useAdminTabCountsStore.getState().error).toBeNull();

      // First call fails after the fact — should be ignored
      await act(async () => {
        rejectFirst(new Error('Stale error'));
        await call1;
      });

      // Error must NOT overwrite the successful state
      expect(useAdminTabCountsStore.getState().error).toBeNull();
      expect(useAdminTabCountsStore.getState().counts).toEqual(COUNTS_B);
    });

    it('commits result when only a single call is in-flight (no contention)', async () => {
      mockGetAdminTabCounts.mockResolvedValueOnce(COUNTS_A);

      await act(async () => {
        await useAdminTabCountsStore.getState().fetchCounts();
      });

      expect(useAdminTabCountsStore.getState().counts).toEqual(COUNTS_A);
    });
  });

  // ============================================================
  // selectTabCount selector
  // ============================================================
  describe('selectTabCount selector', () => {
    it('returns 0 for any key when counts is null', () => {
      useAdminTabCountsStore.setState({ counts: null });
      const state = useAdminTabCountsStore.getState();
      expect(selectTabCount('inbox')(state)).toBe(0);
      expect(selectTabCount('feedback')(state)).toBe(0);
      expect(selectTabCount('errors')(state)).toBe(0);
    });

    it('returns the correct value for each key when counts is populated', () => {
      useAdminTabCountsStore.setState({ counts: COUNTS_A });
      const state = useAdminTabCountsStore.getState();
      expect(selectTabCount('inbox')(state)).toBe(1);
      expect(selectTabCount('decks')(state)).toBe(2);
      expect(selectTabCount('news')(state)).toBe(3);
      expect(selectTabCount('situations')(state)).toBe(4);
      expect(selectTabCount('exercises')(state)).toBe(5);
      expect(selectTabCount('errors')(state)).toBe(6);
      expect(selectTabCount('feedback')(state)).toBe(7);
      expect(selectTabCount('changelog')(state)).toBe(8);
      expect(selectTabCount('announcements')(state)).toBe(9);
    });
  });

  // ============================================================
  // refetchAdminTabCounts fire-and-forget helper
  // ============================================================
  describe('refetchAdminTabCounts()', () => {
    it('triggers fetchCounts without blocking — API is called', async () => {
      mockGetAdminTabCounts.mockResolvedValueOnce(COUNTS_A);

      // Call is fire-and-forget; flush microtasks via a small await
      refetchAdminTabCounts();
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockGetAdminTabCounts).toHaveBeenCalledTimes(1);
    });
  });
});
