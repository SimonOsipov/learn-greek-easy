/**
 * DxCover — coverImageVariants wiring tests (INFRA-11-04)
 *
 * Proves that DxCover calls pickBestSrc and uses the resulting WebP derivative
 * URL in the background-image of [data-testid="dx-cover-img"], not the raw
 * coverImageUrl. Also verifies the fallback path when no variants exist.
 */

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { DeckCategory, DeckLevel } from '@/types/deck';

import { DxCover } from '../DxCover';

const baseDeck = {
  id: 'deck-variants-1',
  level: 'A2' as DeckLevel,
  category: 'vocabulary' as DeckCategory,
};

describe('DxCover — coverImageVariants (INFRA-11-04)', () => {
  it('uses the 400w WebP variant URL in backgroundImage, not the original coverImageUrl', () => {
    const deck = {
      ...baseDeck,
      coverImageVariants: {
        400: 'a_400w.webp',
        800: 'a_800w.webp',
        1600: 'a_1600w.webp',
      },
      coverImageUrl: 'orig.png',
    };

    const { getByTestId } = render(<DxCover deck={deck} />);

    const img = getByTestId('dx-cover-img') as HTMLElement;
    const style = img.getAttribute('style') ?? '';

    // The 400w variant must be used (not the original).
    expect(style).toContain('a_400w.webp');
    expect(style).not.toContain('orig.png');
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
