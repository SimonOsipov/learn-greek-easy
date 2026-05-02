// src/services/studyAPI.ts

/**
 * Study API Service
 *
 * Provides methods for SM-2 study session operations.
 */

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
 * Card in the study queue.
 *
 * Uses card_record_id (the SM-2 record); includes card_type and variant_key.
 */
export interface StudyQueueCard {
  card_record_id: string;
  word_entry_id: string;
  deck_id: string;
  deck_name: string;
  card_type: CardRecordType;
  variant_key: string | null;
  front_content: Record<string, unknown>;
  back_content: Record<string, unknown>;
  status: CardStatus;
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
 * Study queue response
 */
export interface StudyQueue {
  total_due: number;
  total_new: number;
  total_early_practice: number;
  total_in_queue: number;
  cards: StudyQueueCard[];
}

/**
 * Parameters for getting the study queue
 */
export interface StudyQueueParams {
  deck_id?: string;
  card_type?: CardRecordType;
  limit?: number;
  include_new?: boolean;
  new_cards_limit?: number;
  include_early_practice?: boolean;
  early_practice_limit?: number;
  word_entry_id?: string;
}

// ============================================
// Study API Methods
// ============================================

export const studyAPI = {
  /**
   * Get the study queue (card-record based)
   */
  getQueue: async (params: StudyQueueParams = {}): Promise<StudyQueue> => {
    const queryString = buildQueryString({
      deck_id: params.deck_id,
      card_type: params.card_type,
      limit: params.limit || 20,
      include_new: params.include_new !== false,
      new_cards_limit: params.new_cards_limit || 10,
      include_early_practice: params.include_early_practice,
      early_practice_limit: params.early_practice_limit,
      word_entry_id: params.word_entry_id,
    });
    return api.get<StudyQueue>(`/api/v1/study/queue/v2${queryString}`);
  },
};
