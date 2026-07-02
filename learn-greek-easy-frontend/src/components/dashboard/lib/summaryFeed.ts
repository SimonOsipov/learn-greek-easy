// src/components/dashboard/lib/summaryFeed.ts
// PERF-15-06 — maps the server-composed dashboard feed (summary.feed) onto
// the client FeedItem[] that Feed/FeedCards render.
//
// The server (src/services/dashboard_compose.py's `compose_feed`, a
// byte-parity port of the removed composeFeed.ts) already orders and
// presence-gates the feed. This module does NOT re-order or re-gate — it is
// a pure 1:1 projection that resolves each item's `deck_id`/`sibling_deck_ids`/
// `due_deck_ids` reference against `summary.decks` and normalizes snake_case
// field names to the camelCase FeedItem shape.

import type { DashboardDeckSlice, DashboardFeedItem } from '@/types/dashboard';
import type { Deck } from '@/types/deck';

import { DECK_TONES, illoFromCategory, type FeedItem } from './feedItem';
import { toDashboardDeck } from './summaryDeckAdapter';

/**
 * Map the server-ordered feed + deck slices onto FeedItem[] for rendering.
 * Order and presence gating are entirely server-side; a feed item whose
 * `deck_id` doesn't resolve against `decks` is skipped defensively (should
 * not happen in practice — feed deck refs always come from the same
 * `summary.decks` list on the server).
 */
export function mapSummaryFeed(feed: DashboardFeedItem[], decks: DashboardDeckSlice[]): FeedItem[] {
  const deckMap = new Map<string, Deck>(
    decks.map((slice) => [slice.deck_id, toDashboardDeck(slice)])
  );

  const items: FeedItem[] = [];
  let deckToneIndex = 0;

  for (const item of feed) {
    switch (item.type) {
      case 'resume': {
        const deck = deckMap.get(item.deck_id);
        if (!deck) continue;
        const siblings = item.sibling_deck_ids
          .map((id) => deckMap.get(id))
          .filter((d): d is Deck => d != null);
        items.push({ id: item.id, type: 'resume', span: 'hero', tone: 'primary', deck, siblings });
        break;
      }

      case 'review': {
        const dueDecks = item.due_deck_ids
          .map((id) => deckMap.get(id))
          .filter((d): d is Deck => d != null);
        items.push({
          id: item.id,
          type: 'review',
          span: 'side',
          tone: 'blue',
          cardsDue: item.cards_due,
          dueDecks,
        });
        break;
      }

      case 'situation':
        items.push({
          id: item.id,
          type: 'situation',
          span: 'compact',
          tone: 'cyan',
          situation: item.situation,
        });
        break;

      case 'word_of_day':
        items.push({ id: item.id, type: 'wordOfDay', span: 'compact', tone: 'amber' });
        break;

      case 'deck': {
        const deck = deckMap.get(item.deck_id);
        if (!deck) continue;
        items.push({
          id: item.id,
          type: 'deck',
          span: 'side',
          tone: DECK_TONES[deckToneIndex % DECK_TONES.length],
          deck,
          illo: illoFromCategory(deck.category),
        });
        deckToneIndex++;
        break;
      }

      case 'milestone':
        items.push({
          id: item.id,
          type: 'milestone',
          span: 'compact',
          tone: 'amber',
          currentStreak: item.current_streak,
          longestStreak: item.longest_streak,
        });
        break;

      case 'news':
        items.push({ id: item.id, type: 'news', span: 'compact', tone: 'blue', news: item.news });
        break;

      case 'quick':
        items.push({
          id: item.id,
          type: 'quick',
          span: 'compact',
          tone: 'green',
          queueCount: item.queue_count,
        });
        break;
    }
  }

  return items;
}
