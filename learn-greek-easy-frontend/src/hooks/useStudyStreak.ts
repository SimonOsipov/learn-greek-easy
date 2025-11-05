// src/hooks/useStudyStreak.ts

import { useAnalyticsStore } from '@/stores/analyticsStore';

/**
 * Hook for study streak information
 * Returns current streak, longest streak, and history
 *
 * @returns Study streak data, loading state, and error
 *
 * @example
 * ```tsx
 * const { streak, loading, error } = useStudyStreak();
 *
 * return (
 *   <StreakDisplay
 *     current={streak?.currentStreak}
 *     longest={streak?.longestStreak}
 *   />
 * );
 * ```
 */
export const useStudyStreak = () => {
  const streak = useAnalyticsStore((state) => state.dashboardData?.streak);
  const loading = useAnalyticsStore((state) => state.loading);
  const error = useAnalyticsStore((state) => state.error);

  return {
    streak,
    loading,
    error,
  };
};
