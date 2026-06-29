// src/components/dashboard/lib/weekHeat.ts

/**
 * Bucket a raw review count into a 0–5 heat intensity level.
 * Mirrors the backend `bucket_heatmap_intensity` thresholds.
 */
export function bucketWeekHeatIntensity(reviews: number): number {
  if (reviews === 0) return 0;
  if (reviews <= 2) return 1;
  if (reviews <= 4) return 2;
  if (reviews <= 7) return 3;
  if (reviews <= 12) return 4;
  return 5;
}

export interface WeekHeatResult {
  /** Bucketed heat values, length always 7. Index 0 = 6 days ago, index 6 = today. */
  heat: number[];
  /** Index of "today" in the heat array — always 6. */
  todayIdx: number;
}

/**
 * Build a 7-element heat array from sparse recent-activity data.
 * Days without activity are zero-filled. Each day's raw cardsReviewed is
 * summed then bucketed via `bucketWeekHeatIntensity`.
 *
 * @param recentActivity - array of { timestamp: ISO-string, cardsReviewed: number }
 * @param now - optional override for "today" (defaults to new Date()); must use UTC day bucketing
 */
export function buildWeekHeat(
  recentActivity: Array<{ timestamp: string; cardsReviewed: number }>,
  now: Date = new Date()
): WeekHeatResult {
  const dayMs = 24 * 60 * 60 * 1000;
  // UTC midnight of "today"
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // Sum cardsReviewed per index (index 0 = 6 days ago, index 6 = today)
  const dailySums = new Map<number, number>();

  for (const entry of recentActivity) {
    const ts = new Date(entry.timestamp);
    const entryUtcMs = Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate());
    const daysAgo = Math.round((todayUtcMs - entryUtcMs) / dayMs);

    // Only include entries within the 7-day rolling window (0 = today, 6 = oldest)
    if (daysAgo >= 0 && daysAgo <= 6) {
      const idx = 6 - daysAgo; // convert: daysAgo 0 → idx 6, daysAgo 6 → idx 0
      dailySums.set(idx, (dailySums.get(idx) ?? 0) + entry.cardsReviewed);
    }
  }

  // Build dense 7-element array, bucket each day's sum
  const heat = Array.from({ length: 7 }, (_, i) => {
    const sum = dailySums.get(i) ?? 0;
    return bucketWeekHeatIntensity(sum);
  });

  return { heat, todayIdx: 6 };
}
