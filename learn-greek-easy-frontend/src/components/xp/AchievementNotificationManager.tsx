import React, { useEffect, useState, useCallback, useRef } from 'react';

import { AnimatePresence } from 'framer-motion';

import type { UnnotifiedAchievementResponse } from '@/services/xpAPI';
import { useAuthStore, useHasHydrated } from '@/stores/authStore';
import { useXPStore, selectXPStats, selectUnnotifiedAchievements } from '@/stores/xpStore';

import { AchievementToast } from './AchievementToast';
import { LevelUpCelebration } from './LevelUpCelebration';

/**
 * LocalStorage key for storing last known level
 */
const LAST_KNOWN_LEVEL_KEY = 'lge_last_known_level';

/**
 * Polling interval for checking new achievements (30 seconds)
 */
const POLL_INTERVAL = 30000;

/**
 * Notification item types
 */
type NotificationItem =
  | { type: 'achievement'; data: UnnotifiedAchievementResponse }
  | { type: 'level-up'; data: { level: number; nameGreek: string; nameEnglish: string } };

/**
 * AchievementNotificationManager Component
 *
 * Manages and displays achievement and level-up notifications.
 * Features:
 * - Polls for unnotified achievements periodically
 * - Detects level-ups by comparing with localStorage
 * - Queues notifications (one at a time)
 * - Level-ups have priority over achievements
 * - Marks achievements as notified when dismissed
 * - Only active when user is authenticated
 */
export const AchievementNotificationManager: React.FC = () => {
  // Auth state
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useHasHydrated();

  // XP store
  const xpStats = useXPStore(selectXPStats);
  const unnotifiedAchievements = useXPStore(selectUnnotifiedAchievements);
  const loadUnnotifiedAchievements = useXPStore((state) => state.loadUnnotifiedAchievements);
  const markAchievementsNotified = useXPStore((state) => state.markAchievementsNotified);
  const loadXPStats = useXPStore((state) => state.loadXPStats);

  // Notification queue
  const [queue, setQueue] = useState<NotificationItem[]>([]);
  const [currentNotification, setCurrentNotification] = useState<NotificationItem | null>(null);

  // Track if we've checked level-up for this session
  const hasCheckedLevelUp = useRef(false);

  // Track queued achievement IDs to prevent duplicates
  const queuedAchievementIds = useRef(new Set<string>());

  /**
   * Get last known level from localStorage
   */
  const getLastKnownLevel = useCallback((): number | null => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(LAST_KNOWN_LEVEL_KEY);
    return stored ? parseInt(stored, 10) : null;
  }, []);

  /**
   * Save current level to localStorage
   */
  const saveCurrentLevel = useCallback((level: number) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LAST_KNOWN_LEVEL_KEY, String(level));
  }, []);

  /**
   * Check for level-up
   */
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !xpStats || hasCheckedLevelUp.current) return;

    const currentLevel = xpStats.current_level;
    const lastKnownLevel = getLastKnownLevel();

    // If we have a previous level and current is higher, trigger level-up
    if (lastKnownLevel !== null && currentLevel > lastKnownLevel) {
      const levelUpNotification: NotificationItem = {
        type: 'level-up',
        data: {
          level: currentLevel,
          nameGreek: xpStats.level_name_greek,
          nameEnglish: xpStats.level_name_english,
        },
      };

      // Add level-up to front of queue (priority)
      setQueue((prev) => [levelUpNotification, ...prev]);
    }

    // Save current level
    saveCurrentLevel(currentLevel);
    hasCheckedLevelUp.current = true;
  }, [hasHydrated, isAuthenticated, xpStats, getLastKnownLevel, saveCurrentLevel]);

  /**
   * Poll for unnotified achievements
   */
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;

    // Initial load
    loadXPStats();
    loadUnnotifiedAchievements();

    // Set up polling
    const pollInterval = setInterval(() => {
      loadUnnotifiedAchievements();
      loadXPStats(); // Also refresh stats to detect level changes
    }, POLL_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [hasHydrated, isAuthenticated, loadUnnotifiedAchievements, loadXPStats]);

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

    // If it was an achievement, mark it as notified and remove from tracked set
    if (currentNotification.type === 'achievement') {
      await markAchievementsNotified([currentNotification.data.id]);
      queuedAchievementIds.current.delete(currentNotification.data.id);
    }

    // If it was a level-up, update the saved level
    if (currentNotification.type === 'level-up') {
      saveCurrentLevel(currentNotification.data.level);
    }

    setCurrentNotification(null);
  }, [currentNotification, markAchievementsNotified, saveCurrentLevel]);

  // Don't render anything if not hydrated or not authenticated
  if (!hasHydrated || !isAuthenticated) return null;

  return (
    <>
      {/* Achievement Toast Container */}
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

      {/* Level-Up Celebration Modal */}
      <LevelUpCelebration
        isOpen={currentNotification?.type === 'level-up'}
        level={currentNotification?.type === 'level-up' ? currentNotification.data.level : 1}
        levelNameGreek={
          currentNotification?.type === 'level-up' ? currentNotification.data.nameGreek : ''
        }
        levelNameEnglish={
          currentNotification?.type === 'level-up' ? currentNotification.data.nameEnglish : ''
        }
        onDismiss={handleDismiss}
      />
    </>
  );
};
