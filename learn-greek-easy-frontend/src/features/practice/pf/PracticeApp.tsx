// src/features/practice/pf/PracticeApp.tsx
//
// Practice flow shell. Owns the full-screen `.pf-app` wrapper that:
//   - Sets `data-fam` for attribute-based styling hooks in later subtasks.
//   - Sets `data-ambient` to enable / disable the ambient glow.
//   - Sets the three `--pf-*` CSS custom properties that the glow reads.
//
// Stateless: derives everything from `cardType`. Family change re-renders
// with new CSS vars; the pf.css transition handles the visual fade.

import type { CSSProperties, ReactNode } from 'react';

import { descriptorForCardType } from './families';
import './pf.css';

export interface PracticeAppProps {
  /** The current card's card_type (or null/undefined between cards). */
  cardType?: string | null;
  /** Whether to show the ambient family glow. Defaults to true. */
  ambient?: boolean;
  children: ReactNode;
}

/**
 * PracticeApp — full-screen shell for the live deck practice session.
 *
 * Renders outside AppLayout (the page already does this). Provides the
 * `.pf-app` host element with per-family CSS custom properties for the
 * ambient radial glow defined in pf.css.
 *
 * Design-system compliance: all color values compose from existing HSL tokens
 * via `hsl(var(--token))`. No raw hex or arbitrary Tailwind values here.
 */
export function PracticeApp({ cardType, ambient = true, children }: PracticeAppProps) {
  const d = descriptorForCardType(cardType);

  // Set per-family CSS custom properties inline so pf.css ::before/::after
  // can reference them as var(--pf-glow-1) etc.
  // All values compose from existing index.css tokens — no raw hex (AC #6).
  const style = {
    ['--pf-c' as string]: `hsl(var(--${d.tone}))`,
    ['--pf-glow-1' as string]: `hsl(var(--${d.tone}) / 0.22)`,
    ['--pf-glow-2' as string]: `hsl(var(--${d.tone}) / 0.12)`,
  } as CSSProperties;

  return (
    <div className="pf-app" data-fam={d.family} data-ambient={ambient ? 'on' : 'off'} style={style}>
      {children}
    </div>
  );
}
