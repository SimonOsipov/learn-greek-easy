import { Stack } from 'expo-router';

// Force the wizard to always start at Step 1 (level). Without this, expo-router
// has no deterministic initial route for the group (no index route), so entering
// (onboarding) renders a blank screen and a stray Back fires GO_BACK with no
// history. Pushing goal/time/summary then builds the back-stack from level.
export const unstable_settings = { initialRouteName: 'level' };

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
