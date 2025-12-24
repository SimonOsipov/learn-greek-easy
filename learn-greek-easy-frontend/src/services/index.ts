// src/services/index.ts

/**
 * API Services Index
 *
 * Central export point for all API services.
 * Import from here for cleaner imports across the application.
 */

// Base API client and utilities
export { api, APIRequestError, buildQueryString, clearAuthTokens } from './api';
export type { APIError } from './api';

// Authentication API
export { authAPI } from './authAPI';
export type {
  GoogleAuthRequest,
  LoginRequest,
  LogoutResponse,
  RegisterRequest,
  TokenResponse,
  UserProfileResponse,
} from './authAPI';

// Deck API
export { deckAPI } from './deckAPI';
export type {
  DeckDetailResponse,
  DeckLevel,
  DeckListResponse,
  DeckResponse,
  DeckSearchResponse,
  ListDecksParams,
  SearchDecksParams,
} from './deckAPI';

// Card API
export { cardAPI } from './cardAPI';
export type {
  CardDifficulty,
  CardListResponse,
  CardResponse,
  CardSearchResponse,
  ListCardsParams,
  SearchCardsParams,
} from './cardAPI';

// Study API
export { studyAPI } from './studyAPI';
export type {
  CardInitializationRequest,
  CardInitializationResult,
  CardStatus,
  StudyQueue,
  StudyQueueCard,
  StudyQueueParams,
  StudyStatsByStatus,
  StudyStatsResponse,
} from './studyAPI';

// Review API
export { reviewAPI } from './reviewAPI';
export type {
  BulkReviewSubmit,
  ReviewHistoryEntry,
  ReviewHistoryListResponse,
  ReviewHistoryParams,
  ReviewSubmit,
  SM2BulkReviewResult,
  SM2ReviewResult,
} from './reviewAPI';

// Progress API
export { progressAPI } from './progressAPI';
export type {
  Achievement,
  AchievementsResponse,
  CardsByStatus,
  DailyStats,
  DashboardStatsResponse,
  DeckProgressDetailResponse,
  DeckProgressListParams,
  DeckProgressListResponse,
  DeckProgressSummary,
  DeckStatistics,
  DeckTimeline,
  LearningTrendsParams,
  LearningTrendsResponse,
  NextMilestone,
  OverviewStats,
  ProgressMetrics,
  RecentActivityEntry,
  StreakStats,
  TodayStats,
  TrendsSummary,
} from './progressAPI';

// Feedback API
export { feedbackAPI } from './feedbackAPI';
export type {
  CreateFeedbackRequest,
  FeedbackCategory,
  FeedbackFilters,
  FeedbackItem,
  FeedbackListParams,
  FeedbackListResponse,
  FeedbackSortField,
  FeedbackStatus,
  SortOrder,
  VoteRequest,
  VoteResponse,
  VoteType,
} from '@/types/feedback';

// Notification API
export * as notificationAPI from './notificationAPI';

// Culture Deck API
export { cultureDeckAPI } from './cultureDeckAPI';
export type {
  CultureDeckDetailResponse,
  CultureDeckListResponse,
  CultureDeckProgress,
  CultureDeckResponse,
  LocalizedText,
} from './cultureDeckAPI';

// Admin API
export { adminAPI } from './adminAPI';
export type { ContentStatsResponse, DeckStats } from './adminAPI';
