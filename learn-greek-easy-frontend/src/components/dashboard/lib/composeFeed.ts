// src/components/dashboard/lib/composeFeed.ts
// Pure feed selector — compose, filter, and count FeedItems from dashboard data sources.
// Test-first (DASH2-01-06): this module defines the contract; the executor implements the bodies.

import type { NewsItemResponse } from '@/services/adminAPI';
import type { Deck } from '@/types/deck';
import type { LearnerSituationListItem } from '@/types/situation';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FeedType =
  | 'resume'
  | 'review'
  | 'situation'
  | 'wordOfDay'
  | 'deck'
  | 'milestone'
  | 'news'
  | 'quick';

export type FeedSpan = 'hero' | 'wide' | 'side' | 'compact' | 'half';
export type FeedTone = 'primary' | 'violet' | 'cyan' | 'amber' | 'green' | 'blue';

/**
 * Discriminated union of typed feed items.
 * Each variant carries exactly the raw source data its card component needs;
 * cards localize via useTranslation + getLocalizedDeckName (no i18n in this module).
 */
export type FeedItem =
  | { id: string; type: 'resume'; span: 'hero'; tone: 'primary'; deck: Deck }
  | { id: string; type: 'review'; span: 'side'; tone: 'blue'; cardsDue: number; dueDecks: Deck[] }
  | {
      id: string;
      type: 'situation';
      span: 'compact';
      tone: 'cyan';
      situation: LearnerSituationListItem;
    }
  | { id: string; type: 'wordOfDay'; span: 'compact'; tone: 'amber' }
  | {
      id: string;
      type: 'deck';
      span: 'side';
      tone: FeedTone;
      deck: Deck;
      illo: 'deck' | 'verbs' | 'culture';
    }
  | {
      id: string;
      type: 'milestone';
      span: 'compact';
      tone: 'amber';
      currentStreak: number;
      longestStreak: number;
    }
  | { id: string; type: 'news'; span: 'compact'; tone: 'blue'; news: NewsItemResponse }
  | { id: string; type: 'quick'; span: 'compact'; tone: 'green'; queueCount: number };

/** Raw dashboard data sources passed to composeFeed. All sources are non-critical (graceful empty). */
export interface FeedSources {
  decks: Deck[];
  cardsDue: number;
  currentStreak: number;
  longestStreak: number;
  news: NewsItemResponse[];
  situations: LearnerSituationListItem[];
  queueCount: number;
}

// ─── Filter definitions (verbatim from CD dashboard.jsx:522-527) ─────────────

export type FeedFilterKey = 'all' | 'cards' | 'news' | 'practice';

export interface FeedFilter {
  k: FeedFilterKey;
  types: FeedType[] | null;
}

/**
 * Tab definitions for the FeedFilters segment control.
 * null types = "All" (show everything).
 * wordOfDay + milestone appear ONLY under 'all'.
 */
export const FEED_FILTERS: FeedFilter[] = [
  { k: 'all', types: null },
  { k: 'cards', types: ['resume', 'review', 'deck'] },
  { k: 'news', types: ['news'] },
  { k: 'practice', types: ['situation', 'quick'] },
];

// ─── Selector functions ───────────────────────────────────────────────────────

/**
 * Compose a priority-ordered array of FeedItems from raw dashboard sources.
 *
 * Fixed emission order:
 *   resume → review → situation → wordOfDay → deck → milestone → news → quick
 *
 * Presence rules (all presence-gated except wordOfDay which is always emitted):
 *   resume     — if pickResumeDeck(decks) returns a deck
 *   review     — if cardsDue > 0
 *   situation  — if situations.length > 0 (uses situations[0] only)
 *   wordOfDay  — ALWAYS (D-WOTD placeholder; no source)
 *   deck       — each active deck (in-progress || cardsReview > 0) except the resume deck
 *   milestone  — if currentStreak > 0
 *   news       — one item per news element (1:1)
 *   quick      — if queueCount > 0
 *
 * TODO (DASH2-01-06 executor): implement.
 */
export function composeFeed(_s: FeedSources): FeedItem[] {
  return []; // TODO
}

/**
 * Count items per filter key.
 * wordOfDay and milestone are excluded from per-tab counts (appear only under 'all').
 *
 * Returns { all, cards, news, practice }.
 * TODO (DASH2-01-06 executor): implement.
 */
export function countByFilter(_items: FeedItem[]): Record<FeedFilterKey, number> {
  return {} as Record<FeedFilterKey, number>; // TODO
}

/**
 * Filter items by filter key.
 * 'all' → return all items unchanged.
 * Other keys → return only items whose type is in the filter's types array.
 * TODO (DASH2-01-06 executor): implement.
 */
export function filterFeed(items: FeedItem[], _filterKey: string): FeedItem[] {
  return items; // TODO (intentionally pass-through — executor filters by type)
}
