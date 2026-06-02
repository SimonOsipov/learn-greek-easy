/**
 * Placeholder login UI only.
 *
 * Real auth (Supabase sign-in / Google OAuth) is owned by MOB-03
 * (see src/app/sign-in.tsx and the auth-store / use-auth hooks).
 * This file is the redirect target for the root Stack protected guard
 * (SHELL-03) when the user is signed out. Auth wiring is intentionally
 * absent here so that MOB-03 can own it without coupling to this screen.
 *
 * Styling: NativeWind App-palette tokens only — no raw hex, no StyleSheet,
 * no arbitrary [value] Tailwind classes.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Placeholder toggle — real sign-in is MOB-03's responsibility.

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        contentContainerClassName="flex-grow px-6 py-10 gap-5"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-2">
          <Text className="text-fg text-2xl font-semibold">Welcome back</Text>
          <Text className="text-fg2 text-sm mt-1">Sign in to continue learning Greek</Text>
        </View>

        {/* Input fields — bound to local state only, no auth action */}
        <View className="gap-3">
          <TextInput
            className="rounded-lg bg-card border border-input px-4 py-3 text-fg text-base"
            placeholder="Email"
            placeholderTextColor="var(--fg3)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
          />
          <TextInput
            className="rounded-lg bg-card border border-input px-4 py-3 text-fg text-base"
            placeholder="Password"
            placeholderTextColor="var(--fg3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            autoCorrect={false}
          />
        </View>

        {/* Primary affordance — onPress is a no-op placeholder.
            Real Supabase sign-in is MOB-03's job. */}
        <Pressable
          className="rounded-lg bg-primary px-4 py-3 items-center active:opacity-80"
          onPress={() => { /* no-op — real sign-in is MOB-03's responsibility */ }}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <Text className="text-card font-semibold text-base">Sign in</Text>
        </Pressable>

        {/* Divider */}
        <View className="flex-row items-center gap-3">
          <View className="flex-1 h-px bg-line" />
          <Text className="text-fg2 text-xs">or</Text>
          <View className="flex-1 h-px bg-line" />
        </View>

        {/* Google affordance — no-op placeholder */}
        <Pressable
          className="rounded-lg bg-card border border-line-2 px-4 py-3 items-center active:opacity-80"
          onPress={() => {
            // no-op — real Google OAuth is MOB-03's responsibility
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <Text className="text-fg font-semibold text-base">Continue with Google</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
