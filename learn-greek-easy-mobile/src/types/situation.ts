/**
 * Types for the /api/v1/situations and /api/v1/situations/{id} endpoints.
 * Field names match backend JSON (snake_case) exactly.
 * Note: list items have NO `domain` or `level` field — those are client-mapped
 * from the presentation layer (src/lib/situations/presentation.ts).
 */

// ---------------------------------------------------------------------------
// Situations list
// ---------------------------------------------------------------------------

export interface SituationItem {
  id: string;
  scenario_el: string;
  scenario_en: string;
  scenario_ru?: string;
  status: 'ready' | 'draft';
  has_audio: boolean;
  has_dialog: boolean;
  exercise_total: number;
  exercise_completed: number;
  source_image_url: string | null;
}

export interface SituationListResponse {
  items: SituationItem[];
  total: number;
  page: number;
  page_size: number;
}

// ---------------------------------------------------------------------------
// Situation detail
// ---------------------------------------------------------------------------

export interface SituationDescriptionSpeaker {
  id: string;
  speaker_index: number;
  character_name: string;
  voice_id: string;
}

export interface SituationDialogLine {
  id: string;
  line_index: number;
  speaker_id: string;
  text: string;
  start_time_ms: number | null;
  end_time_ms: number | null;
  word_timestamps: Record<string, unknown>[] | null;
}

/**
 * LearnerDescriptionNested (src/schemas/learner_situation.py:9-19).
 * NOTE: text_en / text_en_a2 do NOT exist in the learner endpoint —
 * only the admin schema exposes them. The Translate toggle is therefore
 * not available in the mobile flow; see #8/#18 in review-findings.md.
 */
export interface SituationDescription {
  text_el: string;
  text_el_a2: string | null;
  audio_url: string | null;
  audio_a2_url: string | null;
  audio_duration_seconds: number | null;
  audio_a2_duration_seconds: number | null;
  word_timestamps: Record<string, unknown>[] | null;
  word_timestamps_a2: Record<string, unknown>[] | null;
}

export interface SituationDialog {
  speakers: SituationDescriptionSpeaker[];
  lines: SituationDialogLine[];
  audio_url: string | null;
  audio_duration_seconds: number | null;
}

export interface SituationDetail {
  id: string;
  scenario_el: string;
  scenario_en: string;
  scenario_ru: string | null;
  status: 'ready' | 'draft';
  description: SituationDescription | null;
  dialog: SituationDialog | null;
  exercise_total: number;
  exercise_completed: number;
  source_url: string | null;
  source_image_url: string | null;
  source_title: string | null;
  picture_url: string | null;
  picture_variants: Record<string, string> | null;
  source_image_variants: Record<string, string> | null;
}

// ---------------------------------------------------------------------------
// Exercise queue
// ---------------------------------------------------------------------------

export type ExerciseType =
  | 'select_correct_answer'
  | 'true_false'
  | 'fill_gaps'
  | 'select_heard'
  | 'select_picture_from_description'
  | 'select_description_from_picture'
  | 'word_order';

export type ExerciseModality = 'listening' | 'reading';
export type AudioLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
// ExerciseStatus: verbatim port of backend CardStatus (src/db/models.py:74-80)
export type ExerciseStatus = 'new' | 'learning' | 'review' | 'mastered';

// Supported exercise payload types — verbatim ports of src/schemas/exercise_payload.py

/** Trilingual text field used in SelectCorrectAnswerPayload (exercise_payload.py:6-11). */
export interface MultilingualField {
  el: string;
  en: string;
  ru: string;
}

/**
 * SelectCorrectAnswerPayload (exercise_payload.py:84-89).
 * prompt: question text (trilingual); options: answer choices (trilingual);
 * correct_answer_index: 0-based index of the correct option.
 */
export interface SelectCorrectAnswerPayload {
  prompt: MultilingualField;
  options: MultilingualField[];
  correct_answer_index: number;
}

/**
 * TrueFalsePayload (exercise_payload.py:67-74).
 * statement_el/en/ru: the statement text (trilingual);
 * correct_answer: true = Σωστό, false = Λάθος;
 * explanation: reason shown after answer.
 */
export interface TrueFalsePayload {
  statement_el: string;
  statement_en: string;
  statement_ru: string;
  correct_answer: boolean;
  explanation: string;
}

/**
 * FillGapsPayload (exercise_payload.py:14-21).
 * Rendered as: context_before + ___ + context_after.
 * options: the word choices; correct_answer: the correct word.
 */
export interface FillGapsPayload {
  line_index: number;
  correct_answer: string;
  options: string[];
  context_before: string;
  context_after: string;
}

export type ExercisePayload =
  | SelectCorrectAnswerPayload
  | TrueFalsePayload
  | FillGapsPayload
  | Record<string, unknown>;

export interface ExerciseQueueItem {
  exercise_id: string;
  exercise_type: ExerciseType;
  /** Nullable per backend ExerciseQueueItem (exercise_queue.py:25). */
  modality: ExerciseModality | null;
  /** Nullable per backend ExerciseQueueItem (exercise_queue.py:26). */
  audio_level: AudioLevel | null;
  source_type: 'description' | 'dialog' | 'picture';
  status: ExerciseStatus;
  is_new: boolean;
  items: { item_index: number; payload: ExercisePayload }[];
}

export interface ExerciseQueue {
  total_due: number;
  total_new: number;
  total_early_practice: number;
  total_in_queue: number;
  exercises: ExerciseQueueItem[];
}

// ---------------------------------------------------------------------------
// Exercise review
// ---------------------------------------------------------------------------

export interface ExerciseReviewRequest {
  exercise_id: string;
  score: number;
  max_score: number;
}

export interface ExerciseReviewResult {
  exercise_id: string;
  quality: number;
  score: number;
  max_score: number;
  previous_status: ExerciseStatus;
  new_status: ExerciseStatus;
  easiness_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string;
  message: string;
}
