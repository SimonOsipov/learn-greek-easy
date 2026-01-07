// src/types/analytics.ts

/**
 * Daily analytics snapshot
 * Represents complete learning state at end of a specific date
 *
 * @remarks
 * One snapshot is created/updated per day via endReviewSession hook
 * Snapshots form a time series for trend analysis
 */
export interface AnalyticsSnapshot {
  // Identity
  snapshotId: string; // UUID for snapshot
  userId: string; // Which user (for multi-user support)
  date: Date; // Which date this snapshot represents (start of day UTC)
  createdAt: Date; // When snapshot was created/updated

  // Daily activity
  sessionsToday: number; // How many review sessions completed
  cardsReviewedToday: number; // Total cards reviewed in all sessions
  timeStudiedToday: number; // Total time (seconds) spent studying
  newCardsToday: number; // New cards started today
  cardsReviewedCorrectly: number; // Cards rated "good" or "easy"
  accuracyToday: number; // Percentage (0-100)

  // Cumulative deck state
  totalCardsNew: number; // Sum across all decks
  totalCardsLearning: number; // Sum across all decks
  totalCardsReview: number; // Sum across all decks
  cardsMasteredTotal: number; // Sum across all decks (lifetime)
  cardsMasteredToday: number; // Cards that graduated to mastered today

  // Streak tracking
  currentStreak: number; // Current consecutive days with reviews
  longestStreak: number; // Best streak achieved (lifetime)

  // Quality metrics
  overallAccuracy: number; // Weighted accuracy across all reviews (0-100)
  averageTimePerCard: number; // Seconds (time studied / cards reviewed)

  // Metadata
  streakBroken: boolean; // Whether streak ended today
  newPersonalBest: boolean; // New high for cards studied in a day
}

/**
 * Single point on progress chart timeline
 * Represents one date with multiple metric values for charting
 *
 * @remarks
 * Used for line charts showing: Cards Mastered Over Time, Accuracy Trend, Time Studied Trend
 * Each date maps to one ProgressDataPoint
 */
export interface ProgressDataPoint {
  // Date on x-axis
  date: Date; // Which date (YYYY-MM-DD)
  dateString: string; // ISO string for charting libraries (YYYY-MM-DD)

  // Multiple y-axis metrics (all optional, use only needed ones)
  cardsMastered: number; // Cumulative cards mastered by this date
  cardsReviewed: number; // Cards reviewed on this date
  accuracy: number; // Accuracy percentage (0-100) - combined vocab + culture
  vocabAccuracy: number; // Vocabulary accuracy percentage (0-100)
  cultureAccuracy: number; // Culture questions accuracy percentage (0-100)
  timeStudied: number; // Seconds studied on this date
  streak: number; // Current streak length on this date
  cardsNew: number; // Total new cards remaining
  cardsLearning: number; // Total learning cards
  cardsReview: number; // Total review cards
}

/**
 * Analytics for a single deck
 * Used for bar chart: Accuracy per Deck, Cards Mastered per Deck, etc.
 *
 * @remarks
 * Aggregates all review data for a specific deck
 * Enables answering: "Which decks do I need to focus on?"
 */
export interface DeckPerformanceStats {
  // Deck identity
  deckId: string; // Which deck
  deckName: string; // Display name (e.g., "A1 Basics")
  deckColor: string; // Color for chart bars (hex code)

  // Card counts
  cardsInDeck: number; // Total cards (new + learning + review + mastered)
  cardsNew: number; // Never reviewed
  cardsLearning: number; // Currently learning
  cardsReview: number; // In review phase
  cardsMastered: number; // Graduated and mastered

  // Performance metrics
  accuracy: number; // Weighted accuracy for this deck (0-100)
  successRate: number; // Percentage of reviews correct (0-100)
  averageEaseFactor: number; // Average SM-2 ease factor (1.3-2.5)

  // Time investment
  timeSpent: number; // Total seconds spent on this deck
  sessionsCompleted: number; // Total review sessions
  averageTimePerCard: number; // Seconds

  // Progress rate
  mastery: number; // Percentage of deck mastered (cardsMastered / cardsInDeck) × 100
  completionRate: number; // Percentage started (1 - (cardsNew / cardsInDeck)) × 100

  // Recent performance (last 7 days)
  recentAccuracy: number; // Accuracy in last 7 days
  cardsGraduatedRecently: number; // Cards mastered in last 7 days
}

/**
 * Distribution of cards across learning states
 * Used for pie charts: "Card Status Breakdown" showing new/learning/review/mastered proportions
 *
 * @remarks
 * Answers: "How close am I to finishing this deck?"
 * Visual goal: User sees pie chart 25% mastered, 40% review, 25% learning, 10% new
 */
export interface WordStatusBreakdown {
  // Raw counts
  new: number; // Cards never reviewed
  learning: number; // Cards being learned (< 1 day interval)
  review: number; // Cards in review phase (1+ day interval)
  mastered: number; // Cards mastered (21+ day interval, 80%+ success)
  relearning: number; // Cards that failed and need re-learning

  // Percentages (for labels on pie chart)
  newPercent: number; // (new / total) × 100
  learningPercent: number;
  reviewPercent: number;
  masteredPercent: number;
  relearningPercent: number;

  // Metadata
  total: number; // Sum of all cards
  deckId: string; // Which deck (for filtering breakdown by deck)
  date: Date; // When this breakdown was calculated
}

/**
 * Retention rate at specific interval
 * Tracks: "Of cards reviewed N days ago, what % were correct on re-review?"
 *
 * @remarks
 * Answers: "Are users actually retaining vocabulary or just memorizing?"
 * Example: Of cards reviewed 7 days ago (100 cards), 82 were correct on re-review = 82% retention
 * Data shows retention curve: 90% after 1 day, 82% after 7 days, 75% after 30 days
 */
export interface RetentionRate {
  // Interval definition
  interval: number; // Days since original review (1, 7, 14, 30)
  intervalLabel: string; // "1 day", "7 days", "30 days" for display

  // Sample data
  cardsReviewedAtInterval: number; // Cards reviewed N days ago
  cardsRemembered: number; // Cards correct on re-review
  retention: number; // Percentage (0-100)

  // Context
  deckId?: string; // Optional: specific deck (omit for all decks)
  calculatedAt: Date; // When this retention rate was calculated
}

/**
 * Study streak information
 * Tracks consecutive days with review activity
 *
 * @remarks
 * Displayed prominently on dashboard to motivate daily habits
 * Shows current streak, longest streak, and milestone achievements
 * A "day with reviews" = at least 1 card reviewed (any deck)
 */
export interface StudyStreak {
  // Current streak
  currentStreak: number; // Consecutive days with reviews
  startDate: Date; // When current streak started
  lastActivityDate: Date; // Last date with reviews

  // Historical best
  longestStreak: number; // Best streak achieved
  longestStreakStart: Date; // When that streak started
  longestStreakEnd: Date; // When that streak ended

  // Milestones
  milestoneReached: number; // Highest milestone: 7, 30, 100, etc.
  nextMilestone: number; // Next milestone to reach
  daysToNextMilestone: number; // How many more days needed

  // Additional context
  streakBrokenToday: boolean; // Whether activity was missing yesterday
  consecutiveBreaks: number; // How many days in a row without reviews
}

/**
 * Single activity feed item
 * Represents one review session or learning achievement
 *
 * @remarks
 * Activity feed shows recent study sessions in chronological order
 * Formats: "Reviewed 15 cards in A1 Basics - 87% accuracy - 12 minutes ago"
 * Or: "Mastered 3 cards in Family & Relationships - 30 minutes ago"
 */
export interface AnalyticsActivityItem {
  // Identity
  activityId: string; // UUID for activity
  sessionId?: string; // Linked review session (if from session)
  type: 'review_session' | 'achievement' | 'streak_milestone'; // Activity type

  // Time
  timestamp: Date; // When activity occurred
  relativeTime: string; // "12 minutes ago", "2 hours ago", "3 days ago"

  // Content
  title: string; // Main action: "Reviewed 15 cards"
  description: string; // Details: "in A1 Basics - 87% accuracy"
  deckId?: string; // Which deck(s) involved
  deckName?: string; // Display name

  // Metrics (if review session)
  cardsReviewed?: number;
  accuracy?: number; // Percentage (0-100)
  timeSpent?: number; // Seconds
  newCardsMastered?: number; // Cards that graduated today

  // Metrics (if achievement)
  achievementType?: 'streak_milestone' | 'deck_completed' | 'cards_mastered' | 'accuracy_goal';
  achievementValue?: number; // "7-day streak", "50 cards mastered", etc.

  // Visual
  icon: string; // Icon name: 'book-open', 'zap', 'trophy', 'trending-up'
  color: string; // Tailwind color: 'blue', 'green', 'yellow', 'purple'
}

/**
 * Complete analytics data for dashboard
 * Single query returns all data needed for full dashboard render
 *
 * @remarks
 * Dashboard component receives this single object instead of multiple queries
 * Enables efficient data fetching: one API call = full dashboard data
 * Timestamp allows caching and refresh control
 */
export interface AnalyticsDashboardData {
  // Metadata
  userId: string;
  dateRange: {
    startDate: Date; // "Last 7 days" start
    endDate: Date; // "Last 7 days" end (today)
    label: string; // "Last 7 days", "Last 30 days", "All time"
  };
  fetchedAt: Date; // When this data was fetched/calculated

  // Summary metrics (for header cards)
  summary: {
    totalCardsReviewed: number; // In date range
    totalTimeStudied: number; // Seconds in date range
    averageAccuracy: number; // Across all reviews in range
    cardsNewlyMastered: number; // Graduated in date range
  };

  // Streak info (for prominent display)
  streak: StudyStreak;

  // Historical time series (for line charts)
  progressData: ProgressDataPoint[]; // One per date in range

  // Per-deck comparison (for bar chart)
  deckStats: DeckPerformanceStats[]; // One per deck

  // Word status breakdown (for pie chart)
  wordStatus: WordStatusBreakdown;

  // Retention analysis (for retention curve chart)
  retention: RetentionRate[]; // Intervals: 1d, 7d, 14d, 30d

  // Recent activity (for activity feed)
  recentActivity: AnalyticsActivityItem[]; // Last 20 sessions/achievements
}
