/**
 * Copy-first port of the deck read types needed for the MOB-05 proof query.
 * Source: learn-greek-easy-frontend/src/services/deckAPI.ts:21-63 (verbatim).
 * Copied (not shared) pending a future monorepo packages/shared extraction.
 * Only the read types for the decks-list proof are copied — write/search/
 * detail types are intentionally omitted.
 */

export type DeckLevel = 'A1' | 'A2' | 'B1' | 'B2';

export interface DeckResponse {
  id: string;
  name: string;
  description: string | null;
  name_en?: string;
  name_ru?: string;
  name_el?: string;
  description_en?: string | null;
  description_ru?: string | null;
  description_el?: string | null;
  level: DeckLevel;
  is_active: boolean;
  is_premium?: boolean;
  card_count: number; // Always returned by list/search endpoints
  estimated_time_minutes?: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
  /** Presigned S3 URL for deck cover image */
  cover_image_url?: string | null;
}

export interface DeckListResponse {
  total: number;
  page: number;
  page_size: number;
  decks: DeckResponse[];
}

// ---------------------------------------------------------------------------
// Deck detail + word entries + word mastery (MOB-07 Decks tab)
// Copy-first ports of the backend response schemas (snake_case verbatim):
//   GET /api/v1/decks/{id}               → DeckDetailResponse (same shape as DeckResponse)
//   GET /api/v1/decks/{id}/word-entries  → DeckWordEntriesResponse (src/schemas/deck.py:182)
//   GET /api/v1/decks/{id}/word-mastery  → WordMasteryResponse (src/schemas/deck.py:219)
// Only the read fields the mobile deck-detail screen consumes are copied.
// ---------------------------------------------------------------------------

/** Detail endpoint returns the same shape as the list item. */
export type DeckDetailResponse = DeckResponse;

export type WordGender = 'masculine' | 'feminine' | 'neuter';

/**
 * Subset of backend WordEntryResponse (src/schemas/word_entry.py:391).
 * grammar_data is a raw JSONB dict; the deck screen only reads `gender`.
 */
export interface WordEntryResponse {
  id: string;
  deck_id: string | null;
  lemma: string;
  part_of_speech: string;
  translation_en: string;
  translation_ru: string | null;
  /** Syllable pronunciation guide, e.g. "/spí·ti/". */
  pronunciation: string | null;
  grammar_data: { gender?: string; [key: string]: unknown } | null;
  is_active: boolean;
}

export interface DeckWordEntriesResponse {
  deck_id: string;
  total: number;
  page: number;
  page_size: number;
  word_entries: WordEntryResponse[];
}

export interface CardTypeMastery {
  card_type: string;
  mastered_count: number;
  studied_count: number;
  total_count: number;
}

export interface WordMasteryItem {
  word_entry_id: string;
  mastered_count: number;
  studied_count: number;
  total_count: number;
  /** Per-card-type mastery breakdown (used by word-detail Cards panel, MOB-12). */
  type_progress: CardTypeMastery[];
}

export interface WordMasteryResponse {
  deck_id: string;
  items: WordMasteryItem[];
}

/** Derived per-word learning status (derivation mirrors web WordBrowser.tsx:219-235). */
export type WordStatus = 'new' | 'learning' | 'mastered';
