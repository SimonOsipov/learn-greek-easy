/**
 * Word-detail types (MOB-12): full word entry response + card records.
 *
 * Copy-first port of the backend response schemas (snake_case verbatim):
 *   GET /api/v1/word-entries/{id}              → WordDetailResponse
 *   GET /api/v1/word-entries/{id}/cards        → CardRecordResponse[]
 *
 * Declension data lives in grammar_data (a raw JSONB dict). For nouns the
 * backend stores nominative_singular, genitive_singular, etc. See
 * learn-greek-easy-backend/src/schemas/word_entry.py docstring for the
 * full per-POS structure.
 *
 * CardMasteryStatus is derived on the client from WordMasteryItem.type_progress
 * (same source as the web's deriveCardTypeMasteryStatus hook).
 */

// ---------------------------------------------------------------------------
// Example sentence
// ---------------------------------------------------------------------------

export interface ExampleSentenceResponse {
  id: string | null;
  greek: string;
  english: string;
  russian: string;
  audio_key: string | null;
  audio_url: string | null;
  audio_status: string | null;
}

// ---------------------------------------------------------------------------
// Full word entry (word detail screen)
// ---------------------------------------------------------------------------

/**
 * Full WordEntryResponse as returned by GET /api/v1/word-entries/{id}.
 * Superset of the deck-detail WordEntryResponse in src/types/deck.ts.
 * grammar_data is a raw dict — for nouns it contains the declension keys
 * listed in the backend schema docstring.
 */
export interface WordDetailResponse {
  id: string;
  deck_id: string | null;
  lemma: string;
  part_of_speech: string;
  translation_en: string;
  translation_en_plural: string | null;
  translation_ru: string | null;
  pronunciation: string | null;
  grammar_data: Record<string, unknown> | null;
  examples: ExampleSentenceResponse[] | null;
  audio_url: string | null;
  audio_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Card records
// ---------------------------------------------------------------------------

/** CardType enum values (mirrors backend src/db/models.py CardType). */
export type CardType =
  | 'meaning_el_to_en'
  | 'meaning_en_to_el'
  | 'conjugation'
  | 'declension'
  | 'cloze'
  | 'sentence_translation'
  | 'plural_form'
  | 'article';

/**
 * CardRecordResponse from GET /api/v1/word-entries/{id}/cards.
 * front_content and back_content are raw dicts from the backend.
 */
export interface CardRecordResponse {
  id: string;
  word_entry_id: string;
  deck_id: string;
  card_type: CardType;
  tier: number | null;
  variant_key: string;
  front_content: Record<string, unknown>;
  back_content: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Per-card mastery status (client-side derivation from WordMasteryItem.type_progress)
// ---------------------------------------------------------------------------

/** Derived mastery state per card, based on the card's card_type. */
export type CardMasteryStatus = 'new' | 'studied' | 'mastered';
