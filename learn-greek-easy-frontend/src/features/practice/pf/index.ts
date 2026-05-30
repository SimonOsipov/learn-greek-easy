// src/features/practice/pf/index.ts
// Top-level barrel for the pf (practice flow) design system.
// Consumers import from '@/features/practice/pf'.
//
// Note: pf.css is imported directly by PracticeApp.tsx (the shell that renders
// the practice route) rather than here. A CSS import in this shared barrel
// would land in the common chunk; Vite does not reliably inject its stylesheet
// for routes that reach it via a static import — mirroring the dx precedent.

// ── Shell component ─────────────────────────────────────────────────────────
export { PracticeApp } from './PracticeApp';
export type { PracticeAppProps } from './PracticeApp';

// ── Family map utilities ────────────────────────────────────────────────────
export { FAMILIES, familyForCardType, descriptorForCardType } from './families';
export type { PracticeFamily, FamilyDescriptor } from './families';

// ── Top bar components (PRACT2-1-02) ────────────────────────────────────────
export { TopBar } from './TopBar';
export type { TopBarProps } from './TopBar';
export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';
export { StreakPill } from './StreakPill';
export type { StreakPillProps } from './StreakPill';
