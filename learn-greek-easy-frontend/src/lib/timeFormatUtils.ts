/**
 * Time Format Utilities
 *
 * Provides consistent formatting for study time across the application.
 * Supports seconds, minutes, hours, and days for large values.
 */

/**
 * Maximum time per answer in seconds (3 minutes)
 * Mirrors MAX_ANSWER_TIME_SECONDS from backend
 */
export const MAX_ANSWER_TIME_SECONDS = 180;

/**
 * Format total study time in seconds to a human-readable string.
 *
 * Examples:
 * - 0 -> "0m"
 * - 45 -> "45s"
 * - 120 -> "2m"
 * - 5400 -> "1h 30m"
 * - 86400 -> "1d"
 * - 90000 -> "1d 1h"
 *
 * @param totalSeconds - Total time in seconds
 * @returns Formatted time string
 */
export function formatStudyTime(totalSeconds: number): string {
  if (totalSeconds === 0) return '0m';
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

/**
 * Cap a time value at the maximum allowed per answer.
 *
 * @param timeSeconds - Time in seconds to cap
 * @returns Capped time value
 */
export function capAnswerTime(timeSeconds: number): number {
  return Math.min(timeSeconds, MAX_ANSWER_TIME_SECONDS);
}
