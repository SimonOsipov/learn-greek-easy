import { setTourCompleted } from '@/utils/tourStatus';

import type { DriveStep, Driver } from 'driver.js';
import type { TFunction } from 'i18next';
import './tour.css';

let activeDriver: Driver | null = null;

export interface TourOptions {
  trigger?: 'auto' | 'manual';
  t: TFunction;
  onAnalyticsEvent?: (event: string, properties?: Record<string, unknown>) => void;
}

export async function startTour(steps: DriveStep[], options: TourOptions): Promise<void> {
  if (activeDriver) return;
  if (steps.length === 0) return;

  const { driver } = await import('driver.js');
  await import('driver.js/dist/driver.css');

  const { t, trigger = 'manual', onAnalyticsEvent } = options;

  const driverObj = driver({
    animate: true,
    smoothScroll: true,
    allowKeyboardControl: true,
    showProgress: true,
    overlayOpacity: 0.5,
    stagePadding: 10,
    stageRadius: 8,
    popoverClass: 'greekly-tour-popover',
    progressText: t('tour.progress'),
    nextBtnText: t('tour.next'),
    prevBtnText: t('tour.previous'),
    doneBtnText: t('tour.done'),
    showButtons: ['next', 'previous', 'close'],
    steps,
    onDestroyStarted: () => {
      driverObj.destroy();
    },
    onDestroyed: () => {
      const stepsViewed = driverObj.getActiveIndex() ?? 0;
      const isCompleted = !driverObj.hasNextStep();
      setTourCompleted();
      activeDriver = null;
      if (isCompleted) {
        onAnalyticsEvent?.('tour_completed', { steps_viewed: stepsViewed + 1, trigger });
      } else {
        onAnalyticsEvent?.('tour_dismissed', {
          step_index: stepsViewed,
          steps_total: steps.length,
          trigger,
        });
      }
    },
  });

  activeDriver = driverObj;
  onAnalyticsEvent?.('tour_started', { trigger });
  driverObj.drive();
}

export function getTourDriver(): Driver | null {
  return activeDriver;
}

export function isTourActive(): boolean {
  return activeDriver !== null;
}
