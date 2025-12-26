/**
 * XP Store
 *
 * Manages XP and achievement data state.
 *
 * Key Features:
 * - 5-minute cache to reduce API calls
 * - Separate loading states for stats and achievements
 * - Auto-refresh after XP-earning actions
 * - Auto-cleanup on logout
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import log from '@/lib/logger';
import { xpAPI } from '@/services/xpAPI';
import type {
  XPStatsResponse,
  AchievementsListResponse,
  UnnotifiedAchievementsResponse,
} from '@/services/xpAPI';

/**
 * XP state interface
 */
interface XPState {
  // Data
  xpStats: XPStatsResponse | null;
  achievements: AchievementsListResponse | null;
  unnotifiedAchievements: UnnotifiedAchievementsResponse | null;

  // Loading states
  loadingStats: boolean;
  loadingAchievements: boolean;
  loadingUnnotified: boolean;

  // Error state
  error: string | null;

  // Cache
  lastStatsFetch: number | null;
  lastAchievementsFetch: number | null;

  // Actions
  loadXPStats: (forceRefresh?: boolean) => Promise<void>;
  loadAchievements: (forceRefresh?: boolean) => Promise<void>;
  loadUnnotifiedAchievements: () => Promise<void>;
  markAchievementsNotified: (achievementIds: string[]) => Promise<void>;
  refreshAll: () => Promise<void>;
  clearXPData: () => void;
}

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Check if cache is valid
 */
const isCacheValid = (lastFetch: number | null): boolean => {
  if (!lastFetch) return false;
  return Date.now() - lastFetch < CACHE_TTL;
};

/**
 * XP store with Zustand
 * Manages XP stats and achievements with 5-minute cache strategy
 */
export const useXPStore = create<XPState>()(
  devtools(
    (set, get) => ({
      // Initial state
      xpStats: null,
      achievements: null,
      unnotifiedAchievements: null,
      loadingStats: false,
      loadingAchievements: false,
      loadingUnnotified: false,
      error: null,
      lastStatsFetch: null,
      lastAchievementsFetch: null,

      /**
       * Load XP stats
       * Implements 5-minute cache - skips fetch if data is fresh
       */
      loadXPStats: async (forceRefresh = false) => {
        const state = get();

        // Check cache validity (skip if cache valid and not forcing refresh)
        if (!forceRefresh && state.xpStats && isCacheValid(state.lastStatsFetch)) {
          log.debug('[xpStore] Using cached XP stats');
          return;
        }

        // Set loading state
        set({ loadingStats: true, error: null });

        try {
          const stats = await xpAPI.getStats();

          set({
            xpStats: stats,
            loadingStats: false,
            lastStatsFetch: Date.now(),
          });
        } catch (error) {
          log.error('[xpStore] Failed to load XP stats:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to load XP stats',
            loadingStats: false,
          });
        }
      },

      /**
       * Load achievements list
       * Implements 5-minute cache
       */
      loadAchievements: async (forceRefresh = false) => {
        const state = get();

        // Check cache validity
        if (!forceRefresh && state.achievements && isCacheValid(state.lastAchievementsFetch)) {
          log.debug('[xpStore] Using cached achievements');
          return;
        }

        set({ loadingAchievements: true, error: null });

        try {
          const achievements = await xpAPI.getAchievements();

          set({
            achievements,
            loadingAchievements: false,
            lastAchievementsFetch: Date.now(),
          });
        } catch (error) {
          log.error('[xpStore] Failed to load achievements:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to load achievements',
            loadingAchievements: false,
          });
        }
      },

      /**
       * Load unnotified achievements
       * No cache - always fetches fresh data
       */
      loadUnnotifiedAchievements: async () => {
        set({ loadingUnnotified: true, error: null });

        try {
          const unnotified = await xpAPI.getUnnotifiedAchievements();

          set({
            unnotifiedAchievements: unnotified,
            loadingUnnotified: false,
          });
        } catch (error) {
          log.error('[xpStore] Failed to load unnotified achievements:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to load notifications',
            loadingUnnotified: false,
          });
        }
      },

      /**
       * Mark achievements as notified
       * Clears from unnotified list on success
       */
      markAchievementsNotified: async (achievementIds: string[]) => {
        try {
          await xpAPI.markAchievementsNotified(achievementIds);

          // Update local state - remove notified achievements
          const state = get();
          if (state.unnotifiedAchievements) {
            const remainingAchievements = state.unnotifiedAchievements.achievements.filter(
              (a) => !achievementIds.includes(a.id)
            );
            set({
              unnotifiedAchievements: {
                achievements: remainingAchievements,
                count: remainingAchievements.length,
              },
            });
          }
        } catch (error) {
          log.error('[xpStore] Failed to mark achievements notified:', error);
          // Non-blocking error - don't set error state
        }
      },

      /**
       * Force refresh all XP data
       * Ignores cache and fetches fresh data
       */
      refreshAll: async () => {
        // Invalidate caches
        set({ lastStatsFetch: null, lastAchievementsFetch: null });

        // Fetch all in parallel
        await Promise.all([
          get().loadXPStats(true),
          get().loadAchievements(true),
          get().loadUnnotifiedAchievements(),
        ]);
      },

      /**
       * Clear XP state
       * Called on logout
       */
      clearXPData: () => {
        set({
          xpStats: null,
          achievements: null,
          unnotifiedAchievements: null,
          loadingStats: false,
          loadingAchievements: false,
          loadingUnnotified: false,
          error: null,
          lastStatsFetch: null,
          lastAchievementsFetch: null,
        });
      },
    }),
    { name: 'xpStore' }
  )
);

// Selectors for optimized re-renders
export const selectXPStats = (state: XPState) => state.xpStats;
export const selectAchievements = (state: XPState) => state.achievements;
export const selectUnnotifiedAchievements = (state: XPState) => state.unnotifiedAchievements;
export const selectIsLoadingStats = (state: XPState) => state.loadingStats;
export const selectIsLoadingAchievements = (state: XPState) => state.loadingAchievements;
export const selectXPError = (state: XPState) => state.error;

/**
 * Check if user is at max level (Level 15)
 * Used to hide "next level" info when at max
 */
export const selectIsMaxLevel = (state: XPState) => state.xpStats?.current_level === 15;

/**
 * Get progress to next level (0-100)
 * Returns 100 if at max level
 */
export const selectLevelProgress = (state: XPState) => {
  if (!state.xpStats) return 0;
  if (state.xpStats.current_level === 15) return 100;
  return state.xpStats.progress_percentage;
};
