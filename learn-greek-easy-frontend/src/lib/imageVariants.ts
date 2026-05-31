/**
 * Image variant utilities for WebP derivative srcset (PERF-10).
 *
 * Derivatives are generated at upload time at widths 400, 800, and 1600 px.
 * Pre-existing objects won't have variants until PERF-11 backfill runs.
 * All helpers gracefully return null/empty when no variants are available,
 * so components fall back to the original `src` URL.
 */

/** Record<width, presignedUrl> as returned by the API (e.g. { 400: '...', 800: '...', 1600: '...' }) */
export type ImageVariants = Record<number, string> | null | undefined;

/**
 * Build a `srcset` string from an image_variants dict.
 * Returns null when variants is null/empty (component should use plain src instead).
 *
 * @example
 *   buildSrcSet({ 400: 'https://...', 800: 'https://...', 1600: 'https://...' })
 *   // → "https://... 400w, https://... 800w, https://... 1600w"
 */
export function buildSrcSet(variants: ImageVariants): string | undefined {
  if (!variants) return undefined;
  const entries = Object.entries(variants);
  if (entries.length === 0) return undefined;
  return entries
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([w, url]) => `${url} ${w}w`)
    .join(', ');
}

/**
 * Return the best available src: the closest width in variants to `targetWidth`,
 * or fall back to `originalUrl` when no variants exist.
 *
 * Useful for components that need a single src (e.g. CSS background-image).
 */
export function pickBestSrc(
  variants: ImageVariants,
  targetWidth: number,
  originalUrl: string | null | undefined
): string | null | undefined {
  if (!variants) return originalUrl;
  const widths = Object.keys(variants)
    .map(Number)
    .sort((a, b) => a - b);
  if (widths.length === 0) return originalUrl;
  // Pick the smallest width >= targetWidth, or the largest available.
  const best = widths.find((w) => w >= targetWidth) ?? widths[widths.length - 1];
  return variants[best] ?? originalUrl;
}
