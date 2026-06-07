/**
 * Types for the progress/dashboard, trends, and deck-progress endpoints.
 * Field names match backend JSON (snake_case) exactly.
 *
 * Source endpoints:
 *   GET /api/v1/progress/dashboard  → ProgressDashboardResponse
 *   GET /api/v1/progress/trends     → TrendsResponse
 *   GET /api/v1/progress/decks      → DeckProgressListResponse
 */

export interface StreakStats {
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  vocabulary_current_streak: number;
  vocabulary_longest_streak: number;
  culture_current_streak: number;
  culture_longest_streak: number;
  exercise_current_streak: number;
  exercise_longest_streak: number;
}

export interface ProgressDashboardResponse {
  streak: StreakStats;
  today: {
    cards_due: number;
    daily_goal: number;
    study_time_seconds: number;
  };
  overview: {
    total_cards_mastered: number;
    total_study_time_seconds: number;
  };
  recent_activity: Array<{
    date: string;
    reviews_count: number;
  }>;
}

export interface TrendsDailyStat {
  date: string;
  reviews_count: number;
}

export interface TrendsResponse {
  daily_stats: TrendsDailyStat[];
}

export interface DeckProgressSummary {
  deck_id: string;
  deck_name: string;
  cards_studied: number;
  cards_mastered: number;
  cards_due: number;
  mastery_percentage: number;
  completion_percentage: number;
  last_studied_at: string | null;
}

export interface DeckProgressListResponse {
  total: number;
  page: number;
  page_size: number;
  decks: DeckProgressSummary[];
}
