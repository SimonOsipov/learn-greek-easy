/**
 * XP API Service
 *
 * Provides methods for XP and achievement system including:
 * - XP stats retrieval
 * - Achievements listing
 * - Unnotified achievements
 * - Mark achievements as notified
 */

import { api } from './api';

// ============================================
// Types
// ============================================

/**
 * XP stats response from backend
 */
export interface XPStatsResponse {
  total_xp: number;
  current_level: number;
  level_name_greek: string;
  level_name_english: string;
  xp_in_level: number;
  xp_for_next_level: number;
  progress_percentage: number;
}

/**
 * Single achievement with user progress
 */
export interface AchievementResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  hint: string;
  threshold: number;
  xp_reward: number;
  unlocked: boolean;
  unlocked_at: string | null;
  progress: number;
  current_value: number;
}

/**
 * Achievements list response
 */
export interface AchievementsListResponse {
  achievements: AchievementResponse[];
  total_count: number;
  unlocked_count: number;
  total_xp_earned: number;
}

/**
 * Unnotified achievement (simplified for notification)
 */
export interface UnnotifiedAchievementResponse {
  id: string;
  name: string;
  icon: string;
  xp_reward: number;
}

/**
 * Unnotified achievements response
 */
export interface UnnotifiedAchievementsResponse {
  achievements: UnnotifiedAchievementResponse[];
  count: number;
}

/**
 * Mark notified request
 */
export interface MarkNotifiedRequest {
  achievement_ids: string[];
}

/**
 * Mark notified response
 */
export interface MarkNotifiedResponse {
  marked_count: number;
  success: boolean;
}

// ============================================
// XP API Methods
// ============================================

export const xpAPI = {
  /**
   * Get user's XP stats and level information
   */
  getStats: async (): Promise<XPStatsResponse> => {
    return api.get<XPStatsResponse>('/api/v1/xp/stats');
  },

  /**
   * Get all achievements with user progress
   */
  getAchievements: async (): Promise<AchievementsListResponse> => {
    return api.get<AchievementsListResponse>('/api/v1/xp/achievements');
  },

  /**
   * Get newly unlocked achievements that haven't been shown to user
   */
  getUnnotifiedAchievements: async (): Promise<UnnotifiedAchievementsResponse> => {
    return api.get<UnnotifiedAchievementsResponse>('/api/v1/xp/achievements/unnotified');
  },

  /**
   * Mark achievements as notified (user has seen them)
   */
  markAchievementsNotified: async (achievementIds: string[]): Promise<MarkNotifiedResponse> => {
    return api.post<MarkNotifiedResponse>('/api/v1/xp/achievements/notified', {
      achievement_ids: achievementIds,
    });
  },
};
