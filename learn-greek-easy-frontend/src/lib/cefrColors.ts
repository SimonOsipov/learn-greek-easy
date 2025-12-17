// src/lib/cefrColors.ts
// Centralized CEFR level color configuration for consistent styling across the application

import type { DeckLevel } from '@/types/deck';

/**
 * CEFR Level Tiers
 * - Beginner: A1, A2 (Green)
 * - Intermediate: B1, B2 (Blue)
 * - Advanced: C1, C2 (Red)
 */
export type CEFRTier = 'beginner' | 'intermediate' | 'advanced';

/**
 * CEFR color configuration for each level
 */
interface CEFRColorConfig {
  label: string;
  shortLabel: string;
  bgColor: string;
  bgColorLight: string;
  textColor: string;
  tier: CEFRTier;
}

/**
 * Centralized color mapping for CEFR levels
 * All levels within a tier share the same color for visual consistency
 */
export const CEFR_COLORS: Record<DeckLevel, CEFRColorConfig> = {
  // Beginner Tier (Green)
  A1: {
    label: 'A1 - Beginner',
    shortLabel: 'A1',
    bgColor: 'bg-green-700',
    bgColorLight: 'bg-green-500',
    textColor: 'text-white',
    tier: 'beginner',
  },
  A2: {
    label: 'A2 - Elementary',
    shortLabel: 'A2',
    bgColor: 'bg-green-700',
    bgColorLight: 'bg-green-500',
    textColor: 'text-white',
    tier: 'beginner',
  },
  // Intermediate Tier (Blue)
  B1: {
    label: 'B1 - Intermediate',
    shortLabel: 'B1',
    bgColor: 'bg-blue-700',
    bgColorLight: 'bg-blue-500',
    textColor: 'text-white',
    tier: 'intermediate',
  },
  B2: {
    label: 'B2 - Upper-Intermediate',
    shortLabel: 'B2',
    bgColor: 'bg-blue-700',
    bgColorLight: 'bg-blue-500',
    textColor: 'text-white',
    tier: 'intermediate',
  },
  // Advanced Tier (Red)
  C1: {
    label: 'C1 - Advanced',
    shortLabel: 'C1',
    bgColor: 'bg-red-700',
    bgColorLight: 'bg-red-500',
    textColor: 'text-white',
    tier: 'advanced',
  },
  C2: {
    label: 'C2 - Mastery',
    shortLabel: 'C2',
    bgColor: 'bg-red-700',
    bgColorLight: 'bg-red-500',
    textColor: 'text-white',
    tier: 'advanced',
  },
} as const;

/**
 * Get the background color class for a CEFR level (darker variant)
 * @param level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @returns Tailwind CSS background color class (e.g., 'bg-green-700')
 */
export function getCEFRColor(level: DeckLevel): string {
  return CEFR_COLORS[level].bgColor;
}

/**
 * Get the lighter background color class for a CEFR level (for filter buttons)
 * @param level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @returns Tailwind CSS background color class (e.g., 'bg-green-500')
 */
export function getCEFRColorLight(level: DeckLevel): string {
  return CEFR_COLORS[level].bgColorLight;
}

/**
 * Get the text color class for a CEFR level
 * @param level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @returns Tailwind CSS text color class (e.g., 'text-white')
 */
export function getCEFRTextColor(level: DeckLevel): string {
  return CEFR_COLORS[level].textColor;
}

/**
 * Get the full label for a CEFR level
 * @param level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @returns Full label string (e.g., 'A1 - Beginner')
 */
export function getCEFRLabel(level: DeckLevel): string {
  return CEFR_COLORS[level].label;
}

/**
 * Get the tier for a CEFR level
 * @param level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @returns Tier name ('beginner', 'intermediate', 'advanced')
 */
export function getCEFRTier(level: DeckLevel): CEFRTier {
  return CEFR_COLORS[level].tier;
}

/**
 * Get the full configuration for a CEFR level
 * @param level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @returns Complete color configuration object
 */
export function getCEFRConfig(level: DeckLevel): CEFRColorConfig {
  return CEFR_COLORS[level];
}

/**
 * All CEFR levels in order
 */
export const CEFR_LEVELS: DeckLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Level options for filter components
 */
export const CEFR_LEVEL_OPTIONS: { value: DeckLevel; label: string; color: string }[] =
  CEFR_LEVELS.map((level) => ({
    value: level,
    label: CEFR_COLORS[level].label,
    color: CEFR_COLORS[level].bgColorLight,
  }));
