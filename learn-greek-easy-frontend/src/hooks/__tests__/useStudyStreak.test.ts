/**
 * useStudyStreak Hook Tests
 * Tests study streak selector from analytics store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStudyStreak } from '@/hooks/useStudyStreak';
import { useAnalyticsStore } from '@/stores/analyticsStore';

describe('useStudyStreak Hook', () => {
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

  it('should return undefined streak when no data', () => {
    const { result } = renderHook(() => useStudyStreak());

    expect(result.current.streak).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should return streak data from store', () => {
    const mockStreakData = {
      currentStreak: 7,
      longestStreak: 15,
      lastStudyDate: '2025-01-08T10:00:00.000Z',
    };

    useAnalyticsStore.setState({
      dashboardData: {
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
      },
      loading: false,
    });

    const { result } = renderHook(() => useStudyStreak());

    expect(result.current.streak).toEqual(mockStreakData);
    expect(result.current.streak?.currentStreak).toBe(7);
    expect(result.current.streak?.longestStreak).toBe(15);
    expect(result.current.loading).toBe(false);
  });

  it('should reflect loading state', () => {
    useAnalyticsStore.setState({ loading: true });

    const { result } = renderHook(() => useStudyStreak());
    expect(result.current.loading).toBe(true);
  });

  it('should reflect error state', () => {
    const errorMessage = 'Failed to load streak data';
    useAnalyticsStore.setState({ error: errorMessage });

    const { result } = renderHook(() => useStudyStreak());
    expect(result.current.error).toBe(errorMessage);
  });

  it('should handle zero streak values', () => {
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

    const { result } = renderHook(() => useStudyStreak());
    expect(result.current.streak?.currentStreak).toBe(0);
    expect(result.current.streak?.longestStreak).toBe(0);
    expect(result.current.streak?.lastStudyDate).toBeNull();
  });

  it('should update when streak changes', () => {
    const { result, rerender } = renderHook(() => useStudyStreak());

    // Initially no data
    expect(result.current.streak).toBeUndefined();

    // Update with initial streak
    useAnalyticsStore.setState({
      dashboardData: {
        overview: {
          totalReviews: 50,
          cardsStudied: 25,
          averageAccuracy: 0.8,
          totalStudyTime: 1800,
        },
        streak: {
          currentStreak: 5,
          longestStreak: 10,
          lastStudyDate: new Date().toISOString(),
        },
        progressData: [],
        deckStats: [],
        recentActivity: [],
      },
    });

    rerender();
    expect(result.current.streak?.currentStreak).toBe(5);

    // User continues streak
    useAnalyticsStore.setState({
      dashboardData: {
        overview: {
          totalReviews: 60,
          cardsStudied: 30,
          averageAccuracy: 0.82,
          totalStudyTime: 2100,
        },
        streak: {
          currentStreak: 6,
          longestStreak: 10,
          lastStudyDate: new Date().toISOString(),
        },
        progressData: [],
        deckStats: [],
        recentActivity: [],
      },
    });

    rerender();
    expect(result.current.streak?.currentStreak).toBe(6);
  });

  it('should handle longest streak being equal to current streak', () => {
    useAnalyticsStore.setState({
      dashboardData: {
        overview: {
          totalReviews: 200,
          cardsStudied: 100,
          averageAccuracy: 0.9,
          totalStudyTime: 7200,
        },
        streak: {
          currentStreak: 20,
          longestStreak: 20,
          lastStudyDate: new Date().toISOString(),
        },
        progressData: [],
        deckStats: [],
        recentActivity: [],
      },
    });

    const { result } = renderHook(() => useStudyStreak());
    expect(result.current.streak?.currentStreak).toBe(20);
    expect(result.current.streak?.longestStreak).toBe(20);
    expect(result.current.streak?.currentStreak).toBe(result.current.streak?.longestStreak);
  });
});
