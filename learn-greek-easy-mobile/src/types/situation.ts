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

export interface SituationDescription {
  text_el: string;
  text_el_a2: string | null;
  text_en: string | null;
  text_en_a2: string | null;
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
export type ExerciseStatus = 'new' | 'learning' | 'mastered';

// Supported exercise payload types
export interface SelectCorrectAnswerPayload {
  question_el: string;
  question_en: string | null;
  options: { text_el: string; is_correct: boolean }[];
}

export interface TrueFalsePayload {
  statement_el: string;
  statement_en: string | null;
  is_true: boolean;
}

export interface FillGapsPayload {
  sentence_el: string;
  sentence_en: string | null;
  blanks: { index: number; answer: string; options?: string[] }[];
}

export type ExercisePayload =
  | SelectCorrectAnswerPayload
  | TrueFalsePayload
  | FillGapsPayload
  | Record<string, unknown>;

export interface ExerciseQueueItem {
  exercise_id: string;
  exercise_type: ExerciseType;
  modality: ExerciseModality;
  audio_level: AudioLevel;
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
