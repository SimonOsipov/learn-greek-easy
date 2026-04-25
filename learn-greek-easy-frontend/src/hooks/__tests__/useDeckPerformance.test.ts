/**
 * useDeckPerformance Hook Tests
 * Tests deck performance selector from useAnalytics hook
 *
 * Mocks @/features/analytics (getAnalytics) rather than the hook itself (AC #10).
 * Seeds query cache via queryClient.setQueryData for seeded-data tests (AC #9).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createTestQueryClient } from '@/lib/test-utils';
import { useDeckPerformance } from '@/hooks/useDeckPerformance';

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

const mockDeckStats = [
  {
    deckId: 'deck-1',
    deckName: 'Greek Basics',
    totalCards: 50,
    masteredCards: 20,
    averageAccuracy: 0.85,
    reviewCount: 100,
  },
  {
    deckId: 'deck-2',
    deckName: 'Advanced Vocabulary',
    totalCards: 100,
    masteredCards: 30,
    averageAccuracy: 0.78,
    reviewCount: 150,
  },
];

const fixtureData = {
  overview: {
    totalReviews: 250,
    cardsStudied: 150,
    averageAccuracy: 0.82,
    totalStudyTime: 7200,
  },
  streak: {
    currentStreak: 7,
    longestStreak: 15,
    lastStudyDate: new Date().toISOString(),
  },
  progressData: [],
  deckStats: mockDeckStats,
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

describe('useDeckPerformance Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when no data loaded yet', async () => {
    mockGetAnalytics.mockResolvedValue({ ...fixtureData, deckStats: [] });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeckPerformance(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.deckStats).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should return deck performance data from seeded cache (AC #9)', () => {
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['analytics', 'user-123', 'last7'], fixtureData);
    mockGetAnalytics.mockResolvedValue(fixtureData);

    const { result } = renderHook(() => useDeckPerformance(), { wrapper });

    // Immediately from cache
    expect(result.current.deckStats).toEqual(mockDeckStats);
    expect(result.current.deckStats).toHaveLength(2);
    expect(result.current.loading).toBe(false);
  });

  it('should return deck performance data after API fetch', async () => {
    mockGetAnalytics.mockResolvedValue(fixtureData);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeckPerformance(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.deckStats).toEqual(mockDeckStats);
  });

  it('should reflect loading state', async () => {
    let resolve!: (v: unknown) => void;
    mockGetAnalytics.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeckPerformance(), { wrapper });

    expect(result.current.loading).toBe(true);

    resolve(fixtureData);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('should reflect error state', async () => {
    mockGetAnalytics.mockRejectedValue(new Error('Failed to load deck performance'));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeckPerformance(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.deckStats).toEqual([]);
  });

  it('should handle empty deck performance array', () => {
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['analytics', 'user-123', 'last7'], {
      ...fixtureData,
      deckStats: [],
    });
    mockGetAnalytics.mockResolvedValue(fixtureData);

    const { result } = renderHook(() => useDeckPerformance(), { wrapper });

    expect(result.current.deckStats).toEqual([]);
    expect(Array.isArray(result.current.deckStats)).toBe(true);
  });

  it('should update when deck stats change in cache', async () => {
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['analytics', 'user-123', 'last7'], {
      ...fixtureData,
      deckStats: [],
    });
    mockGetAnalytics.mockResolvedValue(fixtureData);

    const { result } = renderHook(() => useDeckPerformance(), { wrapper });
    expect(result.current.deckStats).toEqual([]);

    const updatedStats = [
      {
        deckId: 'deck-3',
        deckName: 'Grammar Essentials',
        totalCards: 75,
        masteredCards: 45,
        averageAccuracy: 0.92,
        reviewCount: 200,
      },
    ];

    queryClient.setQueryData(['analytics', 'user-123', 'last7'], {
      ...fixtureData,
      deckStats: updatedStats,
    });

    await waitFor(() => expect(result.current.deckStats).toEqual(updatedStats));
  });
});
