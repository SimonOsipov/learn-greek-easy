// Barrel export for all type definitions
import type { ReactNode } from 'react';

// Export auth types explicitly
export type {
  UserRole,
  UserPreferences,
  UserStats,
  User,
  RegisterData,
  AuthResponse,
  AuthError,
} from './auth';

// Export dashboard types explicitly
export type {
  DashboardMetrics,
  WeeklyProgress,
  ActivityItem,
  UpcomingReview,
  LearningStatistics,
  Metric,
  DeckProgress,
  DeckStats,
  Deck,
  DashboardUser,
  DashboardData,
} from './dashboard';

// Export review types explicitly
export type {
  ReviewRating,
  CardReviewState,
  SpacedRepetitionData,
  CardReview,
  ReviewSession,
  SessionStats,
  SessionSummary,
  QueueConfig,
} from './review';

// Export analytics types explicitly
export type {
  AnalyticsSnapshot,
  ProgressDataPoint,
  DeckPerformanceStats,
  WordStatusBreakdown,
  RetentionRate,
  StudyStreak,
  AnalyticsActivityItem,
  AnalyticsDashboardData,
} from './analytics';

// Export feedback types explicitly
export type {
  FeedbackCategory,
  FeedbackStatus,
  VoteType,
  AuthorBrief,
  FeedbackItem,
  FeedbackListResponse,
  VoteResponse,
  CreateFeedbackRequest,
  VoteRequest,
  FeedbackSortField,
  SortOrder,
  FeedbackListParams,
  FeedbackFilters,
  StatusConfig,
} from './feedback';

// Export feedback constants
export { STATUS_CONFIG, CATEGORY_CONFIG } from './feedback';

// Component prop types (to be expanded as components are built)
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface LoadableComponentProps {
  loading?: boolean;
  error?: Error | null;
}
