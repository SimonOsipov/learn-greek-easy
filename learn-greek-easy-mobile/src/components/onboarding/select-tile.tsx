/**
 * SelectTile — single-select option tile for onboarding steps (MOB-14).
 *
 * Unselected: glass surface (GlassFill bg-on-photo-10) + border-on-photo-22,
 *             white `text-on-photo` labels, `rounded-[16px]`.
 * Selected:   bg-on-photo-96 fill + `text-on-photo-active` (navy) labels
 *             + trailing Check icon (navy).
 *
 * MOB-13: no /NN opacity modifier on var-backed tokens. All translucent values
 * use explicit full-color tokens from tailwind.config.js.
 *
 * Leading icon color: text-on-photo (unselected) → text-on-photo-active (selected).
 * cssInterop wiring matches the login screen pattern (lines 65-67 of login.tsx).
 */
import { Pressable, View, Text } from 'react-native';
import type { ReactNode } from 'react';
import { cssInterop } from 'nativewind';
import { Check } from 'lucide-react-native';
import { GlassFill } from '@/components/glass-fill';

// Wire lucide Check icon so className="text-*" colors the stroke (same pattern as login).
cssInterop(Check, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface SelectTileProps {
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  /** Optional leading icon element (e.g. a cssInterop'd lucide icon). */
  leadingIcon?: ReactNode;
  /** Optional trailing node — e.g. estimated time badge for Step 3. */
  trailingMeta?: ReactNode;
  /** Accessible value identifier (e.g. the option key). */
  value?: string;
}

export function SelectTile({
  label,
  subtitle,
  selected,
  onPress,
  leadingIcon,
  trailingMeta,
  value,
}: SelectTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={value ?? label}
      className={`overflow-hidden rounded-[16px] border ${
        selected ? 'border-on-photo-22 bg-on-photo-96' : 'border-on-photo-22'
      }`}
    >
      {/* Glass fill — only shown when unselected (selected has solid bg-on-photo-96) */}
      {!selected && <GlassFill tintClass="bg-on-photo-10" />}

      <View className="flex-row items-center px-4 py-[14px] gap-3">
        {/* Leading icon slot — icon element must carry its own color className
            (e.g. <Plane className="text-on-photo-active" />) so the cssInterop
            color prop maps correctly. A color class on this View has no effect
            on lucide icon stroke color. */}
        {leadingIcon != null && <View>{leadingIcon}</View>}

        {/* Label + subtitle block */}
        <View className="flex-1 gap-[2px]">
          <Text
            className={`text-[15px] ${selected ? 'text-on-photo-active' : 'text-on-photo'}`}
            style={{ fontFamily: 'SplineSans_600SemiBold' }}
          >
            {label}
          </Text>
          {subtitle != null && (
            <Text
              className={`text-[12.5px] ${selected ? 'text-on-photo-active' : 'text-on-photo-72'}`}
              style={{ fontFamily: 'SplineSans_400Regular' }}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Trailing meta slot (e.g. time estimate + badge) */}
        {trailingMeta != null && <View>{trailingMeta}</View>}

        {/* Trailing check — shown when selected */}
        {selected && <Check className="text-on-photo-active" size={18} />}
      </View>
    </Pressable>
  );
}
