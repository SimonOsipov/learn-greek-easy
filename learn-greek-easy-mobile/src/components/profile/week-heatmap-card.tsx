/**
 * WeekHeatmapCard — profile screen weekly activity card.
 *
 * Wraps the shared WeekHeatmap component in a card with:
 *   - "THIS WEEK" mono kicker + bold summary line ("17 sessions · 1h 21m")
 *   - 7-cell heatmap below
 *
 * Design: bg-card, border-line, rounded-[16px], p-[16px_18px].
 */
import { View, Text } from 'react-native';

import { WeekHeatmap } from '@/components/dashboard/week-heatmap';
import { formatStudyTime } from '@/lib/dashboard/format-study-time';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeekHeatmapCardProps {
  testID?: string;
  /**
   * 7-element array of activity buckets (0–5), indexed Mon → Sun.
   * Produced by buildHeatmap() from lib/dashboard/derive.ts.
   */
  heat: number[];
  /**
   * Index (0–6, Mon=0, Sun=6) of today's cell.
   * Pass `(new Date().getDay() + 6) % 7` from the parent screen.
   */
  todayIndex: number;
  /** Total review sessions this week (from TrendsSummary.total_reviews). */
  totalSessions: number;
  /** Total study time this week in SECONDS (from TrendsSummary.total_study_time_seconds). */
  totalStudySeconds: number;
}

// ---------------------------------------------------------------------------
// WeekHeatmapCard
// ---------------------------------------------------------------------------

export function WeekHeatmapCard({
  testID,
  heat,
  todayIndex,
  totalSessions,
  totalStudySeconds,
}: WeekHeatmapCardProps) {
  const formattedTime = formatStudyTime(totalStudySeconds);
  const summaryLine = `${totalSessions} sessions · ${formattedTime}`;

  return (
    <View
      testID={testID ?? 'week-heatmap-card'}
      className="bg-card border border-line rounded-[16px] mx-[18px]"
      style={{ padding: 16 }}
    >
      {/* ── Card header ── */}
      <View className="flex-row items-baseline justify-between mb-3">
        <Text
          testID="heatmap-card-kicker"
          className="text-fg3"
          style={{
            fontFamily: 'SpaceMono_400Regular',
            fontSize: 10.5,
            fontWeight: '700',
            letterSpacing: 1.26,
            textTransform: 'uppercase',
          }}
        >
          This week
        </Text>
        <Text
          testID="heatmap-card-summary"
          className="text-fg"
          style={{
            fontFamily: 'InterTight_700Bold',
            fontSize: 15,
            fontWeight: '700',
            letterSpacing: -0.15,
          }}
        >
          {summaryLine}
        </Text>
      </View>

      {/* ── Heatmap ── */}
      <WeekHeatmap heat={heat} todayIndex={todayIndex} />
    </View>
  );
}
