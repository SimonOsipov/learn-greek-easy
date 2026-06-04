/**
 * Waveform Bar Generation Utility
 *
 * Generates an array of normalized height values for waveform visualization bars.
 * Uses an oscillating sine ripple over a flat baseline to produce a natural,
 * evenly-distributed audio-waveform silhouette (no center hump).
 */

const MAX_HEIGHT = 1.0;

/**
 * Generate an array of normalized bar heights for waveform visualization.
 *
 * Each height is in the range [0.15, 1.0]. An oscillating sine ripple rides
 * on a flat baseline so the silhouette reads as a consistent waveform across
 * its full width rather than tapering at the edges. Deterministic per-bar
 * noise breaks up the ripple so bars look organic while staying stable across
 * renders.
 *
 * @param count - Number of bars to generate
 * @returns Array of normalized height values
 */
export function generateBars(count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const wave = Math.sin(i * 0.4) * 0.5 + 0.5;
    const noise = (((i * 13 + 7) % 7) / 7) * 0.3;
    return Math.min(MAX_HEIGHT, wave * 0.7 + noise + 0.15);
  });
}
