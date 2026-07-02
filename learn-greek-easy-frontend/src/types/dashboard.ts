// Dashboard and metrics type definitions

// Deck types
export interface DeckProgress {
  current: number;
  total: number;
  percentage: number;
}

export interface DeckStats {
  due: number;
  mastered: number;
  learning: number;
}

export interface Deck {
  id: string;
  title: string;
  description: string;
  status: 'in-progress' | 'completed' | 'not-started';
  progress: DeckProgress;
  stats: DeckStats;
  level?: string;
  lastStudied?: Date;
  isCulture?: boolean;
  coverImageUrl?: string;
}

// ============================================================================
// Dashboard Summary DTO (PERF-15) — GET /api/v1/dashboard/summary
//
// snake_case, mirrors learn-greek-easy-backend/src/schemas/dashboard.py
// field-for-field. Names are prefixed `Dashboard*` to avoid colliding with
// the legacy camelCase `Deck`/`DeckProgress`/`DeckStats` above (used by
// src/components/display/DeckCard.tsx — unrelated to this DTO).
// ============================================================================

export interface DashboardWeekHeat {
  /** Bucketed activity intensity per day (0-5), oldest to newest. Length 7. */
  heat: number[];
  /** Index of "today" in `heat` — always 6. */
  today_idx: number;
}

export interface DashboardTodaySummary {
  reviews_completed: number;
  cards_due: number;
  daily_goal: number;
  goal_progress_percentage: number;
  study_time_seconds: number;
}

export interface DashboardStreakSummary {
  current_streak: number;
  longest_streak: number;
}

/** Per-deck summary for the dashboard deck strip/list. */
export interface DashboardDeckSlice {
  deck_id: string;
  name_el: string | null;
  name_en: string | null;
  name_ru: string | null;
  level: string;
  is_premium: boolean;
  category: string;
  card_count: number;
  cover_image_url: string | null;
  cover_image_variants: Record<number, string> | null;
  status: 'not-started' | 'in-progress' | 'completed';
  cards_total: number;
  cards_new: number;
  cards_learning: number;
  cards_review: number;
  cards_mastered: number;
  due_today: number;
  completion_pct: number;
  mastery_pct: number;
  last_studied_at: string | null;
}

/** Slim news DTO for the dashboard feed — card-rendering fields only. */
export interface DashboardSlimNews {
  id: string;
  situation_id: string;
  title_el: string;
  title_en: string;
  title_ru: string;
  publication_date: string;
  country: string;
  audio_duration_seconds: number | null;
  image_url: string | null;
  image_variants: Record<number, string> | null;
}

/** Slim situation DTO for the dashboard feed. */
export interface DashboardSlimSituation {
  id: string;
  scenario_el: string;
  scenario_en: string;
  scenario_ru: string;
  status: string;
  has_audio: boolean;
  has_dialog: boolean;
  exercise_total: number;
  exercise_completed: number;
  source_image_url: string | null;
  domain: string | null;
  description_source_type: string | null;
}

/** Unwired — reserved for a future word-of-the-day feature (PERF-15). */
export interface DashboardWordOfDay {
  lemma: string;
  translation: string;
}

/** Unwired — reserved for future "what's new" counters (PERF-15). */
export interface DashboardRecentlyAdded {
  news_count: number | null;
  audio_count: number | null;
}

// ── Feed item variants — ordered, data-only, discriminated on `type` ───────

export interface DashboardResumeFeedItem {
  type: 'resume';
  id: string;
  deck_id: string;
  sibling_deck_ids: string[];
}

export interface DashboardReviewFeedItem {
  type: 'review';
  id: string;
  cards_due: number;
  due_deck_ids: string[];
}

export interface DashboardSituationFeedItem {
  type: 'situation';
  id: string;
  situation: DashboardSlimSituation;
}

export interface DashboardWordOfDayFeedItem {
  type: 'word_of_day';
  id: string;
}

export interface DashboardDeckFeedItem {
  type: 'deck';
  id: string;
  deck_id: string;
}

export interface DashboardMilestoneFeedItem {
  type: 'milestone';
  id: string;
  current_streak: number;
  longest_streak: number;
}

export interface DashboardNewsFeedItem {
  type: 'news';
  id: string;
  news: DashboardSlimNews;
}

export interface DashboardQuickFeedItem {
  type: 'quick';
  id: string;
  queue_count: number;
}

export type DashboardFeedItem =
  | DashboardResumeFeedItem
  | DashboardReviewFeedItem
  | DashboardSituationFeedItem
  | DashboardWordOfDayFeedItem
  | DashboardDeckFeedItem
  | DashboardMilestoneFeedItem
  | DashboardNewsFeedItem
  | DashboardQuickFeedItem;

/**
 * Composed payload for GET /dashboard/summary — replaces eight separate
 * dashboard calls with one request (PERF-15).
 *
 * The 5 nullable "unwired" slots are part of the DTO contract but not
 * populated by the backend yet (each defaults to `null`); a later story
 * wires them. Consumers should keep rendering `UnwiredDot` markers for
 * these fields.
 */
export interface DashboardSummaryResponse {
  is_new_user: boolean;
  mastered: number;
  today: DashboardTodaySummary;
  streak: DashboardStreakSummary;
  week_heat: DashboardWeekHeat;
  decks: DashboardDeckSlice[];
  feed: DashboardFeedItem[];
  whats_new_count: number;
  queue_count: number;
  /** Lifetime (vocab + culture + mock) study time, in seconds. */
  all_time_study_time_seconds: number;

  // Unwired nullable slots — reserved, wired later.
  word_of_day: DashboardWordOfDay | null;
  recently_added: DashboardRecentlyAdded | null;
  review_time_estimate_minutes: number | null;
  resume_position: number | null;
  minutes_goal: number | null;
}
