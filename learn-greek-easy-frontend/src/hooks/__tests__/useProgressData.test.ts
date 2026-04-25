/**
 * useProgressData Hook Tests
 * Tests progress data selector from useAnalytics hook
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useProgressData } from '@/hooks/useProgressData';

const mockUseAnalytics = vi.fn();
vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => mockUseAnalytics(),
}));

describe('useProgressData Hook', () => {
  beforeEach(() => {
    mockUseAnalytics.mockReturnValue({ data: null, loading: false, error: null });
  });

  it('should return initial state when no data', () => {
    const { result } = renderHook(() => useProgressData());

    // Selector returns empty array when data is null
    expect(result.current.progressData).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should return progress data from hook', () => {
    const mockProgressData = [
      { date: '2025-01-01', reviewCount: 10, cardsStudied: 5, accuracy: 0.8 },
      { date: '2025-01-02', reviewCount: 15, cardsStudied: 8, accuracy: 0.85 },
      { date: '2025-01-03', reviewCount: 12, cardsStudied: 6, accuracy: 0.9 },
    ];

    mockUseAnalytics.mockReturnValue({
      data: {
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
      },
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useProgressData());

    expect(result.current.progressData).toEqual(mockProgressData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should reflect loading state', () => {
    mockUseAnalytics.mockReturnValue({ data: null, loading: true, error: null });

    const { result } = renderHook(() => useProgressData());
    expect(result.current.loading).toBe(true);
  });

  it('should reflect error state', () => {
    const errorMessage = 'Failed to load progress data';
    mockUseAnalytics.mockReturnValue({ data: null, loading: false, error: errorMessage });

    const { result } = renderHook(() => useProgressData());
    expect(result.current.error).toBe(errorMessage);
  });

  it('should update when progress data changes', () => {
    const { result, rerender } = renderHook(() => useProgressData());

    // Initially empty array
    expect(result.current.progressData).toEqual([]);

    // Update mock with new data
    const newProgressData = [
      { date: '2025-01-04', reviewCount: 20, cardsStudied: 10, accuracy: 0.95 },
    ];

    mockUseAnalytics.mockReturnValue({
      data: {
        overview: {
          totalReviews: 120,
          cardsStudied: 60,
          averageAccuracy: 0.88,
          totalStudyTime: 4200,
        },
        streak: {
          currentStreak: 6,
          longestStreak: 10,
          lastStudyDate: new Date().toISOString(),
        },
        progressData: newProgressData,
        deckStats: [],
        recentActivity: [],
      },
      loading: false,
      error: null,
    });

    rerender();
    expect(result.current.progressData).toEqual(newProgressData);
  });
});
