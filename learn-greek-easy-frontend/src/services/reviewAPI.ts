// src/services/reviewAPI.ts

/**
 * Review API Service
 *
 * Provides methods for flashcard review submission.
 */

import { api } from './api';

import type { CardStatus } from './studyAPI';

// ============================================
// Types
// ============================================

/**
 * Single review submission
 */
export interface ReviewRequest {
  card_record_id: string;
  quality: number; // 0-5 SM-2 quality rating
  time_taken: number; // seconds (0-180)
}

/**
 * Review result after SM-2 processing
 */
export interface ReviewResult {
  card_record_id: string;
  quality: number;
  previous_status: CardStatus;
  new_status: CardStatus;
  easiness_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string;
  message: string | null;
}

// ============================================
// Review API Methods
// ============================================

export const reviewAPI = {
  /**
   * Submit a single card review.
   *
   * Quality rating scale:
   * - 0: Complete blackout, no recognition
   * - 1: Incorrect, but upon seeing answer, remembered
   * - 2: Incorrect, but answer seemed easy to recall
   * - 3: Correct with serious difficulty
   * - 4: Correct with some hesitation
   * - 5: Perfect response, no hesitation
   */
  submit: async (review: ReviewRequest): Promise<ReviewResult> => {
    return api.post<ReviewResult>('/api/v1/reviews/v2', review);
  },
};
