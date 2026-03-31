// --- Enums as union types ---

export type SituationStatus = 'draft' | 'partial_ready' | 'ready';
export type SituationDialogStatus = 'draft' | 'audio_ready' | 'exercises_ready';
export type SituationDescriptionStatus = 'draft' | 'audio_ready';
export type SituationDescriptionSourceType = 'original' | 'news';
export type SituationPictureStatus = 'draft' | 'generated';

// --- Nested child types (for detail response) ---

export interface DialogSpeaker {
  id: string;
  speaker_index: number;
  character_name: string;
  voice_id: string;
}

export interface WordTimestamp {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface DialogLine {
  id: string;
  line_index: number;
  speaker_id: string;
  text: string;
  start_time_ms: number | null;
  end_time_ms: number | null;
  word_timestamps: WordTimestamp[] | null;
}

export interface DialogNested {
  id: string;
  status: SituationDialogStatus;
  num_speakers: number;
  audio_duration_seconds: number | null;
  audio_url: string | null;
  created_at: string;
  speakers: DialogSpeaker[];
  lines: DialogLine[];
}

export interface DescriptionNested {
  id: string;
  text_el: string;
  text_el_a2: string | null;
  source_type: SituationDescriptionSourceType;
  status: SituationDescriptionStatus;
  audio_duration_seconds: number | null;
  audio_a2_duration_seconds: number | null;
  audio_url: string | null;
  audio_a2_url: string | null;
  word_timestamps: WordTimestamp[] | null;
  word_timestamps_a2: WordTimestamp[] | null;
  created_at: string;
}

export interface PictureNested {
  id: string;
  image_prompt: string;
  status: SituationPictureStatus;
  created_at: string;
}

// --- List item (matches SituationListItem Pydantic schema) ---

export interface SituationListItem {
  id: string;
  scenario_el: string;
  scenario_en: string;
  scenario_ru: string;
  status: SituationStatus;
  created_at: string;
  has_dialog: boolean;
  has_description: boolean;
  has_picture: boolean;
  has_dialog_audio: boolean;
  has_description_audio: boolean;
  description_timestamps_count: number;
}

// --- Response (matches SituationResponse) ---

export interface SituationResponse {
  id: string;
  scenario_el: string;
  scenario_en: string;
  scenario_ru: string;
  status: SituationStatus;
  created_at: string;
  updated_at: string;
}

// --- Detail response (extends SituationResponse with nested children) ---

export interface SituationDetailResponse extends SituationResponse {
  dialog: DialogNested | null;
  description: DescriptionNested | null;
  picture: PictureNested | null;
}

// --- Create payload (matches SituationCreate) ---

export interface SituationCreatePayload {
  scenario_el: string;
  scenario_en: string;
  scenario_ru: string;
}

// --- Update payload ---

export interface SituationUpdatePayload {
  scenario_el?: string;
  scenario_en?: string;
  scenario_ru?: string;
}

// --- List response (matches SituationListResponse) ---

export interface SituationListResponse {
  items: SituationListItem[];
  total: number;
  page: number;
  page_size: number;
  status_counts: Record<string, number>;
}

// --- Learner-facing types (matches learner_situation.py schemas) ---

export interface LearnerDescriptionNested {
  text_el: string;
  text_el_a2: string | null;
  audio_url: string | null;
  audio_a2_url: string | null;
  audio_duration_seconds: number | null;
  audio_a2_duration_seconds: number | null;
  word_timestamps: WordTimestamp[] | null;
  word_timestamps_a2: WordTimestamp[] | null;
}

export interface LearnerDialogNested {
  speakers: DialogSpeaker[];
  lines: DialogLine[];
  audio_url: string | null;
  audio_duration_seconds: number | null;
}

export interface LearnerSituationListItem {
  id: string;
  scenario_el: string;
  scenario_en: string;
  scenario_ru: string;
  status: SituationStatus;
  has_audio: boolean;
  has_dialog: boolean;
  exercise_total: number;
  exercise_completed: number;
}

export interface LearnerSituationListResponse {
  items: LearnerSituationListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface LearnerSituationDetailResponse {
  id: string;
  scenario_el: string;
  scenario_en: string;
  scenario_ru: string;
  status: SituationStatus;
  description: LearnerDescriptionNested | null;
  dialog: LearnerDialogNested | null;
  exercise_total: number;
  exercise_completed: number;
}
