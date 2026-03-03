import { useEffect, useRef } from 'react';

import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';

import { startTour, tourSteps } from '@/lib/tour';
import { useAppStore, selectIsReady } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { isTourCompleted } from '@/utils/tourStatus';

const AUTO_TRIGGER_DELAY_MS = 1000;

export function useTourAutoTrigger(): void {
  const isAppReady = useAppStore(selectIsReady);
  const isAuthenticated = useAuthStore((state) => !!state.user);
  const { t } = useTranslation('common');
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!isAppReady || !isAuthenticated) return;
    if (triggeredRef.current) return;
    if (isTourCompleted()) return;
    if (tourSteps.length === 0) return;

    triggeredRef.current = true;

    const timer = setTimeout(() => {
      startTour(tourSteps, {
        trigger: 'auto',
        t,
        onAnalyticsEvent: (event, props) => {
          if (typeof posthog?.capture === 'function') {
            posthog.capture(event, props);
          }
        },
      });
    }, AUTO_TRIGGER_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isAppReady, isAuthenticated, t]);
}
