import { useRouter } from 'expo-router';

import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { SelectTile } from '@/components/onboarding/select-tile';
import { useOnboardingStore } from '@/stores/onboarding-store';
import type { Level } from '@/stores/onboarding-store';

interface TileConfig {
  label: string;
  value: Level;
  subtitle: string;
}

const TILES: TileConfig[] = [
  { label: 'Just starting', value: 'new', subtitle: 'Hello, καλημέρα and that’s about it.' },
  { label: 'A1 · Beginner', value: 'A1', subtitle: 'I know the alphabet and a few phrases.' },
  { label: 'A2 · Elementary', value: 'A2', subtitle: 'I can handle simple everyday situations.' },
  { label: 'B1 · Intermediate', value: 'B1', subtitle: 'I can hold a conversation about familiar topics.' },
];

export default function LevelScreen() {
  const router = useRouter();
  const level = useOnboardingStore((s) => s.level);
  const setLevel = useOnboardingStore((s) => s.setLevel);

  return (
    <OnboardingShell
      step={1}
      title="Where are you with Greek?"
      lede="We use this to set difficulty. You can change it later."
      ctaLabel="Continue"
      ctaDisabled={level == null}
      onCtaPress={() => router.push('/(onboarding)/goal')}
      onSkip={() => router.push('/(onboarding)/goal')}
    >
      {TILES.map((tile) => (
        <SelectTile
          key={tile.value}
          label={tile.label}
          value={tile.value}
          subtitle={tile.subtitle}
          selected={level === tile.value}
          onPress={() => setLevel(tile.value)}
        />
      ))}
    </OnboardingShell>
  );
}
