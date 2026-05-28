// src/features/decks/dx/deckGradient.ts
//
// Derives a CSS linear-gradient string from a Deck's category and level.
// No backend `gradient` field — every cover is fully derived from these two
// attributes, so the same {level, category} pair always produces an identical
// string (deterministic) and distinct combos produce distinct strings.

import type { DeckCategory, DeckLevel } from '@/types/deck';

// ────────────────────────────────────────────────────────────────────────────
// Category → base hue  (0–359)
// ────────────────────────────────────────────────────────────────────────────
const CATEGORY_HUE: Record<DeckCategory, number> = {
  vocabulary: 210, // steel-blue — the iconic "study" colour
  grammar: 280, // violet — structural, linguistic
  phrases: 160, // teal — communicative, natural
  culture: 28, // warm amber-orange — cultural warmth
};

// ────────────────────────────────────────────────────────────────────────────
// Level → { saturation shift, lightness: [front-stop, back-stop] }
// A1 is the brightest / most welcoming; B2 is the deepest / most intense.
// ────────────────────────────────────────────────────────────────────────────
interface LevelShift {
  /** Added to the base saturation for the *front* stop */
  sFront: number;
  /** Lightness of the front (lighter) gradient stop */
  lFront: number;
  /** Added to the base hue for the *back* stop (hue rotation) */
  hBackOffset: number;
  /** Saturation of the back (deeper) stop */
  sBack: number;
  /** Lightness of the back (deeper) gradient stop */
  lBack: number;
}

const LEVEL_SHIFT: Record<DeckLevel, LevelShift> = {
  A1: { sFront: 72, lFront: 58, hBackOffset: -12, sBack: 62, lBack: 44 },
  A2: { sFront: 70, lFront: 50, hBackOffset: -14, sBack: 58, lBack: 36 },
  B1: { sFront: 78, lFront: 44, hBackOffset: -16, sBack: 68, lBack: 32 },
  B2: { sFront: 82, lFront: 38, hBackOffset: -18, sBack: 74, lBack: 26 },
};

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns a `linear-gradient(135deg, hsl(...), hsl(...))` string derived
 * deterministically from a deck's level and category.
 *
 * Deviation Justification: derived deck gradient — literal HSL stops, not
 * theme tokens; see docs/design-system.md:151 (Situations-palette
 * inline-literal precedent)
 */
export function deckGradient(deck: { level: DeckLevel; category: DeckCategory }): string {
  const hue = CATEGORY_HUE[deck.category];
  const shift = LEVEL_SHIFT[deck.level];

  const hFront = hue;
  const sFront = shift.sFront;
  const lFront = shift.lFront;

  const hBack = (((hue + shift.hBackOffset) % 360) + 360) % 360;
  const sBack = shift.sBack;
  const lBack = shift.lBack;

  return `linear-gradient(135deg, hsl(${hFront} ${sFront}% ${lFront}%), hsl(${hBack} ${sBack}% ${lBack}%))`;
}

/**
 * Returns three gradient strings for a stacked cover layout:
 * - `front`   — the primary card (same as deckGradient)
 * - `behind1` — rotated -6deg, more desaturated/shifted
 * - `behind2` — rotated +4deg, different hue offset
 *
 * All three are distinct; `front === deckGradient(deck)`.
 */
export function deckGradientStack(deck: { level: DeckLevel; category: DeckCategory }): {
  front: string;
  behind1: string;
  behind2: string;
} {
  const front = deckGradient(deck);

  const hue = CATEGORY_HUE[deck.category];
  const shift = LEVEL_SHIFT[deck.level];

  // behind1: shift hue +20deg, slightly desaturated, lighter
  const h1 = (((hue + 20) % 360) + 360) % 360;
  const h1Back = (((h1 + shift.hBackOffset) % 360) + 360) % 360;
  const behind1 = `linear-gradient(135deg, hsl(${h1} ${shift.sFront - 10}% ${shift.lFront + 6}%), hsl(${h1Back} ${shift.sBack - 10}% ${shift.lBack + 6}%))`;

  // behind2: shift hue -25deg, slightly more saturated, mid-lightness
  const h2 = (((hue - 25) % 360) + 360) % 360;
  const h2Back = (((h2 + shift.hBackOffset) % 360) + 360) % 360;
  const behind2 = `linear-gradient(135deg, hsl(${h2} ${shift.sFront - 4}% ${shift.lFront + 3}%), hsl(${h2Back} ${shift.sBack - 4}% ${shift.lBack + 3}%))`;

  return { front, behind1, behind2 };
}
