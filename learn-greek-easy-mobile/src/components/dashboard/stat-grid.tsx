/**
 * StatGrid — 2×2 dashboard stat tiles.
 *
 * Displays four key dashboard metrics in a 2-column grid:
 *   (1) Streak     — amber     — flame icon
 *   (2) Mastered   — green     — check icon
 *   (3) Time today — primary   — clock icon (value formatted via formatStudyTime)
 *   (4) All time   — violet    — trophy icon (value formatted via formatStudyTime)
 *
 * Pure presentational — parent passes all values, no hooks inside.
 *
 * MOB-13 SAFE: stat tints use explicit <base>-<NN> rgba tokens registered in
 * tailwind.config.js (stat-amber-14, stat-green / stat-green-14, stat-primary-14,
 * stat-violet / stat-violet-14). No /NN modifier on any var-backed token.
 *
 * Design reference: Dashboard Mock.html › StatTile.
 */
import { View, Text } from 'react-native';
import type { ReactNode } from 'react';
import {
  Flame,
  Check,
  Clock,
  Trophy,
} from 'lucide-react-native';

import { formatStudyTime } from '@/lib/dashboard/format-study-time';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatTone = 'amber' | 'green' | 'primary' | 'violet';

interface StatTileProps {
  testID?: string;
  label: string;
  /** Pre-formatted display value (string) or raw number. */
  value: string | number;
  tone: StatTone;
  /** Icon element rendered at 12×12 inside the tinted icon badge. */
  icon: ReactNode;
}

// ---------------------------------------------------------------------------
// Tone map — all MOB-13 explicit rgba tokens (no /NN on var-backed tokens)
// ---------------------------------------------------------------------------

const TONE_CLASSES: Record<StatTone, { bg: string; fg: string }> = {
  amber:   { bg: 'bg-stat-amber-14',   fg: 'text-entry-amber'   },
  green:   { bg: 'bg-stat-green-14',   fg: 'text-stat-green'    },
  primary: { bg: 'bg-stat-primary-14', fg: 'text-primary'       },
  violet:  { bg: 'bg-stat-violet-14',  fg: 'text-stat-violet'   },
};

// ---------------------------------------------------------------------------
// StatTile — single stat cell
// ---------------------------------------------------------------------------

function StatTile({ testID, label, value, tone, icon }: StatTileProps) {
  const T = TONE_CLASSES[tone];
  return (
    <View
      testID={testID}
      className="bg-bg-2 border border-line rounded-[14px] p-3 flex-col gap-1.5 flex-1"
    >
      {/* Label + icon row */}
      <View className="flex-row items-center justify-between">
        <Text
          className="text-fg3 text-[9.5px] uppercase tracking-[0.10em]"
          style={{ fontFamily: 'SpaceMono_400Regular' }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {/* Tinted icon badge */}
        <View
          className={`w-[22px] h-[22px] rounded-[7px] items-center justify-center ${T.bg}`}
        >
          <View className={T.fg} style={{ width: 12, height: 12 }}>
            {icon}
          </View>
        </View>
      </View>

      {/* Big value */}
      <Text
        className="text-fg text-[22px] font-bold tracking-tight leading-none"
        style={{ fontFamily: 'InterTight_700Bold' }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// StatGrid props
// ---------------------------------------------------------------------------

export interface StatGridProps {
  /** Current day streak count. */
  currentStreak: number;
  /** Total cards mastered. */
  masteredCards: number;
  /**
   * Study time for TODAY in SECONDS (today.study_time_seconds).
   * Formatted by formatStudyTime from src/lib/dashboard/format-study-time.ts.
   */
  studyTimeTodaySeconds: number;
  /**
   * All-time study time in SECONDS (overview.total_study_time_seconds).
   * Formatted by formatStudyTime from src/lib/dashboard/format-study-time.ts.
   */
  allTimeStudySeconds: number;
}

// ---------------------------------------------------------------------------
// StatGrid — public component
// ---------------------------------------------------------------------------

/**
 * 2×2 stat grid for the dashboard.
 *
 * Study times are formatted from seconds using `formatStudyTime` (the port of
 * the web timeFormatUtils.ts helper). All other stats are raw numbers.
 *
 * Layout: a plain column of two fixed rows. (A flex-wrap + w-full approach
 * rendered all four tiles on ONE line on native, squeezing and truncating
 * tile content — wrap forcing via width is unreliable in Yoga.)
 *
 * Usage:
 *   <StatGrid
 *     currentStreak={6}
 *     masteredCards={142}
 *     studyTimeTodaySeconds={720}
 *     allTimeStudySeconds={4860}
 *   />
 */
export function StatGrid({
  currentStreak,
  masteredCards,
  studyTimeTodaySeconds,
  allTimeStudySeconds,
}: StatGridProps) {
  const formattedTimeToday = formatStudyTime(studyTimeTodaySeconds);
  const formattedAllTime = formatStudyTime(allTimeStudySeconds);

  return (
    <View testID="stat-grid" className="gap-2 mx-[18px] mt-3">
      {/* Row 1 */}
      <View className="flex-row gap-2">
        <StatTile
          testID="stat-tile-streak"
          label="Streak"
          value={currentStreak}
          tone="amber"
          icon={<Flame size={12} />}
        />
        <StatTile
          testID="stat-tile-mastered"
          label="Mastered"
          value={masteredCards}
          tone="green"
          icon={<Check size={12} />}
        />
      </View>

      {/* Row 2 */}
      <View className="flex-row gap-2">
        <StatTile
          testID="stat-tile-time"
          label="Time today"
          value={formattedTimeToday}
          tone="primary"
          icon={<Clock size={12} />}
        />
        <StatTile
          testID="stat-tile-all-time"
          label="All time"
          value={formattedAllTime}
          tone="violet"
          icon={<Trophy size={12} />}
        />
      </View>
    </View>
  );
}
