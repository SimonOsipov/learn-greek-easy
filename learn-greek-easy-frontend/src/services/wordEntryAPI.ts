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

export type AudioStatus = 'ready' | 'missing' | 'generating' | 'failed';

/**
 * Example sentence with multilingual translations.
 * Matches backend ExampleSentence schema.
 */
export interface WordEntryExampleSentence {
  id: string;
  greek: string;
  english?: string;
  russian?: string;
  context?: string | null;
  audio_key?: string | null;
  audio_url?: string | null;
  audio_status?: AudioStatus;
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
  deck_id: string | null;
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
  audio_url: string | null;
  audio_status: AudioStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Response from admin create-and-link operation.
 * Matches AdminWordEntryCreateResponse in src/schemas/word_entry.py.
 */
export interface AdminWordEntryCreateResponse {
  word_entry: WordEntryResponse;
  cards_created: number;
  is_new: boolean;
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

export interface ExampleSentenceUpdatePayload {
  id: string;
  greek: string;
  english?: string | null;
  russian?: string | null;
  context?: string | null;
}

export interface WordEntryInlineUpdatePayload {
  translation_en?: string;
  translation_en_plural?: string | null;
  translation_ru?: string | null;
  translation_ru_plural?: string | null;
  pronunciation?: string | null;
  grammar_data?: Record<string, string | null>;
  examples?: ExampleSentenceUpdatePayload[];
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
  variant_key: string;
  front_content: Record<string, unknown>;
  back_content: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type GenerateCardType =
  | 'meaning'
  | 'plural_form'
  | 'article'
  | 'sentence_translation'
  | 'declension';

export interface GenerateCardsResponse {
  card_type: string;
  created: number;
  updated: number;
}

// ============================================
// Word Entry API Methods
// ============================================

export const wordEntryAPI = {
  /**
   * Create (or upsert) a single word entry and link it to a deck.
   *
   * Creates or updates the word entry, links it to the deck, and generates
   * all card types automatically. Requires superuser privileges.
   *
   * @param deckId - UUID of the target deck
   * @param wordEntry - Word entry data to create or update
   * @returns Object with word_entry, cards_created, and is_new flag
   */
  createAndLink: async (
    deckId: string,
    wordEntry: WordEntryInput
  ): Promise<AdminWordEntryCreateResponse> => {
    return api.post<AdminWordEntryCreateResponse>('/api/v1/admin/word-entries', {
      deck_id: deckId,
      word_entry: wordEntry,
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

  /**
   * Inline update of a word entry (admin only).
   *
   * Partial update for admin inline editing of a word entry.
   * Requires superuser privileges.
   *
   * @param wordEntryId - UUID of the word entry
   * @param payload - Fields to update
   * @returns Updated WordEntryResponse
   */
  updateInline: async (
    wordEntryId: string,
    payload: WordEntryInlineUpdatePayload
  ): Promise<WordEntryResponse> => {
    return api.patch<WordEntryResponse>(`/api/v1/admin/word-entries/${wordEntryId}`, payload);
  },

  /**
   * Returns the URL for the generate-audio SSE stream endpoint (admin only).
   *
   * The client connects to this URL via POST SSE to stream audio generation
   * progress for all parts (lemma + examples) in a single request.
   *
   * @param wordEntryId - UUID of the word entry
   * @returns URL string for the SSE stream endpoint
   */
  generateAudioStreamUrl: (wordEntryId: string): string => {
    return `/api/v1/admin/word-entries/${wordEntryId}/generate-audio/stream`;
  },

  generateCards: async (
    wordEntryId: string,
    cardType: GenerateCardType
  ): Promise<GenerateCardsResponse> => {
    return api.post<GenerateCardsResponse>(
      `/api/v1/admin/word-entries/${wordEntryId}/generate-cards`,
      { card_type: cardType }
    );
  },
};
