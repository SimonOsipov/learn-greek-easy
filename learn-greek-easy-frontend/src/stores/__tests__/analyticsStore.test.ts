// src/stores/__tests__/analyticsStore.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnalyticsStore } from '../analyticsStore';
import * as mockAnalyticsAPI from '@/services/mockAnalyticsAPI';
import type { AnalyticsDashboardData } from '@/types/analytics';
import type { SessionSummary } from '@/types/review';

// Mock the analytics API
vi.mock('@/services/mockAnalyticsAPI');

describe('analyticsStore', () => {
  // Mock data
  const mockUserId = 'test-user-123';
  const mockDashboardData: AnalyticsDashboardData = {
    userId: mockUserId,
    dateRange: {
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-08'),
      label: 'Last 7 Days',
    },
    fetchedAt: new Date(),
    summary: {
      totalCardsReviewed: 120,
      totalTimeStudied: 3600,
      averageAccuracy: 85,
      cardsNewlyMastered: 15,
    },
    streak: {
      currentStreak: 7,
      startDate: new Date('2025-01-01'),
      lastActivityDate: new Date(),
      longestStreak: 14,
      longestStreakStart: new Date('2024-12-01'),
      longestStreakEnd: new Date('2024-12-14'),
      milestoneReached: 7,
      nextMilestone: 30,
      daysToNextMilestone: 23,
      streakBrokenToday: false,
      consecutiveBreaks: 0,
    },
    progressData: [],
    deckStats: [],
    wordStatus: {
      new: 50,
      learning: 30,
      review: 15,
      mastered: 5,
      relearning: 0,
      newPercent: 50,
      learningPercent: 30,
      reviewPercent: 15,
      masteredPercent: 5,
      relearningPercent: 0,
      total: 100,
      deckId: 'all-decks',
      date: new Date(),
    },
    retention: [],
    recentActivity: [],
  };

  const mockSessionSummary: SessionSummary = {
    sessionId: 'session-123',
    deckId: 'deck-a1-basics',
    userId: mockUserId,
    completedAt: new Date(),
    cardsReviewed: 20,
    accuracy: 90,
    totalTime: 600,
    averageTimePerCard: 30,
    ratingBreakdown: {
      again: 2,
      hard: 3,
      good: 10,
      easy: 5,
    },
    transitions: {
      newToLearning: 15,
      learningToReview: 8,
      reviewToMastered: 3,
      toRelearning: 2,
    },
    deckProgressBefore: {
      cardsNew: 50,
      cardsLearning: 30,
      cardsReview: 15,
      cardsMastered: 5,
    },
    deckProgressAfter: {
      cardsNew: 35,
      cardsLearning: 37,
      cardsReview: 15,
      cardsMastered: 8,
    },
  };

  beforeEach(() => {
    // Reset store to initial state before each test
    useAnalyticsStore.setState({
      dashboardData: null,
      dateRange: 'last30',
      loading: false,
      refreshing: false,
      error: null,
      lastFetch: null,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAnalyticsStore());

      expect(result.current.dashboardData).toBeNull();
      expect(result.current.dateRange).toBe('last30');
      expect(result.current.loading).toBe(false);
      expect(result.current.refreshing).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastFetch).toBeNull();
    });
  });

  describe('loadAnalytics', () => {
    it('should load analytics data successfully', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      expect(result.current.loading).toBe(false);

      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledWith(mockUserId, 'last30');
      expect(result.current.dashboardData).toEqual(mockDashboardData);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastFetch).not.toBeNull();
    });

    it('should load analytics with specific date range', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      await act(async () => {
        await result.current.loadAnalytics(mockUserId, 'last7');
      });

      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledWith(mockUserId, 'last7');
      expect(result.current.dateRange).toBe('last7');
    });

    it('should use cached data when cache is valid', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      // First load
      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledTimes(1);

      // Second load (should use cache)
      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      // API should not be called again (cache is valid)
      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache when date range changes', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      // First load with last30
      await act(async () => {
        await result.current.loadAnalytics(mockUserId, 'last30');
      });

      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledTimes(1);

      // Second load with last7 (should bypass cache)
      await act(async () => {
        await result.current.loadAnalytics(mockUserId, 'last7');
      });

      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledTimes(2);
      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenLastCalledWith(mockUserId, 'last7');
    });

    it('should handle errors gracefully', async () => {
      const errorMessage = 'Failed to fetch analytics';
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAnalyticsStore());

      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.dashboardData).toBeNull();
    });

    it('should set loading state during fetch', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDashboardData), 100))
      );

      const { result } = renderHook(() => useAnalyticsStore());

      const loadPromise = act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      // Check loading state immediately
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await loadPromise;

      expect(result.current.loading).toBe(false);
    });
  });

  describe('setDateRange', () => {
    it('should update date range and trigger reload', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      // Load initial data
      await act(async () => {
        await result.current.loadAnalytics(mockUserId, 'last30');
      });

      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledWith(mockUserId, 'last30');

      // Change date range
      act(() => {
        result.current.setDateRange('last7');
      });

      // Wait for reload
      await waitFor(() => {
        expect(result.current.dateRange).toBe('last7');
      });

      await waitFor(() => {
        expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledWith(mockUserId, 'last7');
      });
    });

    it('should not reload if date range is the same', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      // Load initial data
      await act(async () => {
        await result.current.loadAnalytics(mockUserId, 'last30');
      });

      const callCount = vi.mocked(mockAnalyticsAPI.getAnalytics).mock.calls.length;

      // Set same date range
      act(() => {
        result.current.setDateRange('last30');
      });

      // API should not be called again
      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('refreshAnalytics', () => {
    it('should force refresh analytics bypassing cache', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      // Load initial data
      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledTimes(1);

      // Force refresh
      await act(async () => {
        await result.current.refreshAnalytics();
      });

      // API should be called again (cache bypassed)
      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledTimes(2);
    });

    it('should set refreshing state during refresh', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      // Load initial data
      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      vi.mocked(mockAnalyticsAPI.getAnalytics).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDashboardData), 100))
      );

      const refreshPromise = act(async () => {
        await result.current.refreshAnalytics();
      });

      // Check refreshing state
      await waitFor(() => {
        expect(result.current.refreshing).toBe(true);
      });

      await refreshPromise;

      expect(result.current.refreshing).toBe(false);
    });

    it('should handle errors during refresh', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      // Load initial data
      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      const errorMessage = 'Refresh failed';
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockRejectedValue(new Error(errorMessage));

      await act(async () => {
        await result.current.refreshAnalytics();
      });

      expect(result.current.refreshing).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });

    it('should not refresh if no userId available', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      await act(async () => {
        await result.current.refreshAnalytics();
      });

      expect(mockAnalyticsAPI.getAnalytics).not.toHaveBeenCalled();
    });
  });

  describe('updateSnapshot', () => {
    it('should update analytics snapshot successfully', async () => {
      vi.mocked(mockAnalyticsAPI.updateAnalyticsSnapshot).mockResolvedValue({
        snapshotId: 'snapshot-123',
        userId: mockUserId,
        date: new Date(),
        createdAt: new Date(),
        sessionsToday: 1,
        cardsReviewedToday: 20,
        timeStudiedToday: 600,
        newCardsToday: 5,
        cardsReviewedCorrectly: 18,
        accuracyToday: 90,
        totalCardsNew: 35,
        totalCardsLearning: 37,
        totalCardsReview: 15,
        cardsMasteredTotal: 8,
        cardsMasteredToday: 3,
        currentStreak: 7,
        longestStreak: 7,
        overallAccuracy: 85,
        averageTimePerCard: 30,
        streakBroken: false,
        newPersonalBest: false,
      });

      const { result } = renderHook(() => useAnalyticsStore());

      // Set a lastFetch time to verify it gets invalidated
      act(() => {
        useAnalyticsStore.setState({ lastFetch: Date.now() });
      });

      expect(result.current.lastFetch).not.toBeNull();

      await act(async () => {
        await result.current.updateSnapshot(mockUserId, mockSessionSummary);
      });

      expect(mockAnalyticsAPI.updateAnalyticsSnapshot).toHaveBeenCalledWith(
        mockUserId,
        mockSessionSummary
      );

      // Cache should be invalidated
      expect(result.current.lastFetch).toBeNull();
    });

    it('should handle errors non-blockingly', async () => {
      vi.mocked(mockAnalyticsAPI.updateAnalyticsSnapshot).mockRejectedValue(
        new Error('Update failed')
      );

      const { result } = renderHook(() => useAnalyticsStore());

      // Should not throw error
      await act(async () => {
        await result.current.updateSnapshot(mockUserId, mockSessionSummary);
      });

      // Error should not be set (non-blocking)
      expect(result.current.error).toBeNull();
    });
  });

  describe('clearAnalytics', () => {
    it('should clear all analytics state', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      // Load data first
      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      expect(result.current.dashboardData).not.toBeNull();
      expect(result.current.lastFetch).not.toBeNull();

      // Clear analytics
      act(() => {
        result.current.clearAnalytics();
      });

      expect(result.current.dashboardData).toBeNull();
      expect(result.current.dateRange).toBe('last30');
      expect(result.current.loading).toBe(false);
      expect(result.current.refreshing).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastFetch).toBeNull();
    });
  });

  describe('Selectors', () => {
    it('should select dashboard data', async () => {
      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      const { selectDashboardData } = await import('../analyticsStore');
      const dashboardData = selectDashboardData(result.current);

      expect(dashboardData).toEqual(mockDashboardData);
    });

    it('should select progress data with empty default', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const { selectProgressData } = await import('../analyticsStore');
      const progressData = selectProgressData(result.current);

      expect(progressData).toEqual([]);
    });

    it('should select loading state', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const { selectIsLoading } = await import('../analyticsStore');

      expect(selectIsLoading(result.current)).toBe(false);

      act(() => {
        useAnalyticsStore.setState({ loading: true });
      });

      expect(selectIsLoading(result.current)).toBe(true);
    });

    it('should select error state', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const { selectError } = await import('../analyticsStore');

      expect(selectError(result.current)).toBeNull();

      act(() => {
        useAnalyticsStore.setState({ error: 'Test error' });
      });

      expect(selectError(result.current)).toBe('Test error');
    });

    it('should select date range', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const { selectDateRange } = await import('../analyticsStore');

      expect(selectDateRange(result.current)).toBe('last30');

      act(() => {
        useAnalyticsStore.setState({ dateRange: 'last7' });
      });

      expect(selectDateRange(result.current)).toBe('last7');
    });
  });

  describe('Cache TTL behavior', () => {
    it('should invalidate cache after 5 minutes', async () => {
      vi.useFakeTimers();

      vi.mocked(mockAnalyticsAPI.getAnalytics).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useAnalyticsStore());

      // First load
      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledTimes(1);

      // Advance time by 4 minutes (cache still valid)
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Second load (should use cache)
      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledTimes(1);

      // Advance time by 2 more minutes (total 6 minutes, cache expired)
      vi.advanceTimersByTime(2 * 60 * 1000);

      // Third load (should fetch new data)
      await act(async () => {
        await result.current.loadAnalytics(mockUserId);
      });

      expect(mockAnalyticsAPI.getAnalytics).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });
});
