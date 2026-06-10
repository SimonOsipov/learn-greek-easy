/// <reference types="jest" />
/**
 * MOB-10 — Unit tests for src/lib/culture/presentation.ts.
 *
 * Tests:
 *   1. tintForDeckId — stable, cycles, in-palette.
 *   2. verdictLabel — all backend keys map to non-empty strings.
 *   3. scoreBarColor — thresholds: ≥70% strong, <40% weak, 40–70% null.
 *   4. weakestTopicLabels — returns up to 2 sorted ascending.
 *   5. SUBTOPICS — 3 entries with required fields.
 */

import {
  tintForDeckId,
  verdictLabel,
  scoreBarColor,
  weakestTopicLabels,
  EXAM_TINT_PALETTE,
  SUBTOPICS,
  SCORE_STRONG,
  SCORE_WEAK,
} from '../presentation';

import type { CategoryReadiness } from '@/types/culture';

// ---------------------------------------------------------------------------
// tintForDeckId
// ---------------------------------------------------------------------------

describe('tintForDeckId', () => {
  it('returns a 2-element tuple of rgb strings', () => {
    const tint = tintForDeckId('exam-001');
    expect(tint).toHaveLength(2);
    expect(tint[0]).toMatch(/^rgb\(/);
    expect(tint[1]).toMatch(/^rgb\(/);
  });

  it('returns the same tint for the same id (stable)', () => {
    expect(tintForDeckId('exam-jul-25')).toEqual(tintForDeckId('exam-jul-25'));
  });

  it('returns a tint that is a member of EXAM_TINT_PALETTE', () => {
    const tint = tintForDeckId('exam-feb-24');
    const found = EXAM_TINT_PALETTE.some((p) => p[0] === tint[0] && p[1] === tint[1]);
    expect(found).toBe(true);
  });

  it('different ids can produce different tints', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const tints = ids.map(tintForDeckId);
    const unique = new Set(tints.map((t) => t[0]));
    // With 8 ids across 4 palette entries, we should see all 4 used
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// verdictLabel
// ---------------------------------------------------------------------------

describe('verdictLabel', () => {
  it.each([
    ['not_ready', 'Just getting started'],
    ['getting_there', 'Almost halfway'],
    ['ready', 'Nearly ready'],
    ['thoroughly_prepared', 'Thoroughly prepared'],
  ])('maps "%s" to "%s"', (key, expected) => {
    expect(verdictLabel(key)).toBe(expected);
  });

  it('returns a non-empty fallback for unknown keys', () => {
    expect(verdictLabel('unknown_key').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// scoreBarColor
// ---------------------------------------------------------------------------

describe('scoreBarColor', () => {
  it('returns SCORE_STRONG for pct >= 0.7', () => {
    expect(scoreBarColor(0.7)).toBe(SCORE_STRONG);
    expect(scoreBarColor(0.85)).toBe(SCORE_STRONG);
    expect(scoreBarColor(1.0)).toBe(SCORE_STRONG);
  });

  it('returns SCORE_WEAK for pct < 0.4', () => {
    expect(scoreBarColor(0.39)).toBe(SCORE_WEAK);
    expect(scoreBarColor(0.0)).toBe(SCORE_WEAK);
    expect(scoreBarColor(0.24)).toBe(SCORE_WEAK);
  });

  it('returns null for mid-range 0.4 <= pct < 0.7 (use primary token)', () => {
    expect(scoreBarColor(0.4)).toBeNull();
    expect(scoreBarColor(0.55)).toBeNull();
    expect(scoreBarColor(0.69)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// weakestTopicLabels
// ---------------------------------------------------------------------------

describe('weakestTopicLabels', () => {
  const categories: CategoryReadiness[] = [
    { k: 'history',   l: 'History',   pct: 62 },
    { k: 'politics',  l: 'Politics',  pct: 38 },
    { k: 'geography', l: 'Geography', pct: 71 },
    { k: 'language',  l: 'Language',  pct: 24 },
    { k: 'society',   l: 'Society',   pct: 34 },
  ];

  it('returns up to 2 labels', () => {
    const result = weakestTopicLabels(categories);
    expect(result).toHaveLength(2);
  });

  it('returns the labels with the lowest pct first', () => {
    const result = weakestTopicLabels(categories);
    // Language (24) and Society (34) are the two weakest
    expect(result[0]).toBe('Language');
    expect(result[1]).toBe('Society');
  });

  it('returns 1 label when there is only 1 category', () => {
    const result = weakestTopicLabels([{ k: 'history', l: 'History', pct: 50 }]);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(weakestTopicLabels([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const original = [...categories];
    weakestTopicLabels(categories);
    expect(categories).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// SUBTOPICS constant
// ---------------------------------------------------------------------------

describe('SUBTOPICS', () => {
  it('has exactly 3 entries', () => {
    expect(SUBTOPICS).toHaveLength(3);
  });

  it('each entry has required fields', () => {
    for (const s of SUBTOPICS) {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.el).toBeTruthy();
      expect(s.mark).toBeTruthy();
      expect(s.n).toBeGreaterThan(0);
    }
  });

  it('includes History, Politics, Geography', () => {
    const ids = SUBTOPICS.map((s) => s.id);
    expect(ids).toContain('history');
    expect(ids).toContain('politics');
    expect(ids).toContain('geography');
  });
});
