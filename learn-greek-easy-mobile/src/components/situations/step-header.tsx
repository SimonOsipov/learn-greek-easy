/**
 * StepHeader — close button + step dots + current/total counter (MOB-08).
 * Used above retelling and exercise steps in the situation flow.
 */
import { View, Text, Pressable } from 'react-native';
import { X } from 'lucide-react-native';

// Icon colours — fixed, not token-backed
// #34: rgb(100,116,139) is slate-500 / --practice-text-muted, NOT --fg-3.
// Using intentionally for the situation flow close icon (matches close icons on other screens).
const ICON_FG = 'rgb(100,116,139)'; // --practice-text-muted (slate-500) — intentional

export interface StepHeaderProps {
  /** Zero-based current step index (0 = first inner step after cover). */
  currentIndex: number;
  /** Total number of inner steps (retellings + exercises). */
  total: number;
  onClose: () => void;
  topOffset?: number;
}

export function StepHeader({ currentIndex, total, onClose, topOffset = 0 }: StepHeaderProps) {
  return (
    <View
      testID="step-header"
      className="flex-row items-center gap-2 px-[18px] pb-1.5"
      style={{ paddingTop: topOffset + 10 }}
    >
      {/* Close button */}
      <Pressable
        testID="step-header-close"
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        className="w-8 h-8 rounded-full items-center justify-center active:opacity-60"
      >
        <X size={20} color={ICON_FG} strokeWidth={2} />
      </Pressable>

      {/* Step dots */}
      <View className="flex-1 flex-row gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            testID={`step-dot-${i}`}
            className={`flex-1 rounded-full ${i <= currentIndex ? 'bg-primary' : 'bg-line'}`}
            style={{ height: 4 }}
          />
        ))}
      </View>

      {/* Counter */}
      <Text
        testID="step-counter"
        className="text-fg2 text-[12px] font-bold"
        style={{ fontFamily: 'SpaceMono_400Regular', minWidth: 30, textAlign: 'right' }}
      >
        {currentIndex + 1}/{total}
      </Text>
    </View>
  );
}
