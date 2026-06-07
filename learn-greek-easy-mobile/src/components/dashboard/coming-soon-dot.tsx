/**
 * ComingSoonDot — solid 8×8 danger-coloured dot used as a "coming soon" affordance.
 *
 * MOB-13 SAFE: uses solid `bg-danger` token ONLY. No opacity modifier is applied
 * (the NativeWind v4 defect routes var-backed tokens through unsupported color-mix()
 * and renders dark on native when a numeric opacity suffix is used).
 * If a translucent danger surface is ever needed elsewhere, use the explicit
 * `danger-18 / danger-55 / danger-70` rgba tokens defined in tailwind.config.js.
 */
import { View } from 'react-native';

/**
 * A solid 8×8 red dot using the `bg-danger` design token.
 * Used as a leading indicator on "coming soon" Kicker labels and cards.
 */
export function ComingSoonDot() {
  return (
    <View
      testID="coming-soon-dot"
      className="w-2 h-2 rounded-full bg-danger"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
