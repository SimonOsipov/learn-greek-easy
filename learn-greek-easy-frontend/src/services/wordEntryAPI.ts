// src/services/wordEntryAPI.ts

/**
 * Word Entry API Service
 *
 * Provides methods for word entry operations including:
 * - Bulk upsert (create or update) word entries
 */

import type { PartOfSpeech, DeckLevel } from '@/types/grammar';

import { api } from './api';

// ============================================
// Types
// ============================================

/**
 * Example sentence with multilingual translations.
 * Matches backend ExampleSentence schema.
 */
export interface WordEntryExampleSentence {
  greek: string;
  english?: string;
  russian?: string;
  context?: string | null;
}

/**
 * Input for creating/updating a word entry (without deck_id).
 * Used in bulk operations where deck_id is provided at the request level.
 *
 * Note: audio_key and is_active are excluded - backend does not accept
 * these fields in bulk upload (audio_key not supported, is_active defaults to true).
 */
export interface WordEntryInput {
  lemma: string;
  part_of_speech: PartOfSpeech;
  translation_en: string;
  cefr_level?: DeckLevel | null;
  translation_ru?: string | null;
  pronunciation?: string | null;
  grammar_data?: Record<string, unknown> | null;
  examples?: WordEntryExampleSentence[] | null;
}

/**
 * Word entry response from backend.
 * Matches the WordEntryResponse schema in src/schemas/word_entry.py.
 * Fields use snake_case to match API responses.
 */
export interface WordEntryResponse {
  id: string;
  deck_id: string;
  lemma: string;
  part_of_speech: PartOfSpeech;
  cefr_level: DeckLevel | null;
  translation_en: string;
  translation_ru: string | null;
  pronunciation: string | null;
  grammar_data: Record<string, unknown> | null;
  examples: WordEntryExampleSentence[] | null;
  audio_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Response from bulk upsert operation.
 * Contains counts and the resulting word entries.
 */
export interface WordEntryBulkResponse {
  deck_id: string;
  created_count: number;
  updated_count: number;
  word_entries: WordEntryResponse[];
}

// ============================================
// Word Entry API Methods
// ============================================

export const wordEntryAPI = {
  /**
   * Bulk upsert word entries to a deck.
   *
   * Creates new entries or updates existing ones based on lemma matching.
   * Requires superuser privileges.
   * Maximum 100 entries per request.
   *
   * @param deckId - UUID of the target deck
   * @param wordEntries - Array of word entries to upsert (without deck_id)
   * @returns Object with deck_id, created_count, updated_count, and word_entries array
   */
  bulkUpsert: async (
    deckId: string,
    wordEntries: WordEntryInput[]
  ): Promise<WordEntryBulkResponse> => {
    return api.post<WordEntryBulkResponse>('/api/v1/word-entries/bulk', {
      deck_id: deckId,
      word_entries: wordEntries,
    });
  },
};
