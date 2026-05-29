// src/features/decks/dx/index.ts
// Top-level barrel for the dx (decks experience) design system.
// Consumers import from '@/features/decks/dx'.

// Co-locate the stylesheet with the components so the dx-* classes load
// wherever dx components are used — including deep-links to the deck detail
// page, whose chunk would not otherwise pull in dx.css.
import './dx.css';

// ── Atoms (from dx/atoms sub-barrel) ────────────────────────────────────────
export { Kicker, TypeChip, DonutRing, WeekHeat, Breadcrumb, UnwiredDot, DxSvgDefs } from './atoms';
export type {
  KickerProps,
  DxTone,
  TypeChipProps,
  DonutRingProps,
  WeekHeatProps,
  BreadcrumbItem,
  BreadcrumbProps,
  UnwiredDotProps,
} from './atoms';

// ── Gradient utilities ───────────────────────────────────────────────────────
export { deckGradient, deckGradientStack } from './deckGradient';

// ── Cover primitive ──────────────────────────────────────────────────────────
export { DxCover } from './DxCover';
export type { DxCoverProps, DxCoverVariant } from './DxCover';
