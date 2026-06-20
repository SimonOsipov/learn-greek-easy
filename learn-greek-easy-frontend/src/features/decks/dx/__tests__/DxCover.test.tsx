/**
 * DxCover — coverImageVariants wiring tests (INFRA-11-04)
 *
 * Proves that DxCover calls pickBestSrc and uses the resulting WebP derivative
 * URL in the background-image of [data-testid="dx-cover-img"], not the raw
 * coverImageUrl. Also verifies the fallback path when no variants exist.
 */

import { render } from '@testing-library/react';
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

  it('uses the 1600w WebP derivative on a 2x (retina) display', () => {
    setDevicePixelRatio(2);

    const { getByTestId } = render(<DxCover deck={variantsDeck} />);

    const img = getByTestId('dx-cover-img') as HTMLElement;
    const style = img.getAttribute('style') ?? '';

    // 800 * 2 = 1600 → the largest derivative, so a 2x display is not fed an upscaled image.
    expect(style).toContain('a_1600w.webp');
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
