import React, { useEffect, useMemo } from 'react';

import { motion } from 'framer-motion';
import { X, Star } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { UnnotifiedAchievementResponse } from '@/services/xpAPI';

/**
 * Props for AchievementToast component
 */
export interface AchievementToastProps {
  /** Achievement to display */
  achievement: UnnotifiedAchievementResponse;
  /** Callback when toast is dismissed */
  onDismiss: () => void;
  /** Auto-dismiss duration in ms (default: 5000) */
  duration?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AchievementToast Component
 *
 * Displays a toast notification when an achievement is unlocked.
 * Features:
 * - Animated entry/exit with framer-motion
 * - Shows achievement icon, name, and XP reward
 * - Auto-dismiss after 5 seconds (configurable)
 * - Manual dismiss button
 * - Screen reader announcement for accessibility
 * - Respects prefers-reduced-motion
 */
export const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
  onDismiss,
  duration = 5000,
  className,
}) => {
  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Auto-dismiss after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  // Animation variants
  const toastVariants = {
    initial: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -50, scale: 0.9 },
    animate: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 },
    exit: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.95 },
  };

  return (
    <>
      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        Achievement unlocked: {achievement.name}. You earned {achievement.xp_reward} XP!
      </div>

      {/* Visual toast */}
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={toastVariants}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, ease: 'easeOut' }}
        className={cn(
          'pointer-events-auto relative flex w-full max-w-sm items-center gap-3',
          'rounded-lg border border-purple-200 bg-white p-4 shadow-lg',
          'dark:border-purple-800 dark:bg-gray-900',
          className
        )}
        role="alert"
        aria-labelledby="achievement-toast-title"
      >
        {/* Achievement Icon */}
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 text-2xl dark:bg-purple-900/50"
          aria-hidden="true"
        >
          {achievement.icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-purple-600 dark:text-purple-400">
            Achievement Unlocked!
          </p>
          <p
            id="achievement-toast-title"
            className="mt-0.5 truncate font-semibold text-gray-900 dark:text-white"
          >
            {achievement.name}
          </p>
          <div className="mt-1 flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
            <Star className="h-3.5 w-3.5" aria-hidden="true" />
            <span>+{achievement.xp_reward} XP</span>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className={cn(
            'flex-shrink-0 rounded-full p-1.5',
            'text-gray-400 hover:bg-gray-100 hover:text-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
            'dark:hover:bg-gray-800 dark:hover:text-gray-300'
          )}
          aria-label="Dismiss achievement notification"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar for auto-dismiss timing */}
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className="absolute bottom-0 left-0 h-1 w-full origin-left rounded-b-lg bg-purple-500"
          aria-hidden="true"
        />
      </motion.div>
    </>
  );
};
