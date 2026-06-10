/**
 * Culture-tab presentation helpers (MOB-10): exam tint gradients, score colours,
 * verdict labels, and subtopic data. Pure functions — no React.
 *
 * Tint gradients mirror the handoff `EXAM_TINT` map (culture.jsx → EXAM_TINT),
 * converted hsl → rgb (MOB-13: no NativeWind /NN modifiers; fixed full-colour
 * values with hsl source comments). Four tints cycle via djb2(id) % 4.
 */

import type { CategoryReadiness } from '@/types/culture';

// ---------------------------------------------------------------------------
// Exam tint gradients
// ---------------------------------------------------------------------------

/** Four exam-cover gradient stop pairs (135deg). rgb values per MOB-13 convention. */
export const EXAM_TINT_PALETTE: readonly (readonly [string, string])[] = [
  ['rgb(34,160,113)', 'rgb(32,103,110)'],   // green  — hsl(160 65% 40%) → hsl(180 55% 28%)
  ['rgb(246,168,35)',  'rgb(204,80,16)'],    // amber  — hsl(38 92% 55%)  → hsl(20 85% 42%)
  ['rgb(45,125,221)', 'rgb(39,62,154)'],    // blue   — hsl(212 80% 55%) → hsl(225 60% 38%)
  ['rgb(164,82,224)', 'rgb(43,33,128)'],    // violet — hsl(280 75% 60%) → hsl(248 55% 38%)
] as const;

export type ExamTintName = 'green' | 'amber' | 'blue' | 'violet';

/** Named tint map for looking up by key from the handoff data. */
export const EXAM_TINT_NAMED: Record<ExamTintName, readonly [string, string]> = {
  green:  EXAM_TINT_PALETTE[0],
  amber:  EXAM_TINT_PALETTE[1],
  blue:   EXAM_TINT_PALETTE[2],
  violet: EXAM_TINT_PALETTE[3],
};

/**
 * djb2 hash — same algorithm as lib/decks/presentation.ts so id → index is
 * stable across app restarts.
 */
function djb2(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministically maps a deck id to one of the four exam tint gradients. */
export function tintForDeckId(id: string): readonly [string, string] {
  return EXAM_TINT_PALETTE[djb2(id) % EXAM_TINT_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Score colour helpers
// ---------------------------------------------------------------------------

/** Fixed semantic colours for category score bars (same in both themes). */
export const SCORE_STRONG = 'rgb(37,177,130)';  // hsl(160 65% 42%) — green  ≥ 70%
export const SCORE_WEAK   = 'rgb(252,111,13)';  // hsl(25 95% 53%)  — orange < 40%
// mid (40–70%): use the `primary` design token via className, not a fixed rgb.

/**
 * Returns a fixed rgb colour string for the category score bar fill.
 * `pct` is expected 0–1 (post-division).
 * For mid-range (40–70%) returns null — callers should use the `primary` token via className.
 */
export function scoreBarColor(pct: number): string | null {
  if (pct >= 0.7) return SCORE_STRONG;
  if (pct < 0.4) return SCORE_WEAK;
  return null; // mid — use primary token
}

// ---------------------------------------------------------------------------
// Verdict labels
// ---------------------------------------------------------------------------

/** Maps backend verdict keys to friendly display strings. */
export function verdictLabel(verdict: string): string {
  switch (verdict) {
    case 'not_ready':           return 'Just getting started';
    case 'getting_there':       return 'Almost halfway';
    case 'ready':               return 'Nearly ready';
    case 'thoroughly_prepared': return 'Thoroughly prepared';
    default:                    return 'Getting there';
  }
}

// ---------------------------------------------------------------------------
// Weakest topics
// ---------------------------------------------------------------------------

/**
 * Returns up to two category display-labels with the lowest readiness scores.
 * Used for the "Focus on X and Y" sentence in the readiness card.
 * `categories[].readiness_percentage` values are 0–100 from the backend.
 */
export function weakestTopicLabels(categories: CategoryReadiness[]): string[] {
  return [...categories]
    .sort((a, b) => a.readiness_percentage - b.readiness_percentage)
    .slice(0, 2)
    .map((c) => categoryLabel(c.category));
}

// ---------------------------------------------------------------------------
// Subtopics constant (Drill by topic)
// ---------------------------------------------------------------------------

export interface SubtopicItem {
  id: string;
  /** English display title */
  title: string;
  /** Greek name (Noto Serif) */
  el: string;
  /** 2–3 char monogram shown in the gradient tile */
  mark: string;
  /** Question count (static placeholder — follow-up ticket wires to backend) */
  n: number;
}

/**
 * Static subtopics shown in the "Drill by topic" section.
 * Three rows per the design handoff — History, Politics, Geography.
 * Question counts are placeholders; a follow-up ticket wires these to backend topic stats.
 */
export const SUBTOPICS: readonly SubtopicItem[] = [
  { id: 'history',   title: 'History',   el: 'Ιστορία',   mark: 'Ιστ', n: 42 },
  { id: 'politics',  title: 'Politics',  el: 'Πολιτική',  mark: 'Πολ', n: 28 },
  { id: 'geography', title: 'Geography', el: 'Γεωγραφία', mark: 'Γεω', n: 36 },
] as const;

// ---------------------------------------------------------------------------
// Category label map (for readiness bars — backend key → display label)
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<string, string> = {
  history:    'History',
  politics:   'Politics',
  geography:  'Geography',
  language:   'Language',
  society:    'Society',
  culture:    'Culture',
  traditions: 'Traditions',
  practical:  'Practical',
  news:       'News',
};

/** Resolves a backend category key to its display label. Falls back to capitalized key. */
export function categoryLabel(k: string): string {
  return CATEGORY_LABELS[k] ?? (k.charAt(0).toUpperCase() + k.slice(1));
}
