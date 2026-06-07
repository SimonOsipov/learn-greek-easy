/**
 * GreetingHeader — top block of the dashboard.
 *
 * Pure presentational component (no hooks). The parent screen passes all data,
 * keeping this component easily testable and reusable.
 *
 * Layout (left → right):
 *   Left:  mono kicker (GOOD MORNING / AFTERNOON / EVENING)
 *          + Noto Serif italic "Γεια σου" + optional first name (Inter Tight)
 *   Right: streak chip (🔥 + count) + 36px circular avatar (initials)
 *
 * pt-14 (56px) clears the status bar on iOS; px-[18px] matches the dashboard
 * horizontal padding constant from the design handoff.
 *
 * MOB-13 SAFE: no /NN opacity modifier on any var-backed token.
 */
import { View, Text, Pressable } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GreetingHeaderProps {
  /** Greeting time bucket from useDashboard(). */
  greeting: 'morning' | 'afternoon' | 'evening';
  /**
   * First name to display after "Γεια σου,".
   * When null or empty, renders "Γεια σου" without a name.
   */
  firstName: string | null;
  /** Current streak count. */
  streak: number;
  /**
   * Initials to render inside the avatar circle (e.g. "MS").
   * Falls back to "?" when null/empty.
   */
  initials?: string | null;
  /** Called when the user taps the avatar. Wired by the parent screen. */
  onAvatarPress?: () => void;
}

// ---------------------------------------------------------------------------
// Greeting kicker copy
// ---------------------------------------------------------------------------

const KICKER: Record<'morning' | 'afternoon' | 'evening', string> = {
  morning:   'GOOD MORNING',
  afternoon: 'GOOD AFTERNOON',
  evening:   'GOOD EVENING',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StreakChip({ streak }: { streak: number }) {
  return (
    <View
      testID="streak-chip"
      className="flex-row items-center gap-1.5 h-[30px] px-3 rounded-full bg-card border border-line"
    >
      {/* Flame emoji rendered as Text for cross-platform consistency */}
      <Text className="text-[13px] leading-none" testID="streak-flame">🔥</Text>
      <Text
        className="text-fg text-[13px] font-bold tracking-tight"
        style={{ fontFamily: 'InterTight_700Bold' }}
        testID="streak-count"
      >
        {streak}
      </Text>
    </View>
  );
}

function Avatar({
  initials,
  onPress,
}: {
  initials: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      testID="avatar-button"
      onPress={onPress}
      className="w-9 h-9 rounded-full items-center justify-center"
      style={{ backgroundColor: 'rgb(36,99,235)' }}
      // rgb(36,99,235) = --primary 221 83% 53% in light theme — the avatar
      // uses a fixed opaque gradient stop from gradients.ts so no token
      // opacity modifier is needed (MOB-13 safe).
    >
      <Text
        className="text-[13px] font-bold tracking-tight"
        style={{ fontFamily: 'InterTight_700Bold', color: 'rgb(255,255,255)' }}
        testID="avatar-initials"
      >
        {initials || '?'}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// GreetingHeader
// ---------------------------------------------------------------------------

export function GreetingHeader({
  greeting,
  firstName,
  streak,
  initials,
  onAvatarPress,
}: GreetingHeaderProps) {
  const kicker = KICKER[greeting];
  const hasName = typeof firstName === 'string' && firstName.trim().length > 0;

  return (
    <View
      testID="greeting-header"
      className="flex-row items-center gap-2.5 pt-14 pb-3 px-[18px]"
    >
      {/* ── Left: kicker + Greek greeting ── */}
      <View className="flex-1 min-w-0">
        {/* Mono kicker — GOOD MORNING / AFTERNOON / EVENING */}
        <Text
          testID="greeting-kicker"
          className="text-fg3 text-[10.5px] uppercase tracking-[0.12em]"
          style={{ fontFamily: 'SpaceMono_400Regular' }}
        >
          {kicker}
        </Text>

        {/* "Γεια σου[, Name]" — flex row, baseline aligned */}
        <View className="flex-row items-baseline gap-2 mt-0.5 overflow-hidden">
          {/* Noto Serif italic — the one intentional italic in the design.
              RN Text has no lang prop; lang="el" is HTML-only (the mock uses it
              for web accessibility only). */}
          <Text
            testID="greeting-greek"
            className="text-fg text-[23px] leading-tight"
            style={{ fontFamily: 'NotoSerif_400Regular_Italic', fontStyle: 'italic' }}
          >
            {hasName ? 'Γεια σου,' : 'Γεια σου'}
          </Text>

          {/* First name — Inter Tight, truncates */}
          {hasName && (
            <Text
              testID="greeting-name"
              className="text-fg text-[26px] font-bold tracking-tight flex-shrink"
              style={{ fontFamily: 'InterTight_700Bold' }}
              numberOfLines={1}
            >
              {firstName}
            </Text>
          )}
        </View>
      </View>

      {/* ── Right: streak chip + avatar ── */}
      <View className="flex-row items-center gap-2 flex-shrink-0">
        <StreakChip streak={streak} />
        <Avatar initials={initials ?? ''} onPress={onAvatarPress} />
      </View>
    </View>
  );
}
