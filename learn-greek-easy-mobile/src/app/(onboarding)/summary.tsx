/**
 * ONB-10 — Step 4: Summary + submit ("Your Plan")
 *
 * Displays a glass recap card with resolved level/goal/daily values, then
 * calls complete(mutateAsync) from the onboarding store. On success the
 * ['me'] invalidation causes tour_completed_at to become non-null and the
 * root guard (ONB-05) routes into (app) — no manual navigation needed.
 *
 * MOB-13: NO /NN opacity modifiers on var-backed tokens.
 *   - Glass tint: bg-on-photo-scrim-42 (explicit full-color token)
 *   - Divider/border: border-on-photo-22 (explicit full-color token)
 *   - Label text: text-on-photo-85 (explicit full-color token)
 *   - Error text: text-danger-softer (var-backed, no modifier — safe)
 *
 * Name in title uses font-serif (NotoSerif_400Regular_Italic) via nested <Text>.
 */
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { GlassFill } from '@/components/glass-fill';
import { useOnboardingStore, MINUTES_TO_GOAL } from '@/stores/onboarding-store';
import type { Level, Goal } from '@/stores/onboarding-store';
import { useUpdateUserSettings } from '@/hooks/use-user-settings';
import { useAuth } from '@/hooks/use-auth';

// ---------------------------------------------------------------------------
// Display label maps — beginner-safe skip defaults applied in the store, but
// we resolve again here for display using the same ?? 'new' / ?? 'live' defaults.
// ---------------------------------------------------------------------------
const LEVEL_LABELS: Record<Level, string> = {
  new: 'Just starting',
  A1: 'A1 · Beginner',
  A2: 'A2 · Elementary',
  B1: 'B1 · Intermediate',
};

const GOAL_LABELS: Record<Goal, string> = {
  travel: 'For travel',
  live: 'Living in Cyprus',
  work: 'For work',
  family: 'Family / partner',
  citizen: 'Citizenship exam',
};

// ---------------------------------------------------------------------------
// RecapRow — a single row in the glass card (label left, value right).
// ---------------------------------------------------------------------------
function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-[14px] px-4">
      <Text
        className="text-on-photo-85 text-[11px] tracking-widest uppercase"
        style={{ fontFamily: 'SpaceMono_400Regular' }}
      >
        {label}
      </Text>
      <Text
        className="text-on-photo text-[14px] text-right flex-shrink ml-3"
        style={{ fontFamily: 'SplineSans_600SemiBold' }}
      >
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// RecapCard — frosted glass card with three hairline-divided rows.
// ---------------------------------------------------------------------------
function RecapCard({
  levelLabel,
  goalLabel,
  dailyLabel,
}: {
  levelLabel: string;
  goalLabel: string;
  dailyLabel: string;
}) {
  return (
    <View className="rounded-[18px] overflow-hidden border border-on-photo-22">
      <GlassFill tintClass="bg-on-photo-scrim-42" intensity={12} />
      {/* LEVEL row */}
      <RecapRow label="LEVEL" value={levelLabel} />
      {/* Hairline divider */}
      <View className="h-px bg-on-photo-22 mx-4" />
      {/* GOAL row */}
      <RecapRow label="GOAL" value={goalLabel} />
      {/* Hairline divider */}
      <View className="h-px bg-on-photo-22 mx-4" />
      {/* DAILY row */}
      <RecapRow label="DAILY" value={dailyLabel} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function SummaryScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Resolve display name: email handle before '@', or 'there' as fallback.
  const name = user?.email?.split('@')[0] || 'there';

  // Store selectors — individual selectors to avoid re-render on unrelated changes.
  const level = useOnboardingStore((s) => s.level);
  const goal = useOnboardingStore((s) => s.goal);
  const dailyMinutes = useOnboardingStore((s) => s.dailyMinutes);
  const isSubmitting = useOnboardingStore((s) => s.isSubmitting);
  const storeError = useOnboardingStore((s) => s.error);
  const complete = useOnboardingStore((s) => s.complete);

  // Mutation hook — mutateAsync is injected into complete().
  const { mutateAsync, isSuccess } = useUpdateUserSettings();

  // Resolve display labels with beginner-safe defaults.
  const resolvedLevel: Level = level ?? 'new';
  const resolvedGoal: Goal = goal ?? 'live';
  const cardEstimate = MINUTES_TO_GOAL[dailyMinutes];

  const levelLabel = LEVEL_LABELS[resolvedLevel];
  const goalLabel = GOAL_LABELS[resolvedGoal];
  const dailyLabel = `${dailyMinutes} min · ~${cardEstimate} cards`;

  const handleSubmit = () => {
    // Wrap mutateAsync (returns Promise<UserProfile>) into the store's expected
    // (payload: UserSettingsUpdate) => Promise<void> signature.
    complete((payload) => mutateAsync(payload).then(() => undefined));
  };

  // CTA label: loading state shows "Building your plan…", success shows "Plan ready",
  // otherwise the default CTA copy.
  const ctaLabel = isSubmitting
    ? 'Building your plan…'
    : isSuccess
      ? 'Plan ready'
      : 'Start practicing →';

  return (
    <OnboardingShell
      step={4}
      kicker="YOUR PLAN"
      title=""
      lede=""
      ctaLabel={ctaLabel}
      ctaLoading={isSubmitting}
      ctaDisabled={isSubmitting}
      onCtaPress={handleSubmit}
      onBack={() => router.back()}
      // No onSkip — step 4 omits the Skip link per OnboardingShell logic.
    >
      {/* Custom title with serif name — overrides the shell's empty title slot.
          We render it inside children because the shell's title prop is a plain string
          and cannot embed a nested styled <Text>. */}
      <View className="mb-6 -mt-4">
        <Text
          className="text-on-photo text-[28px] tracking-tight leading-[34px]"
          style={{ fontFamily: 'InterTight_700Bold' }}
        >
          {'Ready, '}
          <Text className="font-serif italic">{name}</Text>
          {'. Here’s your daily.'}
        </Text>
      </View>

      {/* Glass recap card */}
      <RecapCard
        levelLabel={levelLabel}
        goalLabel={goalLabel}
        dailyLabel={dailyLabel}
      />

      {/* Adjustable-later note */}
      <Text
        className="text-on-photo-85 text-[13px] mt-3 text-center"
        style={{ fontFamily: 'SplineSans_400Regular' }}
      >
        {'Everything’s adjustable later in Settings.'}
      </Text>

      {/* Error message — shown below the note when store captures an error */}
      {storeError != null && (
        <Text
          className="text-danger-softer text-[13px] mt-2 text-center"
          style={{ fontFamily: 'SplineSans_400Regular' }}
        >
          {storeError}
        </Text>
      )}

      {/* Inline success confirmation — visible in the window before the guard routes away */}
      {isSuccess && !isSubmitting && (
        <Text
          className="text-on-photo-85 text-[13px] mt-2 text-center"
          style={{ fontFamily: 'SplineSans_400Regular' }}
        >
          Plan ready
        </Text>
      )}
    </OnboardingShell>
  );
}
