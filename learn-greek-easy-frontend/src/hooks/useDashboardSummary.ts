// src/hooks/useDashboardSummary.ts
// PERF-15-05 — single shared query over GET /api/v1/dashboard/summary.
//
// Backs the dashboard's greeting/metrics/week-heat/hero/decks (this story)
// and, per PERF-15-06, the feed + useTourAutoTrigger readiness signal — all
// consumers share this ONE query key/cache entry.

import { useQuery } from '@tanstack/react-query';

import { dashboardAPI } from '@/services/dashboardAPI';
import { useAuthStore } from '@/stores/authStore';
import type { DashboardSummaryResponse } from '@/types/dashboard';

export const useDashboardSummary = () => {
  const userId = useAuthStore((s) => s.user?.id);

  const query = useQuery<DashboardSummaryResponse>({
    // User-scoped (mirrors useAnalytics's ['analytics', userId, dateRange]
    // convention): an unscoped key is shared across accounts, so with the
    // default 5-min staleTime a new login could briefly render the
    // PREVIOUS user's cached summary before logout invalidation catches up.
    queryKey: ['dashboard-summary', userId],
    queryFn: dashboardAPI.getSummary,
    enabled: !!userId,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};
