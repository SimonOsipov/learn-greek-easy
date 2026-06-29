// src/components/dashboard/lib/weekHeat.ts
// TODO: implement for DASH2-01-02 (stubs below let RED tests compile)

/**
 * Bucket a raw review count into a 0–5 heat intensity level.
 * Mirrors the backend `bucket_heatmap_intensity` thresholds.
 */
export function bucketWeekHeatIntensity(_reviews: number): number {
  return 0; /* TODO */
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
  _recentActivity: Array<{ timestamp: string; cardsReviewed: number }>,
  _now?: Date
): WeekHeatResult {
  return { heat: [], todayIdx: 6 }; /* TODO */
}
