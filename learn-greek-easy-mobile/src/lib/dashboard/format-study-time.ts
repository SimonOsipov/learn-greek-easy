/**
 * formatStudyTime — mobile port of the web timeFormatUtils.ts helper.
 *
 * Converts a total SECONDS value to a human-readable string using the same
 * boundary rules as learn-greek-easy-frontend/src/lib/timeFormatUtils.ts:
 *
 *   0         → "0m"
 *   < 60      → "Ns"         (raw seconds, e.g. "45s")
 *   < 3 600   → "Nm"         (minutes only, e.g. "2m")
 *   < 86 400  → "Hh" | "Hh Mm"  (hours, optionally + minutes when non-zero)
 *   ≥ 86 400  → "Dd" | "Dd Hh"  (days, optionally + hours when non-zero)
 *
 * Days take precedence over hours, hours over minutes — the lower unit is
 * omitted when it is 0 (except for the plain-minutes branch which always shows).
 *
 * Used by the dashboard StatGrid for the "Time today" tile.
 *
 * Source: learn-greek-easy-frontend/src/lib/timeFormatUtils.ts (SECONDS-based).
 * NOT the minutes-based formatStudyTime in src/lib/helpers.ts.
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
