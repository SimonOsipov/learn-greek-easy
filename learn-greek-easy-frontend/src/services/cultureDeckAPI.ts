// src/services/cultureDeckAPI.ts

/**
 * Culture Deck API Service
 *
 * Provides methods for culture deck operations including:
 * - Listing culture decks
 * - Getting culture deck details
 */

import { api } from './api';

// ============================================
// Types
// ============================================

/**
 * Localized text structure for culture content
 */
export interface LocalizedText {
  el: string;
  en: string;
  ru: string;
}

/**
 * Progress data for a culture deck
 */
export interface CultureDeckProgress {
  questions_total: number;
  questions_mastered: number;
  questions_learning: number;
  questions_new: number;
}

/**
 * Culture deck response from backend
 */
export interface CultureDeckResponse {
  id: string;
  name: string;
  description: string | null;
  category: string; // "history", "geography", "politics", "culture", "traditions"
  question_count: number;
  is_premium?: boolean;
  progress?: CultureDeckProgress;
}

/**
 * Culture deck list response from backend
 */
export interface CultureDeckListResponse {
  decks: CultureDeckResponse[];
  total: number;
}

/**
 * Culture deck detail response from backend
 */
export interface CultureDeckDetailResponse extends CultureDeckResponse {
  questions?: Array<{
    id: string;
    question: LocalizedText;
    options: Array<{
      id: string;
      text: LocalizedText;
      is_correct: boolean;
    }>;
    explanation?: LocalizedText;
    difficulty: string;
  }>;
}

/**
 * Question queue item for practice session
 */
export interface CultureQuestionQueueItem {
  id: string;
  question_text: LocalizedText;
  options: LocalizedText[]; // Array of 2-4 options
  option_count: number; // Number of answer options (2, 3, or 4)
  image_url: string | null;
  order_index: number;
  is_new: boolean;
  due_date: string | null;
  status: 'new' | 'learning' | 'review' | 'mastered';
  original_article_url: string | null; // Source news article URL
}

/**
 * Question queue response from backend
 */
export interface CultureQuestionQueue {
  deck_id: string;
  deck_name: string;
  category: string;
  total_due: number;
  total_new: number;
  total_in_queue: number;
  questions: CultureQuestionQueueItem[];
}

/**
 * Request body for submitting an answer
 * Note: time_taken is in SECONDS (not milliseconds!) - max 300
 */
export interface CultureAnswerRequest {
  selected_option: number; // 1-4
  time_taken: number; // SECONDS (not milliseconds!) - max 300
  language: string; // 'el' | 'en' | 'ru'
}

/**
 * Response from submitting an answer
 * Matches backend schema: CultureAnswerResponseFast
 */
export interface CultureAnswerResponse {
  is_correct: boolean;
  correct_option: number;
  xp_earned: number;
  message?: string;
  deck_category: string;
}

// ============================================
// Culture Deck API Methods
// ============================================

export const cultureDeckAPI = {
  /**
   * List all culture decks
   */
  getList: async (): Promise<CultureDeckListResponse> => {
    return api.get<CultureDeckListResponse>('/api/v1/culture/decks');
  },

  /**
   * Get culture deck details by ID
   */
  getById: async (deckId: string): Promise<CultureDeckDetailResponse> => {
    return api.get<CultureDeckDetailResponse>(`/api/v1/culture/decks/${deckId}`);
  },

  /**
   * Get question queue for a deck (for practice session)
   */
  getQuestionQueue: async (
    deckId: string,
    options?: {
      limit?: number;
      include_new?: boolean;
      new_questions_limit?: number;
    }
  ): Promise<CultureQuestionQueue> => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.include_new !== undefined)
      params.append('include_new', String(options.include_new));
    if (options?.new_questions_limit)
      params.append('new_questions_limit', String(options.new_questions_limit));

    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<CultureQuestionQueue>(`/api/v1/culture/decks/${deckId}/questions${query}`);
  },

  /**
   * Submit an answer to a question
   * Note: time_taken should be in SECONDS (not milliseconds!)
   */
  submitAnswer: async (
    questionId: string,
    request: CultureAnswerRequest
  ): Promise<CultureAnswerResponse> => {
    return api.post<CultureAnswerResponse>(
      `/api/v1/culture/questions/${questionId}/answer`,
      request
    );
  },
};
