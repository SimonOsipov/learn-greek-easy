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
import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { PostHogProvider } from 'posthog-react-native';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useAuth } from '@/hooks/use-auth';
import { getPostHog, registerSuperProperties } from '@/lib/analytics/posthog';
import { queryClient } from '@/lib/query-client';
import { initSentry } from '@/lib/sentry';

initSentry();

// Declare (app) as the anchor so Stack.Protected falls through to (auth)/login
// when guard=false, instead of landing on the default root index.
export const unstable_settings = { anchor: '(app)' };

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SplineSans_400Regular,
    SplineSans_500Medium,
    SplineSans_600SemiBold,
    SplineSans_700Bold,
    InterTight_600SemiBold,
    InterTight_700Bold,
  });

  // Proceed even if fonts fail — system fonts are the graceful fallback.
  const fontsReady = fontsLoaded || !!fontError;

  const colorScheme = useColorScheme();
  const { session, isLoading } = useAuth();
  const posthog = getPostHog();

  useEffect(() => {
    if (fontError) {
      Sentry.captureException(fontError);
    }
  }, [fontError]);

  useEffect(() => {
    registerSuperProperties(colorScheme ?? 'light');
  }, [colorScheme]);

  const tree = (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay isReady={!isLoading && fontsReady} />
      {!isLoading && fontsReady && (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      )}
    </ThemeProvider>
  );

  return (
    <QueryClientProvider client={queryClient}>
      {posthog ? (
        <PostHogProvider client={posthog} autocapture={false}>
          {tree}
        </PostHogProvider>
      ) : (
        tree
      )}
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
