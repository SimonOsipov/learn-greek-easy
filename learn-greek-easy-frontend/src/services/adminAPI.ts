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

import { api } from './api';

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
}

/**
 * Payload for updating a culture deck
 */
export interface CultureDeckUpdatePayload {
  name?: string;
  description?: string | null;
  category?: string;
  is_active?: boolean;
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
    const queryParams = new URLSearchParams();

    if (params.page !== undefined) {
      queryParams.append('page', params.page.toString());
    }
    if (params.page_size !== undefined) {
      queryParams.append('page_size', params.page_size.toString());
    }
    if (params.search) {
      queryParams.append('search', params.search);
    }
    if (params.type) {
      queryParams.append('type', params.type);
    }

    const queryString = queryParams.toString();
    const url = queryString ? `/api/v1/admin/decks?${queryString}` : '/api/v1/admin/decks';

    return api.get<DeckListResponse>(url);
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
};
