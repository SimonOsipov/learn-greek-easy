/**
 * Types for culture-exam endpoints.
 * Field names match backend JSON (snake_case) exactly.
 *
 * Endpoints:
 *   GET /api/v1/culture/readiness   → CultureReadinessResponse
 *   GET /api/v1/culture/decks       → CultureDeckListResponse
 */

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/** Per-topic readiness score. `pct` is 0–100 from the backend; divide by 100 in presentation. */
export interface CategoryReadiness {
  /** Machine key: e.g. 'history' | 'politics' | 'geography' | 'language' | 'society' */
  k: string;
  /** Display label in English */
  l: string;
  /** Score 0–100 */
  pct: number;
}

export interface CultureReadinessResponse {
  /** Overall readiness score 0–100 */
  overall: number;
  categories: CategoryReadiness[];
  /** Verdict key from the backend */
  verdict: 'not_ready' | 'getting_there' | 'ready' | 'thoroughly_prepared';
}

// ---------------------------------------------------------------------------
// Culture decks
// ---------------------------------------------------------------------------

export interface CultureDeckProgress {
  mastered: number;
  total: number;
  /** Progress ratio 0..1 */
  progress: number;
}

export interface CultureDeckResponse {
  id: string;
  name: string;
  name_en: string | null;
  /** Exam date string, e.g. "Jul 2025" */
  exam_date: string | null;
  question_count: number;
  progress: CultureDeckProgress;
}

export interface CultureDeckListResponse {
  items: CultureDeckResponse[];
  total: number;
}
