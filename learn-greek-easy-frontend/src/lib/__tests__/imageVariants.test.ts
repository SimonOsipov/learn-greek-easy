/**
 * Tests for imageVariants utility (PERF-10).
 *
 * Covers:
 * - buildSrcSet: correct srcset string format
 * - buildSrcSet: fallback when variants null/empty
 * - buildSrcSet: sorted by width ascending
 * - pickBestSrc: selects closest width >= target
 * - pickBestSrc: falls back to originalUrl when no variants
 * - recoverDerivativeError: drops srcset once so the browser reloads the original src
 */

import type { SyntheticEvent } from 'react';

import { describe, expect, it } from 'vitest';

import { buildSrcSet, pickBestSrc, recoverDerivativeError } from '../imageVariants';

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

describe('pickBestSrc — ADMIN2-40 F6-A card-cap regression guards', () => {
  // These three tests are GREEN guards: they assert the existing correct behaviour
  // of pickBestSrc that the card-cap fix must NOT regress.
  const variants = {
    400: 'a_400w.webp',
    800: 'a_800w.webp',
    1600: 'a_1600w.webp',
  };
  const originalUrl = 'orig.png';

  // Test #1 — capped target (800) returns the 800w url (the executor will call
  //   pickBestSrc with target=800 for card variant on DPR2, not 1600).
  it('returns 800w url when target is 800 (capped card target on retina)', () => {
    expect(pickBestSrc(variants, 800, originalUrl)).toBe('a_800w.webp');
  });

  // Test #2 — non-card target 1600 still returns the 1600w url (stack/hero must
  //   continue to receive the full DPR-scaled resolution).
  it('returns 1600w url when target is 1600 (non-card retina — no regression)', () => {
    expect(pickBestSrc(variants, 1600, originalUrl)).toBe('a_1600w.webp');
  });

  // Test #3 — null/empty variants always falls back to the original URL.
  it('returns original url when variants is null', () => {
    expect(pickBestSrc(null, 800, 'orig.png')).toBe('orig.png');
  });

  it('returns original url when variants is empty object', () => {
    expect(pickBestSrc({}, 800, 'orig.png')).toBe('orig.png');
  });
});

describe('recoverDerivativeError', () => {
  // Minimal stub of the SyntheticEvent shape the handler reads.
  const makeEvent = (img: Partial<HTMLImageElement>) =>
    ({ currentTarget: img as HTMLImageElement }) as SyntheticEvent<HTMLImageElement>;

  it('clears srcset and marks fallback on the first error when a srcset is present', () => {
    const img = { srcset: 'https://x/img_800w.webp 800w', dataset: {} as DOMStringMap };
    const recovered = recoverDerivativeError(makeEvent(img));
    expect(recovered).toBe(true);
    expect(img.srcset).toBe('');
    expect(img.dataset.derivativeFallback).toBe('done');
  });

  it('returns false (terminal) when there is no srcset to drop', () => {
    const img = { srcset: '', dataset: {} as DOMStringMap };
    expect(recoverDerivativeError(makeEvent(img))).toBe(false);
  });

  it('returns false (terminal) when it has already fallen back once', () => {
    const img = { srcset: '', dataset: { derivativeFallback: 'done' } as DOMStringMap };
    expect(recoverDerivativeError(makeEvent(img))).toBe(false);
  });
});
