// src/services/studyAPI.ts

/**
 * Study API Service
 *
 * Provides methods for V2 study session operations.
 */

import { api, buildQueryString } from './api';

import type { CardRecordType } from './wordEntryAPI';

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
