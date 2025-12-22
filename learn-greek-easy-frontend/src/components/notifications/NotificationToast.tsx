import React, { useEffect, useMemo } from 'react';

import { motion } from 'framer-motion';
import {
  ArrowUp,
  CheckCircle,
  Flame,
  Hand,
  HeartCrack,
  Info,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types/notification';

/**
 * Icon and styling configuration for each notification type
 */
const notificationConfig: Record<
  NotificationType,
  {
    icon: LucideIcon;
    bgClass: string;
    iconClass: string;
    borderClass: string;
    progressClass: string;
  }
> = {
  achievement_unlocked: {
    icon: Trophy,
    bgClass: 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10',
    iconClass: 'text-amber-500',
    borderClass: 'border-amber-200 dark:border-amber-800',
    progressClass: 'bg-amber-500',
  },
  daily_goal_complete: {
    icon: CheckCircle,
    bgClass: 'bg-gradient-to-r from-green-500/10 to-emerald-500/10',
    iconClass: 'text-green-500',
    borderClass: 'border-green-200 dark:border-green-800',
    progressClass: 'bg-green-500',
  },
  level_up: {
    icon: ArrowUp,
    bgClass: 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10',
    iconClass: 'text-blue-500',
    borderClass: 'border-blue-200 dark:border-blue-800',
    progressClass: 'bg-blue-500',
  },
  streak_at_risk: {
    icon: Flame,
    bgClass: 'bg-gradient-to-r from-orange-500/10 to-red-500/10',
    iconClass: 'text-orange-500',
    borderClass: 'border-orange-200 dark:border-orange-800',
    progressClass: 'bg-orange-500',
  },
  streak_lost: {
    icon: HeartCrack,
    bgClass: 'bg-gradient-to-r from-red-500/10 to-rose-500/10',
    iconClass: 'text-red-500',
    borderClass: 'border-red-200 dark:border-red-800',
    progressClass: 'bg-red-500',
  },
  welcome: {
    icon: Hand,
    bgClass: 'bg-gradient-to-r from-purple-500/10 to-pink-500/10',
    iconClass: 'text-purple-500',
    borderClass: 'border-purple-200 dark:border-purple-800',
    progressClass: 'bg-purple-500',
  },
};

const defaultConfig = {
  icon: Info,
  bgClass: 'bg-secondary',
  iconClass: 'text-muted-foreground',
  borderClass: 'border-border',
  progressClass: 'bg-muted-foreground',
};

/**
 * Props for NotificationToast component
 */
export interface NotificationToastProps {
  /** Notification to display */
  notification: Notification;
  /** Callback when toast is dismissed */
  onDismiss: () => void;
  /** Auto-dismiss duration in ms (default: 5000) */
  duration?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * NotificationToast Component
 *
 * Displays a toast notification for in-app events.
 * Features:
 * - Animated entry/exit with framer-motion
 * - Shows notification icon, title, and message
 * - Auto-dismiss after 5 seconds (configurable)
 * - Manual dismiss button
 * - Click to navigate if action_url is present
 * - Keyboard accessible (Enter/Space)
 * - Screen reader announcement for accessibility
 * - Respects prefers-reduced-motion
 */
export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  duration = 5000,
  className,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Auto-dismiss timer with cleanup
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const config = notificationConfig[notification.type] || defaultConfig;
  const Icon = config.icon;

  // Click handler for navigation
  const handleClick = () => {
    if (notification.action_url) {
      navigate(notification.action_url);
    }
    onDismiss();
  };

  // Keyboard handler for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (notification.action_url && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleClick();
    }
  };

  // Animation variants (from AchievementToast pattern)
  const toastVariants = {
    initial: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 50, scale: 0.95 },
    animate: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 },
    exit: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 20, scale: 0.95 },
  };

  return (
    <>
      {/* Screen reader announcement (sr-only, separate element) */}
      <div className="sr-only" role="status" aria-live="polite">
        {notification.title}: {notification.message}
      </div>

      {/* Visual toast */}
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={toastVariants}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.3, ease: 'easeOut' }}
        className={cn(
          'pointer-events-auto relative flex w-full max-w-sm items-start gap-3',
          'rounded-lg border p-4 shadow-lg',
          config.bgClass,
          config.borderClass,
          notification.action_url && 'cursor-pointer',
          className
        )}
        onClick={notification.action_url ? handleClick : undefined}
        onKeyDown={handleKeyDown}
        tabIndex={notification.action_url ? 0 : undefined}
        role="alert"
        aria-labelledby={`toast-title-${notification.id}`}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/50 dark:bg-gray-800/50',
            config.iconClass
          )}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p
            id={`toast-title-${notification.id}`}
            className="text-sm font-semibold text-foreground"
          >
            {notification.title}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className={cn(
            'flex-shrink-0 rounded-full p-1.5',
            'text-gray-400 hover:bg-gray-100 hover:text-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            'dark:hover:bg-gray-800 dark:hover:text-gray-300'
          )}
          aria-label={t('notifications.dismiss')}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar for auto-dismiss timing */}
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className={cn(
            'absolute bottom-0 left-0 h-1 w-full origin-left rounded-b-lg',
            config.progressClass
          )}
          aria-hidden="true"
        />
      </motion.div>
    </>
  );
};
