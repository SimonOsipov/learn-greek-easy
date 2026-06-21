/**
 * DxCover — coverImageVariants wiring tests (INFRA-11-04)
 *
 * Proves that DxCover calls pickBestSrc and uses the resulting WebP derivative
 * URL in the background-image of [data-testid="dx-cover-img"], not the raw
 * coverImageUrl. Also verifies the fallback path when no variants exist.
 *
 * ADMIN2-40 F6-A additions:
 *   #4 (RED)  — card variant on DPR2 must use 800w (capped), not 1600w.
 *               Currently FAILS because DxCover applies 800*DPR for ALL variants.
 *   #5 (GREEN guard) — stack-front on DPR2 must still use 1600w (no regression).
 *   #6 (RED)  — on cover-load error, background-image swaps to the original URL.
 *               Currently FAILS because no probe <img> / onError exists yet.
 *   #7 (GREEN guard) — deck with no cover paints no http(s) URL into backgroundImage.
 */

import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';

import type { DeckCategory, DeckLevel } from '@/types/deck';

import { DxCover } from '../DxCover';

const baseDeck = {
  id: 'deck-variants-1',
  level: 'A2' as DeckLevel,
  category: 'vocabulary' as DeckCategory,
};

const variantsDeck = {
  ...baseDeck,
  coverImageVariants: {
    400: 'a_400w.webp',
    800: 'a_800w.webp',
    1600: 'a_1600w.webp',
  },
  coverImageUrl: 'orig.png',
};

function setDevicePixelRatio(value: number) {
  Object.defineProperty(window, 'devicePixelRatio', { value, configurable: true });
}

describe('DxCover — coverImageVariants (INFRA-11-04)', () => {
  afterEach(() => {
    setDevicePixelRatio(1);
  });

  it('uses the 800w WebP derivative on a 1x display (800 * DPR target), not the 400w or original', () => {
    setDevicePixelRatio(1);

    const { getByTestId } = render(<DxCover deck={variantsDeck} />);

    const img = getByTestId('dx-cover-img') as HTMLElement;
    const style = img.getAttribute('style') ?? '';

    // 800 * 1 → pickBestSrc returns the 800w derivative (sharp at the card's ~700px width).
    expect(style).toContain('a_800w.webp');
    expect(style).not.toContain('a_400w.webp');
    expect(style).not.toContain('orig.png');
  });

  // Test #5 — GREEN guard (regression: stack-front must keep 1600w on retina).
  // NOTE: This replaces the old "uses the 1600w WebP derivative on a 2x (retina) display"
  // test which was variant-unaware. The card variant must now cap at 800w (see test #4),
  // so only non-card variants (stack-front, stack-1, stack-2) may select 1600w on DPR2.
  it('stack-front variant uses the 1600w WebP derivative on a 2x (retina) display (no regression)', () => {
    setDevicePixelRatio(2);

    const { getByTestId } = render(<DxCover deck={variantsDeck} variant="stack-front" />);

    const img = getByTestId('dx-cover-img') as HTMLElement;
    const style = img.getAttribute('style') ?? '';

    // stack-front retains full DPR scaling: 800 * 2 = 1600 → 1600w variant selected.
    expect(style).toContain('a_1600w.webp');
    expect(style).not.toContain('a_800w.webp');
    expect(style).not.toContain('a_400w.webp');
  });

  it('falls back to coverImageUrl in backgroundImage when coverImageVariants is absent', () => {
    const deck = {
      ...baseDeck,
      coverImageUrl: 'orig.png',
    };

    const { getByTestId } = render(<DxCover deck={deck} />);

    const img = getByTestId('dx-cover-img') as HTMLElement;
    const style = img.getAttribute('style') ?? '';

    expect(style).toContain('orig.png');
  });
});

// ─── ADMIN2-40 F6-A: card-cap + original-URL fallback ──────────────────────

describe('DxCover — ADMIN2-40 F6-A: card-cap + original-URL fallback', () => {
  afterEach(() => {
    setDevicePixelRatio(1);
  });

  // Test #4 — RED: card variant on DPR2 must be capped to 800w.
  // Currently FAILS: DxCover uses Math.round(800 * dpr) = 1600 for all variants,
  // so background-image currently contains a_1600w.webp instead of a_800w.webp.
  it('#4 card variant paints 800w url on a 2x (retina) display (card target is capped to 800)', () => {
    setDevicePixelRatio(2);

    const { getByTestId } = render(<DxCover deck={variantsDeck} variant="card" />);

    const coverEl = getByTestId('dx-cover-img') as HTMLElement;
    const style = coverEl.getAttribute('style') ?? '';

    // After the fix: card on DPR2 must pick the 800w derivative (not 1600w).
    expect(style).toContain('a_800w.webp');
    expect(style).not.toContain('a_1600w.webp');
  });

  // Test #6 — RED: firing an error on the probe <img> must swap the background-image
  // to the original URL (orig.png). Currently FAILS because no probe <img> exists.
  // The probe element is expected to carry the selected coverSrc as its src attribute.
  it('#6 swaps background-image to original URL when the cover probe <img> fires an error', () => {
    setDevicePixelRatio(1);

    const { getByTestId, container } = render(<DxCover deck={variantsDeck} variant="card" />);

    // The probe <img> must exist (hidden, carries the selected coverSrc for error detection).
    // On DPR1 + card variant, the selected src is a_800w.webp.
    const probeImg = container.querySelector('img[src="a_800w.webp"]') as HTMLImageElement | null;
    expect(probeImg).not.toBeNull(); // FAILS here (no probe img today)

    // Fire the error event on the probe to simulate a 404 on the selected WebP variant.
    fireEvent.error(probeImg!);

    // After error: the cover element's background-image should swap to the original URL.
    const coverEl = getByTestId('dx-cover-img') as HTMLElement;
    const style = coverEl.getAttribute('style') ?? '';
    expect(style).toContain('orig.png');
    expect(style).not.toContain('a_800w.webp');
  });

  // Test #7 — GREEN guard: when a deck has no cover at all, background-image must
  // not contain any http(s) URL (the CSS gradient shows through instead).
  it('#7 deck with no cover paints no http url into background-image (gradient fallback)', () => {
    const noCoverDeck = {
      ...baseDeck,
      // no coverImageUrl, no coverImageVariants
    };

    const { container } = render(<DxCover deck={noCoverDeck} variant="card" />);

    // dx-cover-img element should not be rendered at all when there is no cover.
    const coverEl = container.querySelector('[data-testid="dx-cover-img"]');
    expect(coverEl).toBeNull();

    // The host element's style must not contain any http/https url.
    const host = container.querySelector('.dx-cover-host') as HTMLElement | null;
    const hostStyle = host?.getAttribute('style') ?? '';
    expect(hostStyle).not.toMatch(/url\(["']?https?:/);
  });
});
