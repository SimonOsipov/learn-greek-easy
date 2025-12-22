import React from 'react';

import { AnimatePresence } from 'framer-motion';

import { useNotifications } from '@/contexts/NotificationContext';

import { NotificationToast } from './NotificationToast';

/**
 * NotificationToastContainer
 *
 * Renders active toast notifications in a fixed position container.
 * Uses AnimatePresence for smooth enter/exit animations.
 * Positioned at bottom-right, stacking upward.
 *
 * Key features:
 * - Uses AnimatePresence mode="popLayout" for smooth layout animations
 * - flex-col-reverse makes newest toasts appear at bottom, stack upward
 * - pointer-events-none on container, pointer-events-auto on individual toasts
 * - z-50 matches AchievementNotificationManager for consistent layering
 */
export const NotificationToastContainer: React.FC = () => {
  const { activeToasts, dismissToast } = useNotifications();

  if (activeToasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 sm:bottom-8 sm:right-8"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {activeToasts.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={() => dismissToast(notification.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
