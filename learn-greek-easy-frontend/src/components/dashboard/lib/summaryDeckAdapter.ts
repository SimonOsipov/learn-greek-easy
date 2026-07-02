// src/components/dashboard/lib/summaryDeckAdapter.ts
// PERF-15-05 — adapts DashboardDeckSlice (from GET /dashboard/summary) onto
// the legacy `Deck`/`DeckProgress` shape (@/types/deck) that HeroEntries,
// FeedCards and heroEntries.ts already consume.
//
// PERF-15-06 removed composeFeed, but KEPT this adapter: HeroEntries still
// consumes toDashboardDecks() directly, and lib/summaryFeed.ts's
// mapSummaryFeed() uses toDashboardDeck() (singular) as its deck_id -> Deck
// resolver when projecting summary.feed onto FeedItem[].

import type { DashboardDeckSlice } from '@/types/dashboard';
import type { Deck, DeckProgress } from '@/types/deck';

function toDeckProgress(slice: DashboardDeckSlice): DeckProgress {
  return {
    deckId: slice.deck_id,
    status: slice.status,
    cardsTotal: slice.cards_total,
    cardsNew: slice.cards_new,
    cardsLearning: slice.cards_learning,
    cardsReview: slice.cards_review,
    cardsMastered: slice.cards_mastered,
    dueToday: slice.due_today,
    // Per-deck streak has no equivalent in DashboardDeckSlice (only the
    // account-level streak is summarized) and is not read by any dashboard
    // component — 0 is an inert placeholder, not a displayed value.
    streak: 0,
    lastStudied: slice.last_studied_at ? new Date(slice.last_studied_at) : undefined,
    totalTimeSpent: 0,
    accuracy: 0,
    completionPct: slice.completion_pct,
  };
}

/** Adapt one DashboardDeckSlice onto the legacy Deck shape. */
export function toDashboardDeck(slice: DashboardDeckSlice): Deck {
  return {
    id: slice.deck_id,
    title: slice.name_en ?? slice.name_el ?? '',
    titleGreek: slice.name_el ?? '',
    description: '',
    level: slice.level as Deck['level'],
    category: slice.category as Deck['category'],
    tags: [],
    cardCount: slice.card_count,
    estimatedTime: 0,
    isPremium: slice.is_premium,
    coverImageUrl: slice.cover_image_url ?? undefined,
    coverImageVariants: slice.cover_image_variants ?? undefined,
    createdBy: '',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    nameEn: slice.name_en ?? undefined,
    nameRu: slice.name_ru ?? undefined,
    progress: toDeckProgress(slice),
  };
}

/** Adapt a list of DashboardDeckSlice onto the legacy Deck[] shape. */
export function toDashboardDecks(slices: DashboardDeckSlice[]): Deck[] {
  return slices.map(toDashboardDeck);
}
