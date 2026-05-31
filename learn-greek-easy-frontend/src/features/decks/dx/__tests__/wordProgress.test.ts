/**
 * Unit tests for deriveWordProgress helper.
 *
 * Covers:
 * - empty array → all zeros, progressPct === 0
 * - all mastered → progressPct === 100
 * - Greek House shape (6 in-progress, 1 new, 0 mastered / 7 total) → progressPct === 43
 * - mixed example verifying 2-tier rounding
 */

import { describe, it, expect } from 'vitest';

import type { WordMasteryItem } from '@/services/progressAPI';

import { deriveWordProgress } from '../wordProgress';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeItem(
  overrides: Partial<Pick<WordMasteryItem, 'mastered_count' | 'studied_count' | 'total_count'>>
): WordMasteryItem {
  return {
    word_entry_id: 'w-' + Math.random().toString(36).slice(2),
    mastered_count: 0,
    studied_count: 0,
    total_count: 5,
    type_progress: [],
    ...overrides,
  };
}

// mastered: total_count > 0 && mastered_count === total_count
const masteredItem = makeItem({ total_count: 5, mastered_count: 5, studied_count: 5 });

// in-progress: studied_count > 0 && mastered_count < total_count
const inProgressItem = makeItem({ total_count: 5, mastered_count: 0, studied_count: 2 });

// new: studied_count === 0
const newItem = makeItem({ total_count: 5, mastered_count: 0, studied_count: 0 });

// ─── tests ───────────────────────────────────────────────────────────────────

describe('deriveWordProgress()', () => {
  it('empty array → all counts 0 and progressPct === 0', () => {
    const result = deriveWordProgress([]);
    expect(result.totalWords).toBe(0);
    expect(result.masteredWords).toBe(0);
    expect(result.inProgressWords).toBe(0);
    expect(result.newWords).toBe(0);
    expect(result.progressPct).toBe(0);
  });

  it('all mastered → progressPct === 100', () => {
    const items = [masteredItem, masteredItem, masteredItem];
    const result = deriveWordProgress(items);
    expect(result.totalWords).toBe(3);
    expect(result.masteredWords).toBe(3);
    expect(result.inProgressWords).toBe(0);
    expect(result.newWords).toBe(0);
    expect(result.progressPct).toBe(100);
  });

  it('Greek House shape: 6 in-progress + 1 new → progressPct === 43', () => {
    // 6 in-progress, 1 new, 0 mastered, 7 total
    // weightedScore = 1.0*0 + 0.5*6 = 3  →  3/7 ≈ 0.4286  → round → 43
    const items = [...Array.from({ length: 6 }, () => inProgressItem), newItem];
    const result = deriveWordProgress(items);
    expect(result.totalWords).toBe(7);
    expect(result.masteredWords).toBe(0);
    expect(result.inProgressWords).toBe(6);
    expect(result.newWords).toBe(1);
    expect(result.progressPct).toBe(43);
  });

  it('mixed example verifying 2-tier rounding (2 mastered + 4 in-progress + 4 new = 10)', () => {
    // weightedScore = 1.0*2 + 0.5*4 = 4  →  4/10 = 0.4  → round → 40
    const items = [
      ...Array.from({ length: 2 }, () => masteredItem),
      ...Array.from({ length: 4 }, () => inProgressItem),
      ...Array.from({ length: 4 }, () => newItem),
    ];
    const result = deriveWordProgress(items);
    expect(result.totalWords).toBe(10);
    expect(result.masteredWords).toBe(2);
    expect(result.inProgressWords).toBe(4);
    expect(result.newWords).toBe(4);
    expect(result.progressPct).toBe(40);
  });
});
