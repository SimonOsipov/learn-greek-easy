/**
 * Decks-tab presentation helpers (MOB-07): cover gradients, gender accents,
 * word-status derivation, and library filtering. Pure functions — no React.
 *
 * Cover gradients are the named presentation map mandated by the MOB-07
 * handoff ("don't scatter per-deck gradients through src/** — define them as
 * one named map"). Stop values mirror the handoff mock's six deck covers,
 * converted hsl → rgb (MOB-13: no NativeWind /NN modifiers; fixed full-colour
 * values with token comments, same convention as lib/dashboard/gradients.ts).
 *
 * NOTE: the dashboard deck shelf (lib/dashboard/gradients.ts → gradientForId)
 * predates this map and uses a different 4-gradient palette. The handoff
 * palette below is the newer canonical deck-cover set; unifying the dashboard
 * shelf onto it is flagged as a follow-up, not done here (surgical-changes rule).
 */

import type { DeckProgressSummary } from '@/types/dashboard';
import type { DeckResponse, WordGender, WordMasteryItem, WordStatus } from '@/types/deck';

// ---------------------------------------------------------------------------
// Deck cover gradients — handoff presentation map
// ---------------------------------------------------------------------------

/**
 * Six deck-cover stop pairs from the MOB-07 handoff mock (Decks Mock.html →
 * DECKS[].cover), 135° linear gradients. hsl sources in comments.
 */
export const DECK_COVER_PALETTE: readonly (readonly [string, string])[] = [
  ['rgb(225,156,32)', 'rgb(161,99,35)'],   // amber   — hsl(38 72% 52%)  → hsl(28 65% 38%)
  ['rgb(45,125,221)', 'rgb(33,57,131)'],   // blue    — hsl(212 72% 52%) → hsl(225 60% 32%)
  ['rgb(34,160,113)', 'rgb(32,103,110)'],  // green   — hsl(160 65% 38%) → hsl(180 55% 28%)
  ['rgb(242,135,39)', 'rgb(214,31,77)'],   // sunset  — hsl(28 88% 55%)  → hsl(345 75% 48%)
  ['rgb(178,51,204)', 'rgb(58,44,150)'],   // violet  — hsl(280 60% 50%) → hsl(248 55% 38%)
  ['rgb(31,160,214)', 'rgb(34,75,160)'],   // cyan    — hsl(195 75% 48%) → hsl(220 65% 38%)
] as const;

/**
 * djb2 hash — same algorithm as lib/dashboard/gradients.ts so id → index is
 * stable across app restarts. Duplicated (not imported) to keep the two
 * presentation maps independently deletable.
 */
function djb2(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministically maps a deck id to one of the six handoff cover gradients. */
export function coverForDeckId(id: string): readonly [string, string] {
  return DECK_COVER_PALETTE[djb2(id) % DECK_COVER_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Fixed semantic accents (same in both themes — handoff "Design tokens" table)
// ---------------------------------------------------------------------------

/** Grammatical-gender accents for the article badge. hsl sources in comments. */
export const ARTICLE_COLOR: Record<WordGender, string> = {
  masculine: 'rgb(48,135,232)', // hsl(212 80% 55%)
  feminine: 'rgb(226,54,112)',  // hsl(340 75% 55%)
  neuter: 'rgb(37,177,130)',    // hsl(160 65% 42%)
};

/** Check-disc glyph colour on completed deck covers. */
export const COVER_CHECK_GREEN = 'rgb(23,130,87)'; // hsl(160 70% 30%)

/**
 * Sticky "Practice" CTA gradient, top → bottom (mock: 180deg primary-2 → primary).
 * Light-theme primary values, same fixed-rgb convention as GRADIENT_HERO.
 */
export const CTA_GRADIENT: readonly [string, string] = [
  'rgb(90,131,244)', // --primary-2 221 83% 65%
  'rgb(36,99,235)',  // --primary   221 83% 53%
] as const;

// ---------------------------------------------------------------------------
// Greek article + word status derivation
// ---------------------------------------------------------------------------

/** Maps backend grammar_data.gender to the Greek definite article shown in the badge. */
export function articleForGender(gender: string | undefined | null): {
  article: string;
  gender: WordGender;
} | null {
  switch (gender) {
    case 'masculine':
      return { article: 'ο', gender };
    case 'feminine':
      return { article: 'η', gender };
    case 'neuter':
      return { article: 'το', gender };
    default:
      return null;
  }
}

/**
 * Derives a word's learning status from its mastery item.
 * Semantics copied from the web WordBrowser filters
 * (learn-greek-easy-frontend/src/features/decks/components/V2DeckPage/WordBrowser.tsx:219-235):
 *   - no mastery row OR studied_count === 0          → 'new'
 *   - mastered_count === total_count && total > 0    → 'mastered'
 *   - otherwise                                      → 'learning'
 */
export function wordStatus(mastery: WordMasteryItem | undefined): WordStatus {
  if (!mastery || mastery.studied_count === 0) return 'new';
  if (mastery.mastered_count === mastery.total_count && mastery.total_count > 0) {
    return 'mastered';
  }
  return 'learning';
}

// ---------------------------------------------------------------------------
// Library progress + filtering
// ---------------------------------------------------------------------------

/**
 * Progress ratio for a deck in [0, 1] — mastered cards over card count.
 * Same derivation as the dashboard DeckCard (components/dashboard/deck-card.tsx:48).
 */
export function deckProgressRatio(
  deck: DeckResponse,
  progress: DeckProgressSummary | undefined,
): number {
  if (deck.card_count <= 0) return 0;
  const mastered = progress?.cards_mastered ?? 0;
  return Math.max(0, Math.min(1, mastered / deck.card_count));
}

export const DECK_FILTERS = ['All', 'Active', 'A1', 'A2', 'B1', 'B2'] as const;
export type DeckFilter = (typeof DECK_FILTERS)[number];

/**
 * Filters the joined deck list per the active pill.
 * 'Active' = in-progress decks (0 < progress < 1); level pills filter by CEFR level.
 */
export function filterDecks<T extends { deck: DeckResponse; progressRatio: number }>(
  items: T[],
  filter: DeckFilter,
): T[] {
  if (filter === 'All') return items;
  if (filter === 'Active') {
    return items.filter((i) => i.progressRatio > 0 && i.progressRatio < 1);
  }
  return items.filter((i) => i.deck.level === filter);
}
