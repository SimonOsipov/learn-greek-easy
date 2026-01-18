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

// Answer request
export interface MockExamAnswerRequest {
  question_id: string;
  selected_option: number;
  time_taken_seconds: number;
}

// Answer response
export interface MockExamAnswerResponse {
  is_correct: boolean | null;
  correct_option: number | null;
  xp_earned: number;
  current_score: number;
  answers_count?: number; // Optional - frontend uses optimistic local tracking
  duplicate: boolean;
}

// Complete request
export interface MockExamCompleteRequest {
  total_time_seconds: number;
}

// Complete response
export interface MockExamCompleteResponse {
  session: MockExamSession;
  passed: boolean;
  score: number;
  total_questions: number;
  percentage: number;
  pass_threshold: number;
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
