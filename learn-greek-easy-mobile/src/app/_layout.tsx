import '@/global.css';
import {
  SplineSans_400Regular,
  SplineSans_500Medium,
  SplineSans_600SemiBold,
  SplineSans_700Bold,
} from '@expo-google-fonts/spline-sans';
import {
  InterTight_600SemiBold,
  InterTight_700Bold,
} from '@expo-google-fonts/inter-tight';
import {
  NotoSerif_400Regular,
  NotoSerif_400Regular_Italic,
} from '@expo-google-fonts/noto-serif';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { PostHogProvider } from 'posthog-react-native';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ToastProvider } from '@/components/ui/toast';
import { useAuth } from '@/hooks/use-auth';
import { useUserSettings } from '@/hooks/use-user-settings';
import { getPostHog, registerSuperProperties } from '@/lib/analytics/posthog';
import { queryClient } from '@/lib/query-client';
import { initSentry } from '@/lib/sentry';

initSentry();

// Declare (app) as the anchor so Stack.Protected falls through to (auth)/login
// when guard=false, instead of landing on the default root index.
export const unstable_settings = { anchor: '(app)' };

/**
 * Inner navigator rendered inside QueryClientProvider + ThemeProvider.
 * Must be a separate component so useUserSettings() (which calls useQuery)
 * runs inside the QueryClientProvider — calling it in RootLayout would throw
 * "No QueryClient set" because the provider is established by RootLayout's
 * own return value.
 */
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, isLoading } = useAuth();
  const settingsQuery = useUserSettings(); // enabled: !!session

  // For a signed-out session, settingsQuery is disabled:
  //   isPending=true (no data ever fetched) BUT isLoading=false
  //   (isLoading = isPending && isFetching; disabled queries never fetch).
  // Using isLoading (not isPending) means the gate resolves immediately
  // when signed out — isPending would hang the splash forever.
  const onboardingComplete = settingsQuery.data?.tour_completed_at != null;
  const ready = !isLoading && fontsReady && !settingsQuery.isLoading;

  return (
    <>
      <AnimatedSplashOverlay isReady={ready} />
      {ready && (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!!session && !onboardingComplete}>
            <Stack.Screen name="(onboarding)" />
          </Stack.Protected>
          <Stack.Protected guard={!!session && onboardingComplete}>
            <Stack.Screen name="(app)" />
            {/* Deck detail is a root-stack push so it covers the (app) tab bar
                (MOB-07 handoff: deck detail has no tab bar). */}
            <Stack.Screen name="decks/[deckId]" />
            {/* Word detail is a root-stack push (MOB-12: nested under deck). */}
            <Stack.Screen name="decks/[deckId]/[wordId]" />
            {/* Card review is a root-stack push (MOB-09: SRS flashcard loop). */}
            <Stack.Screen name="decks/[deckId]/review" />
            {/* Situation flow is a root-stack push so it covers the (app) tab bar
                (MOB-08 handoff: situation flow has no tab bar). */}
            <Stack.Screen name="situations/[situationId]" />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      )}
    </>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SplineSans_400Regular,
    SplineSans_500Medium,
    SplineSans_600SemiBold,
    SplineSans_700Bold,
    InterTight_600SemiBold,
    InterTight_700Bold,
    NotoSerif_400Regular,
    NotoSerif_400Regular_Italic,
    SpaceMono_400Regular,
  });

  // Proceed even if fonts fail — system fonts are the graceful fallback.
  const fontsReady = fontsLoaded || !!fontError;

  const colorScheme = useColorScheme();
  const posthog = getPostHog();

  useEffect(() => {
    if (fontError) {
      Sentry.captureException(fontError);
    }
  }, [fontError]);

  useEffect(() => {
    registerSuperProperties(colorScheme ?? 'light');
  }, [colorScheme]);

  const navigator = (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RootNavigator fontsReady={fontsReady} />
    </ThemeProvider>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {posthog ? (
          <PostHogProvider client={posthog} autocapture={false}>
            {navigator}
          </PostHogProvider>
        ) : (
          navigator
        )}
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
