/**
 * GlassFill — frosted-glass background for on-photo surfaces (README §Glass/blur).
 * A leaf BlurView (absolute) + translucent tint overlay, sitting BEHIND the
 * surface's content. Kept as a LEAF (never wrapping a ScrollView) to avoid the
 * Android blur z-index glitch noted in MOB-09. Parent must be `overflow-hidden`
 * so the blur respects the rounded corners.
 *
 * tintClass is a CLOSED union of real token classes (MOB-13 guard: no /NN opacity
 * modifier on var-backed tokens — the design's translucent values are explicit
 * full-color rgba tokens in tailwind.config.js).
 *
 * Extracted from src/app/(auth)/login.tsx as part of MOB-14 ONB-06.
 */
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

// Closed union of all real on-photo tint token classes.
// Adding a new tint step requires a corresponding explicit token in tailwind.config.js.
export type GlassTint =
  | 'bg-on-photo-10'
  | 'bg-on-photo-14'
  | 'bg-on-photo-18'
  | 'bg-on-photo-22'
  | 'bg-on-photo-96'
  | 'bg-on-photo-scrim-42'
  | 'bg-danger-18';

interface GlassFillProps {
  tintClass?: GlassTint;
  intensity?: number;
}

export function GlassFill({ tintClass = 'bg-on-photo-10', intensity = 18 }: GlassFillProps) {
  return (
    <>
      <BlurView intensity={intensity} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" className={`absolute inset-0 ${tintClass}`} />
    </>
  );
}
