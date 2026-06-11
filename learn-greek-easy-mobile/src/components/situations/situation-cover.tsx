/**
 * SituationCover — full-bleed gradient cover step (MOB-08).
 *
 * Full screen: scene gradient, big monogram watermark, glassy back button,
 * level + domain pills, Greek headline + English gloss, meta row, Begin CTA,
 * source attribution line.
 */
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Play } from 'lucide-react-native';

import { gradientForSituationId, monogramForScenario, formatDuration } from '@/lib/situations/presentation';
import type { SituationDetail } from '@/types/situation';

// MOB-13: explicit rgba for over-gradient surfaces
const WHITE_96 = 'rgba(255,255,255,0.96)';
const WHITE_85 = 'rgba(255,255,255,0.85)';
const WHITE_78 = 'rgba(255,255,255,0.78)';
const WHITE_22 = 'rgba(255,255,255,0.22)';
const SCRIM_25 = 'rgba(8,11,20,0.25)';
const MARK_16  = 'rgba(255,255,255,0.16)';
// Begin CTA: white bg, primary-dark text (hsl 212 85% 25% ≈ rgb(8,60,121))
const CTA_BG   = WHITE_96;
const CTA_TEXT = 'rgb(8,60,121)';

export interface SituationCoverProps {
  situation: SituationDetail;
  onBack: () => void;
  onBegin: () => void;
  topOffset?: number;
}

export function SituationCover({ situation, onBack, onBegin, topOffset = 0 }: SituationCoverProps) {
  const gradient = gradientForSituationId(situation.id) as unknown as [string, string];
  const mark = monogramForScenario(situation.scenario_el);

  const retellingCount =
    (situation.description?.text_el ? 1 : 0) +
    (situation.description?.text_el_a2 ? 1 : 0);
  const exerciseCount = situation.exercise_total;
  const audioSecs =
    (situation.description?.audio_duration_seconds ?? 0) +
    (situation.description?.audio_a2_duration_seconds ?? 0);
  const audioLabel = audioSecs > 0 ? formatDuration(audioSecs) : null;

  return (
    <LinearGradient
      testID="situation-cover"
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, overflow: 'hidden' }}
    >
      {/* Watermark monogram */}
      <Text
        style={{
          position: 'absolute',
          right: -40,
          top: topOffset + 60,
          fontFamily: 'InterTight_700Bold',
          fontSize: 280,
          fontWeight: '800',
          letterSpacing: -11,
          color: MARK_16,
          lineHeight: 280,
          zIndex: 1,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit={false}
      >
        {mark}
      </Text>

      {/* Back button */}
      <View style={{ paddingTop: topOffset + 14, paddingHorizontal: 18, zIndex: 2 }}>
        <Pressable
          testID="situation-cover-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 9999,
            backgroundColor: SCRIM_25,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={20} color={WHITE_96} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Bottom content block */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 22,
          paddingBottom: 26,
          zIndex: 2,
        }}
      >
        {/* Pills row — only honest data: exercise count if non-zero.
            The B1 level pill is intentionally absent (level is not exposed on
            SituationDetail in the learner endpoint — adding it would be fabricated data).
            The 'Practice' domain pill is also removed for the same reason (no domain
            field on the backend). Re-add when backend exposes these fields. */}
        <View className="flex-row items-center gap-1.5 mb-3.5">
          {exerciseCount > 0 && (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 9999,
                backgroundColor: WHITE_22,
              }}
            >
              <Text
                className="text-[10.5px] font-bold tracking-[0.08em] uppercase"
                style={{ fontFamily: 'SpaceMono_400Regular', color: WHITE_96 }}
              >
                {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
              </Text>
            </View>
          )}
        </View>

        {/* Greek headline */}
        <Text
          testID="situation-cover-headline"
          className="text-[28px] font-semibold leading-[33px]"
          style={{ fontFamily: 'NotoSerif_400Regular', color: WHITE_96 }}
        >
          {situation.scenario_el}
        </Text>

        {/* English gloss */}
        <Text
          testID="situation-cover-gloss"
          className="text-[14px] leading-[21px] mt-2.5 mb-[18px]"
          style={{ color: WHITE_85 }}
        >
          {situation.scenario_en}
        </Text>

        {/* Meta row */}
        <View className="flex-row items-center gap-3.5 mb-[22px]">
          {retellingCount > 0 && (
            <Text
              className="text-[12px] font-bold tracking-[0.04em] uppercase"
              style={{ fontFamily: 'SpaceMono_400Regular', color: WHITE_78 }}
            >
              {retellingCount} {retellingCount === 1 ? 'retelling' : 'retellings'}
            </Text>
          )}
          {retellingCount > 0 && exerciseCount > 0 && (
            <Text style={{ color: WHITE_78 }}>·</Text>
          )}
          {exerciseCount > 0 && (
            <Text
              className="text-[12px] font-bold tracking-[0.04em] uppercase"
              style={{ fontFamily: 'SpaceMono_400Regular', color: WHITE_78 }}
            >
              {exerciseCount} exercises
            </Text>
          )}
          {audioLabel && (
            <>
              <Text style={{ color: WHITE_78 }}>·</Text>
              <Text
                className="text-[12px] font-bold tracking-[0.04em] uppercase"
                style={{ fontFamily: 'SpaceMono_400Regular', color: WHITE_78 }}
              >
                {audioLabel}
              </Text>
            </>
          )}
        </View>

        {/* Begin CTA */}
        <Pressable
          testID="situation-cover-begin"
          accessibilityRole="button"
          onPress={onBegin}
          style={{
            height: 52,
            borderRadius: 14,
            backgroundColor: CTA_BG,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          className="active:opacity-80"
        >
          <Play size={14} color={CTA_TEXT} fill={CTA_TEXT} />
          <Text
            className="text-[16px] font-bold tracking-tight"
            style={{ color: CTA_TEXT, fontFamily: 'InterTight_700Bold' }}
          >
            Begin
          </Text>
        </Pressable>

        {/* Source line */}
        {situation.source_title && (
          <Text
            className="text-[11px] text-center mt-3"
            style={{
              fontFamily: 'SpaceMono_400Regular',
              color: 'rgba(255,255,255,0.70)',
            }}
          >
            Source · {situation.source_title}
          </Text>
        )}
      </View>
    </LinearGradient>
  );
}
