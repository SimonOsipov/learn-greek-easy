/**
 * CategoryBar — single topic progress bar for the "By topic" section.
 *
 * Layout: label (fg) + mono % (fg-2) on a baseline grid, then a 6px track below.
 * Fill colour: green ≥70%, primary 40–70%, orange <40%.
 * MOB-13 safe: strong/weak colours are explicit rgb values (no /NN modifiers);
 * the mid-range fill uses the `primary` design token via style directly.
 */
import { View, Text } from 'react-native';

import { scoreBarColor } from '@/lib/culture/presentation';

interface CategoryBarProps {
  /** English display label */
  label: string;
  /** Score ratio 0–1 */
  pct: number;
}

// Primary token hex for inline style on the fill bar (MOB-13: inline style, not /NN modifier)
// hsl(221 83% 53%) = rgb(36,99,235) — light-theme primary
const PRIMARY_RGB = 'rgb(36,99,235)';

export function CategoryBar({ label, pct }: CategoryBarProps) {
  const fixedColor = scoreBarColor(pct);
  const fillColor = fixedColor ?? PRIMARY_RGB;
  const pctDisplay = Math.round(pct * 100);

  return (
    <View>
      {/* Label row */}
      <View className="flex-row justify-between items-baseline mb-1">
        <Text
          className="text-fg"
          style={{ fontSize: 13, fontWeight: '600' }}
        >
          {label}
        </Text>
        <Text
          className="text-fg2"
          style={{
            fontFamily: 'SpaceMono_400Regular',
            fontSize: 11,
            fontWeight: '700',
          }}
        >
          {pctDisplay}%
        </Text>
      </View>
      {/* Track */}
      <View
        className="rounded-full overflow-hidden bg-line"
        style={{ height: 6 }}
      >
        {/* Fill */}
        <View
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            backgroundColor: fillColor,
            borderRadius: 9999,
          }}
        />
      </View>
    </View>
  );
}
