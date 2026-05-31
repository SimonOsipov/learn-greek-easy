/**
 * xpStore Tests
 *
 * Tests for the Zustand XP store including:
 * - 5-minute TTL cache: hit/miss respects TTL
 * - forceRefresh bypasses cache even when fresh
 * - clearXPData resets every field (logout cleanup)
 * - selectLevelProgress for level 15, level < 15, null xpStats
 * - refreshAll nullifies caches then parallel-fetches
 */

import { act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { xpAPI } from '@/services/xpAPI';
import type { XPStatsResponse, AchievementsListResponse } from '@/services/xpAPI';

import {
  useXPStore,
  selectLevelProgress,
  selectIsMaxLevel,
  selectXPStats,
  selectAchievements,
  selectIsLoadingStats,
  selectIsLoadingAchievements,
  selectXPError,
} from '../xpStore';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/services/xpAPI', () => ({
  xpAPI: {
    getStats: vi.fn(),
    getAchievements: vi.fn(),
  },
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeXPStats(overrides: Partial<XPStatsResponse> = {}): XPStatsResponse {
  return {
    total_xp: 1000,
    current_level: 5,
    level_name_greek: 'Ενδιάμεσος',
    level_name_english: 'Intermediate',
    xp_in_level: 200,
    xp_for_next_level: 500,
    progress_percentage: 40,
    ...overrides,
  };
}

function makeAchievements(
  overrides: Partial<AchievementsListResponse> = {}
): AchievementsListResponse {
  return {
    achievements: [],
    total_count: 10,
    unlocked_count: 3,
    total_xp_earned: 300,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('xpStore', () => {
  beforeEach(() => {
    // Reset to clean state before each test
    useXPStore.getState().clearXPData();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------
  describe('Initial State', () => {
    it('has correct initial state', () => {
      const state = useXPStore.getState();
      expect(state.xpStats).toBeNull();
      expect(state.achievements).toBeNull();
      expect(state.loadingStats).toBe(false);
      expect(state.loadingAchievements).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastStatsFetch).toBeNull();
      expect(state.lastAchievementsFetch).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // clearXPData — logout cleanup
  // -------------------------------------------------------------------------
  describe('clearXPData', () => {
    it('resets every field on logout', async () => {
      vi.mocked(xpAPI.getStats).mockResolvedValue(makeXPStats());
      vi.mocked(xpAPI.getAchievements).mockResolvedValue(makeAchievements());

      await act(async () => {
        await useXPStore.getState().loadXPStats();
        await useXPStore.getState().loadAchievements();
      });

      // Verify data was loaded
      expect(useXPStore.getState().xpStats).not.toBeNull();
      expect(useXPStore.getState().achievements).not.toBeNull();
      expect(useXPStore.getState().lastStatsFetch).not.toBeNull();
      expect(useXPStore.getState().lastAchievementsFetch).not.toBeNull();

      // Simulate error state and loading state
      useXPStore.setState({ error: 'some error', loadingStats: true });

      act(() => {
        useXPStore.getState().clearXPData();
      });

      const state = useXPStore.getState();
      expect(state.xpStats).toBeNull();
      expect(state.achievements).toBeNull();
      expect(state.loadingStats).toBe(false);
      expect(state.loadingAchievements).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastStatsFetch).toBeNull();
      expect(state.lastAchievementsFetch).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Cache TTL — loadXPStats
  // -------------------------------------------------------------------------
  describe('loadXPStats — 5-minute TTL cache', () => {
    it('fetches on first call (cache miss)', async () => {
      const mockStats = makeXPStats();
      vi.mocked(xpAPI.getStats).mockResolvedValue(mockStats);

      await act(async () => {
        await useXPStore.getState().loadXPStats();
      });

      expect(xpAPI.getStats).toHaveBeenCalledTimes(1);
      expect(useXPStore.getState().xpStats).toEqual(mockStats);
    });

    it('uses cached data within TTL (cache hit — no API call)', async () => {
      vi.mocked(xpAPI.getStats).mockResolvedValue(makeXPStats());

      // First fetch — populates cache
      await act(async () => {
        await useXPStore.getState().loadXPStats();
      });

      // Advance time within TTL (4 minutes)
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Second call — should use cache, not call API again
      await act(async () => {
        await useXPStore.getState().loadXPStats();
      });

      expect(xpAPI.getStats).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after TTL expires (cache miss after 5 min)', async () => {
      vi.mocked(xpAPI.getStats).mockResolvedValue(makeXPStats());

      // First fetch
      await act(async () => {
        await useXPStore.getState().loadXPStats();
      });

      // Advance time past TTL (5 minutes + 1ms)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      // Second call — cache expired, should re-fetch
      await act(async () => {
        await useXPStore.getState().loadXPStats();
      });

      expect(xpAPI.getStats).toHaveBeenCalledTimes(2);
    });

    it('forceRefresh bypasses cache even when data is fresh', async () => {
      vi.mocked(xpAPI.getStats).mockResolvedValue(makeXPStats());

      // First fetch
      await act(async () => {
        await useXPStore.getState().loadXPStats();
      });

      // Advance time within TTL
      vi.advanceTimersByTime(60 * 1000);

      // Force refresh — should call API again despite fresh cache
      await act(async () => {
        await useXPStore.getState().loadXPStats(true);
      });

      expect(xpAPI.getStats).toHaveBeenCalledTimes(2);
    });

    it('updates lastStatsFetch timestamp after fetch', async () => {
      vi.mocked(xpAPI.getStats).mockResolvedValue(makeXPStats());

      const before = Date.now();
      await act(async () => {
        await useXPStore.getState().loadXPStats();
      });
      const after = Date.now();

      const { lastStatsFetch } = useXPStore.getState();
      expect(lastStatsFetch).not.toBeNull();
      expect(lastStatsFetch!).toBeGreaterThanOrEqual(before);
      expect(lastStatsFetch!).toBeLessThanOrEqual(after);
    });
  });

  // -------------------------------------------------------------------------
  // Cache TTL — loadAchievements
  // -------------------------------------------------------------------------
  describe('loadAchievements — 5-minute TTL cache', () => {
    it('fetches on first call (cache miss)', async () => {
      const mockAchievements = makeAchievements();
      vi.mocked(xpAPI.getAchievements).mockResolvedValue(mockAchievements);

      await act(async () => {
        await useXPStore.getState().loadAchievements();
      });

      expect(xpAPI.getAchievements).toHaveBeenCalledTimes(1);
      expect(useXPStore.getState().achievements).toEqual(mockAchievements);
    });

    it('uses cached data within TTL (cache hit)', async () => {
      vi.mocked(xpAPI.getAchievements).mockResolvedValue(makeAchievements());

      await act(async () => {
        await useXPStore.getState().loadAchievements();
      });

      // Advance 4 minutes (within TTL)
      vi.advanceTimersByTime(4 * 60 * 1000);

      await act(async () => {
        await useXPStore.getState().loadAchievements();
      });

      expect(xpAPI.getAchievements).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after TTL expires', async () => {
      vi.mocked(xpAPI.getAchievements).mockResolvedValue(makeAchievements());

      await act(async () => {
        await useXPStore.getState().loadAchievements();
      });

      // Advance past TTL
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      await act(async () => {
        await useXPStore.getState().loadAchievements();
      });

      expect(xpAPI.getAchievements).toHaveBeenCalledTimes(2);
    });

    it('forceRefresh bypasses cache even when fresh', async () => {
      vi.mocked(xpAPI.getAchievements).mockResolvedValue(makeAchievements());

      await act(async () => {
        await useXPStore.getState().loadAchievements();
      });

      vi.advanceTimersByTime(60 * 1000);

      await act(async () => {
        await useXPStore.getState().loadAchievements(true);
      });

      expect(xpAPI.getAchievements).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('sets error message when loadXPStats fails', async () => {
      vi.mocked(xpAPI.getStats).mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await useXPStore.getState().loadXPStats();
      });

      const state = useXPStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.loadingStats).toBe(false);
      expect(state.xpStats).toBeNull();
    });

    it('sets generic error message for non-Error rejections', async () => {
      vi.mocked(xpAPI.getStats).mockRejectedValue('string error');

      await act(async () => {
        await useXPStore.getState().loadXPStats();
      });

      expect(useXPStore.getState().error).toBe('Failed to load XP stats');
    });

    it('sets error message when loadAchievements fails', async () => {
      vi.mocked(xpAPI.getAchievements).mockRejectedValue(new Error('Auth expired'));

      await act(async () => {
        await useXPStore.getState().loadAchievements();
      });

      const state = useXPStore.getState();
      expect(state.error).toBe('Auth expired');
      expect(state.loadingAchievements).toBe(false);
      expect(state.achievements).toBeNull();
    });

    it('clears error on successful loadXPStats after previous error', async () => {
      useXPStore.setState({ error: 'previous error' });
      vi.mocked(xpAPI.getStats).mockResolvedValue(makeXPStats());

      await act(async () => {
        await useXPStore.getState().loadXPStats(true);
      });

      expect(useXPStore.getState().error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // refreshAll
  // -------------------------------------------------------------------------
  describe('refreshAll', () => {
    it('nullifies both cache timestamps before fetching', async () => {
      // Pre-seed cache timestamps
      useXPStore.setState({
        lastStatsFetch: Date.now(),
        lastAchievementsFetch: Date.now(),
        xpStats: makeXPStats(),
        achievements: makeAchievements(),
      });

      let statsTimestampDuringFetch: number | null | undefined;
      let achievementsTimestampDuringFetch: number | null | undefined;

      vi.mocked(xpAPI.getStats).mockImplementation(async () => {
        statsTimestampDuringFetch = useXPStore.getState().lastStatsFetch;
        achievementsTimestampDuringFetch = useXPStore.getState().lastAchievementsFetch;
        return makeXPStats();
      });
      vi.mocked(xpAPI.getAchievements).mockResolvedValue(makeAchievements());

      await act(async () => {
        await useXPStore.getState().refreshAll();
      });

      expect(statsTimestampDuringFetch).toBeNull();
      expect(achievementsTimestampDuringFetch).toBeNull();
    });

    it('parallel-fetches both stats and achievements', async () => {
      vi.mocked(xpAPI.getStats).mockResolvedValue(makeXPStats());
      vi.mocked(xpAPI.getAchievements).mockResolvedValue(makeAchievements());

      await act(async () => {
        await useXPStore.getState().refreshAll();
      });

      expect(xpAPI.getStats).toHaveBeenCalledTimes(1);
      expect(xpAPI.getAchievements).toHaveBeenCalledTimes(1);
    });

    it('populates both xpStats and achievements after refreshAll', async () => {
      const mockStats = makeXPStats({ total_xp: 9999 });
      const mockAchievements = makeAchievements({ unlocked_count: 7 });
      vi.mocked(xpAPI.getStats).mockResolvedValue(mockStats);
      vi.mocked(xpAPI.getAchievements).mockResolvedValue(mockAchievements);

      await act(async () => {
        await useXPStore.getState().refreshAll();
      });

      expect(useXPStore.getState().xpStats).toEqual(mockStats);
      expect(useXPStore.getState().achievements).toEqual(mockAchievements);
    });
  });

  // -------------------------------------------------------------------------
  // selectLevelProgress selector
  // -------------------------------------------------------------------------
  describe('selectLevelProgress', () => {
    it('returns 0 when xpStats is null', () => {
      useXPStore.setState({ xpStats: null });
      const state = useXPStore.getState();
      expect(selectLevelProgress(state)).toBe(0);
    });

    it('returns 100 when at max level (level 15)', () => {
      useXPStore.setState({
        xpStats: makeXPStats({ current_level: 15, progress_percentage: 80 }),
      });
      const state = useXPStore.getState();
      expect(selectLevelProgress(state)).toBe(100);
    });

    it('returns progress_percentage when below max level (level < 15)', () => {
      useXPStore.setState({
        xpStats: makeXPStats({ current_level: 7, progress_percentage: 65 }),
      });
      const state = useXPStore.getState();
      expect(selectLevelProgress(state)).toBe(65);
    });

    it('returns progress_percentage = 0 for level 1 with no progress', () => {
      useXPStore.setState({
        xpStats: makeXPStats({ current_level: 1, progress_percentage: 0 }),
      });
      const state = useXPStore.getState();
      expect(selectLevelProgress(state)).toBe(0);
    });

    it('returns 100 regardless of progress_percentage when at level 15', () => {
      // Even if progress_percentage = 0 (which would be weird but defensive)
      useXPStore.setState({
        xpStats: makeXPStats({ current_level: 15, progress_percentage: 0 }),
      });
      const state = useXPStore.getState();
      expect(selectLevelProgress(state)).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // selectIsMaxLevel selector
  // -------------------------------------------------------------------------
  describe('selectIsMaxLevel', () => {
    it('returns true when current_level is 15', () => {
      useXPStore.setState({ xpStats: makeXPStats({ current_level: 15 }) });
      expect(selectIsMaxLevel(useXPStore.getState())).toBe(true);
    });

    it('returns false when current_level is less than 15', () => {
      useXPStore.setState({ xpStats: makeXPStats({ current_level: 14 }) });
      expect(selectIsMaxLevel(useXPStore.getState())).toBe(false);
    });

    it('returns false when xpStats is null', () => {
      useXPStore.setState({ xpStats: null });
      // Optional chaining: null?.current_level === 15 evaluates to false (not undefined)
      expect(selectIsMaxLevel(useXPStore.getState())).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Remaining selectors
  // -------------------------------------------------------------------------
  describe('selectors', () => {
    it('selectXPStats returns xpStats', () => {
      const stats = makeXPStats();
      useXPStore.setState({ xpStats: stats });
      expect(selectXPStats(useXPStore.getState())).toEqual(stats);
    });

    it('selectAchievements returns achievements', () => {
      const achievements = makeAchievements();
      useXPStore.setState({ achievements });
      expect(selectAchievements(useXPStore.getState())).toEqual(achievements);
    });

    it('selectIsLoadingStats reflects loadingStats', () => {
      useXPStore.setState({ loadingStats: true });
      expect(selectIsLoadingStats(useXPStore.getState())).toBe(true);
    });

    it('selectIsLoadingAchievements reflects loadingAchievements', () => {
      useXPStore.setState({ loadingAchievements: true });
      expect(selectIsLoadingAchievements(useXPStore.getState())).toBe(true);
    });

    it('selectXPError reflects error', () => {
      useXPStore.setState({ error: 'test error' });
      expect(selectXPError(useXPStore.getState())).toBe('test error');
    });
  });

  // -------------------------------------------------------------------------
  // Loading state transitions
  // -------------------------------------------------------------------------
  describe('loading state transitions', () => {
    it('sets loadingStats=true during fetch and false after', async () => {
      let resolveStats!: (v: XPStatsResponse) => void;
      const statsPromise = new Promise<XPStatsResponse>((res) => {
        resolveStats = res;
      });
      vi.mocked(xpAPI.getStats).mockReturnValue(statsPromise);

      // Start fetch without awaiting
      const fetchPromise = useXPStore.getState().loadXPStats(true);

      expect(useXPStore.getState().loadingStats).toBe(true);

      resolveStats(makeXPStats());
      await act(async () => {
        await fetchPromise;
      });

      expect(useXPStore.getState().loadingStats).toBe(false);
    });

    it('sets loadingAchievements=true during fetch and false after', async () => {
      let resolveAchievements!: (v: AchievementsListResponse) => void;
      const achievementsPromise = new Promise<AchievementsListResponse>((res) => {
        resolveAchievements = res;
      });
      vi.mocked(xpAPI.getAchievements).mockReturnValue(achievementsPromise);

      const fetchPromise = useXPStore.getState().loadAchievements(true);

      expect(useXPStore.getState().loadingAchievements).toBe(true);

      resolveAchievements(makeAchievements());
      await act(async () => {
        await fetchPromise;
      });

      expect(useXPStore.getState().loadingAchievements).toBe(false);
    });
  });
});
