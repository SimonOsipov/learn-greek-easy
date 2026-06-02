import '@/global.css';
import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useAuth } from '@/hooks/use-auth';
import { queryClient } from '@/lib/query-client';
import { initSentry } from '@/lib/sentry';

initSentry();

// Declare (app) as the anchor so Stack.Protected falls through to (auth)/login
// when guard=false, instead of landing on the default root index.
export const unstable_settings = { anchor: '(app)' };

function RootLayout() {
  const colorScheme = useColorScheme();
  const { session, isLoading } = useAuth();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay isReady={!isLoading} />
        {!isLoading && (
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
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
