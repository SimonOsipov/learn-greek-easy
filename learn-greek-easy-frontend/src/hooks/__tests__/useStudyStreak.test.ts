/**
 * useStudyStreak Hook Tests
 * Tests study streak selector from useAnalytics hook
 *
 * Mocks @/features/analytics (getAnalytics) rather than the hook itself (AC #10).
 * Seeds query cache via queryClient.setQueryData for seeded-data tests (AC #9).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createTestQueryClient } from '@/lib/test-utils';
import { useStudyStreak } from '@/hooks/useStudyStreak';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockGetAnalytics = vi.fn();

vi.mock('@/features/analytics', () => ({
  getAnalytics: (...args: unknown[]) => mockGetAnalytics(...args),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-123' } }),
}));

vi.mock('@/stores/dateRangeStore', () => ({
  useDateRangeStore: (selector: (s: { dateRange: string }) => unknown) =>
    selector({ dateRange: 'last7' }),
}));

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const mockStreakData = {
  currentStreak: 7,
  longestStreak: 15,
  lastStudyDate: '2025-01-08T10:00:00.000Z',
};

const fixtureData = {
  overview: {
    totalReviews: 100,
    cardsStudied: 50,
    averageAccuracy: 0.85,
    totalStudyTime: 3600,
  },
  streak: mockStreakData,
  progressData: [],
  deckStats: [],
  recentActivity: [],
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeWrapper() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useStudyStreak Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined streak when fetched data has no streak', async () => {
    mockGetAnalytics.mockResolvedValue({ ...fixtureData, streak: undefined });

    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useStudyStreak(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.streak).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('should return streak data from seeded cache (AC #9)', () => {
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['analytics', 'user-123', 'last7'], fixtureData);
    mockGetAnalytics.mockResolvedValue(fixtureData);

    const { result } = renderHook(() => useStudyStreak(), { wrapper });

    // Immediately available from cache
    expect(result.current.streak).toEqual(mockStreakData);
    expect(result.current.streak?.currentStreak).toBe(7);
    expect(result.current.streak?.longestStreak).toBe(15);
    expect(result.current.loading).toBe(false);
  });

  it('should return streak data after API fetch', async () => {
    mockGetAnalytics.mockResolvedValue(fixtureData);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStudyStreak(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.streak).toEqual(mockStreakData);
  });

  it('should reflect loading state', async () => {
    let resolve!: (v: unknown) => void;
    mockGetAnalytics.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStudyStreak(), { wrapper });

    expect(result.current.loading).toBe(true);

    resolve(fixtureData);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('should reflect error state', async () => {
    mockGetAnalytics.mockRejectedValue(new Error('Failed to load streak data'));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStudyStreak(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.streak).toBeUndefined();
  });

  it('should handle zero streak values', () => {
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['analytics', 'user-123', 'last7'], {
      ...fixtureData,
      streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: null },
    });
    mockGetAnalytics.mockResolvedValue(fixtureData);

    const { result } = renderHook(() => useStudyStreak(), { wrapper });

    expect(result.current.streak?.currentStreak).toBe(0);
    expect(result.current.streak?.longestStreak).toBe(0);
    expect(result.current.streak?.lastStudyDate).toBeNull();
  });

  it('should update when streak changes in cache', async () => {
    const updatedStreak = {
      currentStreak: 6,
      longestStreak: 10,
      lastStudyDate: new Date().toISOString(),
    };
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['analytics', 'user-123', 'last7'], {
      ...fixtureData,
      streak: { currentStreak: 5, longestStreak: 10, lastStudyDate: new Date().toISOString() },
    });
    // Mock returns streak=6 so background refetches resolve consistently with expected state
    mockGetAnalytics.mockResolvedValue({ ...fixtureData, streak: updatedStreak });

    const { result } = renderHook(() => useStudyStreak(), { wrapper });
    expect(result.current.streak?.currentStreak).toBe(5);

    // Streak advances
    queryClient.setQueryData(['analytics', 'user-123', 'last7'], {
      ...fixtureData,
      streak: updatedStreak,
    });

    await waitFor(() => expect(result.current.streak?.currentStreak).toBe(6));
  });

  it('should handle longest streak equal to current streak', () => {
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['analytics', 'user-123', 'last7'], {
      ...fixtureData,
      streak: { currentStreak: 20, longestStreak: 20, lastStudyDate: new Date().toISOString() },
    });
    mockGetAnalytics.mockResolvedValue(fixtureData);

    const { result } = renderHook(() => useStudyStreak(), { wrapper });

    expect(result.current.streak?.currentStreak).toBe(20);
    expect(result.current.streak?.longestStreak).toBe(20);
    expect(result.current.streak?.currentStreak).toBe(result.current.streak?.longestStreak);
  });
});
