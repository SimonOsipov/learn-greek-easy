// src/types/feedback.ts

/**
 * Feedback Types
 *
 * TypeScript type definitions for the feedback/bug report feature.
 */

// ============================================
// Enums
// ============================================

export type FeedbackCategory = 'feature_request' | 'bug_incorrect_data';

export type FeedbackStatus =
  | 'new'
  | 'under_review'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type VoteType = 'up' | 'down';

// ============================================
// Response Types
// ============================================

/**
 * Brief author information
 */
export interface AuthorBrief {
  id: string;
  full_name: string | null;
}

/**
 * Single feedback item response
 */
export interface FeedbackItem {
  id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  vote_count: number;
  user_vote: VoteType | null; // Current user's vote
  author: AuthorBrief;
  created_at: string;
  updated_at: string;
  admin_response: string | null;
  admin_response_at: string | null;
}

/**
 * Paginated feedback list response
 */
export interface FeedbackListResponse {
  total: number;
  page: number;
  page_size: number;
  items: FeedbackItem[];
}

/**
 * Vote operation response
 */
export interface VoteResponse {
  feedback_id: string;
  vote_type: VoteType | null;
  new_vote_count: number;
}

// ============================================
// Request Types
// ============================================

/**
 * Create feedback request
 */
export interface CreateFeedbackRequest {
  title: string;
  description: string;
  category: FeedbackCategory;
}

/**
 * Update feedback request (partial update)
 */
export interface UpdateFeedbackRequest {
  title?: string;
  description?: string;
}

/**
 * Vote request
 */
export interface VoteRequest {
  vote_type: VoteType;
}

// ============================================
// Filter/Sort Types
// ============================================

export type FeedbackSortField = 'votes' | 'created_at';
export type SortOrder = 'asc' | 'desc';

/**
 * Parameters for listing feedback
 */
export interface FeedbackListParams {
  category?: FeedbackCategory;
  status?: FeedbackStatus;
  sort?: FeedbackSortField;
  order?: SortOrder;
  page?: number;
  page_size?: number;
}

/**
 * Filter state for UI
 */
export interface FeedbackFilters {
  category: FeedbackCategory | null;
  status: FeedbackStatus | null;
  sort: FeedbackSortField;
  order: SortOrder;
}

// ============================================
// UI Helper Types
// ============================================

/**
 * Status display configuration
 */
export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

/**
 * Status display mapping
 */
export const STATUS_CONFIG: Record<FeedbackStatus, StatusConfig> = {
  new: {
    label: 'New',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  under_review: {
    label: 'Under Review',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  planned: {
    label: 'Planned',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
};

/**
 * Category display mapping
 */
export const CATEGORY_CONFIG: Record<FeedbackCategory, { label: string; icon: string }> = {
  feature_request: {
    label: 'Feature Request',
    icon: 'lightbulb',
  },
  bug_incorrect_data: {
    label: 'Bug / Incorrect Data',
    icon: 'bug',
  },
};

// ============================================
// Filter Constants for UI
// ============================================

/**
 * Category options for dropdowns/filters
 */
export const FEEDBACK_CATEGORIES = [
  { value: 'feature_request' as const, label: 'Feature Request' },
  { value: 'bug_incorrect_data' as const, label: 'Bug / Incorrect Data' },
] as const;

/**
 * Status options for dropdowns/filters
 */
export const FEEDBACK_STATUSES = [
  { value: 'new' as const, label: 'New' },
  { value: 'under_review' as const, label: 'Under Review' },
  { value: 'planned' as const, label: 'Planned' },
  { value: 'in_progress' as const, label: 'In Progress' },
  { value: 'completed' as const, label: 'Completed' },
  { value: 'cancelled' as const, label: 'Cancelled' },
] as const;

// ============================================
// Admin Feedback Types
// ============================================

/**
 * Admin feedback item (without user_vote since admin doesn't vote)
 */
export interface AdminFeedbackItem {
  id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  vote_count: number;
  author: AuthorBrief;
  created_at: string;
  updated_at: string;
  admin_response: string | null;
  admin_response_at: string | null;
}

/**
 * Paginated admin feedback list response
 */
export interface AdminFeedbackListResponse {
  total: number;
  page: number;
  page_size: number;
  items: AdminFeedbackItem[];
}

/**
 * Admin feedback update request
 */
export interface AdminFeedbackUpdateRequest {
  status?: FeedbackStatus;
  admin_response?: string;
}

/**
 * Parameters for admin feedback listing
 */
export interface AdminFeedbackListParams {
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  page?: number;
  page_size?: number;
}
