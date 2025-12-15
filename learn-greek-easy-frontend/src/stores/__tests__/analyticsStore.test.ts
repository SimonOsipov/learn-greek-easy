// src/stores/__tests__/analyticsStore.test.ts

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { progressAPI } from '@/services/progressAPI';
import type {
  DashboardStatsResponse,
  LearningTrendsResponse,
  DeckProgressListResponse,
} from '@/services/progressAPI';

import { useAnalyticsStore } from '../analyticsStore';

// Mock the progress API (real API used by analyticsStore)
vi.mock('@/services/progressAPI', () => ({
  progressAPI: {
    getDashboard: vi.fn(),
    getTrends: vi.fn(),
    getDeckProgressList: vi.fn(),
  },
}));

describe('analyticsStore', () => {
  // Mock API response data
  const mockDashboardResponse: DashboardStatsResponse = {
    overview: {
      total_cards_studied: 120,
      total_cards_mastered: 15,
      total_decks_started: 3,
      overall_mastery_percentage: 85,
    },
    today: {
      reviews_completed: 20,
      cards_due: 10,
      daily_goal: 30,
      goal_progress_percentage: 66,
      study_time_seconds: 3600,
    },
    streak: {
      current_streak: 7,
      longest_streak: 14,
      last_study_date: '2025-01-08',
    },
    cards_by_status: {
      new: 50,
      learning: 30,
      review: 15,
      mastered: 5,
    },
    recent_activity: [
      {
        date: '2025-01-08',
        reviews_count: 20,
        average_quality: 4.2,
      },
    ],
  };

  const mockTrendsResponse: LearningTrendsResponse = {
    period: 'week',
    start_date: '2025-01-01',
    end_date: '2025-01-08',
    daily_stats: [
      {
        date: '2025-01-08',
        reviews_count: 20,
        new_cards: 5,
        average_quality: 4.2,
        study_time_seconds: 600,
        cards_mastered: 2,
      },
    ],
    summary: {
      total_reviews: 120,
      total_study_time_seconds: 3600,
      cards_mastered: 5,
      average_daily_reviews: 17,
      best_day: 'Monday',
      quality_trend: 'stable',
    },
  };

  const mockDeckProgressResponse: DeckProgressListResponse = {
    total: 3,
    page: 1,
    page_size: 50,
    decks: [
      {
        deck_id: 'deck-1',
        deck_name: 'A1 Basics',
        deck_level: 'A1',
        total_cards: 100,
        cards_studied: 80,
        cards_mastered: 15,
        cards_due: 10,
        mastery_percentage: 15,
        completion_percentage: 80,
        last_studied_at: '2025-01-08T10:00:00Z',
        average_easiness_factor: 2.5,
        estimated_review_time_minutes: 15,
      },
    ],
  };

  const setupMocks = () => {
    vi.mocked(progressAPI.getDashboard).mockResolvedValue(mockDashboardResponse);
    vi.mocked(progressAPI.getTrends).mockResolvedValue(mockTrendsResponse);
    vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue(mockDeckProgressResponse);
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
      setupMocks();

      const { result } = renderHook(() => useAnalyticsStore());

      expect(result.current.loading).toBe(false);

      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      expect(progressAPI.getDashboard).toHaveBeenCalled();
      expect(progressAPI.getTrends).toHaveBeenCalled();
      expect(progressAPI.getDeckProgressList).toHaveBeenCalled();
      expect(result.current.dashboardData).not.toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastFetch).not.toBeNull();
    });

    it('should load analytics with specific date range', async () => {
      setupMocks();

      const { result } = renderHook(() => useAnalyticsStore());

      await act(async () => {
        await result.current.loadAnalytics('test-user-123', 'last7');
      });

      expect(progressAPI.getTrends).toHaveBeenCalledWith({ period: 'week' });
      expect(result.current.dateRange).toBe('last7');
    });

    it('should use cached data when cache is valid', async () => {
      setupMocks();

      const { result } = renderHook(() => useAnalyticsStore());

      // First load
      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      expect(progressAPI.getDashboard).toHaveBeenCalledTimes(1);

      // Second load (should use cache)
      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      // API should not be called again (cache is valid)
      expect(progressAPI.getDashboard).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache when date range changes', async () => {
      setupMocks();

      const { result } = renderHook(() => useAnalyticsStore());

      // First load with last30
      await act(async () => {
        await result.current.loadAnalytics('test-user-123', 'last30');
      });

      expect(progressAPI.getDashboard).toHaveBeenCalledTimes(1);

      // Second load with last7 (should bypass cache)
      await act(async () => {
        await result.current.loadAnalytics('test-user-123', 'last7');
      });

      expect(progressAPI.getDashboard).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      const errorMessage = 'Failed to fetch analytics';
      vi.mocked(progressAPI.getDashboard).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAnalyticsStore());

      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.dashboardData).toBeNull();
    });

    it('should set loading state during fetch', async () => {
      vi.mocked(progressAPI.getDashboard).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDashboardResponse), 100))
      );
      vi.mocked(progressAPI.getTrends).mockResolvedValue(mockTrendsResponse);
      vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue(mockDeckProgressResponse);

      const { result } = renderHook(() => useAnalyticsStore());

      const loadPromise = act(async () => {
        await result.current.loadAnalytics('test-user-123');
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
    it('should update date range', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      // Change date range
      act(() => {
        result.current.setDateRange('last7');
      });

      expect(result.current.dateRange).toBe('last7');
    });
  });

  describe('refreshAnalytics', () => {
    it('should force refresh analytics bypassing cache', async () => {
      setupMocks();

      const { result } = renderHook(() => useAnalyticsStore());

      // Load initial data
      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      expect(progressAPI.getDashboard).toHaveBeenCalledTimes(1);

      // Force refresh
      await act(async () => {
        await result.current.refreshAnalytics();
      });

      // API should be called again (cache bypassed)
      expect(progressAPI.getDashboard).toHaveBeenCalledTimes(2);
    });

    it('should set refreshing state during refresh', async () => {
      setupMocks();

      const { result } = renderHook(() => useAnalyticsStore());

      // Load initial data
      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      vi.mocked(progressAPI.getDashboard).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDashboardResponse), 100))
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
      setupMocks();

      const { result } = renderHook(() => useAnalyticsStore());

      // Load initial data
      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      const errorMessage = 'Refresh failed';
      vi.mocked(progressAPI.getDashboard).mockRejectedValue(new Error(errorMessage));

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

      expect(progressAPI.getDashboard).not.toHaveBeenCalled();
    });
  });

  describe('updateSnapshot', () => {
    it('should invalidate cache on snapshot update', async () => {
      setupMocks();

      const { result } = renderHook(() => useAnalyticsStore());

      // Load data first
      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      expect(result.current.lastFetch).not.toBeNull();

      // Update snapshot
      await act(async () => {
        await result.current.updateSnapshot('test-user-123', {
          sessionId: 'session-123',
          deckId: 'deck-a1-basics',
          userId: 'test-user-123',
          completedAt: new Date(),
          cardsReviewed: 20,
          accuracy: 90,
          totalTime: 600,
          averageTimePerCard: 30,
          ratingBreakdown: { again: 2, hard: 3, good: 10, easy: 5 },
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
        });
      });

      // Cache should be invalidated
      expect(result.current.lastFetch).toBeNull();
    });
  });

  describe('clearAnalytics', () => {
    it('should clear all analytics state', async () => {
      setupMocks();

      const { result } = renderHook(() => useAnalyticsStore());

      // Load data first
      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
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
      setupMocks();

      const { result } = renderHook(() => useAnalyticsStore());

      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      const { selectDashboardData } = await import('../analyticsStore');
      const dashboardData = selectDashboardData(result.current);

      expect(dashboardData).not.toBeNull();
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

      setupMocks();

      const { result } = renderHook(() => useAnalyticsStore());

      // First load
      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      expect(progressAPI.getDashboard).toHaveBeenCalledTimes(1);

      // Advance time by 4 minutes (cache still valid)
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Second load (should use cache)
      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      expect(progressAPI.getDashboard).toHaveBeenCalledTimes(1);

      // Advance time by 2 more minutes (total 6 minutes, cache expired)
      vi.advanceTimersByTime(2 * 60 * 1000);

      // Third load (should fetch new data)
      await act(async () => {
        await result.current.loadAnalytics('test-user-123');
      });

      expect(progressAPI.getDashboard).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });
});
