// src/hooks/useStudyStreak.ts

import { useAnalytics } from '@/hooks/useAnalytics';

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
  const { data, loading, error } = useAnalytics();
  const streak = data?.streak;

  return {
    streak,
    loading,
    error,
  };
};
