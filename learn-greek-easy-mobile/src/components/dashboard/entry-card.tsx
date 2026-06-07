/**
 * EntryCard — tinted dashboard card used in the "Review + Goal" pair.
 *
 * Pure presentational component (no hooks). The parent screen passes all data.
 *
 * Two tones supported:
 *   'violet' — review card (280 70% 60% palette — accent purple)
 *   'amber'  — goal card   (38 92% 55% palette — warm amber)
 *
 * MOB-13 SAFE: tone tints use explicit <base>-<NN> rgba tokens registered in
 * tailwind.config.js (entry-violet, entry-violet-16, entry-violet-32, etc.).
 * No /NN modifier on any var-backed token in this file.
 *
 * Design reference: Dashboard Mock.html › EntryCard.
 *
 * ReviewGoalPair — convenience layout wrapper that renders one violet review
 * card and one amber goal card side-by-side (1fr/1fr with gap).
 *
 * Goal rendered in CARDS (OPEN DECISION D2 default): shows `{cardsDone} / {goal} cards today`.
 * The daily_goal field from the progress dashboard is in cards, not minutes.
 */
import { View, Text } from 'react-native';
import { cloneElement } from 'react';
import type { ReactNode, ReactElement } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntryCardTone = 'violet' | 'amber';

export interface EntryCardStatProps {
  /** Big Inter Tight number (can be string for e.g. "18"). */
  value: string | number;
  /** Small label next to the stat value. */
  label: ReactNode;
}

export interface EntryCardProps {
  /** Visual tone — determines icon/accent colour. */
  tone: EntryCardTone;
  /** Mono uppercase eyebrow label (e.g. "TODAY'S REVIEW"). */
  kicker: string;
  /** Lucide icon element rendered at 13×13 inside the tinted icon badge. */
  icon: ReactNode;
  /** Primary title line (Inter Tight bold). */
  title: string;
  /** Body copy (smaller, text-fg2). */
  body: ReactNode;
  /**
   * Optional progress bar fill ratio 0..1.
   * Only rendered when provided (daily-goal card uses it; review card does not).
   */
  progress?: number;
  /**
   * Optional big stat shown at the bottom of the card.
   * e.g. { value: 18, label: "min total" } or { value: streak, label: "day streak 🔥" }
   */
  stat?: EntryCardStatProps;
}

// ---------------------------------------------------------------------------
// Tone maps (all MOB-13 explicit rgba token names from tailwind.config.js)
// ---------------------------------------------------------------------------

/**
 * Maps each tone to the Tailwind utility class names for its three colour roles.
 * All values are explicit rgba tokens — no /NN modifier on var-backed tokens.
 */
const TONE_CLASSES: Record<
  EntryCardTone,
  { iconBg: string; iconFg: string; statFg: string; progressFill: string }
> = {
  violet: {
    iconBg:       'bg-entry-violet-16',
    iconFg:       'text-entry-violet',
    statFg:       'text-entry-violet',
    progressFill: 'bg-entry-violet',
  },
  amber: {
    iconBg:       'bg-entry-amber-16',
    iconFg:       'text-entry-amber',
    statFg:       'text-entry-amber',
    progressFill: 'bg-entry-amber',
  },
};

/**
 * Raw icon color strings per tone — used to inject `color` directly into the
 * lucide icon element via cloneElement, since React Native Views do NOT inherit
 * text color from a parent className. Values match the explicit rgba tokens in
 * tailwind.config.js (entry-violet / entry-amber).
 */
const TONE_ICON_COLOR: Record<EntryCardTone, string> = {
  violet: 'rgb(177,82,224)',  // entry-violet  280 70% 60%
  amber:  'rgb(246,168,35)',  // entry-amber   38  92% 55%
};

// ---------------------------------------------------------------------------
// EntryCard
// ---------------------------------------------------------------------------

export function EntryCard({
  tone,
  kicker,
  icon,
  title,
  body,
  progress,
  stat,
}: EntryCardProps) {
  const T = TONE_CLASSES[tone];
  // Clamp progress to [0, 1].
  const clampedProgress =
    progress !== undefined ? Math.min(1, Math.max(0, progress)) : undefined;
  // DimensionValue permits `${number}%` — cast satisfies tsc without runtime change.
  const progressPercent: `${number}%` =
    clampedProgress !== undefined
      ? (`${Math.round(clampedProgress * 100)}%` as `${number}%`)
      : '0%';

  return (
    <View
      testID={`entry-card-${tone}`}
      className="bg-bg-2 border border-line rounded-[16px] p-3.5 flex-1 gap-2 overflow-hidden"
      style={{ minHeight: 138 }}
    >
      {/* ── Icon + kicker row ── */}
      <View className="flex-row items-center gap-2">
        {/* Tinted icon badge */}
        <View
          testID={`entry-card-icon-${tone}`}
          className={`w-6 h-6 rounded-[7px] items-center justify-center ${T.iconBg}`}
        >
          {/* Inject the tone color directly into the icon element — React Native Views
              do NOT inherit color from className, so lucide icons need an explicit prop. */}
          <View style={{ width: 13, height: 13 }}>
            {icon && typeof icon === 'object' && 'type' in icon
              ? cloneElement(icon as ReactElement<{ color?: string }>, {
                  color: TONE_ICON_COLOR[tone],
                })
              : icon}
          </View>
        </View>
        {/* Mono kicker */}
        <Text
          testID={`entry-card-kicker-${tone}`}
          className="text-fg3 text-[9.5px] uppercase tracking-[0.12em] flex-1"
          style={{ fontFamily: 'SpaceMono_400Regular' }}
          numberOfLines={1}
        >
          {kicker}
        </Text>
      </View>

      {/* ── Title ── */}
      <Text
        testID={`entry-card-title-${tone}`}
        className="text-fg text-[14.5px] font-bold leading-tight tracking-tight"
        style={{ fontFamily: 'InterTight_700Bold' }}
        numberOfLines={2}
      >
        {title}
      </Text>

      {/* ── Body copy ── */}
      <Text
        testID={`entry-card-body-${tone}`}
        className="text-fg2 text-[11.5px] leading-relaxed"
      >
        {body}
      </Text>

      {/* ── Progress bar (optional) ── */}
      {clampedProgress !== undefined && (
        <View
          testID={`entry-card-progress-track-${tone}`}
          className="h-[5px] rounded-full overflow-hidden"
          style={{ position: 'relative' }}
        >
          {/* Track background: use the 16-alpha tone token (same as icon badge bg),
              giving a subtle tinted track. MOB-13 safe — explicit rgba token, no /NN. */}
          <View
            className={`absolute inset-0 rounded-full ${T.iconBg}`}
            pointerEvents="none"
          />
          {/* Progress fill on top */}
          <View
            testID={`entry-card-progress-fill-${tone}`}
            className={`h-full rounded-full ${T.progressFill}`}
            style={{ width: progressPercent }}
          />
        </View>
      )}

      {/* ── Big stat at bottom (optional) ── */}
      {stat !== undefined && (
        <View
          testID={`entry-card-stat-${tone}`}
          className="flex-row items-baseline gap-1.5 mt-auto"
        >
          <Text
            testID={`entry-card-stat-value-${tone}`}
            className={`text-[21px] font-bold tracking-tight leading-none ${T.statFg}`}
            style={{ fontFamily: 'InterTight_700Bold' }}
          >
            {stat.value}
          </Text>
          <Text
            testID={`entry-card-stat-label-${tone}`}
            className="text-fg3 text-[10.5px] font-semibold"
          >
            {stat.label}
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ReviewGoalPair — convenience 1fr/1fr layout wrapper
// ---------------------------------------------------------------------------

export interface ReviewGoalPairProps {
  /** Props for the violet "Today's review" card. */
  reviewProps: Omit<EntryCardProps, 'tone'>;
  /** Props for the amber "Daily goal" card. */
  goalProps: Omit<EntryCardProps, 'tone'>;
}

/**
 * Renders the violet review card and amber goal card side-by-side
 * with equal width (flex-row + flex-1 on each card) and a 10px gap.
 * Positioned inside the horizontal 18px gutter of the dashboard screen.
 */
export function ReviewGoalPair({ reviewProps, goalProps }: ReviewGoalPairProps) {
  return (
    <View
      testID="review-goal-pair"
      className="flex-row gap-2.5 mx-[18px] mt-3.5"
    >
      <EntryCard tone="violet" {...reviewProps} />
      <EntryCard tone="amber" {...goalProps} />
    </View>
  );
}
