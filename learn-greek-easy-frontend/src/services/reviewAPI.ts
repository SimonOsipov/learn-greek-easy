// src/services/reviewAPI.ts

/**
 * Review API Service
 *
 * Provides methods for flashcard review operations including:
 * - Getting review history
 * - Submitting single reviews
 * - Submitting bulk reviews
 */

import { api, buildQueryString } from './api';

import type { CardStatus } from './studyAPI';

// ============================================
// Types
// ============================================

/**
 * Review history entry
 */
export interface ReviewHistoryEntry {
  id: string;
  user_id: string;
  card_id: string;
  quality: number;
  time_taken: number;
  reviewed_at: string;
}

/**
 * Review history list response
 */
export interface ReviewHistoryListResponse {
  total: number;
  page: number;
  page_size: number;
  reviews: ReviewHistoryEntry[];
}

/**
 * Single review submission
 */
export interface ReviewSubmit {
  card_id: string;
  quality: number; // 0-5 SM-2 quality rating
  time_taken: number; // seconds (0-300)
}

/**
 * SM-2 review result after processing
 */
export interface SM2ReviewResult {
  success: boolean;
  card_id: string;
  quality: number;
  previous_status: CardStatus;
  new_status: CardStatus;
  easiness_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string;
  message: string;
}

/**
 * Bulk review submission request
 */
export interface BulkReviewSubmit {
  deck_id: string;
  session_id: string;
  reviews: ReviewSubmit[];
}

/**
 * Bulk review result
 */
export interface SM2BulkReviewResult {
  session_id: string;
  total_submitted: number;
  successful: number;
  failed: number;
  results: SM2ReviewResult[];
}

/**
 * Parameters for getting review history
 */
export interface ReviewHistoryParams {
  start_date?: string; // ISO date YYYY-MM-DD
  end_date?: string; // ISO date YYYY-MM-DD
  page?: number;
  page_size?: number;
}

// ============================================
// Review API Methods
// ============================================

export const reviewAPI = {
  /**
   * Get review history with optional date filtering
   */
  getHistory: async (params: ReviewHistoryParams = {}): Promise<ReviewHistoryListResponse> => {
    const queryString = buildQueryString({
      start_date: params.start_date,
      end_date: params.end_date,
      page: params.page || 1,
      page_size: params.page_size || 50,
    });
    return api.get<ReviewHistoryListResponse>(`/api/v1/reviews${queryString}`);
  },

  /**
   * Submit a single card review
   *
   * Quality rating scale:
   * - 0: Complete blackout, no recognition
   * - 1: Incorrect, but upon seeing answer, remembered
   * - 2: Incorrect, but answer seemed easy to recall
   * - 3: Correct with serious difficulty
   * - 4: Correct with some hesitation
   * - 5: Perfect response, no hesitation
   */
  submit: async (review: ReviewSubmit): Promise<SM2ReviewResult> => {
    return api.post<SM2ReviewResult>('/api/v1/reviews', review);
  },

  /**
   * Submit multiple card reviews in bulk
   */
  submitBulk: async (request: BulkReviewSubmit): Promise<SM2BulkReviewResult> => {
    return api.post<SM2BulkReviewResult>('/api/v1/reviews/bulk', request);
  },
};
