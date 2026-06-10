/**
 * ProfileHeader — identity block for the You tab.
 *
 * Renders:
 *   - 68×68 circular avatar: gradient (primary→accent) with white initials, or
 *     a photo when avatar_url is present.
 *   - Full name (Inter Tight 24px bold).
 *   - Level pill: "LEVEL N" mono, bg-primary-15, text-primary.
 *   - "X% to next level" sub-line (fg2, 12px).
 *   - Level progress bar: primary→accent gradient fill on a bg-bg-2 track.
 *
 * MOB-13 SAFE: avatar gradient and level pill bg use rgb/rgba literals.
 * Primary→accent gradient rgb values: primary hsl(221 83% 53%)=rgb(36,99,235)
 * (light), accent hsl(262 83% 58%)=rgb(124,58,237).
 * The avatar gradient is theme-invariant (dark bg + vivid gradient reads well
 * on both themes — same decision as ExamDeckCard tints).
 *
 * Level pill background: `bg-primary-15` (rgba(36,99,235,0.15)), already
 * registered in tailwind.config.js as an explicit rgba token (MOB-13 safe).
 */
import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileHeaderProps {
  testID?: string;
  fullName: string;
  /** Two-letter initials rendered inside the gradient avatar when no photo. */
  initials: string;
  /** S3 presigned URL or null (backend provides full URL). */
  avatarUrl?: string | null;
  /** English level name, e.g. "Learner" or "B1". */
  levelName: string;
  /** 0–100 progress percentage to next level. */
  progressPct: number;
}

// ---------------------------------------------------------------------------
// Gradient colours (MOB-13 explicit rgb — no /NN on hsl var tokens on native)
// ---------------------------------------------------------------------------

// primary: hsl(221 83% 53%) ≈ rgb(36,99,235)
// accent:  hsl(262 83% 58%) ≈ rgb(124,58,237)
const GRADIENT_COLORS: [string, string] = ['rgb(36,99,235)', 'rgb(124,58,237)'];

// ---------------------------------------------------------------------------
// ProfileHeader
// ---------------------------------------------------------------------------

export function ProfileHeader({
  testID,
  fullName,
  initials,
  avatarUrl,
  levelName,
  progressPct,
}: ProfileHeaderProps) {
  // Clamp progress to [0, 1]
  const clampedPct = Math.max(0, Math.min(100, progressPct)) / 100;

  return (
    <View
      testID={testID ?? 'profile-header'}
      className="flex-row items-center gap-[14px] px-[18px]"
    >
      {/* ── Avatar ── */}
      {avatarUrl ? (
        <Image
          testID="profile-avatar-photo"
          source={{ uri: avatarUrl }}
          className="w-[68px] h-[68px] rounded-full"
          style={{ width: 68, height: 68, borderRadius: 9999 }}
        />
      ) : (
        <LinearGradient
          testID="profile-avatar-gradient"
          colors={GRADIENT_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 68, height: 68, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            style={{
              color: 'rgb(255,255,255)',
              fontFamily: 'InterTight_700Bold',
              fontSize: 22,
              fontWeight: '700',
              letterSpacing: -0.4,
            }}
          >
            {initials}
          </Text>
        </LinearGradient>
      )}

      {/* ── Identity info ── */}
      <View className="flex-1 min-w-0 gap-[3px]">
        {/* Full name */}
        <Text
          testID="profile-full-name"
          className="text-fg"
          numberOfLines={1}
          style={{
            fontFamily: 'InterTight_700Bold',
            fontSize: 24,
            fontWeight: '700',
            letterSpacing: -0.48,
            lineHeight: 28,
          }}
        >
          {fullName}
        </Text>

        {/* Level pill + progress text */}
        <View className="flex-row items-center gap-2 mt-0.5">
          <View className="bg-primary-15 px-2 py-[3px] rounded-full">
            <Text
              testID="profile-level-pill"
              className="text-primary"
              style={{
                fontFamily: 'SpaceMono_400Regular',
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.44,
                textTransform: 'uppercase',
              }}
            >
              {levelName}
            </Text>
          </View>
          <Text
            testID="profile-level-progress-text"
            className="text-fg2"
            style={{ fontSize: 12, lineHeight: 18 }}
          >
            {Math.round(Math.max(0, Math.min(100, progressPct)))}% to next level
          </Text>
        </View>

        {/* Level progress bar */}
        <View
          testID="profile-progress-bar-track"
          className="mt-[5px] h-[5px] rounded-full bg-bg-2 border border-line overflow-hidden"
        >
          <LinearGradient
            testID="profile-progress-bar-fill"
            colors={GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: '100%',
              width: `${Math.round(clampedPct * 100)}%`,
              borderRadius: 9999,
            }}
          />
        </View>
      </View>
    </View>
  );
}
