/**
 * WhatsNewChips — the "WHAT'S NEW" label + chip strip below the Review/Goal pair.
 *
 * Pure presentational component (no hooks). The parent screen passes:
 *   - audioCount  — number of news items with B1 audio
 *   - countryCounts — items per country (cypress, greece, world)
 *   - onNewsPress   — navigate to news list
 *   - onAudioPress  — navigate to B1 audio filtered news
 *   - onComingSoon  — called when the "new dialogs" chip is pressed (fires the toast)
 *
 * "New dialogs" chip behaviour:
 *   The chip carries the DASH-04 ComingSoonDot (red dot) + Kicker comingSoon affordance.
 *   Its onPress calls `showComingSoonToast()` and does NOT navigate.
 *
 * MOB-13 SAFE: all colours are design tokens. The green dot on the section label uses
 * `bg-whats-new-green` (explicit rgb() token in tailwind.config.js — no /NN modifier).
 *
 * Design reference: Dashboard Mock.html — chip strip uses bg-bg-2 container,
 * chips in the mock use a 4%-opacity fg tint which we approximate with bg-card since
 * the slash-opacity modifier on var-backed tokens is forbidden on native (MOB-13).
 * The visual result is nearly identical.
 */
import { View, Text, Pressable } from 'react-native';

import { ComingSoonDot } from '@/components/dashboard/coming-soon-dot';
import type { WhatsNewCounts } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WhatsNewChipsProps {
  /** From useDashboard().whatsNew */
  counts: WhatsNewCounts;
  /** Called when a live news chip is pressed (navigate to news list). */
  onNewsPress: () => void;
  /** Called when the B1 audio chip is pressed (navigate to audio filtered news). */
  onAudioPress: () => void;
  /**
   * Called when the "new dialogs" coming-soon chip is pressed.
   * The parent should call showComingSoonToast() here; this component
   * does NOT import useToast directly so it stays purely presentational + testable.
   */
  onComingSoon: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single live (navigable) chip. */
function LiveChip({
  count,
  label,
  onPress,
  testID,
}: {
  count: number;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      className="flex-row items-center gap-1.5 h-[26px] px-3 rounded-full bg-card border border-line"
      accessibilityRole="button"
    >
      <Text
        className="text-fg text-[11px] font-bold"
        style={{ fontFamily: 'SpaceMono_400Regular' }}
      >
        {count}
      </Text>
      <Text className="text-fg2 text-[11px]">{label}</Text>
    </Pressable>
  );
}

/** The "new dialogs" coming-soon chip with a red dot. */
function ComingSoonChip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="whats-new-chip-dialogs"
      onPress={onPress}
      className="flex-row items-center gap-1.5 h-[26px] px-3 rounded-full bg-card border border-line"
      accessibilityRole="button"
    >
      <ComingSoonDot />
      <Text className="text-fg2 text-[11px]">new dialogs</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// WhatsNewChips
// ---------------------------------------------------------------------------

export function WhatsNewChips({
  counts,
  onNewsPress,
  onAudioPress,
  onComingSoon,
}: WhatsNewChipsProps) {
  // Total news items count: sum across all countries.
  const totalNews =
    (counts.country_counts.cyprus ?? 0) +
    (counts.country_counts.greece ?? 0) +
    (counts.country_counts.world ?? 0);

  return (
    <View
      testID="whats-new-chips"
      className="mx-[18px] mt-3.5 flex-row flex-wrap items-center gap-2 px-3 py-2.5 bg-bg-2 border border-line rounded-[12px]"
    >
      {/* ── Section label: "WHAT'S NEW" with green dot ── */}
      <View className="flex-row items-center gap-1.5">
        {/* Green dot — bg-whats-new-green explicit rgb token (MOB-13 safe) */}
        <View
          testID="whats-new-green-dot"
          className="w-[5px] h-[5px] rounded-full bg-whats-new-green"
        />
        <Text
          testID="whats-new-label"
          className="text-fg3 text-[9.5px] uppercase tracking-[0.10em]"
          style={{ fontFamily: 'SpaceMono_400Regular' }}
        >
          What's new
        </Text>
      </View>

      {/* ── Live chip: N news items ── (only shown when count > 0) */}
      {totalNews > 0 && (
        <LiveChip
          testID="whats-new-chip-news"
          count={totalNews}
          label="news items"
          onPress={onNewsPress}
        />
      )}

      {/* ── Live chip: N got B1 audio ── (only shown when count > 0) */}
      {counts.audio_count > 0 && (
        <LiveChip
          testID="whats-new-chip-audio"
          count={counts.audio_count}
          label="got B1 audio"
          onPress={onAudioPress}
        />
      )}

      {/* ── Coming-soon chip: new dialogs (always shown with red dot) ── */}
      {counts.newDialogsComingSoon && (
        <ComingSoonChip onPress={onComingSoon} />
      )}
    </View>
  );
}
