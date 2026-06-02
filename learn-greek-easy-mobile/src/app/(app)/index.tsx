import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="m-4 p-4 rounded-lg bg-card border border-line">
        <Text className="text-fg text-xl font-semibold">Home</Text>
        <Text className="text-fg2 mt-1 text-sm">Your learning journey starts here.</Text>
      </View>
    </SafeAreaView>
  );
}
