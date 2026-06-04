import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { useDecks } from '@/hooks/use-decks';
import { ObservabilityDebug } from '@/components/debug/observability-debug';

export default function HomeScreen() {
  const { user } = useAuth();
  const { data, isLoading, error } = useDecks();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Login-success confirmation — visible proof the auth gate was passed.
          Independent of the API call below, so it stays green even when the
          backend (API_URL) is unset. */}
      <View className="m-4 p-4 rounded-lg bg-card border border-success items-center">
        <Text className="text-success text-2xl font-bold">Success! 🎉</Text>
        <Text className="text-fg mt-1 text-base font-semibold">You’re logged in</Text>
        {user?.email ? (
          <Text className="text-fg2 mt-1 text-sm">Signed in as {user.email}</Text>
        ) : null}
      </View>

      <View className="mx-4 p-4 rounded-lg bg-card border border-line">
        <Text className="text-fg text-base font-semibold mb-2">Decks (API proof)</Text>
        {isLoading ? (
          <View className="flex-row items-center">
            <ActivityIndicator />
            <Text className="text-fg2 ml-2 text-sm">Loading decks…</Text>
          </View>
        ) : error ? (
          <Text className="text-danger text-sm">Failed to load decks: {error.message}</Text>
        ) : !data || data.decks.length === 0 ? (
          <Text className="text-fg3 text-sm">No decks found.</Text>
        ) : (
          <View>
            <Text className="text-fg2 text-sm mb-1">
              {data.total} deck{data.total === 1 ? '' : 's'} from the live backend:
            </Text>
            {data.decks.slice(0, 3).map((deck) => (
              <Text key={deck.id} className="text-fg text-sm">
                • {deck.name}
              </Text>
            ))}
          </View>
        )}
      </View>

      {__DEV__ ? <ObservabilityDebug /> : null}
    </SafeAreaView>
  );
}
