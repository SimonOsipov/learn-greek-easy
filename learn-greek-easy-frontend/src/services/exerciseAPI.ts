import type { WordTimestamp } from '@/types/situation';

import { api, buildQueryString } from './api';

export type ExerciseModality = 'listening' | 'reading';

export type ExerciseSourceType = 'description' | 'dialog' | 'picture';

export type ExerciseType = 'fill_gaps' | 'select_heard' | 'true_false' | 'select_correct_answer';

export type CardStatus = 'new' | 'learning' | 'review' | 'mastered';

export type DeckLevel = 'A1' | 'A2' | 'B1' | 'B2';

export interface ExerciseItemPayload {
  item_index: number;
  payload: Record<string, unknown>;
}

export interface ExerciseQueueItem {
  exercise_id: string;
  source_type: ExerciseSourceType;
  exercise_type: ExerciseType;
  modality: ExerciseModality | null;
  audio_level: DeckLevel | null;
  status: CardStatus;
  is_new: boolean;
  is_early_practice: boolean;
  due_date: string | null;
  easiness_factor: number | null;
  interval: number | null;
  situation_id: string | null;
  scenario_el: string | null;
  scenario_en: string | null;
  scenario_ru: string | null;
  description_text_el: string | null;
  description_audio_url: string | null;
  description_audio_duration: number | null;
  word_timestamps: WordTimestamp[] | null;
  items: ExerciseItemPayload[];
}

export interface ExerciseQueue {
  total_due: number;
  total_new: number;
  total_early_practice: number;
  total_in_queue: number;
  exercises: ExerciseQueueItem[];
}

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
  previous_status: CardStatus;
  new_status: CardStatus;
  easiness_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string;
  message: string | null;
}

export interface ExerciseQueueParams {
  situation_id?: string;
  source_type?: ExerciseSourceType;
  modality?: ExerciseModality;
  audio_level?: DeckLevel;
  limit?: number;
  include_new?: boolean;
  new_limit?: number;
  include_early_practice?: boolean;
  early_practice_limit?: number;
}

export const exerciseAPI = {
  getQueue: async (params: ExerciseQueueParams = {}): Promise<ExerciseQueue> => {
    const queryString = buildQueryString({ ...params });
    return api.get<ExerciseQueue>(`/api/v1/exercises/queue${queryString}`);
  },

  submitReview: async (data: ExerciseReviewRequest): Promise<ExerciseReviewResult> => {
    return api.post<ExerciseReviewResult>('/api/v1/exercises/review', data);
  },
};
