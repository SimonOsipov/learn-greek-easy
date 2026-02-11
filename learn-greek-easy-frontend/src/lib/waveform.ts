/**
 * Waveform Bar Generation Utility
 *
 * Generates an array of normalized height values for waveform visualization bars.
 * Uses a sinusoidal envelope with random noise to produce a natural audio-waveform silhouette.
 */

const MIN_HEIGHT = 0.1;
const MAX_HEIGHT = 1.0;
const NOISE_AMPLITUDE = 0.4;

/**
 * Generate an array of normalized bar heights for waveform visualization.
 *
 * Each height is in the range [0.1, 1.0]. The sinusoidal envelope peaks
 * at the center and tapers toward both edges. Additive random noise
 * breaks up the smooth curve so bars look organic.
 *
 * @param count - Number of bars to generate
 * @returns Array of normalized height values
 */
export function generateBars(count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const envelope = Math.sin((i / count) * Math.PI);
    const noise = Math.random() * NOISE_AMPLITUDE;
    return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, envelope + noise));
  });
}
