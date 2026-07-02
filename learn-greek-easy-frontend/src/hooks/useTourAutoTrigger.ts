import { useEffect, useRef } from 'react';

import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import { startTour, buildTourSteps } from '@/lib/tour';
import { useAppStore, selectIsReady } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { isTourCompleted } from '@/utils/tourStatus';

const POST_READY_DELAY_MS = 250;
const FAIL_SAFE_TIMEOUT_MS = 10_000;

export function useTourAutoTrigger(): void {
  const isAppReady = useAppStore(selectIsReady);
  const isAuthenticated = useAuthStore((state) => !!state.user);
  const tourCompletedAt = useAuthStore((state) => state.user?.tourCompletedAt);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  // PERF-15-06: readiness now comes off the shared ['dashboard-summary']
  // query (Dashboard.tsx's own source of truth) instead of a separate
  // useAnalytics() fetch — no new network call, just a shared cache read.
  const { data, isLoading } = useDashboardSummary();
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const triggeredRef = useRef(false);

  const isDashboardReady = !isLoading && data != null;

  useEffect(() => {
    if (!isAppReady || !isAuthenticated) return;
    if (triggeredRef.current) return;
    if (isTourCompleted(tourCompletedAt)) return;

    // If dashboard data is ready, trigger tour after small paint delay
    if (isDashboardReady) {
      triggeredRef.current = true;
      const timer = setTimeout(() => {
        const steps = buildTourSteps(navigate, t);
        if (steps.length === 0) return;

        startTour(steps, {
          trigger: 'auto',
          t,
          onAnalyticsEvent: (event, props) => {
            if (typeof posthog?.capture === 'function') {
              posthog.capture(event, props);
            }
          },
          onPersistCompletion: () => {
            updateProfile({ tourCompletedAt: new Date().toISOString() }).catch(() => {
              // best-effort server persistence
            });
          },
        });
      }, POST_READY_DELAY_MS);

      return () => clearTimeout(timer);
    }

    // Fail-safe: if dashboard data never loads, cancel after 10s
    const failSafe = setTimeout(() => {
      triggeredRef.current = true;
    }, FAIL_SAFE_TIMEOUT_MS);

    return () => clearTimeout(failSafe);
  }, [isAppReady, isAuthenticated, tourCompletedAt, isDashboardReady, t, navigate, updateProfile]);
}
