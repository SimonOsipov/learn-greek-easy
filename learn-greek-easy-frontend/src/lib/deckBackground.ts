import type { CSSProperties } from 'react';

/**
 * Returns CSS properties for a deck card background image with diagonal gradient overlay.
 * The gradient uses hsl(var(--card)) which automatically adapts to dark mode via shadcn theme.
 * Returns undefined when no URL is provided (cards render identically to current behavior).
 */
export function getDeckBackgroundStyle(coverImageUrl?: string): CSSProperties | undefined {
  if (!coverImageUrl) return undefined;
  return {
    backgroundImage: `linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.85) 40%, hsl(var(--card) / 0.5) 70%, hsl(var(--card) / 0.2) 100%), url(${coverImageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}
