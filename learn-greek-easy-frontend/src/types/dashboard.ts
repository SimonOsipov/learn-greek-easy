// Dashboard and metrics type definitions

export interface DashboardMetrics {
  dueToday: number;
  streak: number;
  overallProgress: number;
  masteredWords: number;
  remainingWords: number;
  weeklyProgress: WeeklyProgress[];
  recentActivity: ActivityItem[];
}

export interface WeeklyProgress {
  day: string;
  cardsReviewed: number;
  accuracy: number;
  timeSpent: number;
}

export interface ActivityItem {
  id: string;
  type: 'review' | 'achievement' | 'milestone';
  description: string;
  timestamp: Date;
  deckId?: string;
  deckTitle?: string;
}

export interface UpcomingReview {
  period: 'today' | 'tomorrow' | 'this-week' | 'later';
  count: number;
  decks: Array<{
    deckId: string;
    deckTitle: string;
    cardCount: number;
  }>;
}

export interface LearningStatistics {
  totalCards: number;
  totalDecks: number;
  studyStreak: number;
  longestStreak: number;
  averageAccuracy: number;
  totalStudyTime: number;
  cardsPerDay: number;
  retentionRate: number;
  masteryLevel: number;
}

// Test dashboard metric types
export interface Metric {
  id: string;
  label: string;
  value: number | string;
  sublabel: string;
  color?: 'primary' | 'orange' | 'green' | 'blue' | 'muted';
  icon?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

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
}

// User types
export interface User {
  name: string;
  email: string;
  avatar?: string;
  streak: number;
  totalWords: number;
  lastActivity: Date;
}

// Dashboard data
export interface DashboardData {
  user: User;
  metrics: Metric[];
  decks: Deck[];
  upcomingReviews: {
    today: number;
    tomorrow: number;
    week: number;
  };
}
