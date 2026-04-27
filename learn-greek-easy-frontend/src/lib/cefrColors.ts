// src/lib/cefrColors.ts
// Centralized CEFR level color configuration for consistent styling across the application

/**
 * CEFR levels supported by this mapping.
 * A1-B2 are live. C1/C2 are added for forward-compatibility.
 */
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

import type { DeckLevel } from '@/types/deck';

/**
 * CEFR badge class mapping — returns the `.b-*` slot for the badge system.
 *
 * Mapping (v2.4 design system):
 *   A1 → b-blue   (beginner)
 *   A2 → b-violet  (elementary)
 *   B1 → b-amber  (intermediate)
 *   B2 → b-green  (upper-intermediate)
 *   C1 → b-red    (advanced, forward-compat — no live data yet)
 *   C2 → b-gray   (mastery, forward-compat — no live data yet)
 */
const CEFR_BADGE_CLASS: Record<CEFRLevel, string> = {
  A1: 'b-blue',
  A2: 'b-violet',
  B1: 'b-amber',
  B2: 'b-green',
  C1: 'b-red',
  C2: 'b-gray',
};

const CEFR_LABELS: Record<CEFRLevel, string> = {
  A1: 'A1 - Beginner',
  A2: 'A2 - Elementary',
  B1: 'B1 - Intermediate',
  B2: 'B2 - Upper-Intermediate',
  C1: 'C1 - Advanced',
  C2: 'C2 - Mastery',
};

/**
 * Get the `.b-*` badge slot class for a CEFR level.
 * Use as: `<span className={`badge ${getCEFRBadgeClass(level)}`}>{level}</span>`
 */
export function getCEFRBadgeClass(level: DeckLevel | CEFRLevel): string {
  return CEFR_BADGE_CLASS[level as CEFRLevel] ?? 'b-gray';
}

// ---------------------------------------------------------------------------
// Deprecated helpers — retained for backward-compat with out-of-scope surfaces
// (landing/Features.tsx, review/shared/LevelBadge.tsx).
// These surfaces will migrate to getCEFRBadgeClass in their own reskin tasks.
// ---------------------------------------------------------------------------

/** @deprecated Use getCEFRBadgeClass instead */
export function getCEFRColor(_level: DeckLevel): string {
  return '';
}

/** @deprecated Use getCEFRBadgeClass instead */
export function getCEFRTextColor(_level: DeckLevel): string {
  return '';
}

/**
 * Get the full label for a CEFR level.
 */
export function getCEFRLabel(level: DeckLevel | CEFRLevel): string {
  return CEFR_LABELS[level as CEFRLevel] ?? level;
}

/**
 * All live CEFR levels (A1-B2 only — what the backend currently ships).
 * C1/C2 are in the mapping for forward-compat but not listed here.
 */
export const CEFR_LEVELS: DeckLevel[] = ['A1', 'A2', 'B1', 'B2'];

/**
 * Level options for filter components.
 * `badgeClass` is the `.b-*` slot for the selected-button treatment.
 */
export const CEFR_LEVEL_OPTIONS: { value: DeckLevel; label: string; badgeClass: string }[] =
  CEFR_LEVELS.map((level) => ({
    value: level,
    label: CEFR_LABELS[level],
    badgeClass: CEFR_BADGE_CLASS[level],
  }));
