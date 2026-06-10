/**
 * CardBack — the back face of the flashcard after reveal (MOB-09).
 *
 * Displays: Greek lemma echoed small (with audio cluster), green Answer block
 * (translation in Inter Tight), and example sentence block.
 *
 * Uses explicit isDark-keyed rgb constants (MOB-13 + #5/#25 dark-mode fix).
 * practice-* classNames are NOT used here — they always resolve to light values
 * on native since darkMode:'class' is unconnected (nothing calls colorScheme.set).
 */
import { View, Text } from 'react-native';
import { Check } from 'lucide-react-native';

import { AudioCluster } from './audio-cluster';
import { reviewPalette } from '@/lib/review/presentation';
import type { V2StudyQueueCard } from '@/types/review';

// MOB-13: explicit rgba for tinted surfaces
const CORRECT_BG_LIGHT  = 'rgba(20,184,103,0.10)';
const CORRECT_BG_DARK   = 'rgba(47,192,119,0.12)';
const CORRECT_BORDER_LIGHT = 'rgba(20,184,103,0.25)';
const CORRECT_BORDER_DARK  = 'rgba(47,192,119,0.25)';
const EXAMPLE_BG_LIGHT  = 'rgba(100,116,139,0.08)';
const EXAMPLE_BG_DARK   = 'rgba(148,163,184,0.10)';
// Correct icon/text colour — explicit rgb (solid, no opacity)
const CORRECT_FG_LIGHT  = 'rgb(20,184,103)';
const CORRECT_FG_DARK   = 'rgb(47,192,119)';

export interface CardBackProps {
  card: V2StudyQueueCard;
  locale: 'en' | 'ru';
  isDark: boolean;
  testID?: string;
}

export function CardBack({ card, locale, isDark, testID }: CardBackProps) {
  const fc = card.front_content;
  const bc = card.back_content;

  const main = typeof fc.main === 'string' ? fc.main : '';
  const answer = locale === 'ru' && card.translation_ru
    ? card.translation_ru
    : (typeof bc.answer === 'string' ? bc.answer : '');
  const exampleEl = card.example_el ?? (typeof bc.example_el === 'string' ? bc.example_el : null);
  const exampleGloss = locale === 'ru' && card.sentence_ru
    ? card.sentence_ru
    : (card.example_en ?? (typeof bc.example_en === 'string' ? bc.example_en : null));

  const correctFg   = isDark ? CORRECT_FG_DARK : CORRECT_FG_LIGHT;
  const correctBg   = isDark ? CORRECT_BG_DARK : CORRECT_BG_LIGHT;
  const correctBorder = isDark ? CORRECT_BORDER_DARK : CORRECT_BORDER_LIGHT;
  const exampleBg   = isDark ? EXAMPLE_BG_DARK : EXAMPLE_BG_LIGHT;
  // #5/#25/#29: derive card surface from isDark (practice-* classNames unconnected on native)
  const palette     = reviewPalette(isDark);

  return (
    <View
      testID={testID ?? 'review-card-back'}
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: palette.cardBg,
        borderWidth: 1,
        borderColor: palette.borderColor,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      {/* ── Lemma echo + audio ── */}
      <View className="px-5 pt-4 pb-3 items-center">
        <Text
          testID="review-back-lemma"
          className="text-[22px] text-center mb-3"
          style={{ fontFamily: 'NotoSerif_400Regular', color: palette.textMuted }}
        >
          {main}
        </Text>
        <AudioCluster audioUrl={card.audio_url} isDark={isDark} testID="review-back-audio" />
      </View>

      {/* ── Answer block ── */}
      <View className="px-4 pb-3">
        <View
          className="rounded-xl px-4 py-3"
          style={{
            backgroundColor: correctBg,
            borderWidth: 1,
            borderColor: correctBorder,
          }}
        >
          {/* Label row */}
          <View className="flex-row items-center gap-1.5 mb-2">
            <Check size={12} color={correctFg} strokeWidth={2.5} />
            <Text
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ fontFamily: 'SpaceMono_400Regular', color: correctFg }}
            >
              Answer
            </Text>
          </View>
          {/* Translation */}
          <Text
            testID="review-back-answer"
            className="text-[26px] font-bold tracking-tight"
            style={{ fontFamily: 'InterTight_700Bold', letterSpacing: -0.5, color: palette.text }}
          >
            {answer}
          </Text>
        </View>
      </View>

      {/* ── Example sentence block ── */}
      {exampleEl ? (
        <View className="px-4 pb-4">
          <View
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: exampleBg }}
          >
            {/* Tag */}
            <Text
              className="text-[9px] font-bold uppercase tracking-widest mb-2"
              style={{ fontFamily: 'SpaceMono_400Regular', color: palette.textDim }}
            >
              Example
            </Text>
            {/* Greek sentence */}
            <Text
              testID="review-back-example-el"
              className="text-[13px] font-semibold mb-1"
              style={{ fontFamily: 'NotoSerif_400Regular', color: palette.text }}
            >
              {exampleEl}
            </Text>
            {/* Example audio */}
            {card.example_audio_url ? (
              <View className="mb-2">
                <AudioCluster
                  audioUrl={card.example_audio_url}
                  isDark={isDark}
                  testID="review-back-example-audio"
                />
              </View>
            ) : null}
            {/* Gloss */}
            {exampleGloss ? (
              <Text
                testID="review-back-example-gloss"
                className="text-[12px]"
                style={{ fontFamily: 'NotoSerif_400Regular_Italic', color: palette.textMuted }}
              >
                {exampleGloss}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
