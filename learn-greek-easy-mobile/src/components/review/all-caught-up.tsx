/**
 * AllCaughtUp — empty queue state (MOB-09).
 *
 * Shows: big check icon, "All caught up" heading, hint line, "Back to deck" button.
 * MOB-13: no /NN opacity modifier on var-backed tokens.
 */
import { View, Text, Pressable } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

// MOB-13: explicit rgba
const CORRECT_BG  = 'rgba(20,184,103,0.12)';
const CORRECT_FG  = 'rgb(20,184,103)';

export interface AllCaughtUpProps {
  isDark: boolean;
  onBackToDeck: () => void;
  testID?: string;
}

export function AllCaughtUp({ isDark, onBackToDeck, testID }: AllCaughtUpProps) {
  const accentFg = isDark ? 'rgb(129,140,248)' : 'rgb(79,70,229)'; // --practice-accent

  return (
    <View
      testID={testID ?? 'review-all-caught-up'}
      className="flex-1 items-center justify-center px-8"
    >
      {/* Check icon */}
      <View
        className="w-24 h-24 rounded-[28px] items-center justify-center mb-6"
        style={{ backgroundColor: CORRECT_BG }}
      >
        <CheckCircle2 size={48} color={CORRECT_FG} strokeWidth={1.8} />
      </View>

      {/* Heading */}
      <Text
        testID="review-caught-up-heading"
        className="text-practice-text text-[30px] font-bold tracking-tight mb-3 text-center"
        style={{ fontFamily: 'InterTight_700Bold', letterSpacing: -0.8 }}
      >
        All caught up
      </Text>

      {/* Hint */}
      <Text
        testID="review-caught-up-hint"
        className="text-practice-text-muted text-[14px] text-center leading-relaxed mb-8"
      >
        No cards due in this deck right now. Come back later, or study ahead.
      </Text>

      {/* Back button */}
      <Pressable
        testID="review-caught-up-back-btn"
        accessibilityRole="button"
        onPress={onBackToDeck}
        className="w-full py-4 rounded-lg items-center justify-center active:opacity-70"
        style={{ backgroundColor: accentFg }}
      >
        <Text className="text-[16px] font-bold" style={{ color: '#fff' }}>Back to deck</Text>
      </Pressable>
    </View>
  );
}
