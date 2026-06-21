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
//
// ADMIN2-40 F6-A additions:
//   - card variant caps the target width at 800 (no DPR multiply) so the 800w
//     derivative is always chosen for cards, avoiding 1600w URLs that 404 when
//     the source image is narrower than 1600px.
//   - A hidden probe <img> fires onError when the selected WebP derivative 404s,
//     swapping the painted background to deck.coverImageUrl (the original upload).

import React, { useState } from 'react';

import { pickBestSrc } from '@/lib/imageVariants';
import type { Deck } from '@/types/deck';

import { deckGradient } from './deckGradient';

export type DxCoverVariant = 'card' | 'stack-front' | 'stack-1' | 'stack-2';

export interface DxCoverProps {
  deck: Pick<Deck, 'id' | 'level' | 'category' | 'coverImageUrl' | 'coverImageVariants'>;
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

  // Pick the best-fit WebP derivative for the card's rendered width, scaled by the
  // device pixel ratio. Cards render up to ~700px wide, so the old fixed 400px target
  // was upscaled ~3.5x on a 2x display (and was already soft at 1x), looking blurry.
  //
  // A1 (ADMIN2-40 F6-A): card variant is capped at 800 (no DPR multiply). Cards are
  // always ≤ ~700 CSS px, so 800w is the correct sharp target regardless of screen
  // density. More importantly, derivatives are only generated for source images wider
  // than each target width, so the 1600w derivative may not exist for many images,
  // causing 404s on retina displays. Non-card variants (stack-front, stack-1, stack-2,
  // hero/default) keep the full 800*DPR scaling so retina stacks look crisp.
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const targetWidth = variant === 'card' ? 800 : Math.round(800 * dpr);
  const initialSrc = pickBestSrc(deck.coverImageVariants, targetWidth, deck.coverImageUrl);

  // A2 (ADMIN2-40 F6-A): track the displayed src in state so we can swap it when the
  // selected WebP derivative 404s. A hidden probe <img> fires onError which sets the
  // displayed src to the original upload URL (always-present, no derivative suffix).
  // Guard against loops: if the original also fails, we clear the src so the gradient
  // shows through (the probe's onError is only wired when displayedSrc === initialSrc).
  const [displayedSrc, setDisplayedSrc] = useState<string | null | undefined>(initialSrc);

  // `has-cover` lets the scrim darken the left text column more on photo covers.
  const cls = ['dx-cover-host', displayedSrc && 'has-cover', className].filter(Boolean).join(' ');

  const handleProbeError = () => {
    // Swap once to the original URL. If there's no original (shouldn't happen when we
    // have a displayedSrc, but guard anyway), clear to show the gradient instead.
    const original = deck.coverImageUrl ?? null;
    setDisplayedSrc(original !== initialSrc ? original : null);
  };

  return (
    <div className={cls} style={style} data-variant={variant}>
      {displayedSrc && (
        <div
          className="dx-cover-img"
          data-testid="dx-cover-img"
          style={{ backgroundImage: `url("${displayedSrc}")` }}
          aria-hidden="true"
        />
      )}
      {/* Probe <img>: hidden element whose src tracks the selected derivative.
          When the derivative 404s, onError swaps the background to the original.
          Only rendered when we have an initial variant-selected src (not the original
          itself, since the original doesn't need a fallback probe). */}
      {initialSrc && initialSrc !== deck.coverImageUrl && (
        <img
          src={initialSrc}
          alt=""
          aria-hidden="true"
          style={{ display: 'none' }}
          onError={handleProbeError}
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
