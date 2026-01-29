// Barrel export for all type definitions
import type { ReactNode } from 'react';

// Export grammar types explicitly
export type {
  PartOfSpeech,
  DeckLevel,
  NounGender,
  NounData,
  VerbVoice,
  VerbData,
  AdjectiveData,
  AdverbData,
  Example,
} from './grammar';

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

// Export notification types explicitly
export type {
  NotificationType,
  Notification,
  NotificationIconConfig,
  NotificationListResponse,
  UnreadCountResponse,
  MarkReadResponse,
  ClearResponse,
} from './notification';

// Export notification config
export { NOTIFICATION_CONFIG } from './notification';

// Export changelog types explicitly
export type {
  ChangelogTag,
  ChangelogItem,
  ChangelogListResponse,
  ChangelogEntryAdmin,
  ChangelogCreateRequest,
  ChangelogUpdateRequest,
  ChangelogAdminListResponse,
  ChangelogLanguage,
} from './changelog';

// Export changelog constants
export {
  CHANGELOG_TAG_CONFIG,
  CHANGELOG_LANGUAGES,
  CHANGELOG_TAG_OPTIONS,
  getTitleField,
  getContentField,
} from './changelog';

// Component prop types (to be expanded as components are built)
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface LoadableComponentProps {
  loading?: boolean;
  error?: Error | null;
}

// Mock Exam types
export type {
  MockExamSessionStatus,
  MockExamQuestion,
  MockExamSession,
  MockExamCreateResponse,
  MockExamQueueResponse,
  MockExamAnswerItem,
  MockExamSubmitAllRequest,
  MockExamAnswerResult,
  MockExamSubmitAllResponse,
  MockExamStats,
  MockExamHistoryItem,
  MockExamStatisticsResponse,
} from './mockExam';

export {
  MOCK_EXAM_QUESTION_COUNT,
  MOCK_EXAM_PASS_THRESHOLD,
  MOCK_EXAM_PASS_SCORE,
} from './mockExam';

// Mock Exam Session types
export type {
  MockExamFrontendSessionStatus,
  MockExamTimerWarningLevel,
  MockExamQuestionState,
  MockExamTimerState,
  MockExamSessionStats,
  MockExamSessionData,
  MockExamSessionSummary,
  MockExamSessionRecoveryData,
  MockExamSessionState,
} from './mockExamSession';

export {
  MOCK_EXAM_TIME_LIMIT_SECONDS,
  MOCK_EXAM_WARNING_5MIN,
  MOCK_EXAM_WARNING_1MIN,
  MOCK_EXAM_SESSION_STORAGE_KEY,
  MOCK_EXAM_SESSION_RECOVERY_VERSION,
  DEFAULT_TIMER_STATE,
  DEFAULT_SESSION_STATS,
} from './mockExamSession';
