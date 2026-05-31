/**
 * Tests for imageVariants utility (PERF-10).
 *
 * Covers:
 * - buildSrcSet: correct srcset string format
 * - buildSrcSet: fallback when variants null/empty
 * - buildSrcSet: sorted by width ascending
 * - pickBestSrc: selects closest width >= target
 * - pickBestSrc: falls back to originalUrl when no variants
 */

import { describe, expect, it } from 'vitest';

import { buildSrcSet, pickBestSrc } from '../imageVariants';

describe('buildSrcSet', () => {
  it('returns undefined when variants is null', () => {
    expect(buildSrcSet(null)).toBeUndefined();
  });

  it('returns undefined when variants is undefined', () => {
    expect(buildSrcSet(undefined)).toBeUndefined();
  });

  it('returns undefined when variants is empty object', () => {
    expect(buildSrcSet({})).toBeUndefined();
  });

  it('produces correct srcset for single variant', () => {
    const result = buildSrcSet({ 400: 'https://cdn.example.com/img_400w.webp' });
    expect(result).toBe('https://cdn.example.com/img_400w.webp 400w');
  });

  it('produces comma-separated srcset for multiple variants', () => {
    const variants = {
      400: 'https://example.com/img_400w.webp',
      800: 'https://example.com/img_800w.webp',
      1600: 'https://example.com/img_1600w.webp',
    };
    const result = buildSrcSet(variants);
    expect(result).toBe(
      'https://example.com/img_400w.webp 400w, https://example.com/img_800w.webp 800w, https://example.com/img_1600w.webp 1600w'
    );
  });

  it('sorts entries by width ascending regardless of insertion order', () => {
    const variants = {
      1600: 'https://example.com/img_1600w.webp',
      400: 'https://example.com/img_400w.webp',
      800: 'https://example.com/img_800w.webp',
    };
    const result = buildSrcSet(variants);
    const parts = result!.split(', ');
    expect(parts[0]).toContain('400w');
    expect(parts[1]).toContain('800w');
    expect(parts[2]).toContain('1600w');
  });
});

describe('pickBestSrc', () => {
  const variants = {
    400: 'https://example.com/img_400w.webp',
    800: 'https://example.com/img_800w.webp',
    1600: 'https://example.com/img_1600w.webp',
  };
  const originalUrl = 'https://example.com/original.jpg';

  it('returns originalUrl when variants is null', () => {
    expect(pickBestSrc(null, 400, originalUrl)).toBe(originalUrl);
  });

  it('returns originalUrl when variants is empty', () => {
    expect(pickBestSrc({}, 400, originalUrl)).toBe(originalUrl);
  });

  it('returns originalUrl when variants is undefined', () => {
    expect(pickBestSrc(undefined, 400, originalUrl)).toBe(originalUrl);
  });

  it('picks exact match when target equals a variant width', () => {
    expect(pickBestSrc(variants, 800, originalUrl)).toBe('https://example.com/img_800w.webp');
  });

  it('picks next width up when target falls between variants', () => {
    expect(pickBestSrc(variants, 500, originalUrl)).toBe('https://example.com/img_800w.webp');
  });

  it('picks smallest width for target smaller than smallest variant', () => {
    expect(pickBestSrc(variants, 200, originalUrl)).toBe('https://example.com/img_400w.webp');
  });

  it('picks largest width when target exceeds all variants', () => {
    expect(pickBestSrc(variants, 2000, originalUrl)).toBe('https://example.com/img_1600w.webp');
  });
});
