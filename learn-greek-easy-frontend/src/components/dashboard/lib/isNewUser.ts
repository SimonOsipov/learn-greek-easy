// src/components/dashboard/lib/isNewUser.ts
// DASH2-01-07 — New-user predicate.
//
// Returns true when ALL signals point to a user who has never had a study
// session. The signals are:
//   - cardsDue === 0   (SRS hasn't queued any cards yet)
//   - currentStreak === 0  (no consecutive-day streak)
//   - mastered === 0   (no mastered cards)
//   - every deck's progress.lastStudied is null/undefined (no deck ever opened)
//
// NOTE: we deliberately do NOT use streak.lastActivityDate as a signal —
// transform.ts:112-115 defaults it to the current timestamp even for new users,
// so it is never null for "never-studied" detection.

import type { Deck } from '@/types/deck';

export interface NewUserSignals {
  cardsDue: number;
  currentStreak: number;
  mastered: number;
  decks: Deck[];
}

export function isNewUser(s: NewUserSignals): boolean {
  return (
    s.cardsDue === 0 &&
    s.currentStreak === 0 &&
    s.mastered === 0 &&
    s.decks.every((d) => d.progress?.lastStudied == null)
  );
}
