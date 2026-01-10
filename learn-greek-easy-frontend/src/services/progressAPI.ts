// src/services/progressAPI.ts

/**
 * Progress API Service
 *
 * Provides methods for progress tracking and analytics including:
 * - Dashboard statistics
 * - Deck progress
 * - Learning trends
 * - Achievements
 */

import { api, buildQueryString } from './api';

// ============================================
// Types
// ============================================

/**
 * Overview statistics
 */
export interface OverviewStats {
  total_cards_studied: number;
  total_cards_mastered: number;
  total_decks_started: number;
  overall_mastery_percentage: number;
  accuracy_percentage?: number;
  culture_questions_mastered: number;
  total_study_time_seconds: number;
}

/**
 * Today's activity statistics
 */
export interface TodayStats {
  reviews_completed: number;
  cards_due: number;
  daily_goal: number;
  goal_progress_percentage: number;
  study_time_seconds: number;
}

/**
 * Streak statistics
 */
export interface StreakStats {
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
}

/**
 * Cards breakdown by status
 */
export interface CardsByStatus {
  new: number;
  learning: number;
  review: number;
  mastered: number;
}

/**
 * Recent activity entry
 */
export interface RecentActivityEntry {
  date: string;
  reviews_count: number;
  average_quality: number;
}

/**
 * Dashboard statistics response
 */
export interface DashboardStatsResponse {
  overview: OverviewStats;
  today: TodayStats;
  streak: StreakStats;
  cards_by_status: CardsByStatus;
  recent_activity: RecentActivityEntry[];
}

/**
 * Deck progress summary
 */
export interface DeckProgressSummary {
  deck_id: string;
  deck_name: string;
  deck_level: string;
  total_cards: number;
  cards_studied: number;
  cards_mastered: number;
  cards_due: number;
  mastery_percentage: number;
  completion_percentage: number;
  last_studied_at: string | null;
  average_easiness_factor: number;
  estimated_review_time_minutes: number;
  deck_type: 'vocabulary' | 'culture';
}

/**
 * Deck progress list response
 */
export interface DeckProgressListResponse {
  total: number;
  page: number;
  page_size: number;
  decks: DeckProgressSummary[];
}

/**
 * Detailed progress metrics
 */
export interface ProgressMetrics {
  total_cards: number;
  cards_studied: number;
  cards_mastered: number;
  cards_due: number;
  cards_new: number;
  cards_learning: number;
  cards_review: number;
  mastery_percentage: number;
  completion_percentage: number;
}

/**
 * Deck statistics
 */
export interface DeckStatistics {
  total_reviews: number;
  total_study_time_seconds: number;
  average_quality: number;
  average_easiness_factor: number;
  average_interval_days: number;
}

/**
 * Timeline information
 */
export interface DeckTimeline {
  first_studied_at: string | null;
  last_studied_at: string | null;
  days_active: number;
  estimated_completion_days: number | null;
}

/**
 * Deck progress detail response
 */
export interface DeckProgressDetailResponse {
  deck_id: string;
  deck_name: string;
  deck_level: string;
  deck_description: string | null;
  progress: ProgressMetrics;
  statistics: DeckStatistics;
  timeline: DeckTimeline;
}

/**
 * Daily statistics entry
 */
export interface DailyStats {
  date: string;
  reviews_count: number;
  cards_learned: number;
  cards_learning: number;
  cards_mastered: number;
  study_time_seconds: number;
  average_quality: number;
  vocab_accuracy: number;
  culture_accuracy: number;
  combined_accuracy: number;
}

/**
 * Trends summary
 */
export interface TrendsSummary {
  total_reviews: number;
  total_study_time_seconds: number;
  cards_mastered: number;
  average_daily_reviews: number;
  best_day: string | null;
  quality_trend: 'improving' | 'stable' | 'declining';
}

/**
 * Learning trends response
 */
export interface LearningTrendsResponse {
  period: string;
  start_date: string;
  end_date: string;
  daily_stats: DailyStats[];
  summary: TrendsSummary;
}

/**
 * Achievement entry
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at: string | null;
  progress: number;
  points: number;
}

/**
 * Next milestone
 */
export interface NextMilestone {
  id: string;
  name: string;
  progress: number;
  remaining: number;
}

/**
 * Achievements response
 */
export interface AchievementsResponse {
  achievements: Achievement[];
  total_points: number;
  next_milestone: NextMilestone | null;
}

/**
 * Parameters for deck progress list
 */
export interface DeckProgressListParams {
  page?: number;
  page_size?: number;
}

/**
 * Parameters for learning trends
 */
export interface LearningTrendsParams {
  period?: 'week' | 'month' | 'year';
  deck_id?: string;
}

// ============================================
// Progress API Methods
// ============================================

export const progressAPI = {
  /**
   * Get comprehensive dashboard statistics
   */
  getDashboard: async (): Promise<DashboardStatsResponse> => {
    return api.get<DashboardStatsResponse>('/api/v1/progress/dashboard');
  },

  /**
   * Get paginated list of deck progress
   */
  getDeckProgressList: async (
    params: DeckProgressListParams = {}
  ): Promise<DeckProgressListResponse> => {
    const queryString = buildQueryString({
      page: params.page || 1,
      page_size: params.page_size || 20,
    });
    return api.get<DeckProgressListResponse>(`/api/v1/progress/decks${queryString}`);
  },

  /**
   * Get detailed progress for a specific deck
   */
  getDeckProgressDetail: async (deckId: string): Promise<DeckProgressDetailResponse> => {
    return api.get<DeckProgressDetailResponse>(`/api/v1/progress/decks/${deckId}`);
  },

  /**
   * Get learning trends for charts and analytics
   */
  getTrends: async (params: LearningTrendsParams = {}): Promise<LearningTrendsResponse> => {
    const queryString = buildQueryString({
      period: params.period || 'week',
      deck_id: params.deck_id,
    });
    return api.get<LearningTrendsResponse>(`/api/v1/progress/trends${queryString}`);
  },

  /**
   * Get user achievements and gamification progress
   */
  getAchievements: async (): Promise<AchievementsResponse> => {
    return api.get<AchievementsResponse>('/api/v1/progress/achievements');
  },
};
