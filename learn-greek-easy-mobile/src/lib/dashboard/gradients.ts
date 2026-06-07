/**
 * Dashboard gradient constants and per-id gradient mapper.
 *
 * Each named gradient is a readonly pair of color stop strings consumable by
 * expo-linear-gradient's `colors` prop.  Color values are derived from the
 * design token CSS vars defined in global.css and referenced in tailwind.config.js.
 * No raw hex without a token comment, no NativeWind /NN modifier on var-backed
 * tokens (MOB-13 / NWOPA-02).
 *
 * Opaque stops are used throughout so that no explicit rgba alpha tokens are
 * required — gradient cards are standalone surfaces, not translucent overlays.
 * If a future iteration requires translucent stops, add a <base>-<NN> explicit
 * rgba token to the MOB-13 block in tailwind.config.js and mirror it into
 * docs/design-tokens.md before using it here.
 */

// ---------------------------------------------------------------------------
// Named gradient stop-pair constants
// ---------------------------------------------------------------------------

/**
 * Hero / welcome card.
 * Primary blue → slightly deeper blue.
 * Token source: --primary 221 83% 53% = rgb(36,99,235)
 *               --primary-2 221 83% 65% = rgb(90,131,244)
 */
export const GRADIENT_HERO: readonly [string, string] = [
  'rgb(36,99,235)',   // --primary  221 83% 53%
  'rgb(90,131,244)',  // --primary-2 221 83% 65%
] as const;

/**
 * News / daily content card.
 * Accent purple → slightly lighter purple.
 * Token source: --accent 262 83% 58% = rgb(124,58,237)
 *               --accent-2 188 95% 50% = rgb(6,220,238)
 */
export const GRADIENT_NEWS: readonly [string, string] = [
  'rgb(124,58,237)', // --accent   262 83% 58%
  'rgb(6,220,238)',  // --accent-2 188 95% 50%
] as const;

/**
 * Situation / contextual learning card.
 * Warm amber → success green.
 * Token source: --accent-3 32 100% 60% = rgb(255,153,0)
 *               --success  160 84% 39% = rgb(20,183,109)
 */
export const GRADIENT_SITUATION: readonly [string, string] = [
  'rgb(255,153,0)',   // --accent-3 32 100% 60%
  'rgb(20,183,109)',  // --success  160 84% 39%
] as const;

/**
 * Quick win / gamification card.
 * Success green → teal (accent-2).
 * Token source: --success  160 84% 39% = rgb(20,183,109)
 *               --accent-2 188 95% 50% = rgb(6,220,238)
 */
export const GRADIENT_QUICKWIN: readonly [string, string] = [
  'rgb(20,183,109)',  // --success  160 84% 39%
  'rgb(6,220,238)',   // --accent-2 188 95% 50%
] as const;

// ---------------------------------------------------------------------------
// Ordered palette — used by gradientForId; exported for test distribution asserts
// ---------------------------------------------------------------------------

/**
 * Ordered palette of all named dashboard gradients.
 * `gradientForId` indexes into this array via a stable hash % length.
 * Add new named gradients here to expand the distribution.
 */
export const GRADIENT_PALETTE: readonly (readonly [string, string])[] = [
  GRADIENT_HERO,
  GRADIENT_NEWS,
  GRADIENT_SITUATION,
  GRADIENT_QUICKWIN,
] as const;

// ---------------------------------------------------------------------------
// gradientForId — deterministic per-id gradient mapper
// ---------------------------------------------------------------------------

/**
 * djb2 hash: maps an arbitrary string to a non-negative 32-bit integer.
 * Same string always produces the same value; distributes reasonably across the range.
 *
 * Algorithm: hash = 5381; for each char: hash = ((hash << 5) + hash) + charCode
 * Uses a 32-bit unsigned integer via `>>> 0` to keep the result non-negative.
 */
function djb2(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    // Equivalent to hash * 33 + charCode, clamped to 32-bit unsigned.
    hash = (((hash << 5) + hash) + s.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Maps a deck or item id to one of the named gradient stop-pairs deterministically.
 *
 * - Same id always returns the same gradient (stable across calls and app restarts).
 * - Distributes across the full GRADIENT_PALETTE via djb2 hash modulo palette length.
 * - No server color fields required.
 *
 * @param id  Any non-empty string identifier (deck id, item id, etc.)
 * @returns   A readonly [string, string] gradient stop-pair for expo-linear-gradient
 */
export function gradientForId(id: string): readonly string[] {
  const index = djb2(id) % GRADIENT_PALETTE.length;
  return GRADIENT_PALETTE[index];
}
