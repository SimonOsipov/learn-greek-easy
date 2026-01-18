/**
 * Timer Warning Banner
 *
 * Persistent warning banner displayed when exam time is critically low (1 minute).
 * Shows at the bottom of the screen to warn users without interrupting their flow.
 */

import React from 'react';

import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

export interface TimerWarningBannerProps {
  /** Whether to show the banner */
  visible: boolean;
  /** Remaining time in formatted string "MM:SS" */
  formattedTime: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * TimerWarningBanner Component
 *
 * A fixed banner that appears at the bottom of the screen when exam time
 * is critically low. Uses red coloring and animation to draw attention.
 */
export const TimerWarningBanner: React.FC<TimerWarningBannerProps> = ({
  visible,
  formattedTime,
  className,
}) => {
  const { t } = useTranslation('mockExam');

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 animate-pulse border-t border-red-500/50 bg-red-600 px-4 py-3 text-white shadow-lg dark:bg-red-700',
        className
      )}
      role="alert"
      aria-live="assertive"
      data-testid="timer-warning-banner"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium sm:text-base">
          {t('session.timeWarning', {
            time: formattedTime,
            defaultValue: 'Only {{time}} remaining! Submit your answers soon.',
          })}
        </span>
      </div>
    </div>
  );
};
