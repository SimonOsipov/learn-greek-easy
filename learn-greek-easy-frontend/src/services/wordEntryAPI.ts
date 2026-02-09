// src/services/wordEntryAPI.ts

/**
 * Word Entry API Service
 *
 * Provides methods for word entry operations including:
 * - Bulk upsert (create or update) word entries
 */

import type { PartOfSpeech } from '@/types/grammar';

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
  translation_en_plural?: string | null;
  translation_ru?: string | null;
  translation_ru_plural?: string | null;
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
  translation_en: string;
  translation_en_plural: string | null;
  translation_ru: string | null;
  translation_ru_plural: string | null;
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

/**
 * Response from list word entries operation.
 * Contains pagination info and word entries array.
 */
export interface WordEntryListResponse {
  deck_id: string;
  total: number;
  word_entries: WordEntryResponse[];
}

/**
 * Card type for V2 card records.
 * Matches backend CardType enum in src/db/models.py.
 */
export type CardRecordType =
  | 'meaning_el_to_en'
  | 'meaning_en_to_el'
  | 'conjugation'
  | 'declension'
  | 'cloze'
  | 'sentence_translation'
  | 'plural_form'
  | 'article';

/**
 * Card record response from backend.
 * Matches the CardRecordResponse schema in src/schemas/card_record.py.
 * Fields use snake_case to match API responses.
 */
export interface CardRecordResponse {
  id: string;
  word_entry_id: string;
  deck_id: string;
  card_type: CardRecordType;
  tier: number | null;
  front_content: Record<string, unknown>;
  back_content: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

  /**
   * Get all word entries for a deck.
   *
   * Fetches word entries associated with a specific deck.
   * Requires authenticated user with access to the deck.
   *
   * @param deckId - UUID of the deck
   * @returns Object with deck_id, total count, and word_entries array
   */
  getByDeck: async (deckId: string): Promise<WordEntryListResponse> => {
    return api.get<WordEntryListResponse>(`/api/v1/decks/${deckId}/word-entries`);
  },

  /**
   * Get a single word entry by ID.
   *
   * Fetches the full word entry with grammar data and examples.
   * Requires authenticated user with access to the deck.
   *
   * @param wordId - UUID of the word entry
   * @returns WordEntryResponse with full word entry data
   */
  getById: async (wordId: string): Promise<WordEntryResponse> => {
    return api.get<WordEntryResponse>(`/api/v1/word-entries/${wordId}`);
  },

  /**
   * Get all card records for a word entry.
   *
   * Fetches card records (V2 flashcards) generated from a specific word entry.
   * Requires authenticated user with access to the word entry's deck.
   *
   * @param wordEntryId - UUID of the word entry
   * @returns Array of CardRecordResponse objects
   */
  getCardsByWordEntry: async (wordEntryId: string): Promise<CardRecordResponse[]> => {
    return api.get<CardRecordResponse[]>(`/api/v1/word-entries/${wordEntryId}/cards`);
  },
};
