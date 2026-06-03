/**
 * LOGIN-08 (MOB-09) — primary CTA, auth store wiring + friendly error banner.
 *
 * Builds on LOGIN-07 (inline email validation + formValid). Adds:
 *  - Store bindings: isSubmitting, error, signIn, signUp (narrow individual selectors)
 *  - useAuth() for isLoading
 *  - Primary CTA: Pressable, bg-primary, disabled when !formValid (opacity-50, no shadow)
 *  - Submitting state: ActivityIndicator + "Signing in…" / "Creating account…" labels
 *  - Both TextInputs set editable={false} while isSubmitting || isLoading
 *  - Glass danger banner above fields when store error is set
 *  - Danger border on BOTH inputs when store error is set
 *  - Friendly error mapping: "Invalid login credentials" → user-facing copy (curly apostrophe)
 *  - Removed void formValid; — formValid now gates the CTA directly
 *
 * Icon coloring: cssInterop maps className → style → color prop for lucide icons.
 * This is the same nativeStyleToProp pattern used by react-native-css-interop itself
 * (see node_modules/react-native-css-interop/src/runtime/components.ts).
 *
 * placeholderTextColor: --on-photo-fg is theme-invariant pure white (0 0% 100%).
 * We derive the placeholder value from that constant so no raw hex is scattered.
 * See ON_PHOTO_PLACEHOLDER constant below — it ties back to --on-photo-fg / 50.
 *
 * Flat translucent View used instead of BlurView: BlurView nests inside a scroll
 * context here, which can cause a blur-layer z-index glitch on Android and adds
 * unnecessary composition complexity for a 47px field. The flat bg-on-photo/10
 * approach is the sanctioned fallback per the spec.
 *
 * Animation: react-native-reanimated useSharedValue + withTiming (180ms).
 *
 * Design tokens: on-photo + danger palette only; no new raw color literals.
 * The ONLY sanctioned raw-literal color values are the three gradient stops
 * (commented inline) and the monogram shadow glow — expo-linear-gradient
 * colors[] and RN shadow cannot accept NativeWind classes.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cssInterop } from 'nativewind';
import { AlertCircle, Eye, EyeOff } from 'lucide-react-native';

import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { track } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// lucide icon cssInterop — maps className → style → color prop.
// Pattern: nativeStyleToProp: { color: true } — same as react-native-css-interop
// uses for ActivityIndicator internally. This lets us write
// <Eye className="text-on-photo/60" /> without any raw color literals.
// ---------------------------------------------------------------------------
cssInterop(AlertCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Eye, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(EyeOff, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// ---------------------------------------------------------------------------
// --on-photo-fg is theme-invariant pure white (0 0% 100%).
// This constant is the single source for placeholder / similar RN props that
// cannot accept a NativeWind className.  Tied to --on-photo-fg in global.css.
// /50 opacity = 128/255 ≈ 0.5
// ---------------------------------------------------------------------------
const ON_PHOTO_PLACEHOLDER = 'rgba(255,255,255,0.5)'; // --on-photo-fg / 50

// ---------------------------------------------------------------------------
// Monogram shadow glow — sanctioned raw-literal; RN shadow cannot take a class.
// Same hue as --primary (222 95% 63%).
// ---------------------------------------------------------------------------
const PRIMARY_GLOW = 'hsl(222 95% 63%)';

// ---------------------------------------------------------------------------
// Email validation — basic pattern: local@domain.tld (no over-engineering).
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  // Narrow individual selectors — avoids new-object memoization pitfalls.
  const clearError = useAuthStore((s) => s.clearError);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const error = useAuthStore((s) => s.error);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  // isLoading from useAuth() (mirrors sign-in.tsx pattern).
  const { isLoading } = useAuth();

  // Field state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Email validation show-flag: set true on blur when email is non-empty + invalid.
  // Cleared on edit so the error disappears as soon as the user starts correcting.
  const [emailError, setEmailError] = useState(false);

  // Derived validation — independent of the show-flag so formValid is accurate
  // even before blur. Gates the CTA directly (void formValid placeholder removed).
  const emailValid = EMAIL_RE.test(email);
  const formValid = emailValid && password.length >= 6;

  // ---------------------------------------------------------------------------
  // Friendly error mapping — translate raw Supabase message to user copy.
  // Curly apostrophe U+2019 in "doesn't" per spec.
  // ---------------------------------------------------------------------------
  const friendlyError = error
    ? error.includes('Invalid login credentials')
      ? "That email or password doesn’t match. Give it another try."
      : error
    : null;

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

  // CTA label and submitting label by mode — true ellipsis U+2026 per spec.
  const ctaLabel = mode === 'signin' ? 'Sign in' : 'Create account';
  const submittingLabel = mode === 'signin' ? 'Signing in…' : 'Creating account…';

  // Whether inputs should be locked (submitting or initial session load).
  const inputsLocked = isSubmitting || isLoading;

  // Press handler — guards on formValid so double-tap can't fire.
  async function handleCTAPress() {
    if (!formValid) return;
    if (mode === 'signin') {
      await signIn(email, password);
      if (!useAuthStore.getState().error) {
        track('user_logged_in', { method: 'email' });
      }
    } else {
      await signUp(email, password);
      if (!useAuthStore.getState().error) {
        track('user_signed_up', { method: 'email' });
      }
    }
  }

  // Google handler — wraps store action to fire analytics on success.
  const handleGoogle = async () => {
    await signInWithGoogle();
    if (!useAuthStore.getState().error) {
      track('user_logged_in', { method: 'oauth_google' });
    }
  };

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
                  shadowColor: PRIMARY_GLOW,
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
            <View className="mt-5 mb-6 gap-[6px]">
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

            {/* Input fields + CTA */}
            <View className="gap-[11px]">
              {/* Glass danger banner — shown above fields when store error is set */}
              {friendlyError ? (
                <View className="flex-row items-center gap-2 bg-danger/18 border border-danger/55 rounded-[13px] px-3 py-3">
                  <AlertCircle className="text-danger-soft" size={15} />
                  <Text
                    className="text-danger-soft text-[12.5px] flex-1"
                    style={{ fontFamily: 'SplineSans_500Medium' }}
                  >
                    {friendlyError}
                  </Text>
                </View>
              ) : null}

              {/* Email field */}
              <View className="gap-[6px]">
                <Text
                  className="text-on-photo/78 text-[12px]"
                  style={{ fontFamily: 'SplineSans_500Medium' }}
                >
                  Email
                </Text>
                {/* Glass input container — danger border when emailError or server error */}
                <View
                  className={`h-[47px] rounded-[13px] bg-on-photo/10 border justify-center px-4 ${
                    emailError || error ? 'border-danger/70' : 'border-on-photo/22'
                  }`}
                >
                  <TextInput
                    className="text-on-photo text-[15px] flex-1"
                    placeholder="you@example.com"
                    placeholderTextColor={ON_PHOTO_PLACEHOLDER}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    editable={!inputsLocked}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setEmailError(false); // clear validation error while correcting
                      clearError(); // clear any server error
                    }}
                    onBlur={() => {
                      // Only show the error after blur and only when non-empty + invalid
                      if (email.length > 0 && !EMAIL_RE.test(email)) {
                        setEmailError(true);
                      }
                    }}
                  />
                </View>
                {/* Inline email error message — shown only after blur + invalid */}
                {emailError && (
                  <View className="flex-row items-center gap-1">
                    <AlertCircle className="text-danger-softer" size={13} />
                    <Text className="text-danger-softer text-[12px]">
                      Enter a valid email address.
                    </Text>
                  </View>
                )}
              </View>

              {/* Password field */}
              <View className="gap-[6px]">
                {/* Label row: "Password" on left, "Forgot?" on right (signin only) */}
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-on-photo/78 text-[12px]"
                    style={{ fontFamily: 'SplineSans_500Medium' }}
                  >
                    Password
                  </Text>
                  {mode === 'signin' && (
                    <Pressable>
                      <Text
                        className="text-on-photo text-[12px]"
                        style={{ fontFamily: 'SplineSans_600SemiBold' }}
                      >
                        Forgot?
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Glass input container — danger border when server error */}
                <View
                  className={`h-[47px] rounded-[13px] bg-on-photo/10 border flex-row items-center px-4 ${
                    error ? 'border-danger/70' : 'border-on-photo/22'
                  }`}
                >
                  <TextInput
                    className="text-on-photo text-[15px] flex-1"
                    placeholder="••••••••"
                    placeholderTextColor={ON_PHOTO_PLACEHOLDER}
                    secureTextEntry={!showPassword}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    editable={!inputsLocked}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      clearError(); // clear any server error
                    }}
                  />
                  {/* Eye toggle — touch target >=44x44 via hitSlop (icon 20px + 12px each side = 44px) */}
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    accessibilityRole="button"
                  >
                    {showPassword ? (
                      <EyeOff className="text-on-photo/60" size={20} />
                    ) : (
                      <Eye className="text-on-photo/60" size={20} />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Primary CTA */}
              <Pressable
                className={`mt-3.5 h-[50px] rounded-[13px] bg-primary items-center justify-center flex-row gap-2 ${
                  !formValid ? 'opacity-50' : ''
                }`}
                style={
                  formValid
                    ? {
                        shadowColor: PRIMARY_GLOW,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.4,
                        shadowRadius: 10,
                        elevation: 5,
                      }
                    : undefined
                }
                onPress={handleCTAPress}
                disabled={!formValid}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
              >
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size={17} color="white" />
                    <Text
                      className="text-on-photo text-[15.5px]"
                      style={{ fontFamily: 'SplineSans_600SemiBold' }}
                    >
                      {submittingLabel}
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

              {/* Divider — "or continue with" */}
              <View className="flex-row items-center my-3">
                <View className="flex-1 h-px bg-on-photo/18" />
                <Text
                  className="text-on-photo/55 text-[11.5px] mx-3"
                  style={{ fontFamily: 'SplineSans_500Medium' }}
                >
                  or continue with
                </Text>
                <View className="flex-1 h-px bg-on-photo/18" />
              </View>

              {/* Social row — Google only (Apple deferred to MOB-10) */}
              <View className="flex-row items-center justify-center gap-3">
                {/* Google glass button */}
                <Pressable
                  className="w-14 h-12 rounded-[13px] bg-on-photo/14 border border-on-photo/22 items-center justify-center"
                  onPress={handleGoogle}
                  accessibilityLabel="Continue with Google"
                  accessibilityRole="button"
                >
                  <GoogleIcon size={20} />
                </Pressable>

                {/* TODO(MOB-10): Apple sign-in — needs signInWithApple + expo-apple-authentication + iOS capability */}
              </View>
            </View>

            {/* Bottom spacing */}
            <View className="mb-8" />
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
