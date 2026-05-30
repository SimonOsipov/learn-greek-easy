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

// ── Card shell + head (PRACT2-1-03) ─────────────────────────────────────────
export { Card } from './Card';
export type { CardProps } from './Card';
export { CardHead } from './CardHead';
export type { CardHeadProps } from './CardHead';
export { AudioChip } from './AudioChip';
export type { AudioChipProps, AudioChipState } from './AudioChip';

// ── Question renderers (PRACT2-1-03) ────────────────────────────────────────
export { TranslationElToEn, TranslationEnToEl } from './questions/Translation';
export type { TranslationElToEnProps, TranslationEnToElProps } from './questions/Translation';
export { GrammarArticle, GrammarPlural } from './questions/Grammar';
export type { GrammarArticleProps, GrammarPluralProps } from './questions/Grammar';

// ── Question renderers (PRACT2-1-04) ────────────────────────────────────────
export { Sentence, SentenceElToEn, SentenceEnToEl } from './questions/Sentence';
export type { SentenceProps } from './questions/Sentence';

// ── Audio surface (PRACT2-1-06) ─────────────────────────────────────────────
export { AudioSurface, barHeight } from './AudioSurface';
export type { AudioSurfaceProps, AudioSurfaceState } from './AudioSurface';

// -- Question renderers (PRACT2-1-05) -----------------------------------------
export { Declension } from './questions/Declension';
export type { DeclensionProps, DeclensionTable, DeclensionRow } from './questions/Declension';

// ── Answer phase (PRACT2-1-07) ───────────────────────────────────────────────
export { Answer, isElAnswer } from './Answer';
export type { AnswerProps } from './Answer';
export { RatingRow } from './RatingRow';
export type { RatingRowProps } from './RatingRow';
export { Toast, formatReviewInterval } from './Toast';
export type { ToastProps } from './Toast';
