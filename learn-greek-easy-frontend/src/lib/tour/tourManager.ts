import { setTourCompleted } from '@/utils/tourStatus';

import type { DriveStep, Driver } from 'driver.js';
import type { TFunction } from 'i18next';
import './tour.css';

let dismissCallback: ((handlers: { onSkip: () => void; onContinue: () => void }) => void) | null =
  null;

export function registerDismissHandler(
  handler: ((handlers: { onSkip: () => void; onContinue: () => void }) => void) | null
): void {
  dismissCallback = handler;
}

let completionCallback: (() => void) | null = null;

export function registerCompletionHandler(handler: (() => void) | null): void {
  completionCallback = handler;
}

let activeDriver: Driver | null = null;
let isStartingTour = false;

export interface TourOptions {
  trigger?: 'auto' | 'manual';
  t: TFunction;
  onAnalyticsEvent?: (event: string, properties?: Record<string, unknown>) => void;
}

export async function startTour(steps: DriveStep[], options: TourOptions): Promise<void> {
  if (activeDriver || isStartingTour) return;
  if (steps.length === 0) return;
  isStartingTour = true;

  try {
    const { driver } = await import('driver.js');
    await import('driver.js/dist/driver.css');

    const { t, trigger = 'manual', onAnalyticsEvent } = options;

    let destroySnapshot = { stepIndex: 0, isCompleted: false };

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
        destroySnapshot = {
          stepIndex: driverObj.getActiveIndex() ?? 0,
          isCompleted: !driverObj.hasNextStep(),
        };
        if (!driverObj.hasNextStep()) {
          driverObj.destroy();
          return;
        }
        if (dismissCallback) {
          dismissCallback({
            onSkip: () => {
              destroySnapshot.isCompleted = false;
              driverObj.destroy();
            },
            onContinue: () => {
              // no-op: dialog closes, tour stays on current step
            },
          });
        } else {
          driverObj.destroy();
        }
      },
      onDestroyed: () => {
        const { stepIndex: stepsViewed, isCompleted } = destroySnapshot;
        setTourCompleted();
        activeDriver = null;
        if (isCompleted) {
          onAnalyticsEvent?.('tour_completed', { steps_viewed: stepsViewed + 1, trigger });
          completionCallback?.();
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
  } catch {
    activeDriver = null;
  } finally {
    isStartingTour = false;
  }
}

export function getTourDriver(): Driver | null {
  return activeDriver;
}

export function isTourActive(): boolean {
  return activeDriver !== null;
}
