/**
 * ContinueHero — full-bleed gradient card for resuming the most-recent in-progress deck.
 *
 * Pure presentational component (no hooks). The parent screen passes the resume deck
 * and the onResume handler, keeping this component easily testable.
 *
 * Design reference: Dashboard Mock.html › HeroResume — radius 22, CONTINUE kicker,
 * deck title (Inter Tight) + Greek subtitle (Noto Serif), 6px progress bar,
 * "done / total cards · N due" line, and a white Resume pill (play icon).
 *
 * When the resume deck is null the component returns null (parent renders nothing).
 *
 * MOB-13 SAFE: gradient stops use the opaque rgb() literals from gradients.ts.
 * All translucent white surfaces use explicit <base>-<NN> token classes from
 * tailwind.config.js (on-photo-22, on-photo-92, on-photo-96). No raw rgba/rgb
 * inline style values; no /NN modifier on var-backed tokens.
 */
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';

import { gradientForId, GRADIENT_HERO } from '@/lib/dashboard/gradients';
import type { DeckProgressSummary } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContinueHeroProps {
  /**
   * The resume deck from useDashboard().resumeDeck.
   * When null the hero renders nothing (new-user / no-progress state).
   */
  deck: DeckProgressSummary | null;
  /**
   * Optional Greek subtitle for the deck (titleEl).
   * Rendered below the deck name in Noto Serif if provided.
   */
  titleEl?: string | null;
  /**
   * Progress ratio 0..1 (cards_studied / total cards in deck).
   * Drives the white progress bar fill.
   */
  progress: number;
  /** Number of cards studied (cardsDone). */
  cardsDone: number;
  /** Total cards in the deck (cardsTotal). */
  cardsTotal: number;
  /** Cards due right now (dueNow). */
  dueNow: number;
  /** Called when the Resume pill is pressed. */
  onResume: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Resume pill: primary blue text color — same as gradients.ts GRADIENT_HERO[0].
// This is a gradient stop color (opaque, from the presentation layer constant).
const RESUME_TEXT_COLOR = GRADIENT_HERO[0]; // rgb(36,99,235) = --primary 221 83% 53%

// ---------------------------------------------------------------------------
// ContinueHero
// ---------------------------------------------------------------------------

export function ContinueHero({
  deck,
  titleEl,
  progress,
  cardsDone,
  cardsTotal,
  dueNow,
  onResume,
}: ContinueHeroProps) {
  if (!deck) return null;

  // Pick a deterministic gradient from the deck id; fall back to GRADIENT_HERO
  // if the id is somehow empty (defensive).
  // Cast to the [string, string, ...string[]] tuple LinearGradient expects.
  const rawStops = deck.deck_id ? gradientForId(deck.deck_id) : GRADIENT_HERO;
  const gradientStops = rawStops as [string, string, ...string[]];

  // Clamp progress to [0, 1].
  const clampedProgress = Math.min(1, Math.max(0, progress));
  // DimensionValue permits `${number}%` — cast the template literal to satisfy tsc.
  const progressPercent = `${Math.round(clampedProgress * 100)}%` as `${number}%`;

  return (
    <View
      testID="continue-hero"
      className="mx-[18px] rounded-[22px] overflow-hidden"
    >
      <LinearGradient
        testID="continue-hero-gradient"
        colors={gradientStops}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 20, paddingBottom: 18 }}
      >
        {/* ── CONTINUE kicker ── */}
        <View className="flex-row items-center gap-2 mb-1.5">
          {/* White dot before kicker — mirrors the mock's decorative dot */}
          <View className="w-1.5 h-1.5 rounded-full bg-on-photo-92" />
          <Text
            testID="continue-kicker"
            className="text-on-photo-92 text-[10.5px] uppercase tracking-[0.14em]"
            style={{ fontFamily: 'SpaceMono_400Regular' }}
          >
            CONTINUE
          </Text>
        </View>

        {/* ── Deck title (Inter Tight) ── */}
        <Text
          testID="continue-deck-title"
          className="text-on-photo-96 text-[26px] leading-tight font-bold tracking-tight"
          style={{ fontFamily: 'InterTight_700Bold' }}
          numberOfLines={2}
        >
          {deck.deck_name}
        </Text>

        {/* ── Greek subtitle (Noto Serif) — optional ── */}
        {!!titleEl && (
          <Text
            testID="continue-deck-title-el"
            className="text-on-photo-92 text-[14px] mt-1 mb-3.5 opacity-82"
            style={{ fontFamily: 'NotoSerif_400Regular' }}
          >
            {titleEl}
          </Text>
        )}

        {/* ── Progress bar ── */}
        <View
          testID="continue-progress-track"
          className="h-1.5 rounded-full mt-3.5 mb-2.5 overflow-hidden bg-on-photo-22"
        >
          <View
            testID="continue-progress-fill"
            className="h-full rounded-full bg-on-photo-92"
            style={{ width: progressPercent }}
          />
        </View>

        {/* ── Bottom row: stats + Resume pill ── */}
        <View className="flex-row items-center justify-between">
          {/* cards done / total · N due */}
          <Text
            testID="continue-stats"
            className="text-on-photo-92 text-[12.5px] font-semibold opacity-90"
          >
            <Text className="font-bold text-on-photo-96">
              {cardsDone}
            </Text>
            <Text className="text-on-photo-96 opacity-70">
              {` / ${cardsTotal} cards · `}
            </Text>
            <Text className="font-bold text-on-photo-96">
              {dueNow}
            </Text>
            <Text className="text-on-photo-96 opacity-70">
              {' due'}
            </Text>
          </Text>

          {/* Resume pill */}
          <Pressable
            testID="continue-resume-button"
            onPress={onResume}
            className="h-9 px-3.5 rounded-full flex-row items-center gap-1.5 bg-on-photo-96"
            accessibilityRole="button"
            accessibilityLabel="Resume deck"
          >
            <Play
              size={12}
              color={RESUME_TEXT_COLOR}
            />
            <Text
              testID="continue-resume-label"
              className="text-[13px] font-bold tracking-tight"
              style={{ fontFamily: 'InterTight_700Bold', color: RESUME_TEXT_COLOR }}
            >
              Resume
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}
