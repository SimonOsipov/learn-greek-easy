import { useEffect, useRef } from 'react';

import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { startTour, buildTourSteps } from '@/lib/tour';
import { useAppStore, selectIsReady } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { isTourCompleted } from '@/utils/tourStatus';

const AUTO_TRIGGER_DELAY_MS = 1000;

export function useTourAutoTrigger(): void {
  const isAppReady = useAppStore(selectIsReady);
  const isAuthenticated = useAuthStore((state) => !!state.user);
  const tourCompletedAt = useAuthStore((state) => state.user?.tourCompletedAt);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!isAppReady || !isAuthenticated) return;
    if (triggeredRef.current) return;
    if (isTourCompleted(tourCompletedAt)) return;
    const steps = buildTourSteps(navigate, t);
    if (steps.length === 0) return;

    triggeredRef.current = true;

    const timer = setTimeout(() => {
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
            // best-effort server persistence; localStorage already set
          });
        },
      });
    }, AUTO_TRIGGER_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isAppReady, isAuthenticated, tourCompletedAt, updateProfile, t, navigate]);
}
