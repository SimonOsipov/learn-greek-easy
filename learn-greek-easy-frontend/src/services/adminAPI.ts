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
  total_culture_decks: number;
  total_culture_questions: number;
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
  owner_id: string | null;
  owner_name: string | null;
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

/**
 * Payload for creating a vocabulary deck
 */
export interface VocabularyDeckCreatePayload {
  name: string;
  description?: string | null;
  level: DeckLevel;
  is_premium?: boolean;
  is_system_deck: true;
}

/**
 * Payload for creating a culture deck
 */
export interface CultureDeckCreatePayload {
  name: string;
  description?: string | null;
  category: string;
  is_premium?: boolean;
}

/**
 * Response from creating a vocabulary deck
 */
export interface VocabularyDeckCreateResponse {
  id: string;
  name: string;
  description: string | null;
  level: DeckLevel;
  is_active: boolean;
  is_premium: boolean;
  is_system_deck: boolean;
  created_at: string;
}

/**
 * Response from creating a culture deck
 */
export interface CultureDeckCreateResponse {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
}

// ============================================
// Question Review Types
// ============================================

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
// Admin Deck Detail Types
// ============================================

/**
 * Vocabulary card item for admin deck detail view
 */
export interface AdminVocabularyCard {
  id: string;
  deck_id: string;
  front_text: string;
  back_text: string;
  example_sentence: string | null;
  pronunciation: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  order_index: number;
  created_at: string;
  updated_at: string;
}

/**
 * Paginated vocabulary card list response
 */
export interface AdminVocabularyCardsResponse {
  total: number;
  page: number;
  page_size: number;
  deck_id: string;
  cards: AdminVocabularyCard[];
}

/**
 * Culture question item for admin deck detail view
 */
export interface AdminCultureQuestion {
  id: string;
  question_text: Record<string, string>;
  option_a: Record<string, string>;
  option_b: Record<string, string>;
  option_c: Record<string, string> | null;
  option_d: Record<string, string> | null;
  correct_option: number;
  source_article_url: string | null;
  is_pending_review: boolean;
  created_at: string;
}

/**
 * Paginated culture questions response
 */
export interface AdminCultureQuestionsResponse {
  questions: AdminCultureQuestion[];
  total: number;
  page: number;
  page_size: number;
  deck_id: string;
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

  /**
   * Create a new vocabulary deck
   *
   * Creates a system vocabulary deck with the specified metadata.
   * Requires superuser authentication.
   */
  createVocabularyDeck: async (
    data: VocabularyDeckCreatePayload
  ): Promise<VocabularyDeckCreateResponse> => {
    return api.post<VocabularyDeckCreateResponse>('/api/v1/decks', data);
  },

  /**
   * Create a new culture deck
   *
   * Creates a culture deck with the specified metadata.
   * Requires superuser authentication.
   */
  createCultureDeck: async (data: CultureDeckCreatePayload): Promise<CultureDeckCreateResponse> => {
    return api.post<CultureDeckCreateResponse>('/api/v1/culture/decks', data);
  },

  /**
   * Delete (soft-delete) a vocabulary deck
   *
   * Sets is_active = false, hiding the deck from learners.
   * User progress is preserved. Can be reactivated via edit.
   * Requires superuser authentication.
   * Returns 204 No Content on success.
   */
  deleteVocabularyDeck: async (deckId: string): Promise<void> => {
    return api.delete<void>(`/api/v1/decks/${deckId}`);
  },

  /**
   * Delete (soft-delete) a culture deck
   *
   * Sets is_active = false, hiding the deck from learners.
   * User progress is preserved. Can be reactivated via edit.
   * Requires superuser authentication.
   * Returns 204 No Content on success.
   */
  deleteCultureDeck: async (deckId: string): Promise<void> => {
    return api.delete<void>(`/api/v1/culture/decks/${deckId}`);
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
  // Question Review Methods
  // ============================================

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

  // ============================================
  // Admin Deck Detail Methods
  // ============================================

  /**
   * List vocabulary cards in a deck
   *
   * Uses the existing cards endpoint with deck_id filter.
   * Requires superuser authentication.
   *
   * @param deckId - UUID of the vocabulary deck
   * @param page - Page number (1-indexed)
   * @param pageSize - Items per page
   * @returns Paginated list of cards
   */
  listVocabularyCards: async (
    deckId: string,
    page = 1,
    pageSize = 20
  ): Promise<AdminVocabularyCardsResponse> => {
    const queryString = buildQueryString({
      deck_id: deckId,
      page,
      page_size: pageSize,
    });
    return api.get<AdminVocabularyCardsResponse>(`/api/v1/cards${queryString}`);
  },

  /**
   * List culture questions in a deck
   *
   * Admin-only endpoint that returns all questions in a deck.
   * Requires superuser authentication.
   *
   * @param deckId - UUID of the culture deck
   * @param page - Page number (1-indexed)
   * @param pageSize - Items per page
   * @returns Paginated list of questions
   */
  listCultureQuestions: async (
    deckId: string,
    page = 1,
    pageSize = 20
  ): Promise<AdminCultureQuestionsResponse> => {
    const queryString = buildQueryString({ page, page_size: pageSize });
    return api.get<AdminCultureQuestionsResponse>(
      `/api/v1/admin/culture/decks/${deckId}/questions${queryString}`
    );
  },

  /**
   * Delete a vocabulary card (HARD DELETE)
   *
   * Permanently removes the card and all associated user data.
   * Requires superuser authentication.
   *
   * @param cardId - UUID of the card to delete
   */
  deleteVocabularyCard: async (cardId: string): Promise<void> => {
    return api.delete<void>(`/api/v1/cards/${cardId}`);
  },

  /**
   * Delete a culture question (HARD DELETE)
   *
   * Permanently removes the question and all associated user data.
   * Requires superuser authentication.
   *
   * @param questionId - UUID of the question to delete
   */
  deleteCultureQuestion: async (questionId: string): Promise<void> => {
    return api.delete<void>(`/api/v1/culture/questions/${questionId}`);
  },
};
