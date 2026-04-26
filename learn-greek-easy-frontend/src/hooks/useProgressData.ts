// src/hooks/useProgressData.ts

import { useAnalytics } from '@/hooks/useAnalytics';

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
  const { data, loading, error } = useAnalytics();
  const progressData = data?.progressData ?? [];

  return {
    progressData,
    loading,
    error,
  };
};
