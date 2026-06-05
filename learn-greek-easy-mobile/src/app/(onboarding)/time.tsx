/**
 * ONB-09 — Step 3: How much per day? (Daily time screen)
 *
 * Four SelectTile options (5 / 15 / 30 / 60 min). The 15-min tile ships a
 * "Recommended" badge in the trailingMeta slot. Badge color-flip:
 *   unselected → bg-badge-recommended-25  text-badge-recommended  (translucent gold)
 *   selected   → bg-primary-15            text-primary             (translucent blue)
 *
 * Default: dailyMinutes is 15 (store default), so Continue is enabled on entry.
 *
 * MOB-13: NO /NN opacity modifiers on var-backed tokens — badge fills use the
 * explicit pre-mixed tokens: badge-recommended-25 and primary-15.
 */
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { SelectTile } from '@/components/onboarding/select-tile';
import { useOnboardingStore } from '@/stores/onboarding-store';
import type { DailyMinutes } from '@/stores/onboarding-store';

// ---------------------------------------------------------------------------
// Tile config — trailingMeta is a render function so it can close over `selected`.
// ---------------------------------------------------------------------------
interface TileConfig {
  label: string;
  value: DailyMinutes;
  subtitle: string;
  cardEstimate: string;
  recommended?: boolean;
}

const TILES: TileConfig[] = [
  { label: '5 minutes',  value: 5,  subtitle: 'A few cards, on the bus.',       cardEstimate: '~10 cards' },
  { label: '15 minutes', value: 15, subtitle: 'Steady progress.',                cardEstimate: '~25 cards', recommended: true },
  { label: '30 minutes', value: 30, subtitle: 'Cards + a news article.',         cardEstimate: '~50 cards' },
  { label: '60 minutes', value: 60, subtitle: 'Cards + article + listening.',    cardEstimate: '~100 cards' },
];

// ---------------------------------------------------------------------------
// RecommendedBadge — shown only on the 15-min tile.
// Color flips based on whether the tile is selected.
// ---------------------------------------------------------------------------
function RecommendedBadge({ selected }: { selected: boolean }) {
  return (
    <View
      className={`rounded-full px-[7px] py-[2px] ${
        selected ? 'bg-primary-15' : 'bg-badge-recommended-25'
      }`}
    >
      <Text
        className={`text-[10px] uppercase tracking-wider ${
          selected ? 'text-primary' : 'text-badge-recommended'
        }`}
        style={{ fontFamily: 'SpaceMono_400Regular' }}
      >
        Recommended
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// TrailingMeta — stacks Recommended badge (when applicable) + mono estimate.
// ---------------------------------------------------------------------------
function TrailingMeta({
  estimate,
  recommended,
  selected,
}: {
  estimate: string;
  recommended: boolean;
  selected: boolean;
}) {
  return (
    <View className="items-end gap-1">
      {recommended && <RecommendedBadge selected={selected} />}
      <Text
        className={`text-[12px] ${selected ? 'text-on-photo-active' : 'text-on-photo'}`}
        style={{ fontFamily: 'SpaceMono_400Regular' }}
      >
        {estimate}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function TimeScreen() {
  const router = useRouter();
  const dailyMinutes = useOnboardingStore((s) => s.dailyMinutes);
  const setDailyMinutes = useOnboardingStore((s) => s.setDailyMinutes);

  return (
    <OnboardingShell
      step={3}
      kicker="STEP 3 OF 4"
      title="How much per day?"
      lede="We'll remind you. Your streak forgives one missed day."
      ctaLabel="Continue"
      ctaDisabled={false}
      onCtaPress={() => router.push('/(onboarding)/summary')}
      onBack={() => router.back()}
      onSkip={() => router.push('/(onboarding)/summary')}
    >
      {TILES.map((tile) => {
        const selected = dailyMinutes === tile.value;
        return (
          <SelectTile
            key={tile.value}
            label={tile.label}
            value={String(tile.value)}
            subtitle={tile.subtitle}
            selected={selected}
            onPress={() => setDailyMinutes(tile.value)}
            trailingMeta={
              <TrailingMeta
                estimate={tile.cardEstimate}
                recommended={tile.recommended ?? false}
                selected={selected}
              />
            }
          />
        );
      })}
    </OnboardingShell>
  );
}
