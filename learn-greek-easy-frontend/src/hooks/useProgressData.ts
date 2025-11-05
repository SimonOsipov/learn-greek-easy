// src/hooks/useProgressData.ts

import {
  useAnalyticsStore,
  selectProgressData,
  selectIsLoading,
  selectError,
} from '@/stores/analyticsStore';

/**
 * Hook for progress chart data
 * Returns progress data points for charts
 *
 * @returns Progress data array, loading state, and error
 *
 * @example
 * ```tsx
 * const { progressData, loading, error } = useProgressData();
 *
 * return (
 *   <LineChart data={progressData} />
 * );
 * ```
 */
export const useProgressData = () => {
  const progressData = useAnalyticsStore(selectProgressData);
  const loading = useAnalyticsStore(selectIsLoading);
  const error = useAnalyticsStore(selectError);

  return {
    progressData,
    loading,
    error,
  };
};
