// src/services/cardAPI.ts

/**
 * Card API Service
 *
 * Provides methods for card operations including:
 * - Listing cards by deck with pagination
 * - Searching cards
 * - Getting card details
 */

import type {
  PartOfSpeech,
  DeckLevel,
  Example,
  NounData,
  VerbData,
  AdjectiveData,
  AdverbData,
} from '@/types/grammar';

import { api, buildQueryString } from './api';

// ============================================
// Types
// ============================================

/**
 * Card response from backend
 *
 * Matches the CardResponse schema in src/schemas/card.py.
 * Fields use snake_case to match API responses.
 */
export interface CardResponse {
  id: string;
  deck_id: string;
  front_text: string;
  back_text_en: string;
  back_text_ru: string | null;
  example_sentence: string | null;
  pronunciation: string | null;
  part_of_speech: PartOfSpeech | null;
  level: DeckLevel | null;
  examples: Example[] | null;
  noun_data: NounData | null;
  verb_data: VerbData | null;
  adjective_data: AdjectiveData | null;
  adverb_data: AdverbData | null;
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

/**
 * Payload for creating a vocabulary card
 *
 * Matches the CardCreate schema in the backend.
 */
export interface CardCreatePayload {
  deck_id: string;
  front_text: string;
  back_text_en: string;
  back_text_ru?: string | null;
  example_sentence?: string | null;
  pronunciation?: string | null;
  part_of_speech?: PartOfSpeech | null;
  level?: DeckLevel | null;
  examples?: Example[] | null;
  noun_data?: NounData | null;
  verb_data?: VerbData | null;
  adjective_data?: AdjectiveData | null;
  adverb_data?: AdverbData | null;
}

// ============================================
// Card API Methods
// ============================================

export const cardAPI = {
  /**
   * List cards for a specific deck with pagination
   */
  listByDeck: async (params: ListCardsParams): Promise<CardListResponse> => {
    const queryString = buildQueryString({
      deck_id: params.deck_id,
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

  /**
   * Create a new vocabulary card
   *
   * Requires superuser privileges.
   */
  create: async (data: CardCreatePayload): Promise<CardResponse> => {
    return api.post<CardResponse>('/api/v1/cards', data);
  },

  /**
   * Update an existing vocabulary card
   *
   * Requires superuser privileges.
   */
  update: async (cardId: string, data: Partial<CardCreatePayload>): Promise<CardResponse> => {
    return api.patch<CardResponse>(`/api/v1/cards/${cardId}`, data);
  },
};
