// src/services/reviewAPI.ts

/**
 * Review API Service
 *
 * Provides methods for flashcard review operations including:
 * - Getting review history
 * - Submitting single reviews
 * - Submitting bulk reviews
 */

import { api } from './api';

import type { V2CardStatus } from './studyAPI';

// ============================================
// V2 Types
// ============================================

/**
 * V2 single review submission
 */
export interface V2ReviewRequest {
  card_record_id: string;
  quality: number; // 0-5 SM-2 quality rating
  time_taken: number; // seconds (0-180)
}

/**
 * V2 review result after processing
 */
export interface V2ReviewResult {
  card_record_id: string;
  quality: number;
  previous_status: V2CardStatus;
  new_status: V2CardStatus;
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
   * Submit a single V2 card review
   *
   * Quality rating scale:
   * - 0: Complete blackout, no recognition
   * - 1: Incorrect, but upon seeing answer, remembered
   * - 2: Incorrect, but answer seemed easy to recall
   * - 3: Correct with serious difficulty
   * - 4: Correct with some hesitation
   * - 5: Perfect response, no hesitation
   */
  submitV2: async (review: V2ReviewRequest): Promise<V2ReviewResult> => {
    return api.post<V2ReviewResult>('/api/v1/reviews/v2', review);
  },
};
