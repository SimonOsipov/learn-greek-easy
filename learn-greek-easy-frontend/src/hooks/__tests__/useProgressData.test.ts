/**
 * useProgressData Hook Tests
 * Tests progress data selector from useAnalytics hook
 *
 * Mocks @/features/analytics (getAnalytics) rather than the hook itself (AC #10).
 * Seeds query cache via queryClient.setQueryData for seeded-data tests (AC #9).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createTestQueryClient } from '@/lib/test-utils';
import { useProgressData } from '@/hooks/useProgressData';

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

const mockProgressData = [
  { date: '2025-01-01', reviewCount: 10, cardsStudied: 5, accuracy: 0.8 },
  { date: '2025-01-02', reviewCount: 15, cardsStudied: 8, accuracy: 0.85 },
  { date: '2025-01-03', reviewCount: 12, cardsStudied: 6, accuracy: 0.9 },
];

const fixtureData = {
  overview: {
    totalReviews: 100,
    cardsStudied: 50,
    averageAccuracy: 0.85,
    totalStudyTime: 3600,
  },
  streak: {
    currentStreak: 5,
    longestStreak: 10,
    lastStudyDate: new Date().toISOString(),
  },
  progressData: mockProgressData,
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

describe('useProgressData Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when no data loaded yet', async () => {
    // getAnalytics never resolves in this test — query stays loading then idle
    mockGetAnalytics.mockResolvedValue({ ...fixtureData, progressData: [] });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProgressData(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.progressData).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should return progress data from hook', async () => {
    mockGetAnalytics.mockResolvedValue(fixtureData);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProgressData(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.progressData).toEqual(mockProgressData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should return seeded progress data directly from query cache', async () => {
    const { queryClient, wrapper } = makeWrapper();
    // Seed via setQueryData — no API call needed (AC #9)
    queryClient.setQueryData(['analytics', 'user-123', 'last7'], fixtureData);
    mockGetAnalytics.mockResolvedValue(fixtureData);

    const { result } = renderHook(() => useProgressData(), { wrapper });

    // Data is immediately available from cache
    expect(result.current.progressData).toEqual(mockProgressData);
    expect(result.current.loading).toBe(false);
  });

  it('should reflect loading state', async () => {
    // Delay resolution to observe loading state
    let resolve!: (v: unknown) => void;
    mockGetAnalytics.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProgressData(), { wrapper });

    expect(result.current.loading).toBe(true);

    resolve(fixtureData);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('should reflect error state', async () => {
    mockGetAnalytics.mockRejectedValue(new Error('Failed to load progress data'));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProgressData(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.progressData).toEqual([]);
  });

  it('should update when progress data changes', async () => {
    const { queryClient, wrapper } = makeWrapper();
    const newProgressData = [
      { date: '2025-01-04', reviewCount: 20, cardsStudied: 10, accuracy: 0.95 },
    ];

    // Seed initial data
    queryClient.setQueryData(['analytics', 'user-123', 'last7'], {
      ...fixtureData,
      progressData: [],
    });
    mockGetAnalytics.mockResolvedValue(fixtureData);

    const { result } = renderHook(() => useProgressData(), { wrapper });
    expect(result.current.progressData).toEqual([]);

    // Update cache directly
    queryClient.setQueryData(['analytics', 'user-123', 'last7'], {
      ...fixtureData,
      progressData: newProgressData,
    });

    await waitFor(() => expect(result.current.progressData).toEqual(newProgressData));
  });
});
