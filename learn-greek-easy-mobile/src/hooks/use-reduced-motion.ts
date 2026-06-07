/**
 * useReducedMotion — subscribe to the device's "Reduce Motion" accessibility
 * setting and return a boolean that is true when motion should be minimised.
 *
 * Uses AccessibilityInfo.isReduceMotionEnabled() for the initial value and
 * subscribes to the "reduceMotionChanged" event for live updates.
 *
 * Gate any shimmer / animated gradient / looping animation behind this hook:
 *   const reduceMotion = useReducedMotion();
 *   if (reduceMotion) { /* render static fill *‌/ }
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // Read the initial value
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    // Subscribe to changes
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
