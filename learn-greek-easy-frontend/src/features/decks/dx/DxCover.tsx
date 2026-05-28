// src/features/decks/dx/DxCover.tsx
//
// Gradient cover primitive. Every cover is a CSS linear-gradient derived from
// deck.level + deck.category — no <img>, no coverImageUrl reads.
//
// Layers (bottom → top):
//   1. deck gradient  (via CSS custom property set on the host element)
//   2. sheen          (radial highlight, top-right corner)
//   3. scrim          (linear dark overlay, improves text legibility)
//   4. children       (text / badges, white on dark background)

import React from 'react';

import type { Deck } from '@/types/deck';

import { deckGradient } from './deckGradient';

export type DxCoverVariant = 'card' | 'stack-front' | 'stack-1' | 'stack-2';

export interface DxCoverProps {
  deck: Pick<Deck, 'id' | 'level' | 'category'>;
  variant?: DxCoverVariant;
  className?: string;
  children?: React.ReactNode;
}

/**
 * DxCover — renders a gradient-backed cover with scrim + sheen overlays.
 *
 * The CSS custom property set depends on `variant`:
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
