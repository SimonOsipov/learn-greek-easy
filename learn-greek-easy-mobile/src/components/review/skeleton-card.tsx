/**
 * SkeletonCard — loading shimmer for the card-review screen (MOB-09).
 *
 * Shows a card-shaped placeholder with shimmer bars while the queue loads.
 * Collapses to a static fill when useReducedMotion() is true.
 *
 * MOB-13: no /NN opacity modifier on var-backed tokens.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Animated } from 'react-native';

import { useReducedMotion } from '@/hooks/use-reduced-motion';

// MOB-13: explicit rgba for shimmer surfaces
const SHIMMER_BASE_LIGHT = 'rgba(100,116,139,0.10)';
const SHIMMER_BASE_DARK  = 'rgba(148,163,184,0.12)';
const SHIMMER_HIGH_LIGHT = 'rgba(100,116,139,0.20)';
const SHIMMER_HIGH_DARK  = 'rgba(148,163,184,0.22)';

export interface SkeletonCardProps {
  isDark: boolean;
  testID?: string;
}

export function SkeletonCard({ isDark, testID }: SkeletonCardProps) {
  const reduceMotion = useReducedMotion();
  const [shimmer] = useState(() => new Animated.Value(0));
  const shimmerLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!reduceMotion) {
      shimmerLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
      );
      shimmerLoop.current.start();
    }
    return () => {
      shimmerLoop.current?.stop();
    };
  }, [reduceMotion, shimmer]);

  const opacity = reduceMotion
    ? 1
    : shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const baseColor = isDark ? SHIMMER_BASE_DARK : SHIMMER_BASE_LIGHT;
  const highColor = isDark ? SHIMMER_HIGH_DARK : SHIMMER_HIGH_LIGHT;
  const cardBg    = isDark ? 'rgba(30,41,59,1)' : '#fff';
  const borderColor = isDark ? 'rgba(71,85,105,0.5)' : 'rgba(203,213,225,0.8)';

  return (
    <Animated.View
      testID={testID ?? 'review-skeleton-card'}
      style={{ opacity }}
    >
      <View
        className="rounded-2xl overflow-hidden px-5 py-6"
        style={{
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor,
        }}
      >
        {/* Badge row */}
        <View className="flex-row gap-2 mb-5">
          <View className="h-6 w-16 rounded-full" style={{ backgroundColor: baseColor }} />
          <View className="h-6 w-12 rounded-full" style={{ backgroundColor: baseColor }} />
        </View>
        {/* Prompt */}
        <View className="h-3 w-32 rounded self-center mb-5" style={{ backgroundColor: baseColor }} />
        {/* Lemma */}
        <View className="h-10 w-48 rounded self-center mb-3" style={{ backgroundColor: highColor }} />
        {/* IPA */}
        <View className="h-3 w-24 rounded self-center mb-6" style={{ backgroundColor: baseColor }} />
        {/* Audio cluster placeholder */}
        <View className="flex-row gap-2 self-center mb-5">
          <View className="h-8 w-16 rounded-full" style={{ backgroundColor: baseColor }} />
          <View className="h-8 w-9 rounded-full" style={{ backgroundColor: baseColor }} />
        </View>
        {/* Hint */}
        <View className="h-3 w-20 rounded self-center" style={{ backgroundColor: baseColor }} />
      </View>
    </Animated.View>
  );
}
