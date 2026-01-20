/**
 * Mock Exam TypeScript type definitions.
 * Matches backend API response schemas.
 */

import type { MultilingualText } from './culture';

// Session status
export type MockExamSessionStatus = 'active' | 'completed' | 'abandoned';

// Question
export interface MockExamQuestion {
  id: string;
  question_text: MultilingualText;
  options: MultilingualText[];
  option_count: number;
  image_url: string | null;
  order_index: number;
}

// Session
export interface MockExamSession {
  id: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  score: number;
  total_questions: number;
  passed: boolean;
  time_taken_seconds: number;
  status: MockExamSessionStatus;
}

// Create session response
export interface MockExamCreateResponse {
  session: MockExamSession;
  questions: MockExamQuestion[];
  is_resumed: boolean;
}

// Queue response
export interface MockExamQueueResponse {
  total_questions: number;
  available_questions: number;
  can_start_exam: boolean;
  sample_questions: MockExamQuestion[];
}

// Submit-all answer item (matches MockExamAnswerItem from backend)
export interface MockExamAnswerItem {
  question_id: string;
  selected_option: number; // 1-4
  time_taken_seconds: number;
}

// Submit-all request (matches MockExamSubmitAllRequest from backend)
export interface MockExamSubmitAllRequest {
  answers: MockExamAnswerItem[]; // 1-25 items
  total_time_seconds: number;
}

// Individual answer result in submit-all response (matches MockExamAnswerResult from backend)
export interface MockExamAnswerResult {
  question_id: string;
  is_correct: boolean;
  correct_option: number; // 1-4
  selected_option: number; // 1-4
  xp_earned: number;
  was_duplicate: boolean;
}

// Submit-all response (matches MockExamSubmitAllResponse from backend)
export interface MockExamSubmitAllResponse {
  session: MockExamSession;
  passed: boolean;
  score: number;
  total_questions: number;
  percentage: number; // 0-100
  pass_threshold: number; // 60
  answer_results: MockExamAnswerResult[];
  total_xp_earned: number;
  new_answers_count: number;
  duplicate_answers_count: number;
}

// Statistics
export interface MockExamStats {
  total_exams: number;
  passed_exams: number;
  pass_rate: number;
  average_score: number;
  best_score: number;
  total_questions_answered: number;
  average_time_seconds: number;
}

// History item
export interface MockExamHistoryItem {
  id: string;
  started_at: string;
  completed_at: string | null;
  score: number;
  total_questions: number;
  passed: boolean;
  time_taken_seconds: number;
}

// Statistics response
export interface MockExamStatisticsResponse {
  stats: MockExamStats;
  recent_exams: MockExamHistoryItem[];
}

// Constants
export const MOCK_EXAM_QUESTION_COUNT = 25;
export const MOCK_EXAM_PASS_THRESHOLD = 60;
export const MOCK_EXAM_PASS_SCORE = 16;
