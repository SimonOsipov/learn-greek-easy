// src/hooks/useAnalytics.ts

import { useQuery } from '@tanstack/react-query';

import { getAnalytics } from '@/features/analytics';
import { useAuthStore } from '@/stores/authStore';
import { useDateRangeStore } from '@/stores/dateRangeStore';
import type { AnalyticsDashboardData } from '@/types/analytics';

/**
 * Primary hook for analytics dashboard data.
 *
 * Backed by TanStack Query — data is cached per (userId, dateRange) and
 * refetched automatically on window focus. No manual polling.
 *
 * @returns Analytics data and query state.
 *   `loading` is a back-compat alias for `isLoading` — consumers should
 *   migrate to the canonical `isLoading` name when convenient.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useAnalytics();
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={String(error)} />;
 * if (!data) return <Empty />;
 *
 * return <Dashboard data={data} onRefresh={refetch} />;
 * ```
 */
export const useAnalytics = () => {
  const userId = useAuthStore((s) => s.user?.id);
  const dateRange = useDateRangeStore((s) => s.dateRange);

  const query = useQuery<AnalyticsDashboardData>({
    queryKey: ['analytics', userId, dateRange],
    queryFn: () => getAnalytics(userId!, dateRange),
    enabled: !!userId,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    // Back-compat alias — migrate callsites to `isLoading` when convenient
    loading: query.isLoading,
  };
};
