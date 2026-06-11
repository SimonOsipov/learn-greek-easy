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

/**
 * Maps card_type enum values to human-readable display labels for the card-type badge.
 * These are the ONLY valid card_type values (src/db/models.py CardType enum).
 */
const CARD_TYPE_LABEL: Record<string, string> = {
  meaning_el_to_en:     'Meaning',
  meaning_en_to_el:     'Meaning',
  sentence_translation: 'Sentence',
  declension:           'Declension',
  conjugation:          'Conjugation',
  cloze:                'Cloze',
  plural_form:          'Plural',
  article:              'Article',
};

export function CardFront({ card, isDark, onFlip, testID }: CardFrontProps) {
  const fc = card.front_content;

  // Extract front content fields
  const prompt = typeof fc.prompt === 'string' ? fc.prompt : 'What does this mean?';
  const main = typeof fc.main === 'string' ? fc.main : '';
  const sub = typeof fc.sub === 'string' ? fc.sub : null;
  // Card-type badge: derived from card.card_type via CARD_TYPE_LABEL map.
  // POS badge: from fc.badge (backend sets this to POS e.g. "Noun", "Verb").
  // Show both when fc.badge is present and differs from the card-type label
  // (case-insensitive), to avoid showing the same text twice.
  const cardTypeLabel = CARD_TYPE_LABEL[card.card_type] ?? card.variant_key;
  const posLabel = typeof fc.badge === 'string' ? fc.badge : null;
  // Only show POS badge when it carries different info than the card-type badge.
  const showPosBadge = !!posLabel && posLabel.toLowerCase() !== cardTypeLabel.toLowerCase();
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
        {/* Design: TWO badges — card-type (accent-tinted) + POS (muted, shown when different). */}
        <View className="flex-row items-center gap-2 px-4 pt-4 pb-3">
          {/* Badge 1: card-type label (accent-tinted, always shown) */}
          <View
            testID="review-card-type-badge"
            className="px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: isDark
                ? 'rgba(129,140,248,0.18)'  // practice-accent dark / 18% MOB-13 explicit rgba
                : 'rgba(97,110,245,0.14)',  // practice-accent light / 14% MOB-13 explicit rgba
              borderWidth: 1,
              borderColor: isDark
                ? 'rgba(129,140,248,0.32)'
                : 'rgba(97,110,245,0.28)',
            }}
          >
            <Text
              testID="review-card-type-badge-text"
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{
                fontFamily: 'SpaceMono_400Regular',
                color: palette.accent,
              }}
            >
              {cardTypeLabel}
            </Text>
          </View>

          {/* Badge 2: POS label (muted, shown only when different from card-type label) */}
          {showPosBadge && (
            <View
              testID="review-pos-badge"
              className="px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: isDark
                  ? 'rgba(234,239,245,0.06)'  // practice-text dark / 6% MOB-13 explicit rgba
                  : 'rgba(15,23,42,0.06)',    // practice-text light / 6% MOB-13 explicit rgba
                borderWidth: 1,
                borderColor: palette.borderColor,
              }}
            >
              <Text
                testID="review-pos-badge-text"
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{
                  fontFamily: 'SpaceMono_400Regular',
                  color: palette.textMuted,
                }}
              >
                {posLabel}
              </Text>
            </View>
          )}
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
