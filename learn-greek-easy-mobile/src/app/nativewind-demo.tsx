/**
 * NativeWind demo screen — className-only, no StyleSheet, no raw hex.
 * Exercises App-palette tokens from global.css and explicit dark: variants.
 * Not linked from any tab bar; accessible as a route for dev inspection.
 */
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';

export default function NativeWindDemo() {
  const { colorScheme } = useColorScheme();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Card */}
      <View className="m-4 p-4 rounded-lg bg-card border border-line">
        <Text className="text-fg text-xl font-semibold">NativeWind Token Demo</Text>
        <Text className="text-fg2 mt-1">
          Active scheme: <Text className="text-primary">{colorScheme ?? 'unknown'}</Text>
        </Text>

        {/* Secondary text — dark variant flips to accent-2 */}
        <Text className="text-fg dark:text-accent-2 mt-2 text-sm">
          This text is fg in light mode and accent-2 in dark mode.
        </Text>

        {/* Primary action pill */}
        <View className="mt-3 px-4 py-2 rounded-md bg-primary self-start">
          <Text className="text-card font-medium">Primary</Text>
        </View>

        {/* Border that flips accent in dark */}
        <View className="mt-3 h-10 rounded-md border border-line dark:border-accent-2" />
      </View>

      {/* Secondary card */}
      <View className="mx-4 p-4 rounded-lg bg-bg-2 border border-line-2">
        <Text className="text-fg2 text-sm">
          bg-bg-2 / border-line-2 — secondary surface tokens
        </Text>
        <View className="mt-2 px-3 py-1.5 rounded-md bg-accent self-start">
          <Text className="text-card text-sm">Accent</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
