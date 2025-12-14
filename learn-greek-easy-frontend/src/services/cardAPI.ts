// src/services/cardAPI.ts

/**
 * Card API Service
 *
 * Provides methods for card operations including:
 * - Listing cards by deck with pagination
 * - Searching cards
 * - Getting card details
 */

import { api, buildQueryString } from './api';

// ============================================
// Types
// ============================================

/**
 * Card difficulty levels
 */
export type CardDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Card response from backend
 */
export interface CardResponse {
  id: string;
  deck_id: string;
  front_text: string;
  back_text: string;
  example_sentence: string | null;
  pronunciation: string | null;
  difficulty: CardDifficulty;
  order_index: number;
  created_at: string;
  updated_at: string;
}

/**
 * Paginated card list response
 */
export interface CardListResponse {
  total: number;
  page: number;
  page_size: number;
  deck_id: string;
  cards: CardResponse[];
}

/**
 * Card search response
 */
export interface CardSearchResponse {
  total: number;
  page: number;
  page_size: number;
  query: string;
  deck_id: string | null;
  cards: CardResponse[];
}

/**
 * Parameters for listing cards
 */
export interface ListCardsParams {
  deck_id: string;
  difficulty?: CardDifficulty;
  page?: number;
  page_size?: number;
}

/**
 * Parameters for searching cards
 */
export interface SearchCardsParams {
  q: string;
  deck_id?: string;
  page?: number;
  page_size?: number;
}

// ============================================
// Card API Methods
// ============================================

export const cardAPI = {
  /**
   * List cards for a specific deck with pagination and optional difficulty filtering
   */
  listByDeck: async (params: ListCardsParams): Promise<CardListResponse> => {
    const queryString = buildQueryString({
      deck_id: params.deck_id,
      difficulty: params.difficulty,
      page: params.page || 1,
      page_size: params.page_size || 50,
    });
    return api.get<CardListResponse>(`/api/v1/cards${queryString}`);
  },

  /**
   * Search cards by text content
   */
  search: async (params: SearchCardsParams): Promise<CardSearchResponse> => {
    const queryString = buildQueryString({
      q: params.q,
      deck_id: params.deck_id,
      page: params.page || 1,
      page_size: params.page_size || 20,
    });
    return api.get<CardSearchResponse>(`/api/v1/cards/search${queryString}`);
  },

  /**
   * Get card details by ID
   */
  getById: async (cardId: string): Promise<CardResponse> => {
    return api.get<CardResponse>(`/api/v1/cards/${cardId}`);
  },
};
