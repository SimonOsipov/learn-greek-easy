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

// ---------------------------------------------------------------------------
// DashboardViewModel — returned by useDashboard()
// ---------------------------------------------------------------------------

import type { DeckResponse } from '@/types/deck';
import type { NewsItem } from '@/types/news';
import type { SituationItem } from '@/types/situation';

/** A deck list item enriched with its progress data (or progress absent if not started). */
export interface DeckWithProgress extends DeckResponse {
  progress: DeckProgressSummary | undefined;
}

/** Counts for the "What's New" chip row. */
export interface WhatsNewCounts {
  /** Number of news items with audio. */
  audio_count: number;
  /** Number of items per country. */
  country_counts: {
    cyprus: number;
    greece: number;
    world: number;
  };
  /** New dialogs chip — coming soon, no backend source yet. */
  newDialogsComingSoon: true;
}

export interface DashboardViewModel {
  /** One of 'morning' | 'afternoon' | 'evening' based on current local hour. */
  greeting: 'morning' | 'afternoon' | 'evening';

  /**
   * Whether the user is brand-new (no mastered cards, no streak).
   * Undefined while useProgressDashboard is still loading — callers must
   * withhold the new-user branch until this resolves.
   */
  isNewUser: boolean | undefined;

  /** The best in-progress deck to resume, or null if none qualifies. */
  resumeDeck: DeckProgressSummary | null;

  /** 7-element array of activity intensity buckets (0–5). */
  heatmap: number[];

  // 2×2 stat values
  masteredCards: number;
  studyTimeSeconds: number;
  currentStreak: number;
  cardsDueToday: number;

  /** Deck list items joined with per-deck progress data. */
  decks: DeckWithProgress[];

  /** News items from /api/v1/news?country=cyprus. */
  news: NewsItem[];

  /** Situation items from /api/v1/situations. */
  situations: SituationItem[];

  /** Chip counts for the "What's New" section. */
  whatsNew: WhatsNewCounts;

  /**
   * First name extracted from full_name (or null while profile is loading).
   * Derived from the first space-delimited token of full_name.
   */
  firstName: string | null;

  /** True while any critical query (progress dashboard) is still pending. */
  isLoading: boolean;

  /** True if any underlying query errored. */
  isError: boolean;

  /** Calls refetch() on all underlying queries. */
  refetchAll: () => void;
}
