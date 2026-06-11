/**
 * MissingDataDot — a small red marker placed where a design element cannot
 * render because the backend has no field/data for it yet (backend gap).
 *
 * Distinct from ComingSoonDot (feature not built): this one flags MISSING
 * BACKEND DATA on an otherwise-built screen, so gaps stay visible while
 * working with the app. Remove each placement when the backend ships the
 * field it documents.
 *
 * MOB-13 SAFE: solid `bg-danger` core inside an explicit `bg-danger-18`
 * rgba halo token — no opacity modifiers on var-backed tokens.
 */
import { View } from 'react-native';

export function MissingDataDot({ testID = 'missing-data-dot' }: { testID?: string }) {
  return (
    <View
      testID={testID}
      className="w-3 h-3 rounded-full bg-danger-18 items-center justify-center"
      accessibilityLabel="Missing backend data"
    >
      <View className="w-1.5 h-1.5 rounded-full bg-danger" />
    </View>
  );
}
