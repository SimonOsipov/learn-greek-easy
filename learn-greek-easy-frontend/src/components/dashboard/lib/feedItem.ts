// src/components/dashboard/lib/feedItem.ts
// Feed vocabulary — FeedItem union, filter definitions, and pure
// filter/count/tone helpers for the unified dashboard feed.
//
// PERF-15-06: re-homed out of composeFeed.ts. Ordering and presence-gating
// used to live in composeFeed's `composeFeed()`; that responsibility moved
// server-side (src/services/dashboard_compose.py's `compose_feed`, a
// byte-parity port). This module keeps only the parts still needed
// client-side: the FeedItem shape itself, the filter-tab vocabulary, and
// the pure countByFilter/filterFeed/tone-cycling helpers that Feed.tsx,
// FeedFilters.tsx, FeedCards.tsx and lib/summaryFeed.ts (the new
// summary.feed -> FeedItem[] mapper) all consume.

import type { DashboardSlimNews, DashboardSlimSituation } from '@/types/dashboard';
import type { Deck } from '@/types/deck';

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
  | { id: string; type: 'resume'; span: 'hero'; tone: 'primary'; deck: Deck; siblings: Deck[] }
  | { id: string; type: 'review'; span: 'side'; tone: 'blue'; cardsDue: number; dueDecks: Deck[] }
  | {
      id: string;
      type: 'situation';
      span: 'compact';
      tone: 'cyan';
      situation: DashboardSlimSituation;
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
  | { id: string; type: 'news'; span: 'compact'; tone: 'blue'; news: DashboardSlimNews }
  | { id: string; type: 'quick'; span: 'compact'; tone: 'green'; queueCount: number };

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

// ─── Layout helpers (deck-card tone cycling + category illo) ─────────────────

/** Cycled tones for deck cards (grammar-≥2 decks) to add visual variety. */
export const DECK_TONES: FeedTone[] = ['primary', 'violet', 'cyan', 'green'];

/** Derive the illo identifier from a deck's category. */
export function illoFromCategory(category: string): 'deck' | 'verbs' | 'culture' {
  if (category === 'culture') return 'culture';
  if (category === 'grammar') return 'verbs';
  return 'deck';
}

// ─── Selector functions ───────────────────────────────────────────────────────

/**
 * Count items per filter key.
 * wordOfDay and milestone are excluded from per-tab counts (appear only under 'all').
 *
 * Returns { all, cards, news, practice }.
 */
export function countByFilter(items: FeedItem[]): Record<FeedFilterKey, number> {
  return {
    all: items.length,
    cards: items.filter((i) =>
      (FEED_FILTERS.find((f) => f.k === 'cards')!.types as FeedType[]).includes(i.type)
    ).length,
    news: items.filter((i) => i.type === 'news').length,
    practice: items.filter((i) =>
      (FEED_FILTERS.find((f) => f.k === 'practice')!.types as FeedType[]).includes(i.type)
    ).length,
  };
}

/**
 * Filter items by filter key.
 * 'all' → return all items unchanged.
 * Other keys → return only items whose type is in the filter's types array.
 */
export function filterFeed(items: FeedItem[], filterKey: string): FeedItem[] {
  if (filterKey === 'all') return items;
  const filter = FEED_FILTERS.find((f) => f.k === filterKey);
  if (!filter?.types) return items;
  const types = filter.types as FeedType[];
  return items.filter((i) => types.includes(i.type));
}
