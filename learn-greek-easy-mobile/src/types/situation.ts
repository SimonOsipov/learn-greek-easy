/**
 * Types for the /api/v1/situations endpoint.
 * Field names match backend JSON (snake_case) exactly.
 * Note: items have NO `domain` or `level` field.
 */

export interface SituationItem {
  id: string;
  scenario_el: string;
  scenario_en: string;
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
