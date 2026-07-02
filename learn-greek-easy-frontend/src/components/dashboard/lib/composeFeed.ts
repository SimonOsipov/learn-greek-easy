// src/components/dashboard/lib/composeFeed.ts
// Pure feed selector — compose, filter, and count FeedItems from dashboard data sources.
// Test-first (DASH2-01-06): this module defines the contract; the executor implements the bodies.

import type { NewsItemResponse } from '@/services/adminAPI';
import type { Deck } from '@/types/deck';
import type { LearnerSituationListItem } from '@/types/situation';

import { decksWithDue, pickResumeDeck } from './heroEntries';

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

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Cycled tones for deck cards (grammar-≥2 decks) to add visual variety. */
const DECK_TONES: FeedTone[] = ['primary', 'violet', 'cyan', 'green'];

/** Derive the illo identifier from a deck's category. */
function illoFromCategory(category: string): 'deck' | 'verbs' | 'culture' {
  if (category === 'culture') return 'culture';
  if (category === 'grammar') return 'verbs';
  return 'deck';
}

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
 */
export function composeFeed(s: FeedSources): FeedItem[] {
  const items: FeedItem[] = [];

  // 1. resume — most-recently-studied / first-with-due / first deck
  const resumeDeck = pickResumeDeck(s.decks);
  if (resumeDeck) {
    // Fanned cover stack (mirrors the deck-detail DxResumeHero): up to 2 other
    // decks rendered behind the resume deck, each showing its own cover.
    const siblings = s.decks.filter((d) => d.id !== resumeDeck.id).slice(0, 2);
    items.push({
      id: `resume-${resumeDeck.id}`,
      type: 'resume',
      span: 'hero',
      tone: 'primary',
      deck: resumeDeck,
      siblings,
    });
  }

  // 2. review — any cards due today
  if (s.cardsDue > 0) {
    items.push({
      id: 'review',
      type: 'review',
      span: 'side',
      tone: 'blue',
      cardsDue: s.cardsDue,
      dueDecks: decksWithDue(s.decks),
    });
  }

  // 3. situation — first situation from the list
  if (s.situations.length > 0) {
    const sit = s.situations[0];
    items.push({
      id: `situation-${sit.id}`,
      type: 'situation',
      span: 'compact',
      tone: 'cyan',
      situation: sit,
    });
  }

  // 4. wordOfDay — ALWAYS (D-WOTD: no backend source yet; renders as placeholder)
  items.push({ id: 'word-of-day', type: 'wordOfDay', span: 'compact', tone: 'amber' });

  // 5. deck — active decks (in-progress or cardsReview > 0) excluding the resume deck
  let deckIndex = 0;
  for (const deck of s.decks) {
    const isActive =
      deck.progress?.status === 'in-progress' || (deck.progress?.cardsReview ?? 0) > 0;
    const isResume = deck.id === resumeDeck?.id;
    if (!isActive || isResume) continue;
    items.push({
      id: `deck-${deck.id}`,
      type: 'deck',
      span: 'side',
      tone: DECK_TONES[deckIndex % DECK_TONES.length],
      deck,
      illo: illoFromCategory(deck.category),
    });
    deckIndex++;
  }

  // 6. milestone — active streak
  if (s.currentStreak > 0) {
    items.push({
      id: 'milestone',
      type: 'milestone',
      span: 'compact',
      tone: 'amber',
      currentStreak: s.currentStreak,
      longestStreak: s.longestStreak,
    });
  }

  // 7. news — one item per news article (1:1 mapping)
  for (const n of s.news) {
    items.push({ id: `news-${n.id}`, type: 'news', span: 'compact', tone: 'blue', news: n });
  }

  // 8. quick — exercises ready in the queue
  if (s.queueCount > 0) {
    items.push({
      id: 'quick',
      type: 'quick',
      span: 'compact',
      tone: 'green',
      queueCount: s.queueCount,
    });
  }

  return items;
}

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
