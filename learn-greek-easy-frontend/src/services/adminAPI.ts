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
// Culture Question CRUD Types
// ============================================

/**
 * Payload for creating a culture question
 * Supports 2, 3, or 4 answer options
 * @note option_d requires option_c (no gaps allowed)
 * @note correct_option must be <= number of options provided
 */
export interface CultureQuestionCreatePayload {
  deck_id: string;
  question_text: MultilingualName;
  option_a: MultilingualName;
  option_b: MultilingualName;
  option_c?: MultilingualName | null;
  option_d?: MultilingualName | null;
  correct_option: 1 | 2 | 3 | 4;
  image_key?: string | null;
  order_index?: number;
}

/**
 * Payload for updating a culture question
 * All fields optional - only provided fields are updated
 * Cannot change deck_id
 */
export interface CultureQuestionUpdatePayload {
  question_text?: MultilingualName;
  option_a?: MultilingualName;
  option_b?: MultilingualName;
  option_c?: MultilingualName | null;
  option_d?: MultilingualName | null;
  correct_option?: 1 | 2 | 3 | 4;
  image_key?: string | null;
  order_index?: number;
}

/**
 * Response from culture question create/update endpoints
 */
export interface CultureQuestionAdminResponse {
  id: string;
  deck_id: string;
  question_text: Record<string, string>;
  option_a: Record<string, string>;
  option_b: Record<string, string>;
  option_c: Record<string, string> | null;
  option_d: Record<string, string> | null;
  correct_option: number;
  option_count: number;
  image_key: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Announcement Types
// ============================================

/**
 * Payload for creating an announcement
 */
export interface AnnouncementCreate {
  title: string;
  message: string;
  link_url?: string;
}

/**
 * Response from creating an announcement
 */
export interface AnnouncementCreateResponse {
  id: string;
  title: string;
  message: string;
  total_recipients: number;
}

/**
 * Brief creator information for announcement items
 */
export interface AnnouncementCreator {
  id: string;
  display_name: string | null;
}

/**
 * Announcement item in list response
 */
export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  total_recipients: number;
  read_count: number;
  created_at: string;
  creator: AnnouncementCreator | null;
}

/**
 * Paginated announcement list response
 */
export interface AnnouncementListResponse {
  total: number;
  page: number;
  page_size: number;
  items: AnnouncementItem[];
}

/**
 * Announcement detail response with computed stats
 */
export interface AnnouncementDetailResponse extends AnnouncementItem {
  read_percentage: number;
}

// ============================================
// News Item Types
// ============================================

/**
 * Payload for creating a news item
 */
export interface NewsItemCreate {
  title_el: string;
  title_en: string;
  title_ru: string;
  description_el: string;
  description_en: string;
  description_ru: string;
  publication_date: string;
  original_article_url: string;
  source_image_url: string;
}

/**
 * Single option for a multiple-choice question
 */
export interface QuestionOption {
  text_el: string;
  text_en: string;
  text_ru: string;
}

/**
 * Question data for creating a culture question from news
 */
export interface QuestionCreate {
  deck_id: string;
  question_el: string;
  question_en: string;
  question_ru: string;
  options: QuestionOption[]; // EXACTLY 4 options required by backend
  correct_answer_index: number; // 0-3
}

/**
 * Payload for creating a news item with optional question
 * Matches backend NewsItemWithQuestionCreate schema
 */
export interface NewsItemWithQuestionCreate extends NewsItemCreate {
  question?: QuestionCreate;
}

/**
 * Brief card info returned after news creation
 */
export interface CardBrief {
  id: string;
  deck_id: string;
  question_text: Record<string, string>;
}

/**
 * Response from creating a news item with optional question
 */
export interface NewsItemWithCardResponse {
  news_item: NewsItemResponse;
  card: CardBrief | null;
  message: string;
}

/**
 * Payload for updating a news item (all fields optional)
 */
export interface NewsItemUpdate {
  title_el?: string;
  title_en?: string;
  title_ru?: string;
  description_el?: string;
  description_en?: string;
  description_ru?: string;
  publication_date?: string;
  original_article_url?: string;
  source_image_url?: string;
}

/**
 * Response from news item API endpoints (extended with card info)
 */
export interface NewsItemResponse {
  id: string;
  title_el: string;
  title_en: string;
  title_ru: string;
  description_el: string;
  description_en: string;
  description_ru: string;
  publication_date: string;
  original_article_url: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  // New fields for card association
  card_id: string | null;
  deck_id: string | null;
}

/**
 * Paginated list of news items
 */
export interface NewsItemListResponse {
  total: number;
  page: number;
  page_size: number;
  items: NewsItemResponse[];
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

  /**
   * Create a new culture question
   * Requires superuser authentication.
   */
  createCultureQuestion: async (
    data: CultureQuestionCreatePayload
  ): Promise<CultureQuestionAdminResponse> => {
    return api.post<CultureQuestionAdminResponse>('/api/v1/culture/questions', data);
  },

  /**
   * Update an existing culture question
   * Requires superuser authentication.
   */
  updateCultureQuestion: async (
    questionId: string,
    data: CultureQuestionUpdatePayload
  ): Promise<CultureQuestionAdminResponse> => {
    return api.patch<CultureQuestionAdminResponse>(`/api/v1/culture/questions/${questionId}`, data);
  },

  // ============================================
  // News Item Management
  // ============================================

  /**
   * Get a paginated list of news items
   *
   * Public endpoint, sorted by publication date descending.
   *
   * @param page - Page number (1-indexed, default: 1)
   * @param pageSize - Items per page (1-50, default: 10)
   * @returns Paginated list of news items
   */
  getNewsItems: async (page = 1, pageSize = 10): Promise<NewsItemListResponse> => {
    const queryString = buildQueryString({ page, page_size: pageSize });
    return api.get<NewsItemListResponse>(`/api/v1/news${queryString}`);
  },

  /**
   * Create a new news item with optional question
   *
   * Admin provides source_image_url; backend downloads and uploads to S3.
   * Image download/upload can take 2-5 seconds.
   * If question data is included, a culture question is also created.
   * Requires superuser authentication.
   *
   * @param data - News item creation payload with optional question
   * @returns Created news item with optional card info
   * @throws 400 if image download fails or question validation fails
   * @throws 409 if original_article_url is already used
   */
  createNewsItem: async (data: NewsItemWithQuestionCreate): Promise<NewsItemWithCardResponse> => {
    return api.post<NewsItemWithCardResponse>('/api/v1/admin/news', data);
  },

  /**
   * Update an existing news item
   *
   * If source_image_url is provided, backend downloads new image and
   * replaces the existing one in S3. All fields are optional.
   * Requires superuser authentication.
   *
   * @param id - UUID of the news item to update
   * @param data - Partial news item update payload
   * @returns Updated news item
   * @throws 404 if news item not found
   * @throws 400 if image download fails
   */
  updateNewsItem: async (id: string, data: NewsItemUpdate): Promise<NewsItemResponse> => {
    return api.put<NewsItemResponse>(`/api/v1/admin/news/${id}`, data);
  },

  /**
   * Delete a news item (HARD DELETE)
   *
   * Permanently removes the news item from database and its image from S3.
   * This action cannot be undone.
   * Requires superuser authentication.
   *
   * @param id - UUID of the news item to delete
   * @throws 404 if news item not found
   */
  deleteNewsItem: async (id: string): Promise<void> => {
    return api.delete<void>(`/api/v1/admin/news/${id}`);
  },

  // ============================================
  // Announcement Management
  // ============================================

  /**
   * Create a new announcement and send to all active users
   *
   * Creates an announcement campaign and generates notifications for all
   * active learners. This action cannot be undone.
   * Requires superuser authentication.
   *
   * @param data - Announcement creation payload
   * @returns Created announcement with recipient count
   */
  createAnnouncement: async (data: AnnouncementCreate): Promise<AnnouncementCreateResponse> => {
    return api.post<AnnouncementCreateResponse>('/api/v1/admin/announcements', data);
  },

  /**
   * Get paginated list of announcements
   *
   * Returns announcements sorted by created_at DESC (newest first).
   * Requires superuser authentication.
   *
   * @param page - Page number (1-indexed, default: 1)
   * @param pageSize - Items per page (1-100, default: 10)
   * @returns Paginated list of announcements with creator info
   */
  getAnnouncements: async (page = 1, pageSize = 10): Promise<AnnouncementListResponse> => {
    const queryString = buildQueryString({ page, page_size: pageSize });
    return api.get<AnnouncementListResponse>(`/api/v1/admin/announcements${queryString}`);
  },

  /**
   * Get single announcement details
   *
   * Returns full announcement details including computed read percentage.
   * Requires superuser authentication.
   *
   * @param id - UUID of the announcement
   * @returns Announcement details with stats
   * @throws 404 if announcement not found
   */
  getAnnouncementDetail: async (id: string): Promise<AnnouncementDetailResponse> => {
    return api.get<AnnouncementDetailResponse>(`/api/v1/admin/announcements/${id}`);
  },
};
