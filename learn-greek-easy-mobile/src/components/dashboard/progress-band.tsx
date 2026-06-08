/**
 * ProgressBand — one-line summary + week heatmap for the dashboard.
 *
 * Renders a single sentence describing cards-due today (and optionally deck
 * count / goal / minutes) followed by the WeekHeatmap component.
 *
 * Bolded numbers use `text-fg`; surrounding prose uses `text-fg2`.
 * The band sits at `mx-[18px]` to match the horizontal padding constant.
 *
 * Props are intentionally minimal — extend when the dashboard screen passes
 * richer data (deckCount, minutesToday, goal) in a later subtask.
 *
 * MOB-13 SAFE: WeekHeatmap handles intensity via element opacity, not /NN tokens.
 */
import { View, Text } from 'react-native';

import { WeekHeatmap } from '@/components/dashboard/week-heatmap';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgressBandProps {
  /** Number of cards due today (from useDashboard().cardsDueToday). */
  dueToday: number;
  /**
   * Number of decks with cards due today.
   * Optional — omitted from the sentence when undefined.
   */
  deckCount?: number;
  /**
   * Minutes studied today (from useDashboard progress data).
   * Optional — omitted from the sentence when undefined.
   */
  minutesToday?: number;
  /**
   * Daily goal in minutes.
   * Optional — if provided alongside minutesToday, shows the "Aim for X min" phrase.
   */
  minutesGoal?: number;
  /**
   * 7-element heatmap intensity array (0–5) from useDashboard().heatmap.
   */
  heat: number[];
  /**
   * Index (0–6) of today in the heatmap (Monday = 0, Sunday = 6).
   * Passed through to WeekHeatmap; when undefined no cell is outlined.
   */
  todayIndex?: number;
}

// ---------------------------------------------------------------------------
// ProgressBand
// ---------------------------------------------------------------------------

export function ProgressBand({
  dueToday,
  deckCount,
  minutesToday,
  minutesGoal,
  heat,
  todayIndex,
}: ProgressBandProps) {
  return (
    <View testID="progress-band" className="mx-[18px] mt-1.5">
      {/* ── Summary sentence ── */}
      <Text
        testID="progress-summary"
        className="text-fg2 text-[13px] leading-relaxed"
        style={{ fontFamily: 'SplineSans_400Regular' }}
      >
        {/* Bold N cards */}
        <Text className="text-fg font-semibold">{dueToday} cards</Text>

        {/* " due across N decks today." or " due today." */}
        {deckCount !== undefined ? (
          <>
            {' due across '}
            <Text className="text-fg font-semibold">{deckCount} decks</Text>
            {' today.'}
          </>
        ) : (
          ' due today.'
        )}

        {/* Optional goal phrase: " Aim for X min — you're at Y min." */}
        {minutesGoal !== undefined && minutesToday !== undefined && (
          <>
            {'  Aim for '}
            <Text className="text-fg font-semibold">{minutesGoal} min</Text>
            {" — you're at "}
            <Text className="text-fg font-semibold">{minutesToday} min</Text>
            {'.'}
          </>
        )}
      </Text>

      {/* ── Week heatmap ── */}
      <View className="mt-3.5">
        <WeekHeatmap heat={heat} todayIndex={todayIndex} />
      </View>
    </View>
  );
}
