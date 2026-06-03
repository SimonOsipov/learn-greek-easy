/**
 * LOGIN-04 (MOB-09) — over-photo login SHELL.
 *
 * Renders the hero background, gradient scrim, brand row, and heading block.
 * Mode state, input fields, CTA, and social login arrive in later subtasks.
 *
 * Design tokens: on-photo palette + App primary only.
 * The ONLY sanctioned raw-literal color values are the three gradient stops
 * below (commented inline) — expo-linear-gradient colors[] cannot accept
 * NativeWind class references.
 */
import { ImageBackground, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
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

            {/* Spacer — pushes heading block to bottom */}
            <View className="flex-1" />

            {/* Heading block */}
            <View className="mb-8 gap-[6px]">
              <Text
                className="text-on-photo text-[29px] tracking-tight"
                style={{ fontFamily: 'InterTight_700Bold' }}
              >
                Welcome back
              </Text>
              <Text
                className="text-on-photo/72 text-[13.5px] font-sans"
              >
                Sign in to continue your Greek journey.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}
