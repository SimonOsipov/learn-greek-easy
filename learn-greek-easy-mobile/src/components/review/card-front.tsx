/**
 * CardFront — the front face of the flashcard (MOB-09).
 *
 * Displays: type badge, POS badge, prompt, Greek lemma (Noto Serif),
 * IPA subtitle, audio cluster, and "Tap to reveal" hint.
 *
 * Uses --practice-* tokens. MOB-13: no /NN opacity modifier on var-backed tokens.
 */
import { View, Text, Pressable } from 'react-native';

import { AudioCluster } from './audio-cluster';
import type { V2StudyQueueCard } from '@/types/review';

// Part-of-speech badge colors — explicit rgba (MOB-13)
const POS_COLORS: Record<string, { bg: string; text: string }> = {
  noun:         { bg: 'rgba(36,99,235,0.12)',  text: 'rgb(36,99,235)' },    // blue
  verb:         { bg: 'rgba(177,82,224,0.14)', text: 'rgb(177,82,224)' },   // violet
  adjective:    { bg: 'rgba(20,184,103,0.12)', text: 'rgb(20,184,103)' },   // green
  adverb:       { bg: 'rgba(246,168,35,0.14)', text: 'rgb(246,168,35)' },   // amber
  pronoun:      { bg: 'rgba(26,178,199,0.12)', text: 'rgb(26,178,199)' },   // cyan
  preposition:  { bg: 'rgba(100,116,139,0.14)', text: 'rgb(100,116,139)' }, // gray
};
const DEFAULT_POS_COLOR = { bg: 'rgba(100,116,139,0.14)', text: 'rgb(100,116,139)' };

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
  const badge = typeof fc.badge === 'string' ? fc.badge : card.variant_key;
  const hint = typeof fc.hint === 'string' ? fc.hint : 'Tap to reveal';

  // POS from card_type or front badge
  const posKey = card.card_type?.toLowerCase() ?? '';
  const posColor = POS_COLORS[posKey] ?? DEFAULT_POS_COLOR;

  const cardBg = isDark ? 'rgba(30,41,59,1)' : '#fff';  // --practice-card
  const borderColor = isDark ? 'rgba(71,85,105,0.5)' : 'rgba(203,213,225,0.8)'; // --practice-border

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
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor,
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
          {/* Card-type badge (e.g. "Meaning") */}
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

          {/* Part-of-speech badge */}
          {posKey ? (
            <View
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: posColor.bg }}
            >
              <Text
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ fontFamily: 'SpaceMono_400Regular', color: posColor.text }}
              >
                {posKey}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Card body ── */}
        <View className="px-5 pb-4 items-center">
          {/* Prompt */}
          <Text
            testID="review-card-prompt"
            className="text-practice-text-dim text-[11px] font-bold uppercase tracking-widest mb-4"
            style={{ fontFamily: 'SpaceMono_400Regular' }}
          >
            {prompt}
          </Text>

          {/* Greek lemma */}
          <Text
            testID="review-card-lemma"
            className="text-practice-text text-[36px] text-center mb-2"
            style={{
              fontFamily: 'NotoSerif_400Regular',
              letterSpacing: -0.7,
              lineHeight: 48,
            }}
          >
            {main}
          </Text>

          {/* IPA subtitle */}
          {sub ? (
            <Text
              testID="review-card-ipa"
              className="text-practice-text-muted text-[14px] text-center mb-4"
              style={{ fontFamily: 'NotoSerif_400Regular_Italic' }}
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
            className="text-practice-text-dim text-[12px] text-center"
          >
            {hint}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
