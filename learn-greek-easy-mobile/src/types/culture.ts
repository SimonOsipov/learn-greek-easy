/**
 * Types for culture-exam endpoints.
 * Field names match backend JSON (snake_case) exactly.
 *
 * Endpoints:
 *   GET /api/v1/culture/readiness   → CultureReadinessResponse
 *   GET /api/v1/culture/decks       → CultureDeckListResponse
 *
 * Ground-truth: learn-greek-easy-backend/src/schemas/culture.py
 *   CultureReadinessResponse  lines 369–396
 *   CategoryReadiness         lines 344–367
 *   CultureDeckListResponse   lines 141–145
 *   CultureDeckResponse       lines 86–123
 *   CultureDeckProgress       lines 69–78
 */

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/** Per-topic readiness data — verbatim from CategoryReadiness (culture.py:344–367). */
export interface CategoryReadiness {
  /** Backend category key: e.g. 'history' | 'politics' | 'geography' */
  category: string;
  /** Weighted readiness score 0–100 */
  readiness_percentage: number;
  /** Questions with MASTERED status */
  questions_mastered: number;
  /** Total questions in this category */
  questions_total: number;
  /** UUIDs of decks in this category */
  deck_ids: string[];
  /** Per-category accuracy from last 30 days; null if no answers */
  accuracy_percentage: number | null;
  /** True when accuracy < 70% and readiness >= 80% */
  needs_reinforcement: boolean;
}

export type ReadinessVerdict = 'not_ready' | 'getting_there' | 'ready' | 'thoroughly_prepared';

/** Verbatim from CultureReadinessResponse (culture.py:369–396). */
export interface CultureReadinessResponse {
  /** Weighted readiness score 0–100 */
  readiness_percentage: number;
  verdict: ReadinessVerdict;
  /** Questions with MASTERED status */
  questions_learned: number;
  /** Total questions across included categories */
  questions_total: number;
  /** Overall answer accuracy; null if no answers */
  accuracy_percentage: number | null;
  /** Total answers submitted */
  total_answers: number;
  categories: CategoryReadiness[];
  motivation: unknown | null;
}

// ---------------------------------------------------------------------------
// Culture decks
// ---------------------------------------------------------------------------

/** Verbatim from CultureDeckProgress (culture.py:69–78). */
export interface CultureDeckProgress {
  questions_total: number;
  questions_mastered: number;
  questions_learning: number;
  questions_new: number;
  /** ISO datetime string or null */
  last_practiced_at: string | null;
}

/**
 * Verbatim from CultureDeckResponse (culture.py:86–123).
 *
 * NOTE: there is no `exam_date` field on this schema (api-map gap #9).
 * The display date for exam decks must be derived from name/name_en if needed,
 * or omitted — it is documented as a known gap in .ralph/briefs/api-map.md.
 */
export interface CultureDeckResponse {
  id: string;
  name: string;
  description: string | null;
  name_en: string | null;
  name_ru: string | null;
  description_en: string | null;
  description_ru: string | null;
  category: string;
  question_count: number;
  is_premium: boolean;
  /** Null for unauthenticated users or decks never practiced. */
  progress: CultureDeckProgress | null;
  cover_image_url: string | null;
}

/** Verbatim from CultureDeckListResponse (culture.py:141–145). */
export interface CultureDeckListResponse {
  total: number;
  decks: CultureDeckResponse[];
}
