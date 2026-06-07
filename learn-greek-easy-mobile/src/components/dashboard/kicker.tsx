/**
 * Kicker — uppercase mono eyebrow label component for the dashboard.
 *
 * When `comingSoon` prop is set:
 *   Renders a leading ComingSoonDot + a quiet "Coming soon" micro-label
 *   BEFORE the main children text.
 * Without `comingSoon`:
 *   Renders only the children/eyebrow text (no dot, no label).
 *
 * Mirrors the web `learn-greek-easy-frontend/src/components/ui/kicker.tsx`
 * API surface adapted to React Native (View + Text + NativeWind, not HTML).
 */
import { View, Text } from 'react-native';
import type { ReactNode } from 'react';

import { ComingSoonDot } from '@/components/dashboard/coming-soon-dot';

interface KickerProps {
  /** When true, renders the red dot + "Coming soon" micro-label. */
  comingSoon?: boolean;
  children: ReactNode;
}

/**
 * Eyebrow / kicker label rendered in uppercase mono.
 *
 * Usage:
 *   <Kicker>VOCABULARY</Kicker>
 *   <Kicker comingSoon>MOCK EXAM</Kicker>
 */
export function Kicker({ comingSoon, children }: KickerProps) {
  return (
    <View className="flex-row items-center gap-1.5">
      {comingSoon && (
        <>
          <ComingSoonDot />
          <Text
            testID="kicker-coming-soon-label"
            className="text-danger text-[10px] uppercase tracking-widest"
            style={{ fontFamily: 'SpaceMono_400Regular' }}
          >
            Coming soon
          </Text>
        </>
      )}
      <Text
        testID="kicker-label"
        className="text-fg3 text-[10px] uppercase tracking-widest"
        style={{ fontFamily: 'SpaceMono_400Regular' }}
      >
        {children}
      </Text>
    </View>
  );
}
