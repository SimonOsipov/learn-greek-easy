/**
 * useDeckPerformance Hook Tests
 * Tests deck performance selector from analytics store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeckPerformance } from '@/hooks/useDeckPerformance';
import { useAnalyticsStore } from '@/stores/analyticsStore';

describe('useDeckPerformance Hook', () => {
  beforeEach(() => {
    // Reset analytics store
    useAnalyticsStore.setState({
      dashboardData: null,
      dateRange: 'last7',
      loading: false,
      refreshing: false,
      error: null,
      lastFetch: null,
    });
  });

  it('should return initial state when no data', () => {
    const { result } = renderHook(() => useDeckPerformance());

    // Selector returns empty array when dashboardData is null
    expect(result.current.deckStats).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should return deck performance data from store', () => {
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

    useAnalyticsStore.setState({
      dashboardData: {
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
      },
      loading: false,
    });

    const { result } = renderHook(() => useDeckPerformance());

    expect(result.current.deckStats).toEqual(mockDeckStats);
    expect(result.current.deckStats).toHaveLength(2);
    expect(result.current.loading).toBe(false);
  });

  it('should reflect loading state', () => {
    useAnalyticsStore.setState({ loading: true });

    const { result } = renderHook(() => useDeckPerformance());
    expect(result.current.loading).toBe(true);
  });

  it('should reflect error state', () => {
    const errorMessage = 'Failed to load deck performance';
    useAnalyticsStore.setState({ error: errorMessage });

    const { result } = renderHook(() => useDeckPerformance());
    expect(result.current.error).toBe(errorMessage);
  });

  it('should handle empty deck performance array', () => {
    useAnalyticsStore.setState({
      dashboardData: {
        overview: {
          totalReviews: 0,
          cardsStudied: 0,
          averageAccuracy: 0,
          totalStudyTime: 0,
        },
        streak: {
          currentStreak: 0,
          longestStreak: 0,
          lastStudyDate: null,
        },
        progressData: [],
        deckStats: [],
        recentActivity: [],
      },
    });

    const { result } = renderHook(() => useDeckPerformance());
    expect(result.current.deckStats).toEqual([]);
    expect(Array.isArray(result.current.deckStats)).toBe(true);
  });

  it('should update when deck stats change', () => {
    const { result, rerender } = renderHook(() => useDeckPerformance());

    // Initially empty array
    expect(result.current.deckStats).toEqual([]);

    // Add deck stats
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

    useAnalyticsStore.setState({
      dashboardData: {
        overview: {
          totalReviews: 200,
          cardsStudied: 75,
          averageAccuracy: 0.92,
          totalStudyTime: 5400,
        },
        streak: {
          currentStreak: 10,
          longestStreak: 15,
          lastStudyDate: new Date().toISOString(),
        },
        progressData: [],
        deckStats: updatedStats,
        recentActivity: [],
      },
    });

    rerender();
    expect(result.current.deckStats).toEqual(updatedStats);
  });
});
