/**
 * Date utility functions for consistent date handling across review system
 *
 * These utilities ensure that date comparisons work correctly for determining
 * if cards are due for review by normalizing all dates to midnight in local timezone.
 *
 * Created to fix BUG-003: Date comparison discrepancy between stats and review API
 */

import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';

import type { Locale } from 'date-fns';

/**
 * Map an i18n language code to a date-fns Locale.
 *
 * Returns `undefined` for English (date-fns defaults to EN when no locale is passed),
 * `ru` for Russian, and `el` for Greek.
 *
 * Named `getDateLocale` to match the 10 existing inline copies across the app,
 * enabling frictionless future consolidation (D3/D11, ADMIN2-42).
 */
export function getDateLocale(language: string): Locale | undefined {
  // Normalize region-qualified tags (e.g. 'ru-RU' -> 'ru'), matching the
  // LanguageContext `.split('-')[0]` convention.
  switch (language.split('-')[0]) {
    case 'ru':
      return ru;
    case 'el':
      return el;
    default:
      return undefined;
  }
}

/**
 * Normalize a date to midnight (00:00:00.000) in local timezone
 * This ensures date comparisons work correctly for "due today" logic
 *
 * @param date - Date object or ISO string to normalize
 * @returns Date object set to midnight
 *
 * @example
 * const date = new Date('2025-11-04T14:30:00.000Z');
 * const midnight = normalizeToMidnight(date);
 * // Result: 2025-11-04T00:00:00.000 (local timezone)
 */
export const normalizeToMidnight = (date: Date | string): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

/**
 * Get current date normalized to midnight
 *
 * @returns Today's date at 00:00:00.000
 */
export const getTodayAtMidnight = (): Date => {
  return normalizeToMidnight(new Date());
};

/**
 * Check if a card is due today (compares ISO string dueDate with today)
 *
 * A card is considered due if:
 * - Its dueDate is today or earlier (when normalized to midnight)
 * - This ensures consistent behavior across different date comparison contexts
 *
 * @param dueDateIso - ISO date string from card's spaced repetition data
 * @returns true if card should be reviewed today
 *
 * @example
 * isCardDueToday('2025-11-03T08:54:46.548Z') // true (yesterday)
 * isCardDueToday('2025-11-04T14:30:00.000Z') // true (today)
 * isCardDueToday('2025-11-05T10:00:00.000Z') // false (tomorrow)
 */
export const isCardDueToday = (dueDateIso: string): boolean => {
  const dueDate = normalizeToMidnight(new Date(dueDateIso));
  const today = getTodayAtMidnight();
  return dueDate <= today;
};

/**
 * Parse ISO date string and normalize to midnight
 *
 * @param isoString - ISO 8601 date string
 * @returns Date object normalized to midnight
 */
export const parseAndNormalizeDate = (isoString: string): Date => {
  return normalizeToMidnight(new Date(isoString));
};

/**
 * Format date for display (e.g., "Jan 15, 2024")
 *
 * @param date - Date object or ISO string
 * @returns Formatted date string
 */
export const formatDisplayDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Convert Date object to ISO string for storage
 *
 * @param date - Date object to convert
 * @returns ISO 8601 string
 */
export const toISOString = (date: Date): string => {
  return date.toISOString();
};
