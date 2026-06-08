/**
 * Types for the /api/v1/news endpoint.
 * Field names match backend JSON (snake_case) exactly.
 * Note: items have NO `level` field.
 */

export interface NewsItem {
  id: string;
  title_el: string;
  title_en: string;
  title_ru: string;
  publication_date: string;
  image_url: string | null;
  audio_url: string | null;
  audio_duration_seconds: number | null;
}

export interface NewsListResponse {
  items: NewsItem[];
  total: number;
  page: number;
  page_size: number;
  country_counts: {
    cyprus: number;
    greece: number;
    world: number;
  };
  audio_count: number;
}
