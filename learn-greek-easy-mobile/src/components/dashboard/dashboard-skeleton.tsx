/**
 * DashboardSkeleton — per-section placeholder shown during initial dashboard load.
 *
 * Rendered by HomeScreen while isLoading=true / isNewUser=undefined (the "blank
 * state" guard from DASH-09) instead of the bare ActivityIndicator.
 *
 * Structure mirrors the returning-user layout order:
 *   1. Greeting bar skeleton
 *   2. Progress band skeleton (one line)
 *   3. Continue-hero placeholder card
 *   4. Two-card entry-pair row
 *   5. Shelf skeleton (kicker + row of card placeholders)  × 3
 *
 * Token rules (MOB-13):
 *   - bg-bg-2, bg-line, bg-card — solid var-backed tokens, NO /NN modifier.
 *   - Element-level opacity-NN is used for the shimmer pulse (safe: maps to
 *     React Native style.opacity, unaffected by the color-mix() bug).
 *   - When reduceMotion=true, the Animated shimmer loop is skipped; blocks render
 *     as static fills (same colours, no animation).
 *
 * Also exports SectionError — a compact inline error/empty state used when a
 * single shelf's query fails without blanking sibling sections.
 */
import { useEffect, useState } from 'react';
import { View, Text, Animated, Pressable } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardSkeletonProps {
  /** When true, skip the animated shimmer and render static placeholder fills. */
  reduceMotion?: boolean;
}

export interface SectionErrorProps {
  /** Human-readable section label shown in "Couldn't load <label>" */
  label: string;
  /** Called when the user taps the retry link. */
  onRetry: () => void;
  testID?: string;
}

// ---------------------------------------------------------------------------
// SectionError — compact inline error/empty state for a single shelf
// ---------------------------------------------------------------------------

/**
 * One-line inline error indicator for a failed shelf query.
 * Does NOT blank the page — it occupies only its own slot so sibling sections
 * remain fully rendered.
 */
export function SectionError({ label, onRetry, testID }: SectionErrorProps) {
  return (
    <View
      testID={testID ?? 'section-error'}
      className="mx-[18px] my-3 px-4 py-3 rounded-xl bg-card border border-line flex-row items-center justify-between"
    >
      <Text className="text-fg3 text-[13px]">Couldn&apos;t load {label}</Text>
      <Pressable onPress={onRetry} testID={`${testID ?? 'section-error'}-retry`}>
        <Text className="text-primary text-[13px] font-semibold">Retry</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Internal skeleton primitives
// ---------------------------------------------------------------------------

/** A single rectangular placeholder block with optional rounded corners. */
function SkeletonBlock({
  className,
  style,
  testID,
}: {
  className?: string;
  style?: object;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      className={`bg-line rounded-lg ${className ?? ''}`}
      style={style}
    />
  );
}

/** Shimmer wrapper — animates opacity between 0.4 and 1.0 on a 1.2 s loop.
 *  When reduceMotion is true, renders the child at static opacity-60 instead.
 */
function ShimmerWrapper({
  reduceMotion,
  children,
}: {
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    if (reduceMotion) {
      // Static fill — no animation loop
      opacity.setValue(0.6);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1.0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

// ---------------------------------------------------------------------------
// Section-level skeletons
// ---------------------------------------------------------------------------

/** Greeting bar: avatar circle + two text lines on the left, streak chip on right */
function GreetingBarSkeleton() {
  return (
    <View
      testID="skeleton-greeting"
      className="flex-row items-center gap-2.5 pt-14 pb-3 px-[18px]"
    >
      {/* Left: two text lines */}
      <View className="flex-1 gap-2">
        <SkeletonBlock className="h-2.5 w-24 rounded-full" />
        <SkeletonBlock className="h-7 w-40 rounded-full" />
      </View>
      {/* Right: streak chip + avatar */}
      <View className="flex-row items-center gap-2">
        <SkeletonBlock className="h-[30px] w-16 rounded-full" />
        <SkeletonBlock className="w-9 h-9 rounded-full" />
      </View>
    </View>
  );
}

/** Progress band: one-line text + 7 heat cells */
function ProgressBandSkeleton() {
  return (
    <View testID="skeleton-progress" className="mx-[18px] gap-2.5 mt-1">
      <SkeletonBlock className="h-3 w-48 rounded-full" />
      {/* 7 heat cells */}
      <View className="flex-row gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-6 flex-1 rounded-md" />
        ))}
      </View>
    </View>
  );
}

/** Continue-hero card placeholder */
function HeroSkeleton() {
  return (
    <View testID="skeleton-hero" className="mx-[18px] mt-3.5 h-[140px] rounded-2xl bg-card border border-line" />
  );
}

/** Pair of entry cards (review / goal) */
function EntryPairSkeleton() {
  return (
    <View testID="skeleton-entry-pair" className="flex-row gap-3 mx-[18px] mt-3.5">
      <View className="flex-1 h-[120px] rounded-2xl bg-card border border-line" />
      <View className="flex-1 h-[120px] rounded-2xl bg-card border border-line" />
    </View>
  );
}

/** A shelf row: kicker + title line + horizontal row of card placeholders */
function ShelfRowSkeleton({
  testID,
  cardCount = 3,
  cardWidth = 200,
  cardHeight = 110,
}: {
  testID?: string;
  cardCount?: number;
  cardWidth?: number;
  cardHeight?: number;
}) {
  return (
    <View testID={testID} className="mt-5">
      {/* Kicker + title lines */}
      <View className="mx-[18px] gap-1.5 mb-3">
        <SkeletonBlock className="h-2.5 w-14 rounded-full" />
        <SkeletonBlock className="h-5 w-36 rounded-full" />
      </View>
      {/* Horizontal card placeholders — not wrapped in a ScrollView so they
          clip naturally; the skeleton doesn't need to be scrollable. */}
      <View className="flex-row gap-3 pl-[18px]">
        {Array.from({ length: cardCount }).map((_, i) => (
          <View
            key={i}
            style={{ width: cardWidth, height: cardHeight }}
            className="rounded-2xl bg-card border border-line"
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DashboardSkeleton — public component
// ---------------------------------------------------------------------------

export function DashboardSkeleton({ reduceMotion = false }: DashboardSkeletonProps) {
  return (
    <ShimmerWrapper reduceMotion={reduceMotion}>
      <View testID="dashboard-skeleton">
        <GreetingBarSkeleton />
        <ProgressBandSkeleton />
        <HeroSkeleton />
        <EntryPairSkeleton />
        <ShelfRowSkeleton testID="skeleton-shelf-news" cardWidth={260} cardHeight={130} />
        <ShelfRowSkeleton testID="skeleton-shelf-situations" cardWidth={240} cardHeight={110} />
        <ShelfRowSkeleton testID="skeleton-shelf-decks" cardWidth={170} cardHeight={120} />
      </View>
    </ShimmerWrapper>
  );
}
