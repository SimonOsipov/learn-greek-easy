/**
 * ONB-08 — Step 2: What brings you here? (Goal screen)
 *
 * Mirrors the level.tsx pattern but adds leading lucide icons per tile.
 * Each icon is wired via cssInterop so className="text-*" maps to the
 * icon's color prop. The icon element itself carries the color class
 * (selected ? "text-on-photo-active" : "text-on-photo") — NOT a wrapping
 * View — ensuring the recolor mechanism works correctly (MOB-13 / MOB-14).
 *
 * MOB-13: no /NN opacity modifiers on var-backed tokens.
 */
import { useRouter } from 'expo-router';
import { cssInterop } from 'nativewind';
import { Plane, Home, Briefcase, Users, ScrollText } from 'lucide-react-native';

import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { SelectTile } from '@/components/onboarding/select-tile';
import { useOnboardingStore } from '@/stores/onboarding-store';
import type { Goal } from '@/stores/onboarding-store';

// ---------------------------------------------------------------------------
// Wire each lucide icon so className="text-*" maps to the icon color prop.
// Exact pattern from login.tsx lines 65-67.
// ---------------------------------------------------------------------------
cssInterop(Plane, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Home, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Briefcase, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Users, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ScrollText, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface TileConfig {
  label: string;
  value: Goal;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string; size?: number }>;
}

const TILES: TileConfig[] = [
  { Icon: Plane, label: 'For travel', value: 'travel', subtitle: 'Cafés, taxis, getting around.' },
  { Icon: Home, label: 'I live in Cyprus / Greece', value: 'live', subtitle: 'Bills, banks, daily life.' },
  { Icon: Briefcase, label: 'For work', value: 'work', subtitle: 'Meetings, emails, work context.' },
  { Icon: Users, label: 'Family / partner', value: 'family', subtitle: 'Connecting with loved ones.' },
  { Icon: ScrollText, label: 'Citizenship exam', value: 'citizen', subtitle: 'Culture exam, Ellinomatheia.' },
];

export default function GoalScreen() {
  const router = useRouter();
  const goal = useOnboardingStore((s) => s.goal);
  const setGoal = useOnboardingStore((s) => s.setGoal);

  return (
    <OnboardingShell
      step={2}
      kicker="STEP 2 OF 4"
      title="What brings you here?"
      lede="We tune your decks to what you need."
      ctaLabel="Continue"
      ctaDisabled={goal == null}
      onCtaPress={() => router.push('/(onboarding)/time')}
      onBack={() => router.back()}
      onSkip={() => router.push('/(onboarding)/time')}
    >
      {TILES.map((tile) => {
        const selected = goal === tile.value;
        return (
          <SelectTile
            key={tile.value}
            label={tile.label}
            value={tile.value}
            subtitle={tile.subtitle}
            selected={selected}
            onPress={() => setGoal(tile.value)}
            leadingIcon={
              <tile.Icon
                className={selected ? 'text-on-photo-active' : 'text-on-photo'}
                size={20}
              />
            }
          />
        );
      })}
    </OnboardingShell>
  );
}
