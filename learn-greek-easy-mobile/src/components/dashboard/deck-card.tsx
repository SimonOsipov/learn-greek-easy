/**
 * DeckCard — 170 px wide card for the "Your decks" shelf.
 *
 * Layout:
 *   - 170×170 gradient cover (gradientForId(deck.id)) with:
 *       · Level pill (top-left)
 *       · Due-cards pill (top-right, only when cards are due)
 *       · Greek monogram watermark (right, faint)
 *       · Title + Greek subtitle + progress bar (bottom)
 *   - Caption below the cover: "{mastered}/{total} mastered"
 *
 * Pure presentational — no hooks. Parent passes the DeckWithProgress + onPress.
 *
 * Design reference: Dashboard Mock.html › DeckCard.
 */
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { gradientForId } from '@/lib/dashboard/gradients';
import type { DeckWithProgress } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DeckCardProps {
  deck: DeckWithProgress;
  /** Called when the card is pressed; routes to deck detail / study. */
  onPress: (id: string) => void;
}

// ---------------------------------------------------------------------------
// DeckCard
// ---------------------------------------------------------------------------

/**
 * A 170 px wide card showing a deck with gradient cover and progress.
 *
 * caption: "{mastered}/{total} mastered"
 */
export function DeckCard({ deck, onPress }: DeckCardProps) {
  const gradientColors = gradientForId(deck.id) as [string, string, ...string[]];

  // Derived progress values from joined progress data
  const mastered = deck.progress?.cards_mastered ?? 0;
  const total = deck.card_count;
  const due = deck.progress?.cards_due ?? 0;
  const progressRatio = total > 0 ? Math.max(0, Math.min(1, mastered / total)) : 0;
  const progressPercent: `${number}%` = `${Math.round(progressRatio * 100)}%`;

  // First 2 chars of deck name as monogram
  const mark = (deck.name_el ?? deck.name).slice(0, 2);

  return (
    <Pressable
      testID={`deck-card-${deck.id}`}
      onPress={() => onPress(deck.id)}
      style={{ width: 170 }}
    >
      {/* ── Gradient cover ── */}
      <LinearGradient
        testID="deck-card-gradient"
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 170, borderRadius: 16, padding: 14, position: 'relative', overflow: 'hidden' }}
      >
        {/* Watermark monogram */}
        <Text
          className="absolute text-on-photo-18 text-[100px] font-extrabold leading-none tracking-tight"
          style={{
            fontFamily: 'InterTight_700Bold',
            right: -10,
            top: -8,
          }}
        >
          {mark}
        </Text>

        {/* Pills row */}
        <View className="flex-row justify-between items-start" style={{ position: 'relative' }}>
          {/* Level pill */}
          <View className="bg-on-photo-18 px-2 py-[3px] rounded-full">
            <Text
              testID="deck-card-level"
              className="text-on-photo-96 text-[10px] font-bold tracking-[0.06em] uppercase"
              style={{ fontFamily: 'SpaceMono_400Regular' }}
            >
              {deck.level}
            </Text>
          </View>

          {/* Due pill (only when cards are due) */}
          {due > 0 ? (
            <View className="bg-on-photo-scrim-42 px-2 py-[3px] rounded-full">
              <Text
                testID="deck-card-due"
                className="text-on-photo-96 text-[10px] font-bold"
                style={{ fontFamily: 'SpaceMono_400Regular' }}
              >
                {due} due
              </Text>
            </View>
          ) : null}
        </View>

        {/* Bottom info: title + Greek subtitle + progress */}
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
          <Text
            testID="deck-card-title"
            className="text-on-photo-96 text-[16px] font-bold tracking-tight leading-tight"
            style={{ fontFamily: 'InterTight_700Bold' }}
            numberOfLines={2}
          >
            {deck.name}
          </Text>
          {deck.name_el ? (
            <Text
              testID="deck-card-title-el"
              className="text-on-photo-78 text-[11px] mt-0.5"
              style={{ fontFamily: 'NotoSerif_400Regular' }}
              numberOfLines={1}
            >
              {deck.name_el}
            </Text>
          ) : null}

          {/* Progress bar */}
          <View
            className="mt-2 h-1 rounded-full bg-on-photo-22 overflow-hidden"
          >
            <View
              testID="deck-card-progress-fill"
              className="h-full rounded-full bg-on-photo-92"
              style={{ width: progressPercent }}
            />
          </View>
        </View>
      </LinearGradient>

      {/* ── Caption below the cover ── */}
      <Text
        testID="deck-card-caption"
        className="text-fg3 text-[11px] mt-1.5"
      >
        {mastered}/{total} mastered
      </Text>
    </Pressable>
  );
}
