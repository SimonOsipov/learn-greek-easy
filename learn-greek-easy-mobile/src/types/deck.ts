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
