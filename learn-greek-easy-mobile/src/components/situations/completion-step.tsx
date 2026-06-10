/**
 * CompletionStep — trophy + "Situation complete" + score + stats + Back CTA (MOB-08).
 */
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy } from 'lucide-react-native';

import { formatDuration } from '@/lib/situations/presentation';

// CTA gradient (primary-2 → primary)
const CTA_GRADIENT: readonly [string, string] = [
  'rgb(90,131,244)',  // --primary-2 hsl(221 83% 65%)
  'rgb(36,99,235)',   // --primary   hsl(221 83% 53%)
] as const;

// Trophy gradient (correct green)
const TROPHY_GRADIENT: readonly [string, string] = [
  'rgb(46,196,130)', // hsl(160 70% 47%)
  'rgb(20,110,90)',  // hsl(180 55% 25%)
] as const;

const WHITE = 'rgba(255,255,255,0.96)';

export interface CompletionStepProps {
  correctCount: number;
  totalCount: number;
  audioSeconds: number;
  elapsedSeconds: number;
  onBack: () => void;
}

export function CompletionStep({
  correctCount,
  totalCount,
  audioSeconds,
  elapsedSeconds,
  onBack,
}: CompletionStepProps) {
  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.round(s / 60)}m`;
  };

  // #12: use formatDuration so fractional float seconds don't produce "2:23.460000000000008"
  const audioLabel = audioSeconds > 0 ? formatDuration(audioSeconds) : '—';

  const stats = [
    { label: 'Words new', value: '—' },
    { label: 'Audio', value: audioLabel },
    { label: 'Time', value: formatTime(elapsedSeconds) },
  ];

  return (
    <View
      testID="completion-step"
      className="flex-1 bg-bg items-center justify-center px-6"
      style={{ paddingVertical: 40 }}
    >
      {/* Trophy icon */}
      <LinearGradient
        colors={TROPHY_GRADIENT as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 84,
          height: 84,
          borderRadius: 9999,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 22,
          // shadow via box-shadow equivalent in RN
          shadowColor: 'rgb(20,110,90)',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.45,
          shadowRadius: 20,
          elevation: 12,
        }}
      >
        <Trophy size={40} color={WHITE as string} />
      </LinearGradient>

      {/* Heading */}
      <Text
        testID="completion-heading"
        className="text-fg text-[28px] font-bold tracking-tight text-center"
        style={{ fontFamily: 'InterTight_700Bold' }}
      >
        Situation complete
      </Text>

      {/* Score */}
      <Text
        testID="completion-score"
        className="text-fg2 text-[14px] leading-[21px] text-center mt-1.5 mb-[22px]"
        style={{ maxWidth: 280 }}
      >
        You got{' '}
        <Text className="text-fg font-bold">
          {correctCount} of {totalCount}
        </Text>{' '}
        right on the first try.
      </Text>

      {/* Stats row */}
      <View
        className="flex-row gap-2.5 mb-6"
        style={{ width: '100%', maxWidth: 320 }}
      >
        {stats.map((stat, i) => (
          <View
            key={i}
            testID={`completion-stat-${i}`}
            className="flex-1 items-center py-3 px-2 rounded-[12px] bg-card border border-line"
          >
            <Text
              className="text-fg text-[20px] font-bold"
              style={{ fontFamily: 'InterTight_700Bold' }}
            >
              {stat.value}
            </Text>
            <Text
              className="text-fg2 text-[10px] font-bold tracking-[0.08em] uppercase text-center mt-0.5"
              style={{ fontFamily: 'SpaceMono_400Regular' }}
            >
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Back to practice CTA */}
      <Pressable
        testID="completion-back"
        accessibilityRole="button"
        onPress={onBack}
        style={{ width: '100%', maxWidth: 320 }}
        className="active:opacity-80"
      >
        <LinearGradient
          colors={CTA_GRADIENT as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            height: 48,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            className="text-[15px] font-bold"
            style={{ color: WHITE, fontFamily: 'InterTight_700Bold' }}
          >
            Back to practice
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
