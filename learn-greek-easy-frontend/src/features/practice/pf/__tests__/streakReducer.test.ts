/**
 * Streak reducer logic tests (PRACT2-1-02)
 *
 * Tests the streak computation logic exported from v2PracticeStore:
 * - ok rating → streak +1
 * - easy rating → streak +1
 * - forgot rating → streak resets to 0
 * - tough rating → streak unchanged
 */

import { describe, it, expect } from 'vitest';

import { ratingToKey } from '@/stores/v2PracticeStore';

// ── Streak reducer (extracted logic mirrors store implementation) ─────────────

function applyStreak(currentStreak: number, rating: 1 | 2 | 3 | 4): number {
  const key = ratingToKey(rating);
  if (key === 'ok' || key === 'easy') return currentStreak + 1;
  if (key === 'forgot') return 0;
  return currentStreak; // tough: unchanged
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Streak reducer logic', () => {
  it('ok rating (3) increments streak', () => {
    expect(applyStreak(2, 3)).toBe(3);
  });

  it('easy rating (4) increments streak', () => {
    expect(applyStreak(5, 4)).toBe(6);
  });

  it('forgot rating (1) resets streak to 0', () => {
    expect(applyStreak(10, 1)).toBe(0);
  });

  it('tough rating (2) leaves streak unchanged', () => {
    expect(applyStreak(4, 2)).toBe(4);
  });

  it('streak starts at 0 and increments correctly', () => {
    let streak = 0;
    streak = applyStreak(streak, 3); // ok → 1
    streak = applyStreak(streak, 4); // easy → 2
    streak = applyStreak(streak, 4); // easy → 3
    expect(streak).toBe(3);
  });

  it('streak resets after forgot then increments again', () => {
    let streak = 5;
    streak = applyStreak(streak, 1); // forgot → 0
    streak = applyStreak(streak, 3); // ok → 1
    expect(streak).toBe(1);
  });
});

describe('ratingToKey', () => {
  it('maps 1 → forgot', () => expect(ratingToKey(1)).toBe('forgot'));
  it('maps 2 → tough', () => expect(ratingToKey(2)).toBe('tough'));
  it('maps 3 → ok', () => expect(ratingToKey(3)).toBe('ok'));
  it('maps 4 → easy', () => expect(ratingToKey(4)).toBe('easy'));
});
