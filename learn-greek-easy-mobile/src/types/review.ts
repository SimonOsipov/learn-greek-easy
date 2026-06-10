/**
 * TypeScript types for SRS card review (MOB-09).
 * Copy-first port of backend src/schemas/v2_sm2.py (snake_case verbatim).
 */

// ---------------------------------------------------------------------------
// Backend response shapes
// ---------------------------------------------------------------------------

/** Rating preview: SM-2 projection for one UI rating button. */
export interface V2RatingPreview {
  /** 1–4 UI rating (Again/Hard/Good/Easy) */
  rating: 1 | 2 | 3 | 4;
  /** SM-2 quality (0–5) sent to backend */
  quality: number;
  /** Days until next review */
  interval: number;
  next_review_date: string;
  new_status: string;
}

/** A single card in the study queue (GET /api/v1/study/queue/v2). */
export interface V2StudyQueueCard {
  card_record_id: string;
  word_entry_id: string;
  deck_id: string;
  deck_name: string;
  card_type: string;
  variant_key: string;
  /** Discriminated by card_type; keys include: prompt, main, sub, badge, hint */
  front_content: Record<string, unknown>;
  /** Discriminated by card_type; keys include: answer, answer_sub, context, declension_table, full_sentence */
  back_content: Record<string, unknown>;
  // #21/#42: backend CardStatus serializes lowercase; RELEARNING does not exist.
  // (models.py:74-80: 'new'/'learning'/'review'/'mastered'). Fixed verbatim port.
  status: 'new' | 'learning' | 'review' | 'mastered';
  is_new: boolean;
  is_early_practice: boolean;
  due_date: string | null;
  easiness_factor: number | null;
  interval: number | null;
  /** Presigned URL for the lemma audio. */
  audio_url: string | null;
  /** Presigned URL for the example sentence audio. */
  example_audio_url: string | null;
  translation_ru: string | null;
  translation_ru_plural: string | null;
  /** Russian example sentence gloss. */
  sentence_ru: string | null;
  /** Greek example sentence. */
  example_el: string | null;
  /** English gloss of example. */
  example_en: string | null;
  /** SM-2 interval projections for each of the 4 UI ratings. */
  rating_previews: V2RatingPreview[];
}

/** Queue response (GET /api/v1/study/queue/v2). */
export interface V2StudyQueue {
  total_due: number;
  total_new: number;
  total_early_practice: number;
  total_in_queue: number;
  cards: V2StudyQueueCard[];
}

/** Review submission request body (POST /api/v1/reviews/v2). */
export interface V2ReviewRequest {
  card_record_id: string;
  /** SM-2 quality 0–5 (derived from UI rating via mapRatingToQuality). */
  quality: number;
  /** Seconds spent on this card (0–180). */
  time_taken: number;
}

/** Review result (POST /api/v1/reviews/v2 response). */
export interface V2ReviewResult {
  card_record_id: string;
  quality: number;
  previous_status: string;
  new_status: string;
  easiness_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string;
  message: string | null;
}

// ---------------------------------------------------------------------------
// Client-side session state
// ---------------------------------------------------------------------------

/** UI rating labels (1–4). */
export type UIRating = 1 | 2 | 3 | 4;

/** Per-card result recorded client-side after each rating. */
export interface CardResult {
  card_record_id: string;
  rating: UIRating;
  time_taken: number;
}

/** Accumulated stats for the session summary screen. */
export interface SessionStats {
  reviewed: number;
  total_time_seconds: number;
  again_count: number;
  hard_count: number;
  good_count: number;
  easy_count: number;
}

/**
 * Maps a 1–4 UI rating to the SM-2 quality scale (0–5).
 * Canonical mapping from web frontend src/stores/v2PracticeStore.ts.
 *   Again(1) → 0 (complete failure, reset to learning)
 *   Hard(2)  → 2 (incorrect but easy, short interval)
 *   Good(3)  → 4 (correct with hesitation, normal interval)
 *   Easy(4)  → 5 (perfect, long interval × 2.5)
 */
export function mapRatingToQuality(rating: UIRating): number {
  switch (rating) {
    case 1: return 0;
    case 2: return 2;
    case 3: return 4;
    case 4: return 5;
  }
}
