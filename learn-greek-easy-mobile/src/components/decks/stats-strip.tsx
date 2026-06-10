/**
 * StatsStrip — 3-up Due / Mastered / Cards card on the deck-detail screen
 * (MOB-07). Overlaps the cover hero by 12px (parent applies -mt-3 via margin).
 *
 * Big Inter Tight numbers, mono uppercase labels. Due is primary, Mastered is
 * the success token, Cards is fg (mock: Decks Mock.html › DeckDetail › stats).
 */
import { View, Text } from 'react-native';

export interface StatsStripProps {
  due: number;
  mastered: number;
  cards: number;
}

function Stat({
  label,
  value,
  valueClass,
  testID,
}: {
  label: string;
  value: number;
  valueClass: string;
  testID: string;
}) {
  return (
    <View className="flex-1 items-center">
      <Text
        testID={testID}
        className={`${valueClass} text-[24px] leading-none tracking-tight`}
        style={{ fontFamily: 'InterTight_700Bold' }}
      >
        {value}
      </Text>
      <Text
        className="text-fg3 text-[10px] font-bold tracking-[0.1em] uppercase mt-1"
        style={{ fontFamily: 'SpaceMono_400Regular' }}
      >
        {label}
      </Text>
    </View>
  );
}

export function StatsStrip({ due, mastered, cards }: StatsStripProps) {
  return (
    <View
      testID="deck-stats-strip"
      className="flex-row bg-card border border-line rounded-2xl px-3.5 py-3.5"
    >
      <Stat testID="deck-stat-due" label="Due" value={due} valueClass="text-primary" />
      <Stat testID="deck-stat-mastered" label="Mastered" value={mastered} valueClass="text-success" />
      <Stat testID="deck-stat-cards" label="Cards" value={cards} valueClass="text-fg" />
    </View>
  );
}
