// src/components/dashboard/lib/__tests__/weekHeat.test.ts
// RED specs for DASH2-01-02 — written before implementation.
// All assertions test REAL intended behaviour and FAIL against the stubs.

import { describe, it, expect } from 'vitest';
import { bucketWeekHeatIntensity, buildWeekHeat } from '../weekHeat';

// Fixed "now" for deterministic UTC-day bucketing.
// 2026-06-29 10:00 UTC → today is Monday 2026-06-29.
// The trailing 7-day window (oldest→newest):
//   idx 0: 2026-06-23  idx 1: 2026-06-24  idx 2: 2026-06-25
//   idx 3: 2026-06-26  idx 4: 2026-06-27  idx 5: 2026-06-28  idx 6: 2026-06-29
const NOW = new Date('2026-06-29T10:00:00Z');

// ── bucketWeekHeatIntensity ───────────────────────────────────────────────────

describe('bucketWeekHeatIntensity — mirrors backend bucket_heatmap_intensity thresholds', () => {
  // Each tuple: [reviews, expectedBucket]
  const cases: Array<[number, number]> = [
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
    [7, 3],
    [8, 4],
    [12, 4],
    [13, 5],
    [30, 5],
  ];

  it.each(cases)('reviews=%i → bucket %i', (reviews, expected) => {
    expect(bucketWeekHeatIntensity(reviews)).toBe(expected);
  });
});

// ── buildWeekHeat ─────────────────────────────────────────────────────────────

describe('buildWeekHeat — dense-fill: always 7 elements, today at index 6', () => {
  it('always returns heat length 7', () => {
    const result = buildWeekHeat([], NOW);
    expect(result.heat).toHaveLength(7);
  });

  it('todayIdx is always 6', () => {
    const result = buildWeekHeat([], NOW);
    expect(result.todayIdx).toBe(6);
  });
});

describe('buildWeekHeat — all-zero when recentActivity is empty', () => {
  it('empty input → 7 zeros (caller hides the strip; helper still returns zeros)', () => {
    const result = buildWeekHeat([], NOW);
    expect(result.heat).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('buildWeekHeat — sparse activity, correct day buckets, zero-filled gaps', () => {
  it('places today activity at index 6, zero-fills other indices', () => {
    // 10 reviews today → bucket 4
    const activity = [{ timestamp: '2026-06-29T08:00:00Z', cardsReviewed: 10 }];
    const result = buildWeekHeat(activity, NOW);
    expect(result.heat).toHaveLength(7);
    expect(result.heat[6]).toBe(4); // bucketWeekHeatIntensity(10) = 4
    expect(result.heat[0]).toBe(0);
    expect(result.heat[1]).toBe(0);
    expect(result.heat[2]).toBe(0);
    expect(result.heat[3]).toBe(0);
    expect(result.heat[4]).toBe(0);
    expect(result.heat[5]).toBe(0);
  });

  it('sparse multi-day: activity on today + 3 days ago, gaps zero', () => {
    // today (idx 6): 5 reviews → bucket 3
    // 3 days ago (2026-06-26, idx 3): 3 reviews → bucket 2
    const activity = [
      { timestamp: '2026-06-29T08:00:00Z', cardsReviewed: 5 },
      { timestamp: '2026-06-26T15:00:00Z', cardsReviewed: 3 },
    ];
    const result = buildWeekHeat(activity, NOW);
    expect(result.heat).toHaveLength(7);
    expect(result.heat[6]).toBe(3); // bucketWeekHeatIntensity(5) = 3
    expect(result.heat[3]).toBe(2); // bucketWeekHeatIntensity(3) = 2
    expect(result.heat[0]).toBe(0);
    expect(result.heat[1]).toBe(0);
    expect(result.heat[2]).toBe(0);
    expect(result.heat[4]).toBe(0);
    expect(result.heat[5]).toBe(0);
  });

  it('out-of-order timestamps still land in correct indices', () => {
    // Reversed order in input — the helper must sort by UTC day, not input order
    const activity = [
      { timestamp: '2026-06-23T12:00:00Z', cardsReviewed: 13 }, // idx 0 → bucket 5
      { timestamp: '2026-06-29T09:00:00Z', cardsReviewed: 1 }, // idx 6 → bucket 1
    ];
    const result = buildWeekHeat(activity, NOW);
    expect(result.heat[0]).toBe(5); // bucketWeekHeatIntensity(13) = 5
    expect(result.heat[6]).toBe(1); // bucketWeekHeatIntensity(1)  = 1
  });

  it('activity older than 7 days is ignored (not placed at negative indices)', () => {
    const activity = [
      { timestamp: '2026-06-20T12:00:00Z', cardsReviewed: 20 }, // 9 days ago — ignored
      { timestamp: '2026-06-29T08:00:00Z', cardsReviewed: 8 }, // today → bucket 4
    ];
    const result = buildWeekHeat(activity, NOW);
    expect(result.heat).toHaveLength(7);
    expect(result.heat[6]).toBe(4); // bucketWeekHeatIntensity(8) = 4
    // No element should carry the out-of-window value (bucket 5)
    expect(result.heat.filter((v) => v === 5)).toHaveLength(0);
  });
});

describe('buildWeekHeat — same-day cardsReviewed are summed before bucketing', () => {
  it('two entries on the same UTC day: sum → bucket', () => {
    // idx 6 (today): 5 + 8 = 13 reviews → bucket 5
    const activity = [
      { timestamp: '2026-06-29T06:00:00Z', cardsReviewed: 5 },
      { timestamp: '2026-06-29T18:00:00Z', cardsReviewed: 8 },
    ];
    const result = buildWeekHeat(activity, NOW);
    expect(result.heat[6]).toBe(5); // bucketWeekHeatIntensity(13) = 5
  });
});

describe('buildWeekHeat — UTC boundary: timestamps straddle midnight correctly', () => {
  it('timestamp at 2026-06-28T23:59:59Z lands in index 5 (Jun 28), not today', () => {
    const activity = [{ timestamp: '2026-06-28T23:59:59Z', cardsReviewed: 5 }];
    const result = buildWeekHeat(activity, NOW);
    expect(result.heat[5]).toBe(3); // bucketWeekHeatIntensity(5) = 3 — June 28
    expect(result.heat[6]).toBe(0); // today (June 29) has no activity
  });

  it('timestamp at 2026-06-29T00:00:00Z lands in index 6 (today, June 29)', () => {
    const activity = [{ timestamp: '2026-06-29T00:00:00Z', cardsReviewed: 5 }];
    const result = buildWeekHeat(activity, NOW);
    expect(result.heat[6]).toBe(3); // bucketWeekHeatIntensity(5) = 3 — today
    expect(result.heat[5]).toBe(0); // June 28 has no activity
  });
});

// ── Adversarial boundary tests (QA-DASH2-01-02) ──────────────────────────────

describe('buildWeekHeat — window-edge adversarial (QA-DASH2-01-02)', () => {
  it('entry exactly 6 days ago (2026-06-23) lands at idx 0 (oldest included day)', () => {
    // daysAgo = 6 → idx = 6 - 6 = 0; filter passes (0 <= 6 <= 6).
    // This is the LAST day included by the fence `daysAgo <= 6`.
    const activity = [{ timestamp: '2026-06-23T00:00:00Z', cardsReviewed: 13 }];
    const result = buildWeekHeat(activity, NOW);
    expect(result.heat[0]).toBe(5); // bucketWeekHeatIntensity(13) = 5
    // All other days zero (only one activity entry)
    for (let i = 1; i <= 6; i++) expect(result.heat[i]).toBe(0);
  });

  it('entry exactly 7 days ago (2026-06-22) is excluded — first day outside window', () => {
    // daysAgo = 7 → filter `daysAgo <= 6` fails → entry dropped → heat all zeros.
    const activity = [{ timestamp: '2026-06-22T00:00:00Z', cardsReviewed: 13 }];
    const result = buildWeekHeat(activity, NOW);
    expect(result.heat).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('future-dated entry (tomorrow, daysAgo < 0) is excluded', () => {
    // daysAgo = -1 → filter `daysAgo >= 0` fails → entry dropped → heat all zeros.
    const activity = [{ timestamp: '2026-06-30T12:00:00Z', cardsReviewed: 10 }];
    const result = buildWeekHeat(activity, NOW);
    expect(result.heat).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('all 7 days filled: activity on each day of the window', () => {
    // Provide exactly one entry per day (Jul 23–29).
    const activity = [
      { timestamp: '2026-06-23T10:00:00Z', cardsReviewed: 1 }, // idx 0 → bucket 1
      { timestamp: '2026-06-24T10:00:00Z', cardsReviewed: 3 }, // idx 1 → bucket 2
      { timestamp: '2026-06-25T10:00:00Z', cardsReviewed: 5 }, // idx 2 → bucket 3
      { timestamp: '2026-06-26T10:00:00Z', cardsReviewed: 8 }, // idx 3 → bucket 4
      { timestamp: '2026-06-27T10:00:00Z', cardsReviewed: 13 }, // idx 4 → bucket 5
      { timestamp: '2026-06-28T10:00:00Z', cardsReviewed: 2 }, // idx 5 → bucket 1
      { timestamp: '2026-06-29T10:00:00Z', cardsReviewed: 4 }, // idx 6 → bucket 2
    ];
    const result = buildWeekHeat(activity, NOW);
    expect(result.heat).toEqual([1, 2, 3, 4, 5, 1, 2]);
    expect(result.todayIdx).toBe(6);
  });
});
