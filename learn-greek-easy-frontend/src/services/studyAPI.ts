// src/services/studyAPI.ts

/**
 * Study API Service
 *
 * Provides methods for study session operations including:
 * - Getting study queue (cards due for review)
 * - Getting study statistics
 * - Initializing cards for study
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

import type { CardRecordType } from './wordEntryAPI';

// ============================================
// Types
// ============================================

/**
 * Card status in the SM-2 system
 */
export type CardStatus = 'new' | 'learning' | 'review' | 'mastered';

/**
 * Card in study queue
 *
 * Matches the StudyQueueCard schema in src/schemas/sm2.py.
 * Contains card content plus SM-2 scheduling metadata.
 */
export interface StudyQueueCard {
  card_id: string;
  front_text: string;
  back_text: string;
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
  status: CardStatus;
  is_new: boolean;
  is_early_practice: boolean;
  due_date: string | null;
  easiness_factor: number | null;
  interval: number | null;
  audio_url: string | null;
  word_entry_id: string | null;
}

/**
 * Study queue response
 */
export interface StudyQueue {
  deck_id: string;
  deck_name: string;
  total_due: number;
  total_new: number;
  total_early_practice: number;
  total_in_queue: number;
  cards: StudyQueueCard[];
}

/**
 * Study statistics by status
 */
export interface StudyStatsByStatus {
  new: number;
  learning: number;
  review: number;
  mastered: number;
  due: number;
}

/**
 * Study statistics response
 */
export interface StudyStatsResponse {
  by_status: StudyStatsByStatus;
  reviews_today: number;
  current_streak: number;
  due_today: number;
  total_reviews: number;
  total_study_time: number;
  average_quality: number;
}

/**
 * Card initialization result
 */
export interface CardInitializationResult {
  initialized_count: number;
  already_exists_count: number;
  card_ids: string[];
}

/**
 * Parameters for getting study queue
 */
export interface StudyQueueParams {
  limit?: number;
  include_new?: boolean;
  new_cards_limit?: number;
  include_early_practice?: boolean;
  early_practice_limit?: number;
}

/**
 * Request for initializing specific cards
 */
export interface CardInitializationRequest {
  deck_id: string;
  card_ids: string[];
}

// ============================================
// V2 Types
// ============================================

/**
 * Card status in the SM-2 V2 system
 */
export type V2CardStatus = 'new' | 'learning' | 'review' | 'mastered';

/**
 * Card in V2 study queue
 *
 * Matches the V2StudyQueueCard schema from the backend.
 * Uses card_record_id instead of card_id; includes card_type and variant_key.
 */
export interface V2StudyQueueCard {
  card_record_id: string;
  word_entry_id: string;
  deck_id: string;
  deck_name: string;
  card_type: CardRecordType;
  variant_key: string | null;
  front_content: Record<string, unknown>;
  back_content: Record<string, unknown>;
  status: V2CardStatus;
  is_new: boolean;
  is_early_practice: boolean;
  due_date: string | null;
  easiness_factor: number | null;
  interval: number | null;
  audio_url: string | null;
  example_audio_url: string | null;
  translation_ru: string | null;
  translation_ru_plural: string | null;
  sentence_ru: string | null;
}

/**
 * V2 study queue response
 */
export interface V2StudyQueue {
  total_due: number;
  total_new: number;
  total_early_practice: number;
  total_in_queue: number;
  cards: V2StudyQueueCard[];
}

/**
 * Parameters for getting V2 study queue
 */
export interface V2StudyQueueParams {
  deck_id?: string;
  card_type?: CardRecordType;
  limit?: number;
  include_new?: boolean;
  new_cards_limit?: number;
  include_early_practice?: boolean;
  early_practice_limit?: number;
}

// ============================================
// Study API Methods
// ============================================

export const studyAPI = {
  /**
   * Get study queue across all decks
   */
  getQueue: async (params: StudyQueueParams = {}): Promise<StudyQueue> => {
    const queryString = buildQueryString({
      limit: params.limit || 20,
      include_new: params.include_new !== false,
      new_cards_limit: params.new_cards_limit || 10,
      include_early_practice: params.include_early_practice,
      early_practice_limit: params.early_practice_limit,
    });
    return api.get<StudyQueue>(`/api/v1/study/queue${queryString}`);
  },

  /**
   * Get study queue for a specific deck
   */
  getDeckQueue: async (deckId: string, params: StudyQueueParams = {}): Promise<StudyQueue> => {
    const queryString = buildQueryString({
      limit: params.limit || 20,
      include_new: params.include_new !== false,
      new_cards_limit: params.new_cards_limit || 10,
      include_early_practice: params.include_early_practice,
      early_practice_limit: params.early_practice_limit,
    });
    return api.get<StudyQueue>(`/api/v1/study/queue/${deckId}${queryString}`);
  },

  /**
   * Get study statistics
   */
  getStats: async (deckId?: string): Promise<StudyStatsResponse> => {
    const queryString = deckId ? buildQueryString({ deck_id: deckId }) : '';
    return api.get<StudyStatsResponse>(`/api/v1/study/stats${queryString}`);
  },

  /**
   * Initialize specific cards for study
   */
  initializeCards: async (
    request: CardInitializationRequest
  ): Promise<CardInitializationResult> => {
    return api.post<CardInitializationResult>('/api/v1/study/initialize', request);
  },

  /**
   * Initialize all cards in a deck for study
   */
  initializeDeck: async (deckId: string): Promise<CardInitializationResult> => {
    return api.post<CardInitializationResult>(`/api/v1/study/initialize/${deckId}`);
  },

  /**
   * Get V2 study queue (card-record based)
   */
  getV2Queue: async (params: V2StudyQueueParams = {}): Promise<V2StudyQueue> => {
    const queryString = buildQueryString({
      deck_id: params.deck_id,
      card_type: params.card_type,
      limit: params.limit || 20,
      include_new: params.include_new !== false,
      new_cards_limit: params.new_cards_limit || 10,
      include_early_practice: params.include_early_practice,
      early_practice_limit: params.early_practice_limit,
    });
    return api.get<V2StudyQueue>(`/api/v1/study/queue/v2${queryString}`);
  },
};
