// src/services/adminAPI.ts

/**
 * Admin API Service
 *
 * Provides methods for admin operations including:
 * - Fetching content statistics (deck and card counts)
 * - Listing all decks with search and pagination
 *
 * All endpoints require superuser authentication.
 */

import type {
  AdminFeedbackItem,
  AdminFeedbackListParams,
  AdminFeedbackListResponse,
  AdminFeedbackUpdateRequest,
} from '@/types/feedback';

import { api, buildQueryString } from './api';

// ============================================
// Types
// ============================================

/**
 * CEFR language proficiency levels
 */
export type DeckLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/**
 * Multilingual name object for culture decks
 */
export interface MultilingualName {
  el: string;
  en: string;
  ru: string;
}

/**
 * Content statistics response from admin endpoint
 */
export interface ContentStatsResponse {
  total_decks: number;
  total_cards: number;
  total_vocabulary_decks: number;
  total_vocabulary_cards: number;
}

/**
 * Unified deck item for combined listing
 */
export interface UnifiedDeckItem {
  id: string;
  name: string | MultilingualName;
  type: 'vocabulary' | 'culture';
  level: DeckLevel | null;
  category: string | null;
  item_count: number;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
}

/**
 * Paginated deck list response
 */
export interface DeckListResponse {
  decks: UnifiedDeckItem[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * Parameters for listing decks
 */
export interface ListDecksParams {
  page?: number;
  page_size?: number;
  search?: string;
  type?: 'vocabulary' | 'culture';
}

/**
 * Payload for updating a vocabulary deck
 */
export interface VocabularyDeckUpdatePayload {
  name?: string;
  description?: string | null;
  level?: DeckLevel;
  is_active?: boolean;
  is_premium?: boolean;
}

/**
 * Payload for updating a culture deck
 */
export interface CultureDeckUpdatePayload {
  name?: string;
  description?: string | null;
  category?: string;
  is_active?: boolean;
  is_premium?: boolean;
}

// ============================================
// News Source Types
// ============================================

/**
 * News source response from API
 */
export interface NewsSourceResponse {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Paginated news source list response
 */
export interface NewsSourceListResponse {
  sources: NewsSourceResponse[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * Parameters for listing news sources
 */
export interface ListNewsSourcesParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
}

/**
 * Payload for creating a news source
 */
export interface NewsSourceCreatePayload {
  name: string;
  url: string;
  is_active?: boolean;
}

/**
 * Payload for updating a news source
 */
export interface NewsSourceUpdatePayload {
  name?: string;
  url?: string;
  is_active?: boolean;
}

// ============================================
// Fetch History Types
// ============================================

/**
 * A single fetch history item
 */
export interface FetchHistoryItem {
  id: string;
  fetched_at: string;
  status: 'success' | 'error';
  html_size_bytes: number | null;
  error_message: string | null;
  trigger_type: 'manual' | 'scheduled';
  final_url: string | null;
  // Analysis fields
  analysis_status: 'pending' | 'completed' | 'failed' | null;
  analysis_error: string | null;
  analysis_tokens_used: number | null;
  analyzed_at: string | null;
}

/**
 * Paginated fetch history response
 */
export interface FetchHistoryResponse {
  items: FetchHistoryItem[];
  total: number;
}

/**
 * Response containing HTML content for a fetch history item
 */
export interface FetchHtmlResponse {
  id: string;
  html_content: string;
  fetched_at: string;
  final_url: string | null;
}

// ============================================
// Article Analysis Types
// ============================================

/**
 * A discovered article from AI analysis
 */
export interface DiscoveredArticle {
  url: string;
  title: string;
  reasoning: string;
}

/**
 * Detailed fetch history response including discovered articles
 */
export interface FetchHistoryDetailResponse {
  id: string;
  source_id: string;
  fetched_at: string;
  status: 'success' | 'error';
  html_size_bytes: number | null;
  error_message: string | null;
  trigger_type: 'manual' | 'scheduled';
  final_url: string | null;
  analysis_status: 'pending' | 'completed' | 'failed' | null;
  analysis_error: string | null;
  analysis_tokens_used: number | null;
  analyzed_at: string | null;
  discovered_articles: DiscoveredArticle[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * Response when triggering analysis
 */
export interface AnalysisStartedResponse {
  message: string;
  history_id: string;
}

// ============================================
// Question Generation Types
// ============================================

/**
 * Request payload for generating a culture question from an article
 */
export interface GenerateQuestionRequest {
  article_url: string;
  article_title: string;
  fetch_history_id: string;
}

/**
 * Response from successful question generation
 */
export interface GenerateQuestionResponse {
  question_id: string;
  message: string;
}

/**
 * Response from article usage check
 */
export interface CheckArticleResponse {
  used: boolean;
  question_id: string | null;
}

/**
 * A single pending review question
 */
export interface PendingQuestion {
  id: string;
  question_text: Record<string, string>;
  option_a: Record<string, string>;
  option_b: Record<string, string>;
  option_c: Record<string, string> | null;
  option_d: Record<string, string> | null;
  correct_option: number;
  source_article_url: string | null;
  created_at: string;
}

/**
 * Paginated response for pending questions list
 */
export interface PendingQuestionsResponse {
  questions: PendingQuestion[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * Response from question approval
 */
export interface QuestionApproveResponse {
  id: string;
  deck_id: string;
  is_pending_review: boolean;
  message: string;
}

/**
 * Culture deck item for approval dropdown
 */
export interface CultureDeckListItem {
  id: string;
  name: string;
  category: string;
  question_count: number;
  is_active: boolean;
}

// ============================================
// Admin API Methods
// ============================================

export const adminAPI = {
  /**
   * Get content statistics for admin dashboard
   *
   * Returns counts of active decks and cards, plus per-deck breakdown.
   * Requires superuser authentication.
   */
  getContentStats: async (): Promise<ContentStatsResponse> => {
    return api.get<ContentStatsResponse>('/api/v1/admin/stats');
  },

  /**
   * List all decks with search and pagination
   *
   * Returns a paginated list of vocabulary and culture decks.
   * Supports filtering by type and case-insensitive search.
   * Requires superuser authentication.
   */
  listDecks: async (params: ListDecksParams = {}): Promise<DeckListResponse> => {
    const queryString = buildQueryString({
      page: params.page,
      page_size: params.page_size,
      search: params.search,
      type: params.type,
    });
    return api.get<DeckListResponse>(`/api/v1/admin/decks${queryString}`);
  },

  /**
   * Update a vocabulary deck's metadata
   *
   * Updates deck name, description, level, or active status.
   * Requires superuser authentication.
   */
  updateVocabularyDeck: async (deckId: string, data: VocabularyDeckUpdatePayload) => {
    return api.patch(`/api/v1/decks/${deckId}`, data);
  },

  /**
   * Update a culture deck's metadata
   *
   * Updates deck name, description, category, or active status.
   * Requires superuser authentication.
   */
  updateCultureDeck: async (deckId: string, data: CultureDeckUpdatePayload) => {
    return api.patch(`/api/v1/culture/decks/${deckId}`, data);
  },

  // ============================================
  // Feedback Management
  // ============================================

  /**
   * List all feedback for admin with pagination and filters
   *
   * Returns feedback sorted with NEW status items first, then by created_at DESC.
   * Requires superuser authentication.
   */
  listFeedback: async (
    params: AdminFeedbackListParams = {}
  ): Promise<AdminFeedbackListResponse> => {
    const queryString = buildQueryString({
      status: params.status,
      category: params.category,
      page: params.page || 1,
      page_size: params.page_size || 10,
    });
    return api.get<AdminFeedbackListResponse>(`/api/v1/admin/feedback${queryString}`);
  },

  /**
   * Update feedback status and/or admin response
   *
   * If admin_response is provided without status, and current status is NEW,
   * status auto-changes to UNDER_REVIEW.
   * Requires superuser authentication.
   */
  updateFeedback: async (
    feedbackId: string,
    data: AdminFeedbackUpdateRequest
  ): Promise<AdminFeedbackItem> => {
    return api.patch<AdminFeedbackItem>(`/api/v1/admin/feedback/${feedbackId}`, data);
  },

  // ============================================
  // News Source Management
  // ============================================

  /**
   * List all news sources with pagination and optional filtering
   *
   * Returns a paginated list of news sources for culture content scraping.
   * Requires superuser authentication.
   */
  listNewsSources: async (params: ListNewsSourcesParams = {}): Promise<NewsSourceListResponse> => {
    const queryString = buildQueryString({
      page: params.page,
      page_size: params.page_size,
      is_active: params.is_active,
    });
    return api.get<NewsSourceListResponse>(`/api/v1/admin/culture/sources${queryString}`);
  },

  /**
   * Get a single news source by ID
   *
   * Requires superuser authentication.
   */
  getNewsSource: async (sourceId: string): Promise<NewsSourceResponse> => {
    return api.get<NewsSourceResponse>(`/api/v1/admin/culture/sources/${sourceId}`);
  },

  /**
   * Create a new news source
   *
   * Requires superuser authentication.
   * Returns 409 Conflict if URL already exists.
   */
  createNewsSource: async (data: NewsSourceCreatePayload): Promise<NewsSourceResponse> => {
    return api.post<NewsSourceResponse>('/api/v1/admin/culture/sources', data);
  },

  /**
   * Update an existing news source
   *
   * Requires superuser authentication.
   * Returns 404 if source not found, 409 if URL already exists.
   */
  updateNewsSource: async (
    sourceId: string,
    data: NewsSourceUpdatePayload
  ): Promise<NewsSourceResponse> => {
    return api.patch<NewsSourceResponse>(`/api/v1/admin/culture/sources/${sourceId}`, data);
  },

  /**
   * Delete a news source
   *
   * Requires superuser authentication.
   * Returns 204 No Content on success, 404 if not found.
   */
  deleteNewsSource: async (sourceId: string): Promise<void> => {
    return api.delete<void>(`/api/v1/admin/culture/sources/${sourceId}`);
  },

  // ============================================
  // Fetch History Management
  // ============================================

  /**
   * Trigger a manual fetch for a news source
   *
   * Works on both active and inactive sources.
   * Requires superuser authentication.
   */
  triggerFetch: async (sourceId: string): Promise<FetchHistoryItem> => {
    return api.post<FetchHistoryItem>(`/api/v1/admin/culture/sources/${sourceId}/fetch`);
  },

  /**
   * Get fetch history for a news source
   *
   * Returns the most recent fetch history items for the source.
   * Requires superuser authentication.
   */
  getFetchHistory: async (sourceId: string, limit = 10): Promise<FetchHistoryResponse> => {
    const queryString = buildQueryString({ limit });
    return api.get<FetchHistoryResponse>(
      `/api/v1/admin/culture/sources/${sourceId}/history${queryString}`
    );
  },

  /**
   * Get raw HTML content for a fetch history item
   *
   * Requires superuser authentication.
   * Returns 404 if history item not found.
   */
  getFetchHtml: async (historyId: string): Promise<FetchHtmlResponse> => {
    return api.get<FetchHtmlResponse>(`/api/v1/admin/culture/sources/history/${historyId}/html`);
  },

  /**
   * Delete a fetch history record
   *
   * Deletes the fetch history entry and its HTML content.
   * Requires superuser authentication.
   * Returns 204 No Content on success, 404 if not found.
   */
  deleteFetchHistory: async (historyId: string): Promise<void> => {
    return api.delete<void>(`/api/v1/admin/culture/sources/history/${historyId}`);
  },

  // ============================================
  // Article Analysis
  // ============================================

  /**
   * Trigger AI analysis for a fetch history record
   *
   * Starts background analysis of the HTML content to discover articles.
   * Requires superuser authentication.
   */
  triggerAnalysis: async (historyId: string): Promise<AnalysisStartedResponse> => {
    return api.post<AnalysisStartedResponse>(
      `/api/v1/admin/culture/sources/history/${historyId}/analyze`
    );
  },

  /**
   * Get analysis results (discovered articles) for a fetch history record
   *
   * Returns the full history record including discovered articles.
   * Requires superuser authentication.
   */
  getAnalysisResults: async (historyId: string): Promise<FetchHistoryDetailResponse> => {
    return api.get<FetchHistoryDetailResponse>(
      `/api/v1/admin/culture/sources/history/${historyId}/articles`
    );
  },

  // ============================================
  // Question Generation
  // ============================================

  /**
   * Generate a culture question from an article using AI
   *
   * Fetches the article HTML, sends to Claude for question generation,
   * and creates a new pending review question.
   * Requires superuser authentication.
   *
   * @returns Generated question ID and success message
   * @throws 400 if article fetch fails
   * @throws 409 if article already used for question generation
   * @throws 500 if AI generation fails
   */
  generateQuestion: async (data: GenerateQuestionRequest): Promise<GenerateQuestionResponse> => {
    return api.post<GenerateQuestionResponse>('/api/v1/admin/culture/questions/generate', data);
  },

  /**
   * Check if an article URL has already been used for question generation
   *
   * Requires superuser authentication.
   *
   * @param url - The article URL to check
   * @returns Whether the article is used and the existing question ID if so
   */
  checkArticleUsage: async (url: string): Promise<CheckArticleResponse> => {
    const queryString = buildQueryString({ url });
    return api.get<CheckArticleResponse>(
      `/api/v1/admin/culture/questions/check-article${queryString}`
    );
  },

  /**
   * Get a paginated list of AI-generated questions awaiting admin review
   *
   * Requires superuser authentication.
   *
   * @param page - Page number (1-indexed, default: 1)
   * @param pageSize - Items per page (1-100, default: 20)
   * @returns Paginated list of pending questions
   */
  getPendingQuestions: async (page = 1, pageSize = 20): Promise<PendingQuestionsResponse> => {
    const queryString = buildQueryString({ page, page_size: pageSize });
    return api.get<PendingQuestionsResponse>(
      `/api/v1/admin/culture/questions/pending${queryString}`
    );
  },

  // ============================================
  // Question Review Methods
  // ============================================

  /**
   * Get a single pending question by ID
   *
   * Requires superuser authentication.
   *
   * @param questionId - UUID of the question
   * @returns Full pending question details
   * @throws 404 if question not found or already approved
   */
  getQuestion: async (questionId: string): Promise<PendingQuestion> => {
    return api.get<PendingQuestion>(`/api/v1/admin/culture/questions/${questionId}`);
  },

  /**
   * Approve a pending question and assign to a deck
   *
   * Sets the question's deck_id and clears is_pending_review flag.
   * Requires superuser authentication.
   *
   * @param questionId - UUID of the question to approve
   * @param deckId - UUID of the target culture deck
   * @returns Success message with updated question info
   * @throws 400 if deck_id is invalid or deck is inactive
   * @throws 404 if question not found or already approved
   */
  approveQuestion: async (questionId: string, deckId: string): Promise<QuestionApproveResponse> => {
    return api.post<QuestionApproveResponse>(
      `/api/v1/admin/culture/questions/${questionId}/approve`,
      { deck_id: deckId }
    );
  },

  /**
   * Reject (permanently delete) a pending question
   *
   * This is a hard delete. The source article becomes available
   * for new question generation.
   * Requires superuser authentication.
   *
   * @param questionId - UUID of the question to delete
   * @throws 404 if question not found
   */
  rejectQuestion: async (questionId: string): Promise<void> => {
    return api.delete<void>(`/api/v1/culture/questions/${questionId}`);
  },

  /**
   * Get all active culture decks for approval dropdown
   *
   * Uses the public culture decks endpoint.
   *
   * @returns Array of active culture decks
   */
  getCultureDecks: async (): Promise<CultureDeckListItem[]> => {
    const response = await api.get<{ decks: CultureDeckListItem[]; total: number }>(
      '/api/v1/culture/decks?page_size=100'
    );
    return response.decks;
  },
};
