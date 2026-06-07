/**
 * SituationCard — 240 px wide card for the "Practice situations" shelf.
 *
 * Layout (top → bottom):
 *   - Gradient scene header (84 px) via gradientForId, with Greek monogram centred.
 *   - Body: Greek title (scenario_el, 2-line clamp).
 *   - Subline: "{exercise_total} exercises" ONLY — no domain, no level.
 *
 * Pure presentational — no hooks. Parent passes the SituationItem + an onPress handler.
 *
 * Design reference: Dashboard Mock.html › SituationCard.
 */
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { gradientForId } from '@/lib/dashboard/gradients';
import type { SituationItem } from '@/types/situation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a 2-letter Greek monogram from the scenario_el text.
 * Takes the first 2 characters of the first word (after stripping "Η ", "Ο ", "Το ", etc.).
 */
function monogram(scenario_el: string): string {
  // Strip common Greek articles at the start
  const withoutArticle = scenario_el.replace(/^(Η |Ο |Το |Τα |Οι |Τη )/u, '');
  // Return the first 2 characters of the first word
  const firstWord = withoutArticle.split(' ')[0] ?? scenario_el;
  return firstWord.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SituationCardProps {
  item: SituationItem;
  /** Called when the card is pressed; routes to situation detail / tab. */
  onPress: (id: string) => void;
}

// ---------------------------------------------------------------------------
// SituationCard
// ---------------------------------------------------------------------------

/**
 * A 240 px wide card showing a situation learning scenario.
 * Subline shows ONLY "N exercises" — no domain, no level (per acceptance criterion #2).
 */
export function SituationCard({ item, onPress }: SituationCardProps) {
  const gradientColors = gradientForId(item.id) as [string, string, ...string[]];
  const mark = monogram(item.scenario_el);

  return (
    <Pressable
      testID={`situation-card-${item.id}`}
      onPress={() => onPress(item.id)}
      style={{ width: 240 }}
      className="rounded-[16px] overflow-hidden bg-bg-2 border border-line flex-col"
    >
      {/* ── Gradient scene header ── */}
      <LinearGradient
        testID="situation-card-gradient"
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 84, alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Greek monogram */}
        <Text
          testID="situation-card-monogram"
          className="text-on-photo-92 text-[36px] font-extrabold tracking-tight"
          style={{ fontFamily: 'InterTight_700Bold', color: 'rgba(255,255,255,0.92)' }}
        >
          {mark}
        </Text>
      </LinearGradient>

      {/* ── Body ── */}
      <View className="p-3.5 pb-4 flex-1 flex-col">
        {/* Greek title — 2-line clamp, serif */}
        <Text
          testID="situation-card-title"
          className="text-fg text-[13.5px] font-semibold leading-snug"
          style={{ fontFamily: 'NotoSerif_600SemiBold', minHeight: 36 }}
          numberOfLines={2}
        >
          {item.scenario_el}
        </Text>

        {/* Subline: "N exercises" ONLY — no domain, no level */}
        <Text
          testID="situation-card-subline"
          className="text-fg3 text-[11.5px] mt-1"
        >
          {item.exercise_total} exercises
        </Text>
      </View>
    </Pressable>
  );
}
