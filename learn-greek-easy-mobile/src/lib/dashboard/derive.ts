/**
 * Pure derivation helpers for the dashboard view model.
 * No React, no network, no side effects.
 */

import type { DeckProgressSummary } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// greetingForHour
// ---------------------------------------------------------------------------

/** Maps a 0–23 hour value to one of three greeting buckets. */
export function greetingForHour(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

// ---------------------------------------------------------------------------
// pickResumeDeck
// ---------------------------------------------------------------------------

/**
 * Selects the best in-progress deck for the "Resume" card.
 *
 * Qualifying decks: cards_studied > 0 AND completion_percentage < 100.
 * Priority:
 *   1. Decks with cards_due > 0 are preferred over those with cards_due === 0.
 *   2. Among ties, the deck with the latest last_studied_at wins.
 *      null last_studied_at is treated as the lowest possible value (never wins).
 */
export function pickResumeDeck(decks: DeckProgressSummary[]): DeckProgressSummary | null {
  const qualifying = decks.filter(
    (d) => d.cards_studied > 0 && d.completion_percentage < 100,
  );

  if (qualifying.length === 0) return null;

  // Partition: decks with due cards vs those without
  const withDue = qualifying.filter((d) => d.cards_due > 0);
  const candidates = withDue.length > 0 ? withDue : qualifying;

  // Among candidates, pick the one with the latest last_studied_at
  return candidates.reduce((best, current) => {
    const bestTime = best.last_studied_at ?? '';
    const currentTime = current.last_studied_at ?? '';
    return currentTime > bestTime ? current : best;
  });
}

// ---------------------------------------------------------------------------
// isNewUser
// ---------------------------------------------------------------------------

/**
 * Returns true only when the user has zero mastered cards AND zero streak days.
 * Both conditions must be 0 — a user with any activity is not "new".
 */
export function isNewUser(mastered: number, streak: number): boolean {
  return mastered === 0 && streak === 0;
}

// ---------------------------------------------------------------------------
// buildHeatmap
// ---------------------------------------------------------------------------

/**
 * Converts an array of daily review stats into a fixed-length 7-element array
 * of intensity buckets in [0, 5].
 *
 * - Always returns exactly 7 elements (pads with 0s, truncates to last 7).
 * - reviews_count === 0 → bucket 0 (guaranteed).
 * - Buckets are monotonically non-decreasing with reviews_count.
 * - Bucket 5 is reachable for large counts.
 *
 * Thresholds (inclusive lower bound → bucket):
 *   0       → 0
 *   1–4     → 1
 *   5–9     → 2
 *   10–19   → 3
 *   20–49   → 4
 *   50+     → 5
 */
export function buildHeatmap(
  dailyStats: { date: string; reviews_count: number }[],
): number[] {
  // Take last 7 entries (or all if fewer), then pad with zeros to reach 7.
  const last7 = dailyStats.slice(-7);
  const padded = [
    ...Array.from({ length: Math.max(0, 7 - last7.length) }, () => 0),
    ...last7.map((s) => s.reviews_count),
  ];

  return padded.map((count) => {
    // Clamp negative counts to 0 — invalid API data must not map to bucket 1.
    const c = count < 0 ? 0 : count;
    if (c === 0) return 0;
    if (c < 5) return 1;
    if (c < 10) return 2;
    if (c < 20) return 3;
    if (c < 50) return 4;
    return 5;
  });
}
