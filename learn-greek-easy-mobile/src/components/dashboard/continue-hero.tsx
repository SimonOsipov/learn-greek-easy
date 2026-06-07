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
 * MOB-13 SAFE: gradient stops use the opaque rgb() literals from gradients.ts
 * (same pattern as login.tsx / onboarding-shell.tsx). No /NN modifier on any
 * var-backed token anywhere in this file.
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

// White at ~22% and ~92% alpha — sanctioned raw rgba literals for gradient card
// surfaces (expo-linear-gradient colors[] cannot accept NativeWind classes).
// Same approach used in login.tsx and gradients.ts comments.
const PROGRESS_TRACK = 'rgba(255,255,255,0.22)';
const PROGRESS_FILL  = 'rgba(255,255,255,0.92)';

// Resume pill: dark blue text on white background — matches the mock exactly.
// rgb(36,99,235) = --primary 221 83% 53% (same literal as gradients.ts GRADIENT_HERO[0]).
const RESUME_TEXT_COLOR = 'rgb(36,99,235)';
const RESUME_BG         = 'rgba(255,255,255,0.96)';

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
          <View
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: PROGRESS_FILL }}
          />
          <Text
            testID="continue-kicker"
            className="text-[10.5px] uppercase tracking-[0.14em]"
            style={{ fontFamily: 'SpaceMono_400Regular', color: PROGRESS_FILL }}
          >
            CONTINUE
          </Text>
        </View>

        {/* ── Deck title (Inter Tight) ── */}
        <Text
          testID="continue-deck-title"
          className="text-[26px] leading-tight font-bold tracking-tight"
          style={{ fontFamily: 'InterTight_700Bold', color: 'rgb(255,255,255)' }}
          numberOfLines={2}
        >
          {deck.deck_name}
        </Text>

        {/* ── Greek subtitle (Noto Serif) — optional ── */}
        {!!titleEl && (
          <Text
            testID="continue-deck-title-el"
            className="text-[14px] mt-1 mb-3.5"
            style={{
              fontFamily: 'NotoSerif_400Regular',
              color: PROGRESS_FILL,
              opacity: 0.82,
            }}
          >
            {titleEl}
          </Text>
        )}

        {/* ── Progress bar ── */}
        <View
          testID="continue-progress-track"
          className="h-1.5 rounded-full mt-3.5 mb-2.5 overflow-hidden"
          style={{ backgroundColor: PROGRESS_TRACK }}
        >
          <View
            testID="continue-progress-fill"
            className="h-full rounded-full"
            style={{ width: progressPercent, backgroundColor: PROGRESS_FILL }}
          />
        </View>

        {/* ── Bottom row: stats + Resume pill ── */}
        <View className="flex-row items-center justify-between">
          {/* cards done / total · N due */}
          <Text
            testID="continue-stats"
            className="text-[12.5px] font-semibold"
            style={{ color: PROGRESS_FILL, opacity: 0.9 }}
          >
            <Text style={{ fontWeight: '700', color: 'rgb(255,255,255)' }}>
              {cardsDone}
            </Text>
            <Text style={{ opacity: 0.7, color: 'rgb(255,255,255)' }}>
              {` / ${cardsTotal} cards · `}
            </Text>
            <Text style={{ fontWeight: '700', color: 'rgb(255,255,255)' }}>
              {dueNow}
            </Text>
            <Text style={{ opacity: 0.7, color: 'rgb(255,255,255)' }}>
              {' due'}
            </Text>
          </Text>

          {/* Resume pill */}
          <Pressable
            testID="continue-resume-button"
            onPress={onResume}
            className="h-9 px-3.5 rounded-full flex-row items-center gap-1.5"
            style={{ backgroundColor: RESUME_BG }}
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
