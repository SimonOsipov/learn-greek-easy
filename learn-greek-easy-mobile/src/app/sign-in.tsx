/**
 * AUTH-09 — minimal sign-in harness (throwaway-grade).
 * A single self-contained route that exercises all four auth flows.
 * MOB-04 will own the real (auth) group structure; this file is
 * intentionally kept outside any route group so MOB-04 can cleanly
 * replace it without touching the (auth)/ directory it will create.
 *
 * Styling: NativeWind App-palette tokens only — no raw hex, no StyleSheet.
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { session, user, isLoading } = useAuth();
  const error = useAuthStore((s) => s.error);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signOut = useAuthStore((s) => s.signOut);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        contentContainerClassName="flex-grow px-6 py-8 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-2">
          <Text className="text-fg text-2xl font-semibold">Auth Harness</Text>
          <Text className="text-fg2 text-sm mt-1">MOB-03 dev screen</Text>
        </View>

        {/* Session status */}
        <View className="rounded-lg bg-card border border-line p-4">
          {session ? (
            <>
              <Text className="text-success font-medium">Signed in</Text>
              <Text className="text-fg2 text-sm mt-1">{user?.email}</Text>
            </>
          ) : (
            <Text className="text-fg2">No active session</Text>
          )}
        </View>

        {/* Error banner */}
        {error ? (
          <View className="rounded-lg bg-danger/10 border border-danger px-4 py-3">
            <Text className="text-danger text-sm">{error}</Text>
          </View>
        ) : null}

        {/* Credentials inputs */}
        <View className="gap-3">
          <TextInput
            className="rounded-lg bg-card border border-input px-4 py-3 text-fg text-base"
            placeholder="Email"
            placeholderTextColor="hsl(var(--fg-3))"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!isLoading}
          />
          <TextInput
            className="rounded-lg bg-card border border-input px-4 py-3 text-fg text-base"
            placeholder="Password"
            placeholderTextColor="hsl(var(--fg-3))"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        {/* Loading indicator */}
        {isLoading ? (
          <View className="items-center py-2">
            <ActivityIndicator className="text-primary" />
          </View>
        ) : null}

        {/* Action buttons */}
        <View className="gap-3">
          <Pressable
            className="rounded-lg bg-primary px-4 py-3 items-center active:opacity-80 disabled:opacity-50"
            onPress={() => signIn(email, password)}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text className="text-card font-semibold text-base">Sign in</Text>
          </Pressable>

          <Pressable
            className="rounded-lg bg-accent px-4 py-3 items-center active:opacity-80 disabled:opacity-50"
            onPress={() => signUp(email, password)}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Sign up"
          >
            <Text className="text-card font-semibold text-base">Sign up</Text>
          </Pressable>

          <Pressable
            className="rounded-lg bg-card border border-line-2 px-4 py-3 items-center active:opacity-80 disabled:opacity-50"
            onPress={() => signInWithGoogle()}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <Text className="text-fg font-semibold text-base">Continue with Google</Text>
          </Pressable>

          <Pressable
            className="rounded-lg bg-bg-2 border border-line px-4 py-3 items-center active:opacity-80 disabled:opacity-50"
            onPress={() => signOut()}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text className="text-fg2 font-medium text-base">Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
