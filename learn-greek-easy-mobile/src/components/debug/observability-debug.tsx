import { Pressable, Text, View } from 'react-native';

import { track } from '@/lib/analytics';
import { useAuth } from '@/hooks/use-auth';

/**
 * Dev-only smoke-test panel for the observability pipelines.
 * Rendered exclusively when __DEV__ is true; the call-site also wraps
 * it in a ternary so it is double-gated and never reaches a release build.
 */
export function ObservabilityDebug() {
  // Hooks must be called unconditionally (Rules of Hooks).
  // The guard below still short-circuits rendering in non-dev builds,
  // but the hook call itself cannot be skipped.
  const { user } = useAuth();

  if (!__DEV__) return null;

  return (
    <View className="mx-4 p-4 rounded-lg bg-card border border-line">
      <Text className="text-fg text-base font-semibold">Observability Debug (dev)</Text>

      {user?.id ? (
        <Text className="text-fg2 text-sm mt-1">user.id: {user.id}</Text>
      ) : null}

      <View className="gap-3 mt-3">
        {/* Button A — Throw test error
            Thrown asynchronously so it escapes the React call stack and
            reaches Sentry's global handler.
            In dev this triggers the RN redbox; in a release/preview build
            with a DSN configured it reports to Sentry source-mapped. */}
        <Pressable
          className="rounded-lg bg-danger px-4 py-3 items-center active:opacity-80"
          onPress={() => {
            setTimeout(() => {
              throw new Error('OBSRV debug test error');
            }, 0);
          }}
          accessibilityRole="button"
          accessibilityLabel="Throw test error"
        >
          <Text className="text-card font-semibold text-base">Throw test error</Text>
        </Pressable>

        {/* Button B — Send test event
            Throwaway dev-only smoke event; relies on the global identify
            (OBSRV-04) for distinct_id — no PII passed here. */}
        <Pressable
          className="rounded-lg bg-accent px-4 py-3 items-center active:opacity-80"
          onPress={() => track('debug_event_fired')}
          accessibilityRole="button"
          accessibilityLabel="Send test event"
        >
          <Text className="text-card font-semibold text-base">Send test event</Text>
        </Pressable>
      </View>
    </View>
  );
}
