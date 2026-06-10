/**
 * DeckGridCard — one tile of the Decks-library 2-up grid (MOB-07).
 *
 * Layout (Decks Mock.html › DecksIndex › deck grid):
 *   - 1 / 1.05 gradient cover (coverForDeckId), radius 16, with:
 *       · Greek monogram watermark (top-right, faint)
 *       · Level pill (glassy white, top-left)
 *       · Check disc (top-right) when progress === 1
 *       · Title + Greek subtitle (1-line ellipsis) at the bottom
 *       · Thin progress bar only when 0 < progress < 1
 *   - Caption row under the cover: "{cards} cards" (mono) + "{due} due" pill
 *     when due > 0. (The mock's "· domain" suffix is omitted — the backend
 *     has no deck domain field yet.)
 *
 * Pure presentational — parent passes the joined deck + progress values.
 */
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';

import { coverForDeckId, COVER_CHECK_GREEN } from '@/lib/decks/presentation';
import type { DeckResponse } from '@/types/deck';

export interface DeckGridCardProps {
  deck: DeckResponse;
  /** Mastery ratio in [0, 1] (deckProgressRatio). */
  progressRatio: number;
  /** Cards due now for this deck (0 when not started). */
  due: number;
  onPress: (id: string) => void;
}

export function DeckGridCard({ deck, progressRatio, due, onPress }: DeckGridCardProps) {
  const cover = coverForDeckId(deck.id) as unknown as [string, string];
  const mark = (deck.name_el ?? deck.name).slice(0, 2);
  const inProgress = progressRatio > 0 && progressRatio < 1;
  const complete = progressRatio === 1;
  const progressPercent: `${number}%` = `${Math.round(progressRatio * 100)}%`;

  return (
    <Pressable
      testID={`deck-grid-card-${deck.id}`}
      onPress={() => onPress(deck.id)}
      className="flex-1 active:opacity-80"
    >
      {/* ── Gradient cover ── */}
      <LinearGradient
        testID="deck-grid-cover"
        colors={cover}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          aspectRatio: 1 / 1.05,
          borderRadius: 16,
          padding: 12,
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        {/* Watermark monogram */}
        <Text
          className="absolute text-on-photo-18 text-[100px] leading-none tracking-tight"
          style={{ fontFamily: 'InterTight_700Bold', right: -8, top: -6 }}
        >
          {mark}
        </Text>

        {/* Top row: level pill + completion check */}
        <View className="flex-row justify-between items-start">
          <View className="bg-on-photo-18 px-2 py-[3px] rounded-full">
            <Text
              testID="deck-grid-level"
              className="text-on-photo-96 text-[10px] font-bold tracking-[0.06em] uppercase"
              style={{ fontFamily: 'SpaceMono_400Regular' }}
            >
              {deck.level}
            </Text>
          </View>
          {complete ? (
            <View
              testID="deck-grid-check"
              className="w-[22px] h-[22px] rounded-full bg-on-photo-92 items-center justify-center"
            >
              <Check size={12} color={COVER_CHECK_GREEN} strokeWidth={2.4} />
            </View>
          ) : null}
        </View>

        {/* Bottom: title + Greek subtitle + progress */}
        <View>
          <Text
            testID="deck-grid-title"
            className="text-on-photo-96 text-[16px] font-bold tracking-tight leading-tight"
            style={{ fontFamily: 'InterTight_700Bold' }}
            numberOfLines={2}
          >
            {deck.name}
          </Text>
          {deck.name_el ? (
            <Text
              testID="deck-grid-title-el"
              className="text-on-photo-78 text-[11px] mt-0.5"
              style={{ fontFamily: 'NotoSerif_400Regular' }}
              numberOfLines={1}
            >
              {deck.name_el}
            </Text>
          ) : null}
          {inProgress ? (
            <View className="mt-2 h-1 rounded-full bg-on-photo-22 overflow-hidden">
              <View
                testID="deck-grid-progress-fill"
                className="h-full rounded-full bg-on-photo-92"
                style={{ width: progressPercent }}
              />
            </View>
          ) : null}
        </View>
      </LinearGradient>

      {/* ── Caption row ── */}
      <View className="mt-2 flex-row items-center justify-between">
        <Text
          testID="deck-grid-caption"
          className="text-fg3 text-[11.5px]"
          style={{ fontFamily: 'SpaceMono_400Regular' }}
        >
          {deck.card_count} cards
        </Text>
        {due > 0 ? (
          <View className="bg-primary-15 px-[7px] py-[2px] rounded-full">
            <Text testID="deck-grid-due" className="text-primary text-[10px] font-bold">
              {due} due
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
