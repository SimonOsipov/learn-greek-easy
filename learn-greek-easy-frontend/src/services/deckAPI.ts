// src/services/deckAPI.ts

/**
 * Deck API Service
 *
 * Provides methods for deck operations including:
 * - Listing decks with pagination and filtering
 * - Searching decks
 * - Getting deck details
 */

import { api, buildQueryString } from './api';

// ============================================
// Types
// ============================================

/**
 * CEFR language proficiency levels
 */
export type DeckLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/**
 * Deck response from backend
 */
export interface DeckResponse {
  id: string;
  name: string;
  description: string | null;
  level: DeckLevel;
  is_active: boolean;
  card_count: number;
  estimated_time_minutes?: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Deck detail response with card count
 */
export interface DeckDetailResponse extends DeckResponse {
  card_count: number;
}

/**
 * Paginated deck list response
 */
export interface DeckListResponse {
  total: number;
  page: number;
  page_size: number;
  decks: DeckResponse[];
}

/**
 * Deck search response
 */
export interface DeckSearchResponse {
  total: number;
  page: number;
  page_size: number;
  query: string;
  decks: DeckResponse[];
}

/**
 * Parameters for listing decks
 */
export interface ListDecksParams {
  page?: number;
  page_size?: number;
  level?: DeckLevel;
}

/**
 * Parameters for searching decks
 */
export interface SearchDecksParams {
  q: string;
  page?: number;
  page_size?: number;
}

// ============================================
// Deck API Methods
// ============================================

export const deckAPI = {
  /**
   * List all active decks with pagination and optional level filtering
   */
  getList: async (params: ListDecksParams = {}): Promise<DeckListResponse> => {
    const queryString = buildQueryString({
      page: params.page || 1,
      page_size: params.page_size || 20,
      level: params.level,
    });
    return api.get<DeckListResponse>(`/api/v1/decks${queryString}`);
  },

  /**
   * Search decks by name or description
   */
  search: async (params: SearchDecksParams): Promise<DeckSearchResponse> => {
    const queryString = buildQueryString({
      q: params.q,
      page: params.page || 1,
      page_size: params.page_size || 20,
    });
    return api.get<DeckSearchResponse>(`/api/v1/decks/search${queryString}`);
  },

  /**
   * Get deck details by ID including card count
   */
  getById: async (deckId: string): Promise<DeckDetailResponse> => {
    return api.get<DeckDetailResponse>(`/api/v1/decks/${deckId}`);
  },
};
