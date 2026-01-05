import React, { useEffect, useState, useCallback, useRef } from 'react';

import { AnimatePresence } from 'framer-motion';

import type { UnnotifiedAchievementResponse } from '@/services/xpAPI';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore, useHasHydrated } from '@/stores/authStore';
import { useXPStore, selectUnnotifiedAchievements } from '@/stores/xpStore';

import { AchievementToast } from './AchievementToast';

/**
 * Polling interval for checking new achievements (30 seconds)
 */
const POLL_INTERVAL = 30000;

/**
 * Notification item type
 */
type NotificationItem = { type: 'achievement'; data: UnnotifiedAchievementResponse };

/**
 * AchievementNotificationManager Component
 *
 * Manages and displays achievement notifications.
 * Features:
 * - Polls for unnotified achievements periodically
 * - Queues notifications (one at a time)
 * - Marks achievements as notified when dismissed
 * - Only active when user is authenticated
 */
export const AchievementNotificationManager: React.FC = () => {
  // Auth state
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useHasHydrated();
  const authInitialized = useAppStore((state) => state.authInitialized);

  // XP store
  const unnotifiedAchievements = useXPStore(selectUnnotifiedAchievements);
  const loadUnnotifiedAchievements = useXPStore((state) => state.loadUnnotifiedAchievements);
  const markAchievementsNotified = useXPStore((state) => state.markAchievementsNotified);
  const loadXPStats = useXPStore((state) => state.loadXPStats);

  // Notification queue
  const [queue, setQueue] = useState<NotificationItem[]>([]);
  const [currentNotification, setCurrentNotification] = useState<NotificationItem | null>(null);

  // Track queued achievement IDs to prevent duplicates
  const queuedAchievementIds = useRef(new Set<string>());

  /**
   * Poll for unnotified achievements
   */
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !authInitialized) return;

    // Initial load
    loadXPStats();
    loadUnnotifiedAchievements();

    // Set up polling
    const pollInterval = setInterval(() => {
      loadUnnotifiedAchievements();
      loadXPStats();
    }, POLL_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [hasHydrated, isAuthenticated, authInitialized, loadUnnotifiedAchievements, loadXPStats]);

  /**
   * Queue new achievements when they arrive
   */
  useEffect(() => {
    if (!unnotifiedAchievements?.achievements?.length) return;

    const newAchievements: NotificationItem[] = [];

    for (const achievement of unnotifiedAchievements.achievements) {
      // Skip if already queued or currently showing
      if (queuedAchievementIds.current.has(achievement.id)) continue;
      if (
        currentNotification?.type === 'achievement' &&
        currentNotification.data.id === achievement.id
      )
        continue;

      queuedAchievementIds.current.add(achievement.id);
      newAchievements.push({
        type: 'achievement' as const,
        data: achievement,
      });
    }

    if (newAchievements.length > 0) {
      setQueue((prev) => [...prev, ...newAchievements]);
    }
  }, [unnotifiedAchievements, currentNotification]);

  /**
   * Process queue - show next notification when current is dismissed
   */
  useEffect(() => {
    if (currentNotification || queue.length === 0) return;

    // Pop first item from queue
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrentNotification(next);
  }, [queue, currentNotification]);

  /**
   * Handle dismissal of current notification
   */
  const handleDismiss = useCallback(async () => {
    if (!currentNotification) return;

    // Mark achievement as notified and remove from tracked set
    if (currentNotification.type === 'achievement') {
      await markAchievementsNotified([currentNotification.data.id]);
      queuedAchievementIds.current.delete(currentNotification.data.id);
    }

    setCurrentNotification(null);
  }, [currentNotification, markAchievementsNotified]);

  // Don't render anything if not hydrated, not authenticated, or auth not validated
  if (!hasHydrated || !isAuthenticated || !authInitialized) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col items-end gap-2">
      <AnimatePresence mode="wait">
        {currentNotification?.type === 'achievement' && (
          <AchievementToast
            key={currentNotification.data.id}
            achievement={currentNotification.data}
            onDismiss={handleDismiss}
            duration={5000}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
