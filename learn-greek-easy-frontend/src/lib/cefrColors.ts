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
  dot: string;
  bg: string;
  border: string;
  text: string;
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
    dot: 'bg-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    text: 'text-green-700 dark:text-green-300',
  },
  A2: {
    label: 'A2 - Elementary',
    shortLabel: 'A2',
    bgColor: 'bg-green-700',
    bgColorLight: 'bg-green-500',
    textColor: 'text-white',
    tier: 'beginner',
    dot: 'bg-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    text: 'text-green-700 dark:text-green-300',
  },
  // Intermediate Tier (Blue)
  B1: {
    label: 'B1 - Intermediate',
    shortLabel: 'B1',
    bgColor: 'bg-blue-700',
    bgColorLight: 'bg-blue-500',
    textColor: 'text-white',
    tier: 'intermediate',
    dot: 'bg-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-700 dark:text-blue-300',
  },
  B2: {
    label: 'B2 - Upper-Intermediate',
    shortLabel: 'B2',
    bgColor: 'bg-blue-700',
    bgColorLight: 'bg-blue-500',
    textColor: 'text-white',
    tier: 'intermediate',
    dot: 'bg-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-700 dark:text-blue-300',
  },
  // Advanced Tier (Red)
  C1: {
    label: 'C1 - Advanced',
    shortLabel: 'C1',
    bgColor: 'bg-red-700',
    bgColorLight: 'bg-red-500',
    textColor: 'text-white',
    tier: 'advanced',
    dot: 'bg-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-700 dark:text-red-300',
  },
  C2: {
    label: 'C2 - Mastery',
    shortLabel: 'C2',
    bgColor: 'bg-red-700',
    bgColorLight: 'bg-red-500',
    textColor: 'text-white',
    tier: 'advanced',
    dot: 'bg-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-700 dark:text-red-300',
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
 * Get the dot color class for a CEFR level (solid color for badge dots)
 * @param level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @returns Tailwind CSS background color class (e.g., 'bg-green-500')
 */
export function getCEFRDot(level: DeckLevel): string {
  return CEFR_COLORS[level].dot;
}

/**
 * Get the background color class with opacity for a CEFR level
 * @param level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @returns Tailwind CSS background color class with opacity (e.g., 'bg-green-500/10')
 */
export function getCEFRBg(level: DeckLevel): string {
  return CEFR_COLORS[level].bg;
}

/**
 * Get the border color class with opacity for a CEFR level
 * @param level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @returns Tailwind CSS border color class with opacity (e.g., 'border-green-500/20')
 */
export function getCEFRBorder(level: DeckLevel): string {
  return CEFR_COLORS[level].border;
}

/**
 * Get the text color class with dark mode for a CEFR level
 * @param level - CEFR level (A1, A2, B1, B2, C1, C2)
 * @returns Tailwind CSS text color class with dark mode (e.g., 'text-green-700 dark:text-green-300')
 */
export function getCEFRText(level: DeckLevel): string {
  return CEFR_COLORS[level].text;
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
