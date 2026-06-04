/**
 * OnboardingShell — shared chrome wrapper for all 4 onboarding steps (MOB-14).
 *
 * Layout (top→bottom):
 *   ImageBackground (cyprus-hero, full-bleed)
 *     └── LinearGradient scrim (reused from MOB-09 login — same 3-stop dark vignette)
 *     └── SafeAreaView
 *           └── ScrollView (px-6)
 *                 ├── Header row: back chevron | ProgressBar | skip
 *                 ├── Mono kicker (STEP n OF 4 or custom override)
 *                 ├── Title (font-heading)
 *                 ├── Lede (font-sans, text-on-photo-85)
 *                 ├── children (option tiles etc.)
 *                 └── Pinned CTA button (full-width, rounded-[14px])
 *
 * Gradient stops reused from MOB-09 login (sanctioned raw-literal exception —
 * expo-linear-gradient colors[] cannot accept NativeWind classes):
 *   rgba(8,11,20,0.28) @ 0  → rgba(8,11,20,0.55) @ 0.42 → rgba(8,11,20,0.94) @ 1
 *
 * MOB-13: no /NN opacity modifier on var-backed tokens anywhere in this file.
 * Icon opacity handled via style={{ opacity: 0.4 }} (style prop, not className modifier).
 *
 * lucide icon cssInterop wiring matches login.tsx pattern (lines 65-67).
 */
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cssInterop } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { ProgressBar } from './progress-bar';

// Wire ChevronLeft so className="text-on-photo" maps to the icon color prop.
cssInterop(ChevronLeft, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// On-photo white for ActivityIndicator color prop (RN prop, cannot accept NativeWind class).
const ON_PHOTO_FG = '#ffffff'; // = --on-photo-fg (0 0% 100%)

interface OnboardingShellProps {
  /** Current step 1–4 (drives ProgressBar and default kicker). */
  step: 1 | 2 | 3 | 4;
  /** Called when back chevron is pressed. If undefined (step 1), chevron renders disabled. */
  onBack?: () => void;
  /** Called when Skip is pressed. Omit on step 4 — Skip link is hidden. */
  onSkip?: () => void;
  /** Override the mono kicker text. Default: "STEP {step} OF 4". Step 4 callers pass "YOUR PLAN". */
  kicker?: string;
  /** Screen title — rendered in font-heading (InterTight Bold). */
  title: string;
  /** Subtitle/lede sentence — rendered in font-sans, text-on-photo-85. */
  lede: string;
  /** Option tiles or other screen-specific content. */
  children: ReactNode;
  /** CTA button label. */
  ctaLabel: string;
  /** CTA press handler. */
  onCtaPress: () => void;
  /** Whether the CTA should be disabled (e.g. no option selected yet). */
  ctaDisabled?: boolean;
  /** Whether the CTA is in a loading/submitting state. */
  ctaLoading?: boolean;
}

export function OnboardingShell({
  step,
  onBack,
  onSkip,
  kicker,
  title,
  lede,
  children,
  ctaLabel,
  onCtaPress,
  ctaDisabled = false,
  ctaLoading = false,
}: OnboardingShellProps) {
  const kickerText = kicker ?? `STEP ${step} OF 4`;
  const backDisabled = onBack == null;
  const showSkip = onSkip != null && step !== 4;

  return (
    <ImageBackground
      source={require('@/assets/images/cyprus-hero.webp')}
      resizeMode="cover"
      className="flex-1"
    >
      {/* Scrim gradient — reused verbatim from MOB-09 login. Sized via StyleSheet.absoluteFill
          because expo-linear-gradient doesn't apply NativeWind className sizing. */}
      <LinearGradient
        colors={['rgba(8,11,20,0.28)', 'rgba(8,11,20,0.55)', 'rgba(8,11,20,0.94)']}
        locations={[0, 0.42, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="flex-grow px-6 pb-8"
        >
          {/* Header row: back | progress | skip */}
          <View className="flex-row items-center gap-3 mt-4 mb-5">
            {/* Back chevron — disabled (opacity-40 via style) when onBack is undefined / step 1 */}
            <Pressable
              onPress={backDisabled ? undefined : onBack}
              disabled={backDisabled}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft
                className="text-on-photo"
                size={24}
                style={backDisabled ? { opacity: 0.4 } : undefined}
              />
            </Pressable>

            {/* Progress segments — fills remaining space */}
            <View className="flex-1">
              <ProgressBar step={step} total={4} />
            </View>

            {/* Skip link — hidden on step 4 or when onSkip is undefined */}
            {showSkip ? (
              <Pressable
                onPress={onSkip}
                accessibilityLabel="Skip onboarding"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  className="text-on-photo-85 text-[13px]"
                  style={{ fontFamily: 'SplineSans_600SemiBold' }}
                >
                  Skip
                </Text>
              </Pressable>
            ) : (
              /* Placeholder to keep progress bar centered when skip is hidden */
              <View style={{ width: 32 }} />
            )}
          </View>

          {/* Mono kicker — uppercase, letter-spaced, Space Mono */}
          <Text
            className="text-on-photo-85 text-[11px] tracking-widest uppercase mb-2"
            style={{ fontFamily: 'SpaceMono_400Regular' }}
          >
            {kickerText}
          </Text>

          {/* Title */}
          <Text
            className="text-on-photo text-[28px] tracking-tight mb-2"
            style={{ fontFamily: 'InterTight_700Bold' }}
          >
            {title}
          </Text>

          {/* Lede */}
          <Text
            className="text-on-photo-85 text-[14px] mb-6"
            style={{ fontFamily: 'SplineSans_400Regular' }}
          >
            {lede}
          </Text>

          {/* Screen-specific content (tiles, cards, etc.) */}
          <View className="gap-3 flex-1">{children}</View>

          {/* Bottom spacer — push CTA to bottom of content area */}
          <View className="mt-8">
            {/* Primary CTA */}
            <Pressable
              className={`h-[52px] rounded-[14px] bg-primary items-center justify-center flex-row gap-2 ${
                ctaDisabled || ctaLoading ? 'opacity-50' : ''
              }`}
              onPress={ctaLoading ? undefined : onCtaPress}
              disabled={ctaDisabled || ctaLoading}
              accessibilityRole="button"
              accessibilityLabel={ctaLabel}
            >
              {ctaLoading ? (
                <>
                  <ActivityIndicator size={17} color={ON_PHOTO_FG} />
                  <Text
                    className="text-on-photo text-[15.5px]"
                    style={{ fontFamily: 'SplineSans_600SemiBold' }}
                  >
                    {ctaLabel}
                  </Text>
                </>
              ) : (
                <Text
                  className="text-on-photo text-[15.5px]"
                  style={{ fontFamily: 'SplineSans_600SemiBold' }}
                >
                  {ctaLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}
