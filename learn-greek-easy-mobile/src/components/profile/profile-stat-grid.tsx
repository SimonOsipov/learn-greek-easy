/**
 * ProfileStatGrid — 2×2 stat tiles for the You / profile screen.
 *
 * Tiles (differs from dashboard StatGrid):
 *   (1) Day Streak  — amber  — flame  — raw number
 *   (2) Mastered    — green  — check  — raw number + " words" suffix
 *   (3) Total Time  — primary — clock — formatted from allTimeSeconds
 *   (4) Best Streak — violet — trophy — raw number + " days" suffix
 *
 * MOB-13 SAFE: icon badges use explicit <base>-14 rgba tokens from
 * tailwind.config.js (stat-amber-14, stat-green-14, stat-primary-14,
 * stat-violet-14). No /NN modifier on any hsl var-backed token.
 *
 * Layout: column of two flex-row pairs (same pattern as StatGrid in
 * src/components/dashboard/stat-grid.tsx — avoids Yoga wrap issues).
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
  /** testID applied to the value <Text> element. */
  valueTestID?: string;
  label: string;
  value: string;
  tone: StatTone;
  icon: ReactNode;
}

// ---------------------------------------------------------------------------
// Tone map — MOB-13 explicit rgba tokens (no /NN on var-backed tokens)
// ---------------------------------------------------------------------------

const TONE_CLASSES: Record<StatTone, { bg: string; fg: string }> = {
  amber:   { bg: 'bg-stat-amber-14',   fg: 'text-entry-amber'   },
  green:   { bg: 'bg-stat-green-14',   fg: 'text-stat-green'    },
  primary: { bg: 'bg-stat-primary-14', fg: 'text-primary'       },
  violet:  { bg: 'bg-stat-violet-14',  fg: 'text-stat-violet'   },
};

// ---------------------------------------------------------------------------
// StatTile — single tile
// ---------------------------------------------------------------------------

function StatTile({ testID, valueTestID, label, value, tone, icon }: StatTileProps) {
  const T = TONE_CLASSES[tone];
  return (
    <View
      testID={testID}
      className="bg-card border border-line rounded-[14px] p-[14px] flex-col gap-1.5 flex-1"
    >
      {/* Label + icon row */}
      <View className="flex-row items-center justify-between">
        <Text
          className="text-fg3 uppercase"
          style={{
            fontFamily: 'SpaceMono_400Regular',
            fontSize: 9.5,
            letterSpacing: 0.76,
          }}
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

      {/* Value */}
      <Text
        testID={valueTestID}
        className="text-fg leading-none"
        style={{
          fontFamily: 'InterTight_700Bold',
          fontSize: 22,
          fontWeight: '700',
          letterSpacing: -0.44,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ProfileStatGrid — props
// ---------------------------------------------------------------------------

export interface ProfileStatGridProps {
  /** Current day streak count. */
  currentStreak: number;
  /** Total cards mastered. */
  masteredCards: number;
  /** All-time study time in SECONDS (overview.total_study_time_seconds). */
  allTimeSeconds: number;
  /** Longest streak in days. */
  bestStreak: number;
}

// ---------------------------------------------------------------------------
// ProfileStatGrid — public component
// ---------------------------------------------------------------------------

export function ProfileStatGrid({
  currentStreak,
  masteredCards,
  allTimeSeconds,
  bestStreak,
}: ProfileStatGridProps) {
  const formattedAllTime = formatStudyTime(allTimeSeconds);

  return (
    <View testID="profile-stat-grid" className="gap-[10px] px-[18px]">
      {/* Row 1 */}
      <View className="flex-row gap-[10px]">
        <StatTile
          testID="profile-stat-streak"
          valueTestID="profile-stat-streak-value"
          label="Day streak"
          value={String(currentStreak)}
          tone="amber"
          icon={<Flame size={12} />}
        />
        <StatTile
          testID="profile-stat-mastered"
          valueTestID="profile-stat-mastered-value"
          label="Mastered"
          value={`${masteredCards} words`}
          tone="green"
          icon={<Check size={12} />}
        />
      </View>

      {/* Row 2 */}
      <View className="flex-row gap-[10px]">
        <StatTile
          testID="profile-stat-time"
          valueTestID="profile-stat-time-value"
          label="Total time"
          value={formattedAllTime}
          tone="primary"
          icon={<Clock size={12} />}
        />
        <StatTile
          testID="profile-stat-best-streak"
          valueTestID="profile-stat-best-streak-value"
          label="Best streak"
          value={`${bestStreak} days`}
          tone="violet"
          icon={<Trophy size={12} />}
        />
      </View>
    </View>
  );
}
