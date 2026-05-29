// src/features/decks/dx/index.ts
// Top-level barrel for the dx (decks experience) design system.
// Consumers import from '@/features/decks/dx'.
//
// Note: dx.css is imported directly by the route modules that render dx
// components (DecksPage, V2DeckPage, WordHero) rather than here. A CSS import
// in this shared barrel lands in the common DxCover chunk, whose stylesheet
// Vite does not reliably inject for routes that reach it via a static import.

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
