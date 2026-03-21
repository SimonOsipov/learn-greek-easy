import type { DeckLevel } from '@/services/adminAPI';

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
  created_at: string;
  speakers: DialogSpeaker[];
  lines: DialogLine[];
}

export interface DescriptionNested {
  id: string;
  text_el: string;
  source_type: SituationDescriptionSourceType;
  status: SituationDescriptionStatus;
  audio_duration_seconds: number | null;
  audio_a2_duration_seconds: number | null;
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
  cefr_level: DeckLevel;
  status: SituationStatus;
  created_at: string;
  has_dialog: boolean;
  has_description: boolean;
  has_picture: boolean;
  has_dialog_audio: boolean;
  has_description_audio: boolean;
}

// --- Response (matches SituationResponse) ---

export interface SituationResponse {
  id: string;
  scenario_el: string;
  scenario_en: string;
  scenario_ru: string;
  cefr_level: DeckLevel;
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
  cefr_level: DeckLevel;
}

// --- List response (matches SituationListResponse) ---

export interface SituationListResponse {
  items: SituationListItem[];
  total: number;
  page: number;
  page_size: number;
}
