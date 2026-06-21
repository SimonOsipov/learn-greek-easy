/**
 * WordRow — one row of the deck-detail word list (MOB-07).
 *
 * Layout (Decks Mock.html › DeckDetail › word list):
 *   - 38px article badge (bg-bg-2, radius 12) showing the Greek article
 *     (ο / η / το) tinted by grammatical gender — fixed semantic accents from
 *     ARTICLE_COLOR. Words without a noun gender (verbs, adverbs …) show the
 *     first letter of the lemma in fg-2 instead.
 *   - Greek lemma (Noto Serif 18) + pronunciation guide (mono) · English gloss.
 *   - Status tag (NEW / LEARNING / MASTERED) + chevron.
 *
 * Word detail is out of scope for MOB-07 — the parent passes an onPress that
 * fires the coming-soon toast.
 */
import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { ARTICLE_COLOR, articleForGender } from '@/lib/decks/presentation';
import type { WordEntryResponse, WordStatus } from '@/types/deck';
import { useIconColor } from '@/hooks/use-icon-color';

export interface WordRowProps {
  word: WordEntryResponse;
  status: WordStatus;
  /** Hairline under the row — false for the last row in the card. */
  showDivider: boolean;
  onPress: (id: string) => void;
}

export function WordRow({ word, status, showDivider, onPress }: WordRowProps) {
  const articleInfo = articleForGender(word.grammar_data?.gender);
  // THEME-06: chevron (--fg-3) resolves per-theme from the global store.
  const iconFg3 = useIconColor('fg-3');

  return (
    <Pressable
      testID={`word-row-${word.id}`}
      onPress={() => onPress(word.id)}
      className={`flex-row items-center gap-3 px-3.5 py-3.5 active:opacity-70 ${
        showDivider ? 'border-b border-line' : ''
      }`}
    >
      {/* Article badge */}
      <View className="w-[38px] h-[38px] rounded-md bg-bg-2 items-center justify-center">
        {articleInfo ? (
          <Text
            testID={`word-article-${word.id}`}
            className="text-[14px] font-bold tracking-tight"
            style={{
              fontFamily: 'InterTight_700Bold',
              color: ARTICLE_COLOR[articleInfo.gender],
            }}
          >
            {articleInfo.article}
          </Text>
        ) : (
          <Text
            testID={`word-article-${word.id}`}
            className="text-fg2 text-[14px] font-bold tracking-tight"
            style={{ fontFamily: 'InterTight_700Bold' }}
          >
            {word.lemma.slice(0, 1)}
          </Text>
        )}
      </View>

      {/* Lemma + pronunciation · gloss */}
      <View className="flex-1 min-w-0">
        <Text
          testID={`word-lemma-${word.id}`}
          className="text-fg text-[18px] font-semibold leading-snug"
          style={{ fontFamily: 'NotoSerif_400Regular' }}
          numberOfLines={1}
        >
          {word.lemma}
        </Text>
        <View className="flex-row items-center gap-2 mt-0.5">
          {word.pronunciation ? (
            <Text
              className="text-fg2 text-[12px] opacity-70"
              style={{ fontFamily: 'SpaceMono_400Regular' }}
              numberOfLines={1}
            >
              {word.pronunciation}
            </Text>
          ) : null}
          <Text className="text-fg2 text-[12px] flex-shrink" numberOfLines={1}>
            {word.pronunciation ? '· ' : ''}
            {word.translation_en}
          </Text>
        </View>
      </View>

      {/* Status + chevron */}
      <Text
        testID={`word-status-${word.id}`}
        className="text-fg3 text-[10px] font-bold tracking-[0.08em] uppercase"
      >
        {status}
      </Text>
      <ChevronRight size={16} color={iconFg3} strokeWidth={2.2} />
    </Pressable>
  );
}
