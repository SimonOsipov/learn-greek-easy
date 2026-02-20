// src/services/index.ts

/**
 * API Services Index
 *
 * Re-exports all API services for package/external consumption.
 *
 * INTERNAL CODE PATTERN:
 * Import directly from individual API files for reliability:
 *   import { deckAPI } from '@/services/deckAPI';
 *   import type { DeckResponse } from '@/services/deckAPI';
 *
 * Do NOT import through this barrel file in application code:
 *   import { deckAPI } from '@/services';  // Avoid
 */

// Base API client and utilities
export { api, APIRequestError, buildQueryString, clearAuthTokens } from './api';
export type { APIError } from './api';

// Authentication API
export { authAPI } from './authAPI';
export type { LogoutResponse, TokenResponse, UserProfileResponse } from './authAPI';

// Users API (Danger Zone)
export { usersAPI } from './usersAPI';

// Deck API
export { deckAPI } from './deckAPI';
export type {
  CreateDeckInput,
  DeckDetailResponse,
  DeckLevel,
  DeckListResponse,
  DeckResponse,
  DeckSearchResponse,
  ListDecksParams,
  SearchDecksParams,
  UpdateDeckInput,
} from './deckAPI';

// Card API
export { cardAPI } from './cardAPI';
export type {
  CardCreatePayload,
  CardListResponse,
  CardResponse,
  CardSearchResponse,
  ListCardsParams,
  SearchCardsParams,
} from './cardAPI';

// Word Entry API
export { wordEntryAPI } from './wordEntryAPI';
export type {
  WordEntryBulkResponse,
  WordEntryExampleSentence,
  WordEntryInput,
  WordEntryResponse,
} from './wordEntryAPI';

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

// Card Error API
export { cardErrorAPI } from './cardErrorAPI';
export type {
  CardType,
  CardErrorStatus,
  CreateCardErrorRequest,
  CardErrorResponse,
} from '@/types/cardError';

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
export type { ContentStatsResponse } from './adminAPI';

// Mock Exam API
export { mockExamAPI } from './mockExamAPI';

// Changelog API
export { changelogAPI } from './changelogAPI';

// Billing API
export { billingAPI } from './billingAPI';
export type { BillingCycle, CheckoutSessionResponse, CheckoutVerifyResponse } from './billingAPI';
