/**
 * CardFront — the front face of the flashcard (MOB-09).
 *
 * Displays: type badge (from fc.badge), prompt, Greek lemma (Noto Serif),
 * IPA subtitle, audio cluster, and "Tap to reveal" hint.
 *
 * Uses explicit isDark-keyed rgb constants (MOB-13 + #5/#25 dark-mode fix).
 * practice-* classNames are NOT used here — they always resolve to light values
 * on native since darkMode:'class' is unconnected (nothing calls colorScheme.set).
 */
import { View, Text, Pressable } from 'react-native';

import { AudioCluster } from './audio-cluster';
import { reviewPalette } from '@/lib/review/presentation';
import type { V2StudyQueueCard } from '@/types/review';

export interface CardFrontProps {
  card: V2StudyQueueCard;
  isDark: boolean;
  onFlip: () => void;
  testID?: string;
}

export function CardFront({ card, isDark, onFlip, testID }: CardFrontProps) {
  const fc = card.front_content;

  // Extract front content fields
  const prompt = typeof fc.prompt === 'string' ? fc.prompt : 'What does this mean?';
  const main = typeof fc.main === 'string' ? fc.main : '';
  const sub = typeof fc.sub === 'string' ? fc.sub : null;
  // #13/#20: source badge from fc.badge (backend populates this with the POS,
  // e.g. "Noun", "Verb" via card_generator_service.py:96). card_type is an internal
  // enum (meaning_el_to_en, declension …) — never a POS — so it must NOT be shown
  // in a POS badge. fc.badge already covers the display label; no second badge needed.
  const badge = typeof fc.badge === 'string' ? fc.badge : card.variant_key;
  const hint = typeof fc.hint === 'string' ? fc.hint : 'Tap to reveal';

  // #5/#25/#29: derive all practice-* colors from isDark prop (explicit rgb constants).
  // practice-* classNames always resolve to light values on native (darkMode:'class'
  // is unconnected — nothing calls colorScheme.set).
  const palette = reviewPalette(isDark);

  return (
    <Pressable
      testID={testID ?? 'review-card-front'}
      accessibilityRole="button"
      accessibilityLabel="Tap to reveal answer"
      onPress={onFlip}
      className="active:opacity-95"
    >
      <View
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: palette.cardBg,
          borderWidth: 1,
          borderColor: palette.borderColor,
          // Shadow
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        {/* ── Badge row ── */}
        <View className="flex-row items-center gap-2 px-4 pt-4 pb-3">
          {/* POS/variant badge sourced from fc.badge (backend sets part_of_speech.value.capitalize()) */}
          <View
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(234,89,74,0.12)' }}
          >
            <Text
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{
                fontFamily: 'SpaceMono_400Regular',
                color: 'rgb(234,89,74)',
              }}
            >
              {badge}
            </Text>
          </View>
          {/* Note: a second "POS badge" keyed on card_type has been removed (#13/#20).
              card_type values are internal enum strings (meaning_el_to_en, declension …),
              never part-of-speech labels. fc.badge already carries the correct POS. */}
        </View>

        {/* ── Card body ── */}
        <View className="px-5 pb-4 items-center">
          {/* Prompt */}
          <Text
            testID="review-card-prompt"
            className="text-[11px] font-bold uppercase tracking-widest mb-4"
            style={{ fontFamily: 'SpaceMono_400Regular', color: palette.textDim }}
          >
            {prompt}
          </Text>

          {/* Greek lemma */}
          <Text
            testID="review-card-lemma"
            className="text-[36px] text-center mb-2"
            style={{
              fontFamily: 'NotoSerif_400Regular',
              letterSpacing: -0.7,
              lineHeight: 48,
              color: palette.text,
            }}
          >
            {main}
          </Text>

          {/* IPA subtitle */}
          {sub ? (
            <Text
              testID="review-card-ipa"
              className="text-[14px] text-center mb-4"
              style={{ fontFamily: 'NotoSerif_400Regular_Italic', color: palette.textMuted }}
            >
              {sub}
            </Text>
          ) : (
            <View className="mb-4" />
          )}

          {/* Audio cluster */}
          <View className="mb-5">
            <AudioCluster audioUrl={card.audio_url} isDark={isDark} testID="review-card-audio" />
          </View>

          {/* Flip hint */}
          <Text
            testID="review-card-hint"
            className="text-[12px] text-center"
            style={{ color: palette.textDim }}
          >
            {hint}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
