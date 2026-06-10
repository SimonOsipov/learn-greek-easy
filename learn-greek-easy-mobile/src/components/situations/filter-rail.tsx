/**
 * SituationFilterRail — horizontally-scrolling pill row for the Practice tab (MOB-08).
 *
 * Pills: All · Ready · In progress · B1 · B2 · A2 (SITUATION_FILTERS).
 * The selected pill is filled primary; the rest are outline (bg-card / border-line).
 * Selection is owned by the parent screen — this rail is controlled.
 */
import { ScrollView, Pressable, Text } from 'react-native';

import { SITUATION_FILTERS, type SituationFilter } from '@/lib/situations/presentation';

export interface SituationFilterRailProps {
  selected: SituationFilter;
  onSelect: (filter: SituationFilter) => void;
}

export function SituationFilterRail({ selected, onSelect }: SituationFilterRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 }}
    >
      {SITUATION_FILTERS.map((filter) => {
        const on = filter === selected;
        return (
          <Pressable
            key={filter}
            testID={`situation-filter-${filter}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(filter)}
            className={
              on
                ? 'h-8 px-3.5 rounded-full bg-primary border border-primary justify-center'
                : 'h-8 px-3.5 rounded-full bg-card border border-line justify-center active:opacity-70'
            }
          >
            <Text
              className={
                on
                  ? 'text-on-photo text-[13px] font-semibold'
                  : 'text-fg text-[13px] font-semibold'
              }
            >
              {filter}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
