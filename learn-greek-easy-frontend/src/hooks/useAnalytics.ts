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
 * @param autoLoad - Accepted for backward-compat but is a no-op.
 *   TanStack Query loads on mount automatically when `enabled: !!userId`.
 *   Will be removed in PERF-01-04 once Dashboard.tsx and Statistics.tsx
 *   drop the `true` argument.
 *
 * @returns Analytics data plus back-compat aliases (loading, refresh).
 *   Aliases will be removed in PERF-01-04 / PERF-01-05 as consumers migrate
 *   to the canonical { isLoading, isFetching, refetch } shape.
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
export const useAnalytics = (
  _autoLoad = false // no-op: TanStack Query auto-loads on mount; remove in PERF-01-04
) => {
  const userId = useAuthStore((s) => s.user?.id);
  const dateRange = useDateRangeStore((s) => s.dateRange);

  const query = useQuery<AnalyticsDashboardData>({
    queryKey: ['analytics', userId, dateRange],
    queryFn: () => getAnalytics(userId!, dateRange),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    // Back-compat aliases — remove in PERF-01-04/05 once consumers are migrated
    loading: query.isLoading, // TODO(PERF-01-04): remove
    refresh: query.refetch, // TODO(PERF-01-04): remove
    dateRange, // TODO(PERF-01-04): remove (TimeStudiedWidget already reads store directly)
  };
};
