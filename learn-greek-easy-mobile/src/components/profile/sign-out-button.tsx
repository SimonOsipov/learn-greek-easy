/**
 * SignOutButton — destructive outline button for the profile screen.
 *
 * Shows a native Alert.alert() confirmation dialog before calling onSignOut.
 * Design: full-width, height 48px, border-radius 12px, transparent bg,
 * 1px border-danger, danger red text (hsl(0 78% 58%) = rgb(239,68,68)).
 *
 * MOB-13 SAFE: uses the `danger` token (border-danger, text-danger) which
 * resolves through NativeWind's CSS variable pipeline; no /NN modifier needed
 * on a solid (non-transparent) color.
 */
import { Pressable, Text, Alert } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignOutButtonProps {
  testID?: string;
  onSignOut: () => void;
}

// ---------------------------------------------------------------------------
// SignOutButton
// ---------------------------------------------------------------------------

export function SignOutButton({ testID, onSignOut }: SignOutButtonProps) {
  function handlePress() {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: onSignOut,
        },
      ],
      { cancelable: true },
    );
  }

  return (
    <Pressable
      testID={testID ?? 'sign-out-button'}
      onPress={handlePress}
      className="mx-[18px] border border-danger rounded-[12px] items-center justify-center active:opacity-70"
      style={{ height: 48 }}
    >
      <Text
        className="text-danger"
        style={{
          fontSize: 14,
          fontWeight: '600',
          letterSpacing: -0.07,
        }}
      >
        Sign out
      </Text>
    </Pressable>
  );
}
