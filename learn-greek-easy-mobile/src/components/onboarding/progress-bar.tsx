/**
 * ProgressBar — 4-segment step indicator for onboarding screens (MOB-14).
 *
 * Filled segments use `bg-on-photo` (opaque white); remaining segments use
 * `bg-on-photo-25` (rgba(255,255,255,0.25)). The `on-photo-25` token is defined
 * in tailwind.config.js per MOB-13: no /NN modifier on var-backed tokens on native.
 */
import { View } from 'react-native';

interface ProgressBarProps {
  /** Current step, 1-based. Segments 1..step are filled. */
  step: number;
  /** Total segments. Defaults to 4. */
  total?: number;
}

export function ProgressBar({ step, total = 4 }: ProgressBarProps) {
  return (
    <View className="flex-row gap-[6px]">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`flex-1 h-[4px] rounded-full ${i < step ? 'bg-on-photo' : 'bg-on-photo-25'}`}
        />
      ))}
    </View>
  );
}
