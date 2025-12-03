// src/hooks/useAnalytics.ts

import { useEffect } from 'react';

import { useAnalyticsStore } from '@/stores/analyticsStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * Primary hook for analytics dashboard data
 *
 * @param autoLoad - Automatically load data on mount if true (default: false)
 * @returns Analytics data, loading states, and actions
 *
 * @example
 * ```tsx
 * const { data, loading, error, refresh, setDateRange } = useAnalytics(true);
 *
 * if (loading) return <Loading />;
 * if (error) return <Error message={error} />;
 * if (!data) return <Empty />;
 *
 * return <Dashboard data={data} onRefresh={refresh} />;
 * ```
 */
export const useAnalytics = (autoLoad = false) => {
  const user = useAuthStore((state) => state.user);

  const dashboardData = useAnalyticsStore((state) => state.dashboardData);
  const loading = useAnalyticsStore((state) => state.loading);
  const refreshing = useAnalyticsStore((state) => state.refreshing);
  const error = useAnalyticsStore((state) => state.error);
  const dateRange = useAnalyticsStore((state) => state.dateRange);

  const setDateRange = useAnalyticsStore((state) => state.setDateRange);
  const refreshAnalytics = useAnalyticsStore((state) => state.refreshAnalytics);

  // Auto-load on mount if enabled and no data
  // Use getState() to avoid dependency on store selectors that create new references
  useEffect(() => {
    if (autoLoad && user) {
      const state = useAnalyticsStore.getState();
      if (!state.dashboardData && !state.loading) {
        state.loadAnalytics(user.id);
      }
    }
  }, [autoLoad, user]);

  return {
    data: dashboardData,
    loading: loading || refreshing,
    error,
    dateRange,
    refresh: refreshAnalytics,
    setDateRange,
  };
};
