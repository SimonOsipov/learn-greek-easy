/**
 * useAnalyticsSSE — SSE hook for analytics dashboard real-time updates.
 *
 * Opens an SSE connection to /api/v1/progress/stream when the user is logged in.
 * On dashboard_updated event, calls refreshAnalytics() (not loadAnalytics) to
 * avoid a loading flash (existing data stays visible during refetch).
 * Falls back to 60-second polling if SSE fails after max retries.
 */

import { useCallback, useEffect, useRef } from 'react';

import { useSSE } from '@/hooks/useSSE';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { useAuthStore } from '@/stores/authStore';
import type { SSEConnectionState, SSEEvent } from '@/types/sse';

const POLLING_INTERVAL_MS = 60_000;

export function useAnalyticsSSE(): void {
  const user = useAuthStore((state) => state.user);
  const refreshAnalytics = useAnalyticsStore((state) => state.refreshAnalytics);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const handleEvent = useCallback(
    (event: SSEEvent<unknown>) => {
      if (event.type === 'dashboard_updated') {
        refreshAnalytics();
      }
    },
    [refreshAnalytics]
  );

  const handleStateChange = useCallback(
    (state: SSEConnectionState) => {
      if (state === 'connected') {
        stopPolling();
        refreshAnalytics();
      } else if (state === 'error') {
        if (pollingRef.current === null) {
          pollingRef.current = setInterval(() => {
            refreshAnalytics();
          }, POLLING_INTERVAL_MS);
        }
      }
    },
    [refreshAnalytics, stopPolling]
  );

  useSSE('/api/v1/progress/stream', {
    enabled: !!user,
    onEvent: handleEvent,
    onStateChange: handleStateChange,
    maxRetries: 10,
  });

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);
}
