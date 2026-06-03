/**
 * LOGIN-05 (MOB-09) — mode state + segmented signin/signup control.
 *
 * Builds on LOGIN-04 over-photo shell. Adds:
 *  - mode: 'signin' | 'signup' state
 *  - Glass segmented control (animated sliding thumb via Reanimated, ~180ms)
 *  - Heading copy swaps by mode
 *  - clearError called on mode switch; email/password preserved (added LOGIN-06)
 *
 * Animation: react-native-reanimated useSharedValue + withTiming (180ms).
 * This avoids accessing .current during render, satisfying react-hooks/refs.
 *
 * Design tokens: on-photo palette + App primary only.
 * The ONLY sanctioned raw-literal color values are the three gradient stops
 * below (commented inline) — expo-linear-gradient colors[] cannot accept
 * NativeWind class references.
 */
import { useState } from 'react';
import { ImageBackground, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/stores/auth-store';

export default function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const clearError = useAuthStore((s) => s.clearError);

  // thumb position: 0 = left (signin), 1 = right (signup).
  const thumbProgress = useSharedValue(0);

  function handleModeChange(next: 'signin' | 'signup') {
    if (next === mode) return;
    setMode(next);
    clearError();
    thumbProgress.value = withTiming(next === 'signin' ? 0 : 1, { duration: 180 });
  }

  // Heading copy by mode
  const headingTitle = mode === 'signin' ? 'Welcome back' : 'Start learning Greek';
  const headingSubtitle =
    mode === 'signin'
      ? 'Sign in to continue your Greek journey.'
      : 'Create your account to get started.';

  return (
    <ImageBackground
      source={require('@/assets/images/cyprus-hero.webp')}
      resizeMode="cover"
      className="flex-1"
    >
      {/* Sanctioned raw-literal exception (MOB-09): expo-linear-gradient colors[] cannot take a NativeWind class. */}
      <LinearGradient
        colors={['rgba(8,11,20,0.28)', 'rgba(8,11,20,0.55)', 'rgba(8,11,20,0.94)']}
        locations={[0, 0.42, 1]}
        className="flex-1"
      >
        <SafeAreaView className="flex-1">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="flex-1 px-[22px]"
          >
            {/* Brand row */}
            <View className="flex-row items-center gap-3 mt-4">
              {/* Monogram tile */}
              <View
                className="w-[38px] h-[38px] rounded-[11px] bg-primary items-center justify-center"
                style={{
                  shadowColor: 'hsl(222 95% 63%)',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.45,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text
                  className="text-on-photo text-[17px]"
                  style={{ fontFamily: 'SplineSans_700Bold' }}
                >
                  Ελ
                </Text>
              </View>

              {/* Wordmark */}
              <Text
                className="text-on-photo text-[16px]"
                style={{ fontFamily: 'SplineSans_600SemiBold' }}
              >
                Greeklish
              </Text>
            </View>

            {/* Spacer — pushes bottom group to bottom */}
            <View className="flex-1" />

            {/* Segmented control */}
            <SegmentedControl
              mode={mode}
              thumbProgress={thumbProgress}
              onModeChange={handleModeChange}
            />

            {/* Heading block */}
            <View className="mt-5 mb-8 gap-[6px]">
              <Text
                className="text-on-photo text-[29px] tracking-tight"
                style={{ fontFamily: 'InterTight_700Bold' }}
              >
                {headingTitle}
              </Text>
              <Text className="text-on-photo/72 text-[13.5px] font-sans">
                {headingSubtitle}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

// ---------------------------------------------------------------------------
// SegmentedControl — extracted for readability; lives in this file only.
// ---------------------------------------------------------------------------

interface SegmentedControlProps {
  mode: 'signin' | 'signup';
  thumbProgress: ReturnType<typeof useSharedValue<number>>;
  onModeChange: (next: 'signin' | 'signup') => void;
}

function SegmentedControl({ mode, thumbProgress, onModeChange }: SegmentedControlProps) {
  // trackWidth measured via onLayout so the thumb spans exactly half the track.
  const [trackWidth, setTrackWidth] = useState(0);

  // Inner padding of 4px (p-1 = 4px); the thumb is (trackWidth / 2 - 4)px wide.
  // translateX slides from 0 → trackWidth / 2 to land under the right button.
  const thumbWidth = trackWidth > 0 ? trackWidth / 2 - 4 : 0;
  const halfWidth = trackWidth > 0 ? trackWidth / 2 : 0;

  const thumbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbProgress.value * halfWidth }],
  }));

  return (
    <View
      className="bg-on-photo-scrim/42 border border-on-photo/22 rounded-md p-1 flex-row"
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {/* Animated sliding thumb — absolutely positioned, sits behind labels */}
      {trackWidth > 0 && (
        <Animated.View
          className="absolute top-1 bottom-1 left-1 bg-on-photo/96 rounded-[9px]"
          style={[{ width: thumbWidth }, thumbAnimStyle]}
          pointerEvents="none"
        />
      )}

      {/* Sign in button */}
      <Pressable
        className="flex-1 items-center justify-center h-[34px] rounded-[9px]"
        onPress={() => onModeChange('signin')}
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === 'signin' }}
        accessibilityLabel="Sign in"
      >
        <Text
          className={mode === 'signin' ? 'text-on-photo-active text-[13px]' : 'text-on-photo/66 text-[13px]'}
          style={{ fontFamily: 'SplineSans_600SemiBold' }}
        >
          Sign in
        </Text>
      </Pressable>

      {/* Sign up button */}
      <Pressable
        className="flex-1 items-center justify-center h-[34px] rounded-[9px]"
        onPress={() => onModeChange('signup')}
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === 'signup' }}
        accessibilityLabel="Sign up"
      >
        <Text
          className={mode === 'signup' ? 'text-on-photo-active text-[13px]' : 'text-on-photo/66 text-[13px]'}
          style={{ fontFamily: 'SplineSans_600SemiBold' }}
        >
          Sign up
        </Text>
      </Pressable>
    </View>
  );
}
