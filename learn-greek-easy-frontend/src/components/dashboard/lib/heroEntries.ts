// src/components/dashboard/lib/heroEntries.ts
// Pure helper functions for the hero entry-card section.

import type { Deck } from '@/types/deck';

/**
 * Pick the "resume" deck — the one the user is most likely to continue.
 * Priority order:
 *   1. Deck with the most recent lastStudied date
 *   2. First deck that has cards due today
 *   3. First deck in the list
 *   4. undefined (empty list)
 */
export function pickResumeDeck(decks: Deck[]): Deck | undefined {
  if (decks.length === 0) return undefined;

  // 1. Deck with max lastStudied
  const withLastStudied = decks.filter((d) => d.progress?.lastStudied != null);
  if (withLastStudied.length > 0) {
    return withLastStudied.reduce((best, d) => {
      const bestDate = best.progress!.lastStudied!;
      const dDate = d.progress!.lastStudied!;
      return dDate > bestDate ? d : best;
    });
  }

  // 2. First deck with due cards
  const withDue = decks.find((d) => (d.progress?.dueToday ?? 0) > 0);
  if (withDue) return withDue;

  // 3. First deck
  return decks[0];
}

/**
 * Return decks that have at least one card due today.
 */
export function decksWithDue(decks: Deck[]): Deck[] {
  return decks.filter((d) => (d.progress?.dueToday ?? 0) > 0);
}
