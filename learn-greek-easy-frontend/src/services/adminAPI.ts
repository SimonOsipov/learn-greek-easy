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
 * Vocabulary deck statistics in admin response
 */
export interface DeckStats {
  id: string;
  name: string;
  level: DeckLevel;
  card_count: number;
}

/**
 * Culture deck statistics in admin response
 */
export interface CultureDeckStats {
  id: string;
  name: MultilingualName;
  category: string;
  question_count: number;
}

/**
 * Content statistics response from admin endpoint
 */
export interface ContentStatsResponse {
  total_decks: number;
  total_cards: number;
  total_vocabulary_decks: number;
  total_culture_decks: number;
  total_vocabulary_cards: number;
  total_culture_questions: number;
  decks: DeckStats[];
  culture_decks: CultureDeckStats[];
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
};
