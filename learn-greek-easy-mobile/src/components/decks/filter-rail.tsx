/**
 * FilterRail — horizontally-scrolling pill row for the Decks library (MOB-07).
 *
 * Pills: All · Active · A1 · A2 · B1 · B2 (DECK_FILTERS). The selected pill is
 * filled primary; the rest are outline (bg-card / border-line). Selection is
 * local UI state owned by the parent screen — the rail is controlled.
 */
import { ScrollView, Pressable, Text } from 'react-native';

import { DECK_FILTERS, type DeckFilter } from '@/lib/decks/presentation';

export interface FilterRailProps {
  selected: DeckFilter;
  onSelect: (filter: DeckFilter) => void;
}

export function FilterRail({ selected, onSelect }: FilterRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 }}
    >
      {DECK_FILTERS.map((filter) => {
        const on = filter === selected;
        return (
          <Pressable
            key={filter}
            testID={`deck-filter-${filter}`}
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
