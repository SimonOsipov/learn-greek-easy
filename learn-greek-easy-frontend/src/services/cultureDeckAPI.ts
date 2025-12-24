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
  name: LocalizedText;
  description: LocalizedText;
  icon: string;
  color_accent: string;
  category: string; // "history", "geography", "politics", "culture", "traditions"
  question_count: number;
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
};
