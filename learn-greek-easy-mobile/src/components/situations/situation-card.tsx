/**
 * SituationCard — a single row in the Situations list (MOB-08).
 *
 * Left: 96px scene tile (gradient + monogram watermark, optional progress sliver).
 * Right: body column (level pill + meta, headline, gloss, exercise count).
 */
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  gradientForSituationId,
  monogramForScenario,
  clientStatusFor,
} from '@/lib/situations/presentation';
import { MissingDataDot } from '@/components/ui/missing-data-dot';
import type { SituationItem } from '@/types/situation';

// MOB-13: explicit rgba — no /NN modifier on var-backed tokens
const TILE_MARK_OPACITY = 'rgba(255,255,255,0.92)'; // on-photo-92

export interface SituationCardProps {
  item: SituationItem;
  onPress: (id: string) => void;
}

export function SituationCard({ item, onPress }: SituationCardProps) {
  const gradient = gradientForSituationId(item.id);
  const mark = monogramForScenario(item.scenario_el);
  const clientStatus = clientStatusFor(item.exercise_completed, item.exercise_total);
  const progressRatio =
    item.exercise_total > 0 ? item.exercise_completed / item.exercise_total : 0;

  const metaLabel = (() => {
    if (clientStatus === 'Completed') return '✓ COMPLETED';
    if (clientStatus === 'In progress')
      return `${item.exercise_completed}/${item.exercise_total} EXERCISES`;
    return `${item.exercise_total} EXERCISES`;
  })();

  return (
    <Pressable
      testID={`situation-card-${item.id}`}
      accessibilityRole="button"
      onPress={() => onPress(item.id)}
      className="rounded-[18px] overflow-hidden bg-card border border-line flex-row active:opacity-70"
      style={{ minHeight: 100 }}
    >
      {/* ── Scene tile (96px wide) ── */}
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 96, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        <Text
          style={{
            fontFamily: 'InterTight_700Bold',
            fontSize: 36,
            letterSpacing: -1.5,
            color: TILE_MARK_OPACITY,
            lineHeight: 40,
          }}
        >
          {mark}
        </Text>

        {/* Progress sliver */}
        {clientStatus === 'In progress' && (
          <View
            className="absolute bottom-0 left-0 right-0"
            style={{ height: 4, backgroundColor: 'rgba(0,0,0,0.20)' }}
          >
            <View
              style={{
                width: `${progressRatio * 100}%`,
                height: '100%',
                backgroundColor: 'rgba(255,255,255,0.92)',
              }}
            />
          </View>
        )}
      </LinearGradient>

      {/* ── Body column ── */}
      <View className="flex-1 py-3 px-3.5" style={{ minWidth: 0 }}>
        {/*
         * Level pill slot: the backend list endpoint (LearnerSituationListItem)
         * does not expose a `level` field — level is only available on the
         * situation detail response. The MissingDataDot marks the gap; replace
         * it with the real pill when the backend serialises level on the list
         * endpoint.
         */}
        <View className="flex-row items-center mb-1">
          <MissingDataDot testID={`situation-card-level-gap-${item.id}`} />
        </View>

        {/* Greek headline */}
        <Text
          testID={`situation-card-headline-${item.id}`}
          className="text-fg text-[14.5px] font-semibold leading-[19px]"
          style={{ fontFamily: 'NotoSerif_400Regular' }}
          numberOfLines={2}
        >
          {item.scenario_el}
        </Text>

        {/* English gloss */}
        <Text
          className="text-fg2 text-[12px] mt-0.5"
          numberOfLines={1}
        >
          {item.scenario_en}
        </Text>

        {/* Exercise meta */}
        <Text
          testID={`situation-card-meta-${item.id}`}
          className="text-fg3 text-[11px] mt-1.5 tracking-[0.04em]"
          style={{ fontFamily: 'SpaceMono_400Regular' }}
        >
          {metaLabel}
        </Text>
      </View>
    </Pressable>
  );
}
