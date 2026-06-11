/**
 * RetellingStep — audio player + Greek passage + optional English translation (MOB-08).
 *
 * Two retelling levels per situation (shown in sequence): A2 (simpler) then B1 (standard).
 * The Translate toggle reveals/hides the English gloss in an inset card.
 * Footer: Translate button (outline) + Continue button (primary gradient CTA).
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';

import { AudioPlayer } from './audio-player';
import { MissingDataDot } from '@/components/ui/missing-data-dot';

// CTA gradient (same as deck CTA: primary-2 → primary)
const CTA_GRADIENT: readonly [string, string] = [
  'rgb(90,131,244)',  // --primary-2 hsl(221 83% 65%)
  'rgb(36,99,235)',   // --primary   hsl(221 83% 53%)
] as const;

// MOB-13: no /NN modifier on var-backed tokens
const WHITE = 'rgba(255,255,255,0.96)';

export type RetellingLevel = 'A2' | 'B1';

export interface RetellingStepProps {
  level: RetellingLevel;
  textEl: string;
  textEn: string | null;
  audioUrl: string | null;
  audioDurationSeconds: number | null;
  isLast: boolean;
  onContinue: () => void;
}

export function RetellingStep({
  level,
  textEl,
  textEn,
  audioUrl,
  audioDurationSeconds,
  isLast,
  onContinue,
}: RetellingStepProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const versionLabel = level === 'A2' ? 'Simpler version' : 'Standard version';

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 18, paddingTop: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Audio player */}
        {audioUrl && (
          <AudioPlayer
            audioUrl={audioUrl}
            durationSeconds={audioDurationSeconds}
            testID="retelling-audio-player"
          />
        )}

        {/* Level pill + version label */}
        <View className="flex-row items-center gap-2 mt-4 mb-3.5 px-1">
          <View className="px-2.5 py-1 rounded-full bg-primary-15">
            <Text
              className="text-primary text-[11px] font-bold tracking-[0.06em] uppercase"
              style={{ fontFamily: 'SpaceMono_400Regular' }}
            >
              {level} retelling
            </Text>
          </View>
          <Text className="text-fg3 text-[12px]">· {versionLabel}</Text>
        </View>

        {/* Greek passage */}
        <Text
          testID="retelling-text-el"
          className="text-fg text-[17px] leading-[26px]"
          style={{ fontFamily: 'NotoSerif_400Regular', fontWeight: '500' }}
        >
          {textEl}
        </Text>

        {/* Translation (when toggled) */}
        {showTranslation && textEn && (
          <View
            testID="retelling-translation"
            className="mt-3.5 p-3.5 rounded-[12px] bg-bg-2 border border-line"
          >
            <Text className="text-fg2 text-[14px] leading-[21px]">{textEn}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer buttons */}
      <View
        className="flex-row gap-2.5 px-[18px] pb-5 pt-3 bg-bg"
        style={{ borderTopWidth: 0 }}
      >
        {textEn ? (
          <Pressable
            testID="retelling-translate-toggle"
            accessibilityRole="button"
            onPress={() => setShowTranslation((v) => !v)}
            className="h-12 px-[18px] rounded-[12px] bg-transparent border border-line items-center justify-center active:opacity-70"
          >
            <Text className="text-fg text-[13.5px] font-semibold">
              {showTranslation ? 'Hide translation' : 'Translate'}
            </Text>
          </Pressable>
        ) : (
          /* Translate-toggle slot: text_en is not exposed on the learner
             endpoint (LearnerDescriptionNested) — the marker flags the gap. */
          <View
            testID="retelling-translate-gap"
            className="h-12 px-3 rounded-[12px] border border-line items-center justify-center"
          >
            <MissingDataDot testID="retelling-translate-gap-dot" />
          </View>
        )}

        <Pressable
          testID="retelling-continue"
          accessibilityRole="button"
          onPress={onContinue}
          className="flex-1 active:opacity-80"
        >
          <LinearGradient
            colors={CTA_GRADIENT as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              height: 48,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Text
              className="text-[15px] font-bold"
              style={{ color: WHITE, fontFamily: 'InterTight_700Bold' }}
            >
              {isLast ? 'Start exercises' : 'Continue'}
            </Text>
            <ArrowRight size={14} color={WHITE} strokeWidth={2.5} />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
