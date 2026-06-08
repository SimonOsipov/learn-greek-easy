import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text } from 'react-native';

export default function DecksScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 items-center justify-center gap-2">
        <Text className="text-fg text-2xl font-bold">Decks</Text>
        <Text className="text-fg2 text-sm">Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}
