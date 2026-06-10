/**
 * SessionSummary — end-of-session summary screen (MOB-09).
 *
 * Shows: check icon, "Session summary" heading, "Μπράβο.", 3-up stats row
 * (Reviewed / Total time / Avg per card), rating breakdown grid,
 * and Back to deck / Study more buttons.
 *
 * All stats are accumulated client-side. MOB-13: no /NN opacity modifier.
 */
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SessionStats } from '@/types/review';

// MOB-13: explicit rgba for tinted surfaces
const CORRECT_BG = 'rgba(20,184,103,0.12)';
const CORRECT_FG = 'rgb(20,184,103)';

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export interface SessionSummaryProps {
  stats: SessionStats;
  isDark: boolean;
  onBackToDeck: () => void;
  onStudyMore: () => void;
  testID?: string;
}

export function SessionSummary({
  stats,
  isDark,
  onBackToDeck,
  onStudyMore,
  testID,
}: SessionSummaryProps) {
  const insets = useSafeAreaInsets();

  const avgSeconds = stats.reviewed > 0
    ? Math.round(stats.total_time_seconds / stats.reviewed)
    : 0;
  const accuracy = stats.reviewed > 0
    ? Math.round(((stats.good_count + stats.easy_count) / stats.reviewed) * 100)
    : 0;

  const statCardBg = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.06)';
  const statBorderColor = isDark ? 'rgba(148,163,184,0.14)' : 'rgba(100,116,139,0.12)';
  const accentFg = isDark ? 'rgb(129,140,248)' : 'rgb(79,70,229)'; // --practice-accent

  return (
    <ScrollView
      testID={testID ?? 'review-session-summary'}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
      className="flex-1"
    >
      {/* ── Check icon ── */}
      <View className="items-center mb-5">
        <View
          className="w-16 h-16 rounded-[20px] items-center justify-center mb-4"
          style={{ backgroundColor: CORRECT_BG }}
        >
          <Check size={32} color={CORRECT_FG} strokeWidth={2.5} />
        </View>
        <Text
          testID="review-summary-heading"
          className="text-practice-text text-[28px] font-bold tracking-tight mb-1"
          style={{ fontFamily: 'InterTight_700Bold', letterSpacing: -0.8 }}
        >
          Session summary
        </Text>
        <Text
          className="text-practice-text-muted text-[16px]"
          style={{ fontFamily: 'NotoSerif_400Regular_Italic' }}
        >
          Μπράβο.
        </Text>
      </View>

      {/* ── 3-up stats row ── */}
      <View className="flex-row gap-2 px-4 mb-3">
        {[
          { label: 'Reviewed', value: String(stats.reviewed) },
          { label: 'Total time', value: formatTime(stats.total_time_seconds) },
          { label: 'Avg / card', value: formatTime(avgSeconds) },
        ].map((s) => (
          <View
            key={s.label}
            className="flex-1 rounded-lg px-3 py-3 items-center"
            style={{
              backgroundColor: statCardBg,
              borderWidth: 1,
              borderColor: statBorderColor,
            }}
          >
            <Text
              testID={`review-summary-stat-${s.label.toLowerCase().replace(/[^a-z]/g, '-')}`}
              className="text-practice-text text-[22px] font-bold mb-0.5"
              style={{ fontFamily: 'InterTight_700Bold' }}
            >
              {s.value}
            </Text>
            <Text
              className="text-practice-text-dim text-[10px] font-bold uppercase tracking-wider text-center"
              style={{ fontFamily: 'SpaceMono_400Regular' }}
            >
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Accuracy note ── */}
      <View className="px-4 mb-3">
        <Text className="text-practice-text-muted text-[13px] text-center">
          {accuracy}% correct (Good + Easy)
        </Text>
      </View>

      {/* ── Rating breakdown ── */}
      <View
        className="mx-4 rounded-lg px-4 py-3 mb-5"
        style={{ backgroundColor: statCardBg, borderWidth: 1, borderColor: statBorderColor }}
      >
        <Text
          testID="review-summary-breakdown-label"
          className="text-practice-text-dim text-[10px] font-bold uppercase tracking-wider mb-3"
          style={{ fontFamily: 'SpaceMono_400Regular' }}
        >
          Rating breakdown
        </Text>
        <View className="flex-row gap-2">
          {[
            { label: 'Again', count: stats.again_count, color: 'rgb(220,38,38)' },
            { label: 'Hard',  count: stats.hard_count,  color: 'rgb(234,119,23)' },
            { label: 'Good',  count: stats.good_count,  color: 'rgb(20,184,103)' },
            { label: 'Easy',  count: stats.easy_count,  color: isDark ? 'rgb(129,140,248)' : 'rgb(79,70,229)' },
          ].map((r) => (
            <View key={r.label} className="flex-1 items-center">
              <Text
                testID={`review-summary-${r.label.toLowerCase()}-count`}
                className="text-[20px] font-bold mb-0.5"
                style={{ fontFamily: 'InterTight_700Bold', color: r.color }}
              >
                {r.count}
              </Text>
              <Text
                className="text-practice-text-dim text-[10px] font-bold uppercase"
                style={{ fontFamily: 'SpaceMono_400Regular' }}
              >
                {r.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Buttons ── */}
      <View className="flex-row gap-2 px-4">
        <Pressable
          testID="review-summary-back-btn"
          accessibilityRole="button"
          onPress={onBackToDeck}
          className="flex-1 py-3.5 rounded-lg items-center justify-center border border-practice-border active:opacity-70"
        >
          <Text className="text-practice-text text-[15px] font-semibold">Back to deck</Text>
        </Pressable>
        <Pressable
          testID="review-summary-study-more-btn"
          accessibilityRole="button"
          onPress={onStudyMore}
          className="flex-1 py-3.5 rounded-lg items-center justify-center active:opacity-70"
          style={{ backgroundColor: accentFg }}
        >
          <Text className="text-[15px] font-bold" style={{ color: '#fff' }}>Study more</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
