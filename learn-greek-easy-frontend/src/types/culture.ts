/**
 * Culture Exam TypeScript type definitions.
 * Matches backend API response schemas from CULTURE-03.
 */

export type CultureLanguage = 'el' | 'en' | 'ru';

export type CultureCategory =
  | 'history'
  | 'geography'
  | 'politics'
  | 'culture'
  | 'traditions'
  | 'practical';

export interface MultilingualText {
  el: string;
  en: string;
  ru: string;
}

export interface CultureQuestionResponse {
  id: string;
  question_text: MultilingualText;
  options: MultilingualText[]; // Array of 4 options
  image_url: string | null;
  order_index: number;
}

export interface CultureDeckResponse {
  id: string;
  name: MultilingualText;
  description: MultilingualText;
  icon: string;
  color_accent: string;
  category: CultureCategory;
  question_count: number;
  progress: CultureDeckProgress | null;
}

export interface CultureDeckProgress {
  questions_total: number;
  questions_mastered: number;
  questions_learning: number;
  questions_new: number;
  last_practiced_at: string | null;
}

export interface CultureAnswerRequest {
  selected_option: number; // 1-4
  time_taken: number; // milliseconds
  language: CultureLanguage;
}

export interface CultureAnswerResponse {
  is_correct: boolean;
  correct_option: number;
  xp_earned: number;
  new_stats: CultureQuestionStats;
}

export interface CultureQuestionStats {
  easiness_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string;
  status: 'new' | 'learning' | 'review' | 'mastered';
}
