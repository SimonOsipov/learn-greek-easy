// src/features/decks/dx/DxCover.tsx
//
// Cover primitive. Renders the deck's cover image when `coverImageUrl` is set,
// falling back to a CSS linear-gradient derived from deck.level + deck.category.
//
// Layers (bottom → top):
//   1. deck gradient  (via CSS custom property set on the host element — fallback)
//   2. cover image    (background-image layer, only when coverImageUrl is set)
//   3. scrim          (linear dark overlay, improves text legibility)
//   4. sheen          (radial highlight, top-right corner)
//   5. children       (text / badges, white on dark background)
//
// The image is a background-image layer (not an <img>): a broken or absent URL
// transparently reveals the gradient underneath, so the gradient is a true
// fallback even when an image fails to load.

import React from 'react';

import type { Deck } from '@/types/deck';

import { deckGradient } from './deckGradient';

export type DxCoverVariant = 'card' | 'stack-front' | 'stack-1' | 'stack-2';

export interface DxCoverProps {
  deck: Pick<Deck, 'id' | 'level' | 'category' | 'coverImageUrl'>;
  variant?: DxCoverVariant;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DxCover — renders a deck cover with scrim + sheen overlays.
 *
 * When `deck.coverImageUrl` is set, the image is painted as a background-image
 * layer above the gradient; otherwise the gradient shows through. The gradient
 * (set via a CSS custom property, chosen by `variant`) is always the fallback:
 *   card        → --dx-grad       (used by .dx-deck-card)
 *   stack-front → --dx-cover-grad (used by .dx-cover.dx-cover-3)
 *   stack-1     → --dx-cover-grad-1 (used by .dx-cover.dx-cover-1)
 *   stack-2     → --dx-cover-grad-2 (used by .dx-cover.dx-cover-2)
 */
export function DxCover({ deck, variant = 'card', className, children }: DxCoverProps) {
  const gradient = deckGradient(deck);

  const cssVarName = CSS_VAR_FOR_VARIANT[variant];
  const style: React.CSSProperties & Record<string, string> = {
    [cssVarName]: gradient,
  };

  const cls = ['dx-cover-host', className].filter(Boolean).join(' ');

  return (
    <div className={cls} style={style} data-variant={variant}>
      {deck.coverImageUrl && (
        <div
          className="dx-cover-img"
          data-testid="dx-cover-img"
          style={{ backgroundImage: `url("${deck.coverImageUrl}")` }}
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Variant → CSS custom property name mapping
// ────────────────────────────────────────────────────────────────────────────

const CSS_VAR_FOR_VARIANT: Record<DxCoverVariant, string> = {
  card: '--dx-grad',
  'stack-front': '--dx-cover-grad',
  'stack-1': '--dx-cover-grad-1',
  'stack-2': '--dx-cover-grad-2',
};
